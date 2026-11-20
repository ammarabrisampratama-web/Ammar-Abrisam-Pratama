# Security Specification — Kelas 6A MI Al-Hidayah Sawotratap

## 1. Data Invariants
1. **Authenticated & Verified Access Only**: Unauthenticated requests (`request.auth == null`) and unverified emails (`request.auth.token.email_verified != true`) are denied across the entire database.
2. **No Public Access / No Owner Secret Exposure**: No collection is publicly readable or writable. No Owner PIN or password is stored in readable documents or exposed to students.
3. **Role Integrity (Anti-Privilege-Escalation)**: Users creating their own `users_public/{userId}` document may only assign `role: "siswa"` unless their verified token email matches the bootstrapped Owner (`ammarabrisampratama@gmail.com`). Users cannot modify their own `role`. Only the Owner can promote or demote `admin` and `siswa`.
4. **PII Isolation**: User email addresses are isolated in `users_private/{userId}` and `login_history/{logId}`. Students cannot read other users' private profiles or `login_history`.
5. **Owner-Only Login History**: `login_history` is readable (`get` and `list`) strictly by Owner. Users may only append a login log for their own `uid` with `loggedInAt == request.time`.
6. **Student Private Messages to Admin**: Students may create `admin_messages` with `senderId == request.auth.uid` and `status == "menunggu"` and empty `adminReply`, and may read (`get` / `list`) only their own messages. Only Owner and Admin may read all `admin_messages` or update `status`, `adminReply`, and `repliedBy`.
7. **Academic & Treasury Authoring**: Announcements, Assignments, Schedules, Agendas, and Treasury entries can only be created, updated, or deleted by Owner or Admin.
8. **Chat Identity & Moderation**: Signed-in verified members may send `chat_messages` where `senderId == request.auth.uid` and `createdAt == request.time`. Only the message sender, Admin, or Owner may delete a chat message.
9. **Temporal & Schema Integrity**: Every create/update validates `isValidId()`, exact key allowlists (`hasAll`/`hasOnly` on create, `affectedKeys().hasOnly(...)` on update), strict string lengths, regex patterns, and server timestamps (`request.time`).

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read on Announcements**: `auth: null` -> `get /announcements/ann_1` -> DENIED.
2. **Self-Role Escalation on Registration**: `auth: { uid: "s1", email: "siswa@example.com", email_verified: true }` -> `create /users_public/s1` with `{ role: "owner", ... }` -> DENIED.
3. **Self-Role Update Escalation**: `auth: { uid: "s1" }` -> `update /users_public/s1` with `{ role: "admin" }` -> DENIED.
4. **PII Blanket Read by Student**: `auth: { uid: "s1" }` -> `get /users_private/s2` -> DENIED.
5. **Student Reading Login History**: `auth: { uid: "s1" }` -> `list /login_history` -> DENIED.
6. **Admin Reading Login History**: `auth: { uid: "a1", role: "admin" }` -> `list /login_history` -> DENIED.
7. **Shadow Field Injection on Chat**: `auth: { uid: "s1" }` -> `create /chat_messages/m1` with `{ ..., isVerified: true }` -> DENIED.
8. **Sender Spoofing in Chat**: `auth: { uid: "s1" }` -> `create /chat_messages/m1` with `{ senderId: "owner_uid", ... }` -> DENIED.
9. **Timestamp Forgery on Announcement**: `auth: { uid: "owner" }` -> `create /announcements/a1` with client-backdated `createdAt` (`!= request.time`) -> DENIED.
10. **Student Creating Treasury Entry**: `auth: { uid: "s1", role: "siswa" }` -> `create /treasury/t1` -> DENIED.
11. **Student Reading Another Student's Admin Message**: `auth: { uid: "s1" }` -> `get /admin_messages/msg_from_s2` -> DENIED.
12. **Path Variable ID Poisoning**: `auth: { uid: "owner" }` -> `create /announcements/bad$id*12345` -> DENIED by `isValidId()`.
