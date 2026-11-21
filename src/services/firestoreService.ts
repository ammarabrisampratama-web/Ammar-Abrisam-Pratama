import type { User } from 'firebase/auth';
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { BOOTSTRAPPED_OWNER_EMAIL, db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AccountStatus,
  AdminMessageCategory,
  AdminMessageStatus,
  AgendaStatus,
  AnnouncementCategory,
  AnnouncementPriority,
  Assignment,
  AssignmentPriority,
  ChatMessageType,
  ChatReplyRef,
  ClassSettings,
  DayOfWeek,
  GameId,
  GameIdMap,
  LfgStatus,
  NotificationType,
  ReportCategory,
  ReportStatus,
  TaskProgressStatus,
  TreasuryCategory,
  TreasuryPaymentStatus,
  TreasuryType,
  UserPublic,
  UserRole,
} from '../types';
import {
  buildDefaultPicketSchedules,
  buildDmRoomId,
  GAME_CATALOG,
  GAME_ROOM_IDS,
  OFFICIAL_WHATSAPP_GROUP_URL,
} from '../utils/mediaUtils';
import { inspectMessageSafety, validateReportInput } from '../utils/moderation';
import {
  CLASS_ID,
  DAYS_ORDER,
  DEFAULT_CLASS_SETTINGS,
  getJakartaDateString,
  OFFICIAL_6_DAY_SCHEDULE,
  validateAdminMessageInput,
  validateAgendaInput,
  validateAnnouncementInput,
  validateAssignmentInput,
  validateChatText,
  validatePicketInput,
  validateProfileInput,
  validateScheduleInput,
  validateTreasuryInput,
} from '../utils/validation';

function detectDeviceInfo(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMobile = /Mobile/i.test(ua);
  const os = isAndroid ? 'Android' : isIOS ? 'iOS' : isMobile ? 'Mobile' : 'Desktop';
  const browser = /Edg/i.test(ua)
    ? 'Edge'
    : /Chrome/i.test(ua)
      ? 'Chrome'
      : /Firefox/i.test(ua)
        ? 'Firefox'
        : /Safari/i.test(ua)
          ? 'Safari'
          : 'Browser';
  return `${os} · ${browser}`.slice(0, 160);
}

export async function recordActivityLog(
  actor: Pick<UserPublic, 'uid' | 'displayName' | 'role'>,
  action: string,
  targetCollection: string,
  detail: string
): Promise<void> {
  try {
    await addDoc(collection(db, 'activity_logs'), {
      classId: CLASS_ID,
      actorId: actor.uid,
      actorName: actor.displayName.slice(0, 80),
      actorRole: actor.role,
      action: action.slice(0, 80),
      targetCollection: targetCollection.slice(0, 60),
      detail: detail.slice(0, 300),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Activity log warning:', error);
  }
}

export async function createNotificationEvent(
  actor: Pick<UserPublic, 'uid' | 'displayName'>,
  input: {
    type: NotificationType;
    title: string;
    body: string;
    targetTab: string;
    targetUid?: string;
  }
): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      classId: CLASS_ID,
      type: input.type,
      title: input.title.trim().slice(0, 120),
      body: input.body.trim().slice(0, 300),
      targetTab: input.targetTab.slice(0, 40),
      targetUid: (input.targetUid || 'ALL').slice(0, 128),
      actorId: actor.uid,
      actorName: actor.displayName.slice(0, 80),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Notification publish warning:', error);
  }
}

export async function saveReadNotifications(uid: string, readIds: string[]): Promise<void> {
  const path = `users_private/${uid}/notification_state/main`;
  try {
    await setDoc(doc(db, 'users_private', uid, 'notification_state', 'main'), {
      uid,
      readIds: readIds.slice(0, 200),
      lastReadAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function recordLoginAudit(
  firebaseUser: User,
  profile: Pick<UserPublic, 'displayName' | 'role'>
): Promise<void> {
  const path = 'login_history';
  try {
    await addDoc(collection(db, path), {
      uid: firebaseUser.uid,
      displayName: profile.displayName.slice(0, 80),
      email: (firebaseUser.email || 'unknown@example.com').slice(0, 160),
      role: profile.role,
      deviceInfo: detectDeviceInfo(),
      loggedInAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncPrivateUserOnLogin(firebaseUser: User): Promise<void> {
  const path = `users_private/${firebaseUser.uid}`;
  try {
    const ref = doc(db, 'users_private', firebaseUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        email: (firebaseUser.email || 'unknown@example.com').slice(0, 160),
        lastLoginAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid: firebaseUser.uid,
        email: (firebaseUser.email || 'unknown@example.com').slice(0, 160),
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function normalizeUserPublic(raw: Partial<UserPublic> & { uid: string }): UserPublic {
  const displayName = raw.displayName?.trim() || 'Anggota 6A';
  return {
    uid: raw.uid,
    displayName,
    nickname: raw.nickname?.trim() || displayName.split(' ')[0] || displayName,
    photoURL: raw.photoURL || '',
    absenNumber: typeof raw.absenNumber === 'number' ? raw.absenNumber : 1,
    role: raw.role || 'siswa',
    status: raw.status || 'aktif',
    classId: '6A',
    lastLoginAt: raw.lastLoginAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    bio: typeof raw.bio === 'string' ? raw.bio : '',
    gameIds: raw.gameIds && typeof raw.gameIds === 'object' ? raw.gameIds : {},
    hideOnlineStatus: Boolean(raw.hideOnlineStatus),
  };
}

export async function fetchPublicProfile(uid: string): Promise<UserPublic | null> {
  const path = `users_public/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users_public', uid));
    if (!snap.exists()) return null;
    return normalizeUserPublic(snap.data() as Partial<UserPublic> & { uid: string });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createOrUpdateUserProfile(
  firebaseUser: User,
  displayName: string,
  nickname: string,
  absenNumber: number,
  isFirstLoginAudit: boolean,
  extras?: {
    photoURL?: string;
    bio?: string;
    gameIds?: GameIdMap;
    hideOnlineStatus?: boolean;
  }
): Promise<UserPublic> {
  const isOwnerEmail = firebaseUser.email === BOOTSTRAPPED_OWNER_EMAIL;
  const err = validateProfileInput(displayName, nickname, absenNumber, isOwnerEmail);
  if (err) throw new Error(err);

  const pubPath = `users_public/${firebaseUser.uid}`;
  try {
    const ref = doc(db, 'users_public', firebaseUser.uid);
    const existingSnap = await getDoc(ref);
    const trimmedName = displayName.trim().slice(0, 80);
    const trimmedNick = nickname.trim().slice(0, 40);
    const fallbackPhoto = (firebaseUser.photoURL || '').slice(0, 1000);
    const cleanBio = (extras?.bio ?? '').trim().slice(0, 200);
    const cleanGameIds: GameIdMap = {
      ff: (extras?.gameIds?.ff ?? '').trim().slice(0, 40),
      mlbb: (extras?.gameIds?.mlbb ?? '').trim().slice(0, 40),
      roblox: (extras?.gameIds?.roblox ?? '').trim().slice(0, 40),
      fcMobile: (extras?.gameIds?.fcMobile ?? '').trim().slice(0, 40),
    };

    if (existingSnap.exists()) {
      const existingData = normalizeUserPublic(existingSnap.data() as Partial<UserPublic> & { uid: string });
      const resolvedPhoto = (extras?.photoURL !== undefined ? extras.photoURL : existingData.photoURL || fallbackPhoto).slice(0, 1000);
      const updatePayload: Record<string, unknown> = {
        displayName: trimmedName,
        nickname: trimmedNick,
        photoURL: resolvedPhoto,
        absenNumber,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (extras?.bio !== undefined) updatePayload.bio = cleanBio;
      if (extras?.gameIds !== undefined) updatePayload.gameIds = cleanGameIds;
      if (extras?.hideOnlineStatus !== undefined) updatePayload.hideOnlineStatus = extras.hideOnlineStatus;

      await updateDoc(ref, updatePayload);
      await syncPrivateUserOnLogin(firebaseUser);
      const updatedProfile: UserPublic = {
        ...existingData,
        displayName: trimmedName,
        nickname: trimmedNick,
        photoURL: resolvedPhoto,
        absenNumber,
        bio: extras?.bio !== undefined ? cleanBio : existingData.bio,
        gameIds: extras?.gameIds !== undefined ? cleanGameIds : existingData.gameIds,
        hideOnlineStatus:
          extras?.hideOnlineStatus !== undefined ? extras.hideOnlineStatus : existingData.hideOnlineStatus,
      };
      if (isFirstLoginAudit) {
        await recordLoginAudit(firebaseUser, updatedProfile);
      }
      await recordActivityLog(updatedProfile, 'Perbarui Profil', 'users_public', `Profil diperbarui (${trimmedNick})`);
      return updatedProfile;
    }

    const assignedRole: UserRole = isOwnerEmail ? 'owner' : 'siswa';
    const newProfile: UserPublic = {
      uid: firebaseUser.uid,
      displayName: trimmedName,
      nickname: trimmedNick,
      photoURL: fallbackPhoto,
      absenNumber,
      role: assignedRole,
      status: 'aktif',
      classId: CLASS_ID,
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      bio: cleanBio,
      gameIds: cleanGameIds,
      hideOnlineStatus: Boolean(extras?.hideOnlineStatus),
    };
    await setDoc(ref, newProfile);
    await syncPrivateUserOnLogin(firebaseUser);
    await recordLoginAudit(firebaseUser, newProfile);
    await recordActivityLog(newProfile, 'Registrasi Akun', 'users_public', `${trimmedName} bergabung ke Kelas 6A`);
    return newProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pubPath);
  }
}

export async function updateOnlinePrivacy(uid: string, hideOnlineStatus: boolean): Promise<void> {
  const path = `users_public/${uid}`;
  try {
    await updateDoc(doc(db, 'users_public', uid), {
      hideOnlineStatus,
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'presence', uid), {
      uid,
      isOnline: !hideOnlineStatus,
      hideOnlineStatus,
      lastSeenAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserPresence(
  uid: string,
  isOnline: boolean,
  hideOnlineStatus: boolean
): Promise<void> {
  try {
    await setDoc(doc(db, 'presence', uid), {
      uid,
      isOnline: hideOnlineStatus ? false : isOnline,
      hideOnlineStatus,
      lastSeenAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Presence sync warning:', error);
  }
}

export async function blockClassmate(
  uid: string,
  targetUid: string,
  targetName: string
): Promise<void> {
  if (uid === targetUid) throw new Error('Tidak dapat memblokir akun sendiri.');
  const path = `users_private/${uid}/blocked_users/${targetUid}`;
  try {
    await setDoc(doc(db, 'users_private', uid, 'blocked_users', targetUid), {
      targetUid,
      targetName: targetName.trim().slice(0, 80) || 'Anggota 6A',
      blockedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function unblockClassmate(uid: string, targetUid: string): Promise<void> {
  const path = `users_private/${uid}/blocked_users/${targetUid}`;
  try {
    await deleteDoc(doc(db, 'users_private', uid, 'blocked_users', targetUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateMemberRoleAndStatus(
  actor: UserPublic,
  target: UserPublic,
  updates: {
    role?: 'admin' | 'siswa';
    status?: AccountStatus;
    nickname?: string;
    displayName?: string;
    absenNumber?: number;
  }
): Promise<void> {
  if (actor.role !== 'owner') {
    throw new Error('Hanya Owner yang dapat mengelola akun dan hak akses.');
  }
  if (target.role === 'owner' && updates.role) {
    throw new Error('Hak akses Owner utama tidak dapat diubah.');
  }
  const path = `users_public/${target.uid}`;
  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.role && target.role !== 'owner') payload.role = updates.role;
    if (updates.status && target.role !== 'owner') payload.status = updates.status;
    if (updates.displayName) payload.displayName = updates.displayName.trim().slice(0, 80);
    if (updates.nickname) payload.nickname = updates.nickname.trim().slice(0, 40);
    if (typeof updates.absenNumber === 'number') payload.absenNumber = updates.absenNumber;

    await updateDoc(doc(db, 'users_public', target.uid), payload);
    await recordActivityLog(
      actor,
      'Kelola Pengguna',
      'users_public',
      `Memperbarui akun ${target.displayName} (${updates.role ?? target.role}, status ${updates.status ?? target.status})`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Announcements ---
export async function createAnnouncement(
  actor: UserPublic,
  input: {
    title: string;
    content: string;
    category: AnnouncementCategory;
    priority: AnnouncementPriority;
    pinned: boolean;
  }
): Promise<void> {
  const err = validateAnnouncementInput(input);
  if (err) throw new Error(err);
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw new Error('Hanya Owner atau Admin yang dapat membuat pengumuman.');
  }
  const path = 'announcements';
  try {
    await addDoc(collection(db, path), {
      classId: CLASS_ID,
      title: input.title.trim(),
      content: input.content.trim(),
      category: input.category,
      priority: input.priority,
      pinned: input.pinned,
      archived: false,
      authorId: actor.uid,
      authorName: actor.nickname || actor.displayName,
      authorRole: actor.role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await createNotificationEvent(actor, {
      type: 'pengumuman',
      title: `Pengumuman: ${input.title.trim()}`,
      body: input.content.trim().slice(0, 140),
      targetTab: 'pengumuman',
    });
    await recordActivityLog(actor, 'Buat Pengumuman', 'announcements', input.title.trim());
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateAnnouncement(
  actor: UserPublic,
  id: string,
  updates: Partial<{
    title: string;
    content: string;
    category: AnnouncementCategory;
    priority: AnnouncementPriority;
    pinned: boolean;
    archived: boolean;
  }>
): Promise<void> {
  const path = `announcements/${id}`;
  try {
    await updateDoc(doc(db, 'announcements', id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await recordActivityLog(actor, 'Edit Pengumuman', 'announcements', `Memperbarui pengumuman (${id})`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAnnouncement(actor: UserPublic, id: string, title: string): Promise<void> {
  const path = `announcements/${id}`;
  try {
    await deleteDoc(doc(db, 'announcements', id));
    await recordActivityLog(actor, 'Hapus Pengumuman', 'announcements', title);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Assignments ---
export async function createAssignment(
  actor: UserPublic,
  input: {
    subject: string;
    title: string;
    description: string;
    assignedDate: string;
    dueDate: string;
    priority: AssignmentPriority;
  }
): Promise<void> {
  const err = validateAssignmentInput(input);
  if (err) throw new Error(err);
  const path = 'assignments';
  try {
    await addDoc(collection(db, path), {
      classId: CLASS_ID,
      subject: input.subject.trim(),
      title: input.title.trim(),
      description: input.description.trim(),
      assignedDate: input.assignedDate.trim(),
      dueDate: input.dueDate.trim(),
      priority: input.priority,
      authorId: actor.uid,
      authorName: actor.nickname || actor.displayName,
      authorRole: actor.role,
      editHistory: [`Dibuat oleh ${actor.nickname || actor.displayName} pada ${getJakartaDateString()}`],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await createNotificationEvent(actor, {
      type: 'tugas',
      title: `Tugas Baru (${input.subject.trim()}): ${input.title.trim()}`,
      body: `Tenggat ${input.dueDate.trim()} · ${input.description.trim().slice(0, 120)}`,
      targetTab: 'tugas',
    });
    await recordActivityLog(actor, 'Tambah Tugas', 'assignments', `${input.subject.trim()}: ${input.title.trim()}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateAssignment(
  actor: UserPublic,
  existing: Assignment,
  input: {
    subject: string;
    title: string;
    description: string;
    assignedDate: string;
    dueDate: string;
    priority: AssignmentPriority;
  }
): Promise<void> {
  const err = validateAssignmentInput(input);
  if (err) throw new Error(err);
  const path = `assignments/${existing.id}`;
  const historyNote = `Diedit oleh ${actor.nickname || actor.displayName} pada ${getJakartaDateString()}`;
  const nextHistory = [...(existing.editHistory || []).slice(-19), historyNote];
  try {
    await updateDoc(doc(db, 'assignments', existing.id), {
      subject: input.subject.trim(),
      title: input.title.trim(),
      description: input.description.trim(),
      assignedDate: input.assignedDate.trim(),
      dueDate: input.dueDate.trim(),
      priority: input.priority,
      editHistory: nextHistory,
      updatedAt: serverTimestamp(),
    });
    await recordActivityLog(actor, 'Edit Tugas', 'assignments', input.title.trim());
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAssignment(actor: UserPublic, id: string, title: string): Promise<void> {
  const path = `assignments/${id}`;
  try {
    await deleteDoc(doc(db, 'assignments', id));
    await recordActivityLog(actor, 'Hapus Tugas', 'assignments', title);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function setTaskProgressStatus(
  uid: string,
  taskId: string,
  status: TaskProgressStatus
): Promise<void> {
  const path = `users_private/${uid}/task_progress/${taskId}`;
  try {
    await setDoc(doc(db, 'users_private', uid, 'task_progress', taskId), {
      taskId,
      uid,
      completed: status === 'selesai',
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Schedules ---
export async function createScheduleItem(
  actor: UserPublic,
  input: {
    day: DayOfWeek;
    order: number;
    startTime: string;
    endTime: string;
    subject: string;
    teacher: string;
    room: string;
  }
): Promise<void> {
  const err = validateScheduleInput(input);
  if (err) throw new Error(err);
  const path = 'schedules';
  try {
    await addDoc(collection(db, path), {
      classId: CLASS_ID,
      day: input.day,
      order: input.order,
      startTime: input.startTime.trim(),
      endTime: input.endTime.trim(),
      subject: input.subject.trim(),
      teacher: input.teacher.trim(),
      room: input.room.trim(),
      authorId: actor.uid,
      updatedAt: serverTimestamp(),
    });
    await createNotificationEvent(actor, {
      type: 'jadwal',
      title: `Pembaruan Jadwal ${input.day}`,
      body: `${input.subject.trim()} (jam ke-${input.order})`,
      targetTab: 'jadwal',
    });
    await recordActivityLog(actor, 'Tambah Jadwal', 'schedules', `${input.day}: ${input.subject.trim()}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateScheduleItem(
  actor: UserPublic,
  id: string,
  input: {
    day: DayOfWeek;
    order: number;
    startTime: string;
    endTime: string;
    subject: string;
    teacher: string;
    room: string;
  }
): Promise<void> {
  const err = validateScheduleInput(input);
  if (err) throw new Error(err);
  const path = `schedules/${id}`;
  try {
    await updateDoc(doc(db, 'schedules', id), {
      day: input.day,
      order: input.order,
      startTime: input.startTime.trim(),
      endTime: input.endTime.trim(),
      subject: input.subject.trim(),
      teacher: input.teacher.trim(),
      room: input.room.trim(),
      updatedAt: serverTimestamp(),
    });
    await createNotificationEvent(actor, {
      type: 'jadwal',
      title: `Perubahan Jadwal ${input.day}`,
      body: `${input.subject.trim()} diperbarui.`,
      targetTab: 'jadwal',
    });
    await recordActivityLog(actor, 'Edit Jadwal', 'schedules', `${input.day}: ${input.subject.trim()}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteScheduleItem(actor: UserPublic, id: string, subject: string): Promise<void> {
  const path = `schedules/${id}`;
  try {
    await deleteDoc(doc(db, 'schedules', id));
    await recordActivityLog(actor, 'Hapus Jadwal', 'schedules', subject);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function initializeOfficial6DaySchedule(
  actor: UserPublic,
  existingScheduleIds: string[] = []
): Promise<void> {
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw new Error('Hanya Owner atau Admin yang dapat mengisi jadwal resmi 6 hari.');
  }
  const batch = writeBatch(db);
  for (const oldId of existingScheduleIds) {
    if (!oldId.startsWith('default-')) {
      batch.delete(doc(db, 'schedules', oldId));
    }
  }
  for (const day of DAYS_ORDER) {
    const subjects = OFFICIAL_6_DAY_SCHEDULE[day];
    subjects.forEach((subject, idx) => {
      const ref = doc(collection(db, 'schedules'));
      batch.set(ref, {
        classId: CLASS_ID,
        day,
        order: idx + 1,
        startTime: '',
        endTime: '',
        subject,
        teacher: '',
        room: 'Ruang 6A',
        authorId: actor.uid,
        updatedAt: serverTimestamp(),
      });
    });
  }
  try {
    await batch.commit();
    await createNotificationEvent(actor, {
      type: 'jadwal',
      title: 'Jadwal Pelajaran 6 Hari Tersedia',
      body: 'Jadwal resmi Senin–Sabtu Kelas 6A telah disinkronkan.',
      targetTab: 'jadwal',
    });
    await recordActivityLog(
      actor,
      existingScheduleIds.length > 0 ? 'Sinkronkan Jadwal Resmi 6 Hari' : 'Inisialisasi Jadwal 6 Hari',
      'schedules',
      'Menerapkan jadwal resmi Senin–Sabtu Kelas 6A'
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'schedules_batch');
  }
}

// --- Jadwal Piket ---
export async function savePicketSchedule(
  actor: UserPublic,
  input: {
    day: DayOfWeek;
    students: string[];
    tasks: string[];
    coordinator: string;
    note: string;
  }
): Promise<void> {
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw new Error('Hanya Owner atau Admin yang dapat mengatur Jadwal Piket.');
  }
  const cleanStudents = input.students.map((s) => s.trim()).filter(Boolean).slice(0, 20);
  const cleanTasks = input.tasks.map((t) => t.trim()).filter(Boolean).slice(0, 15);
  const err = validatePicketInput({ ...input, students: cleanStudents, tasks: cleanTasks });
  if (err) throw new Error(err);

  const picketId = input.day.toLowerCase();
  const path = `picket_schedules/${picketId}`;
  try {
    await setDoc(doc(db, 'picket_schedules', picketId), {
      classId: CLASS_ID,
      day: input.day,
      students: cleanStudents,
      tasks: cleanTasks,
      coordinator: input.coordinator.trim().slice(0, 80),
      note: input.note.trim().slice(0, 200),
      updatedById: actor.uid,
      updatedAt: serverTimestamp(),
    });
    await recordActivityLog(actor, 'Perbarui Jadwal Piket', 'picket_schedules', `Piket hari ${input.day}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function initializeDefaultPicketSchedules(actor: UserPublic): Promise<void> {
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw new Error('Hanya Owner atau Admin yang dapat menyinkronkan template Jadwal Piket.');
  }
  const defaults = buildDefaultPicketSchedules();
  const batch = writeBatch(db);
  for (const item of defaults) {
    batch.set(doc(db, 'picket_schedules', item.id), {
      classId: CLASS_ID,
      day: item.day,
      students: item.students,
      tasks: item.tasks,
      coordinator: item.coordinator,
      note: item.note,
      updatedById: actor.uid,
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
    await recordActivityLog(actor, 'Inisialisasi Jadwal Piket', 'picket_schedules', 'Template Senin–Sabtu');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'picket_schedules_batch');
  }
}

// --- Agendas ---
export async function createAgendaItem(
  actor: UserPublic,
  input: {
    title: string;
    description: string;
    eventDate: string;
    eventTime: string;
    location: string;
  }
): Promise<void> {
  const err = validateAgendaInput(input);
  if (err) throw new Error(err);
  const path = 'agendas';
  try {
    await addDoc(collection(db, path), {
      classId: CLASS_ID,
      title: input.title.trim(),
      description: input.description.trim(),
      eventDate: input.eventDate.trim(),
      eventTime: input.eventTime.trim(),
      location: input.location.trim(),
      status: 'mendatang',
      authorId: actor.uid,
      authorName: actor.nickname || actor.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await createNotificationEvent(actor, {
      type: 'agenda',
      title: `Agenda Baru: ${input.title.trim()}`,
      body: `${input.eventDate.trim()} · ${input.location.trim()}`,
      targetTab: 'agenda',
    });
    await recordActivityLog(actor, 'Tambah Agenda', 'agendas', input.title.trim());
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateAgendaItem(
  actor: UserPublic,
  id: string,
  input: {
    title: string;
    description: string;
    eventDate: string;
    eventTime: string;
    location: string;
    status: AgendaStatus;
  }
): Promise<void> {
  const err = validateAgendaInput(input);
  if (err) throw new Error(err);
  const path = `agendas/${id}`;
  try {
    await updateDoc(doc(db, 'agendas', id), {
      title: input.title.trim(),
      description: input.description.trim(),
      eventDate: input.eventDate.trim(),
      eventTime: input.eventTime.trim(),
      location: input.location.trim(),
      status: input.status,
      updatedAt: serverTimestamp(),
    });
    await recordActivityLog(actor, 'Edit Agenda', 'agendas', input.title.trim());
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAgendaItem(actor: UserPublic, id: string, title: string): Promise<void> {
  const path = `agendas/${id}`;
  try {
    await deleteDoc(doc(db, 'agendas', id));
    await recordActivityLog(actor, 'Hapus Agenda', 'agendas', title);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Treasury ---
export async function createTreasuryEntry(
  actor: UserPublic,
  input: {
    type: TreasuryType;
    amount: number;
    description: string;
    category: TreasuryCategory;
    studentName: string;
    paymentStatus: TreasuryPaymentStatus;
    correctionNote: string;
    date: string;
  }
): Promise<void> {
  const err = validateTreasuryInput(input);
  if (err) throw new Error(err);
  const path = 'treasury';
  try {
    await addDoc(collection(db, path), {
      classId: CLASS_ID,
      type: input.type,
      amount: Math.round(input.amount),
      description: input.description.trim(),
      category: input.category,
      studentName: input.studentName.trim(),
      paymentStatus: input.paymentStatus,
      correctionNote: input.correctionNote.trim(),
      date: input.date.trim(),
      recordedById: actor.uid,
      recordedByName: actor.nickname || actor.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await recordActivityLog(
      actor,
      'Catat Uang Kas',
      'treasury',
      `${input.type} Rp ${Math.round(input.amount).toLocaleString('id-ID')} (${input.description.trim()})`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTreasuryEntry(
  actor: UserPublic,
  id: string,
  input: {
    type: TreasuryType;
    amount: number;
    description: string;
    category: TreasuryCategory;
    studentName: string;
    paymentStatus: TreasuryPaymentStatus;
    correctionNote: string;
    date: string;
  }
): Promise<void> {
  if (!input.correctionNote.trim()) {
    throw new Error('Wajib menyertakan catatan koreksi audit saat mengubah transaksi kas.');
  }
  const err = validateTreasuryInput(input);
  if (err) throw new Error(err);
  const path = `treasury/${id}`;
  try {
    await updateDoc(doc(db, 'treasury', id), {
      type: input.type,
      amount: Math.round(input.amount),
      description: input.description.trim(),
      category: input.category,
      studentName: input.studentName.trim(),
      paymentStatus: input.paymentStatus,
      correctionNote: input.correctionNote.trim(),
      date: input.date.trim(),
      updatedAt: serverTimestamp(),
    });
    await recordActivityLog(actor, 'Koreksi Kas', 'treasury', `${input.description.trim()} — Alasan: ${input.correctionNote.trim()}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTreasuryEntry(actor: UserPublic, id: string, desc: string): Promise<void> {
  const path = `treasury/${id}`;
  try {
    await deleteDoc(doc(db, 'treasury', id));
    await recordActivityLog(actor, 'Hapus Kas', 'treasury', desc);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Legacy Chat + Upgraded WhatsApp-Style Chat Rooms ---
export async function sendChatMessage(actor: UserPublic, text: string): Promise<void> {
  const err = validateChatText(text);
  if (err) throw new Error(err);
  const safety = inspectMessageSafety(text, { isPublicRoom: true });
  if (!safety.allowed) throw new Error(safety.reason);

  const path = 'chat_messages';
  try {
    await addDoc(collection(db, path), {
      classId: CLASS_ID,
      senderId: actor.uid,
      senderName: actor.nickname || actor.displayName,
      senderRole: actor.role,
      text: text.trim(),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteChatMessage(id: string): Promise<void> {
  const path = `chat_messages/${id}`;
  try {
    await deleteDoc(doc(db, 'chat_messages', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function getSystemRoomDefinition(roomId: string): {
  type: 'class' | 'game';
  name: string;
  description: string;
  gameId: string;
} | null {
  if (roomId === 'kelas-6a') {
    return {
      type: 'class',
      name: 'Grup Utama Kelas 6A',
      description: 'Ruang diskusi resmi seluruh siswa, Admin, dan Wali Kelas 6A MI Al-Hidayah Sawotratap.',
      gameId: '',
    };
  }
  const gameEntry = GAME_CATALOG.find((g) => GAME_ROOM_IDS[g.gameId] === roomId);
  if (gameEntry) {
    return {
      type: 'game',
      name: `Chat Mabar ${gameEntry.shortName}`,
      description: gameEntry.description,
      gameId: gameEntry.gameId,
    };
  }
  return null;
}

export async function ensureSystemChatRoom(roomId: string, actor: UserPublic): Promise<void> {
  const def = getSystemRoomDefinition(roomId);
  if (!def) return;
  const ref = doc(db, 'chat_rooms', roomId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        roomId,
        classId: CLASS_ID,
        type: def.type,
        name: def.name,
        description: def.description,
        gameId: def.gameId,
        participantIds: [],
        pinnedMessageId: '',
        pinnedText: '',
        pinnedByName: '',
        lastMessageText: def.description.slice(0, 120),
        lastMessageSenderId: '',
        lastMessageAt: serverTimestamp(),
        createdBy: actor.uid,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Ensure system room warning:', error);
  }
}

export async function ensureDmRoom(actor: UserPublic, targetUser: UserPublic): Promise<string> {
  const dmId = buildDmRoomId(actor.uid, targetUser.uid);
  const path = `chat_rooms/${dmId}`;
  try {
    const ref = doc(db, 'chat_rooms', dmId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const participants = [actor.uid, targetUser.uid].sort();
      await setDoc(ref, {
        roomId: dmId,
        classId: CLASS_ID,
        type: 'dm',
        name: `${actor.nickname || actor.displayName} ↔ ${targetUser.nickname || targetUser.displayName}`.slice(0, 100),
        description: 'Percakapan pribadi antarsiswa Kelas 6A',
        gameId: '',
        participantIds: participants,
        pinnedMessageId: '',
        pinnedText: '',
        pinnedByName: '',
        lastMessageText: 'Percakapan pribadi dimulai',
        lastMessageSenderId: '',
        lastMessageAt: serverTimestamp(),
        createdBy: actor.uid,
        updatedAt: serverTimestamp(),
      });
    }
    return dmId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createCustomGroupRoom(
  actor: UserPublic,
  name: string,
  description: string
): Promise<string> {
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw new Error('Hanya Owner atau Admin yang dapat membuat grup diskusi kelas baru.');
  }
  const cleanName = name.trim().slice(0, 100);
  if (cleanName.length < 3) throw new Error('Nama grup minimal 3 karakter.');
  const roomId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const path = `chat_rooms/${roomId}`;
  try {
    await setDoc(doc(db, 'chat_rooms', roomId), {
      roomId,
      classId: CLASS_ID,
      type: 'group',
      name: cleanName,
      description: description.trim().slice(0, 240) || 'Grup diskusi tambahan Kelas 6A',
      gameId: '',
      participantIds: [],
      pinnedMessageId: '',
      pinnedText: '',
      pinnedByName: '',
      lastMessageText: 'Grup dibuat',
      lastMessageSenderId: actor.uid,
      lastMessageAt: serverTimestamp(),
      createdBy: actor.uid,
      updatedAt: serverTimestamp(),
    });
    await recordActivityLog(actor, 'Buat Grup Chat', 'chat_rooms', cleanName);
    return roomId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCustomGroupRoom(
  actor: UserPublic,
  roomId: string,
  roomName: string
): Promise<void> {
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw new Error('Hanya Owner atau Admin yang dapat menghapus grup.');
  }
  const path = `chat_rooms/${roomId}`;
  try {
    await deleteDoc(doc(db, 'chat_rooms', roomId));
    await recordActivityLog(actor, 'Hapus Grup Chat', 'chat_rooms', roomName);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function sendRoomMessage(
  actor: UserPublic,
  input: {
    roomId: string;
    isPublicRoom: boolean;
    messageType: ChatMessageType;
    text: string;
    mediaUrls?: string[];
    mediaNames?: string[];
    mediaDurationSec?: number;
    replyTo?: ChatReplyRef | null;
    forwardedFrom?: string;
  }
): Promise<void> {
  const cleanText = input.text.trim().slice(0, 1500);
  const mediaUrls = (input.mediaUrls ?? []).slice(0, 5);
  const mediaNames = (input.mediaNames ?? []).slice(0, 5);
  if (input.messageType === 'text' && !cleanText) {
    throw new Error('Pesan teks tidak boleh kosong.');
  }
  if (input.messageType !== 'text' && mediaUrls.length === 0) {
    throw new Error('File media belum siap dikirim.');
  }
  if (cleanText) {
    const safety = inspectMessageSafety(cleanText, { isPublicRoom: input.isPublicRoom });
    if (!safety.allowed) {
      throw new Error(safety.reason || 'Pesan ditolak oleh sistem moderasi keamanan.');
    }
  }

  await ensureSystemChatRoom(input.roomId, actor);

  const path = `chat_rooms/${input.roomId}/messages`;
  try {
    const cleanReply: ChatReplyRef | null = input.replyTo
      ? {
          id: input.replyTo.id.slice(0, 128),
          senderName: input.replyTo.senderName.slice(0, 80),
          text: input.replyTo.text.slice(0, 200),
          messageType: input.replyTo.messageType,
        }
      : null;

    await addDoc(collection(db, 'chat_rooms', input.roomId, 'messages'), {
      roomId: input.roomId,
      classId: CLASS_ID,
      senderId: actor.uid,
      senderName: (actor.nickname || actor.displayName).slice(0, 80),
      senderRole: actor.role,
      senderPhoto: (actor.photoURL || '').slice(0, 1000),
      messageType: input.messageType,
      text: cleanText,
      mediaUrls,
      mediaNames,
      mediaDurationSec: Math.max(0, Math.min(600, Math.round(input.mediaDurationSec ?? 0))),
      replyTo: cleanReply,
      forwardedFrom: (input.forwardedFrom ?? '').slice(0, 100),
      reactions: {},
      readBy: [actor.uid],
      deleted: false,
      moderatedBy: '',
      editedAt: null,
      createdAt: serverTimestamp(),
    });

    const summaryText =
      input.messageType === 'audio'
        ? '🎤 Pesan suara'
        : input.messageType === 'image'
          ? `📷 Foto${cleanText ? `: ${cleanText}` : ''}`
          : input.messageType === 'video'
            ? `🎥 Video${cleanText ? `: ${cleanText}` : ''}`
            : cleanText;

    await updateDoc(doc(db, 'chat_rooms', input.roomId), {
      lastMessageText: summaryText.slice(0, 240),
      lastMessageSenderId: actor.uid,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function editRoomMessage(
  actor: UserPublic,
  roomId: string,
  messageId: string,
  newText: string,
  isPublicRoom: boolean
): Promise<void> {
  const clean = newText.trim().slice(0, 1500);
  if (!clean) throw new Error('Teks pesan tidak boleh kosong.');
  const safety = inspectMessageSafety(clean, { isPublicRoom });
  if (!safety.allowed) throw new Error(safety.reason);

  const path = `chat_rooms/${roomId}/messages/${messageId}`;
  try {
    await updateDoc(doc(db, 'chat_rooms', roomId, 'messages', messageId), {
      text: clean,
      editedAt: serverTimestamp(),
    });
    await recordActivityLog(actor, 'Edit Pesan Chat', 'chat_rooms', `Room ${roomId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function softDeleteRoomMessage(
  actor: UserPublic,
  roomId: string,
  messageId: string,
  isModeration: boolean
): Promise<void> {
  const path = `chat_rooms/${roomId}/messages/${messageId}`;
  const label = isModeration
    ? `Pesan dihapus oleh moderator (${actor.nickname || actor.displayName})`
    : 'Pesan ini telah dihapus';
  try {
    await updateDoc(doc(db, 'chat_rooms', roomId, 'messages', messageId), {
      deleted: true,
      text: label,
      mediaUrls: [],
      moderatedBy: isModeration ? (actor.nickname || actor.displayName).slice(0, 80) : '',
    });
    if (isModeration) {
      await recordActivityLog(actor, 'Moderasi Hapus Pesan', 'chat_rooms', `Menghapus pesan di room ${roomId}`);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleMessageReaction(
  roomId: string,
  messageId: string,
  uid: string,
  emoji: string,
  currentReactions: Record<string, string[]>
): Promise<void> {
  const next: Record<string, string[]> = {};
  for (const [key, uids] of Object.entries(currentReactions || {})) {
    const cleanList = Array.isArray(uids) ? uids.filter((id) => id !== uid) : [];
    if (cleanList.length > 0) {
      next[key] = cleanList;
    }
  }
  const alreadyHadSame = Array.isArray(currentReactions?.[emoji]) && currentReactions[emoji].includes(uid);
  if (!alreadyHadSame) {
    next[emoji] = [...(next[emoji] ?? []), uid].slice(0, 60);
  }
  try {
    await updateDoc(doc(db, 'chat_rooms', roomId, 'messages', messageId), {
      reactions: next,
    });
  } catch (error) {
    console.error('Reaction update warning:', error);
  }
}

export async function markRoomMessageRead(
  roomId: string,
  messageId: string,
  uid: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'chat_rooms', roomId, 'messages', messageId), {
      readBy: arrayUnion(uid),
    });
  } catch (error) {
    console.error('Read receipt warning:', error);
  }
}

export async function pinRoomMessage(
  actor: UserPublic,
  roomId: string,
  messageId: string,
  pinnedText: string
): Promise<void> {
  const path = `chat_rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'chat_rooms', roomId), {
      pinnedMessageId: messageId.slice(0, 128),
      pinnedText: pinnedText.trim().slice(0, 300),
      pinnedByName: (actor.nickname || actor.displayName).slice(0, 80),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function unpinRoomMessage(roomId: string): Promise<void> {
  const path = `chat_rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'chat_rooms', roomId), {
      pinnedMessageId: '',
      pinnedText: '',
      pinnedByName: '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function setTypingStatus(
  roomId: string,
  actor: UserPublic,
  isTyping: boolean
): Promise<void> {
  const ref = doc(db, 'chat_rooms', roomId, 'typing', actor.uid);
  try {
    if (isTyping) {
      await setDoc(ref, {
        uid: actor.uid,
        displayName: (actor.nickname || actor.displayName).slice(0, 80),
        updatedAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(ref);
    }
  } catch {
    // Ephemeral typing failure is non-fatal
  }
}

// --- Game Center ---
export async function joinOrUpdateGameCommunity(
  actor: UserPublic,
  gameId: GameId,
  input: {
    inGameName: string;
    inGameId: string;
    lfgStatus: LfgStatus;
    lfgNote: string;
  },
  isAlreadyMember: boolean
): Promise<void> {
  const safety = inspectMessageSafety(`${input.inGameName} ${input.inGameId} ${input.lfgNote}`, {
    isPublicRoom: true,
  });
  if (!safety.allowed) throw new Error(safety.reason);

  const path = `game_communities/${gameId}/members/${actor.uid}`;
  const ref = doc(db, 'game_communities', gameId, 'members', actor.uid);
  try {
    if (isAlreadyMember) {
      await updateDoc(ref, {
        displayName: actor.displayName.slice(0, 80),
        nickname: (actor.nickname || actor.displayName).slice(0, 40),
        photoURL: (actor.photoURL || '').slice(0, 1000),
        role: actor.role,
        inGameName: input.inGameName.trim().slice(0, 50),
        inGameId: input.inGameId.trim().slice(0, 50),
        lfgStatus: input.lfgStatus,
        lfgNote: input.lfgNote.trim().slice(0, 120),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid: actor.uid,
        gameId,
        classId: CLASS_ID,
        displayName: actor.displayName.slice(0, 80),
        nickname: (actor.nickname || actor.displayName).slice(0, 40),
        photoURL: (actor.photoURL || '').slice(0, 1000),
        role: actor.role,
        inGameName: input.inGameName.trim().slice(0, 50),
        inGameId: input.inGameId.trim().slice(0, 50),
        lfgStatus: input.lfgStatus,
        lfgNote: input.lfgNote.trim().slice(0, 120),
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await recordActivityLog(actor, 'Gabung Komunitas Game', 'game_communities', gameId.toUpperCase());
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function leaveGameCommunity(actor: UserPublic, gameId: GameId): Promise<void> {
  const path = `game_communities/${gameId}/members/${actor.uid}`;
  try {
    await deleteDoc(doc(db, 'game_communities', gameId, 'members', actor.uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function removeGameMemberByMod(
  actor: UserPublic,
  gameId: GameId,
  targetUid: string,
  targetName: string
): Promise<void> {
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw new Error('Hanya Owner atau Admin yang dapat mengeluarkan anggota komunitas.');
  }
  const path = `game_communities/${gameId}/members/${targetUid}`;
  try {
    await deleteDoc(doc(db, 'game_communities', gameId, 'members', targetUid));
    await recordActivityLog(
      actor,
      'Moderasi Komunitas Game',
      'game_communities',
      `Mengeluarkan ${targetName} dari ${gameId}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createGamePost(
  actor: UserPublic,
  gameId: GameId,
  input: {
    type: 'update' | 'pengumuman';
    title: string;
    content: string;
    pinned: boolean;
  }
): Promise<void> {
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw new Error('Hanya Owner atau Admin yang dapat memposting update/pengumuman game.');
  }
  const title = input.title.trim();
  const content = input.content.trim();
  if (title.length < 3 || title.length > 120) throw new Error('Judul harus 3–120 karakter.');
  if (content.length < 3 || content.length > 1500) throw new Error('Konten harus 3–1500 karakter.');

  const path = `game_communities/${gameId}/posts`;
  try {
    await addDoc(collection(db, 'game_communities', gameId, 'posts'), {
      gameId,
      classId: CLASS_ID,
      type: input.type,
      title,
      content,
      pinned: input.pinned,
      authorId: actor.uid,
      authorName: (actor.nickname || actor.displayName).slice(0, 80),
      authorRole: actor.role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await createNotificationEvent(actor, {
      type: 'game',
      title: `Game Center (${gameId.toUpperCase()}): ${title}`,
      body: content.slice(0, 140),
      targetTab: 'game-center',
    });
    await recordActivityLog(actor, 'Buat Info Game', 'game_communities', `${gameId}: ${title}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteGamePost(
  actor: UserPublic,
  gameId: GameId,
  postId: string,
  title: string
): Promise<void> {
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw new Error('Hanya Owner atau Admin yang dapat menghapus info game.');
  }
  const path = `game_communities/${gameId}/posts/${postId}`;
  try {
    await deleteDoc(doc(db, 'game_communities', gameId, 'posts', postId));
    await recordActivityLog(actor, 'Hapus Info Game', 'game_communities', `${gameId}: ${title}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Moderation & Reports ---
export async function submitUserReport(
  actor: UserPublic,
  input: {
    targetUid: string;
    targetName: string;
    roomId?: string;
    messageId?: string;
    messageExcerpt?: string;
    category: ReportCategory;
    reason: string;
  }
): Promise<void> {
  const err = validateReportInput(input);
  if (err) throw new Error(err);

  const path = 'user_reports';
  try {
    await addDoc(collection(db, 'user_reports'), {
      classId: CLASS_ID,
      reporterId: actor.uid,
      reporterName: (actor.nickname || actor.displayName).slice(0, 80),
      targetUid: input.targetUid.slice(0, 128),
      targetName: input.targetName.trim().slice(0, 80) || 'Anggota',
      roomId: (input.roomId ?? '').slice(0, 128),
      messageId: (input.messageId ?? '').slice(0, 128),
      messageExcerpt: (input.messageExcerpt ?? '').slice(0, 300),
      category: input.category,
      reason: input.reason.trim().slice(0, 500),
      status: 'menunggu',
      resolutionNote: '',
      resolvedBy: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await recordActivityLog(
      actor,
      'Kirim Laporan Moderasi',
      'user_reports',
      `Melaporkan ${input.targetName} (${input.category})`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function resolveUserReport(
  actor: UserPublic,
  reportId: string,
  status: ReportStatus,
  resolutionNote: string
): Promise<void> {
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw new Error('Hanya Owner atau Admin yang dapat menindaklanjuti laporan.');
  }
  const path = `user_reports/${reportId}`;
  try {
    await updateDoc(doc(db, 'user_reports', reportId), {
      status,
      resolutionNote: resolutionNote.trim().slice(0, 300),
      resolvedBy: (actor.nickname || actor.displayName).slice(0, 80),
      updatedAt: serverTimestamp(),
    });
    await recordActivityLog(actor, 'Tindak Laporan Moderasi', 'user_reports', `${reportId} (${status})`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Admin Messages ---
export async function sendAdminMessage(
  actor: UserPublic,
  input: { category: AdminMessageCategory; subject: string; message: string }
): Promise<void> {
  const err = validateAdminMessageInput(input);
  if (err) throw new Error(err);
  const path = 'admin_messages';
  try {
    await addDoc(collection(db, path), {
      classId: CLASS_ID,
      senderId: actor.uid,
      senderName: actor.nickname || actor.displayName,
      category: input.category,
      subject: input.subject.trim(),
      message: input.message.trim(),
      status: 'menunggu',
      adminReply: '',
      repliedBy: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await recordActivityLog(actor, 'Kirim Pesan Admin', 'admin_messages', input.subject.trim());
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function replyAdminMessage(
  actor: UserPublic,
  msgId: string,
  senderId: string,
  subject: string,
  status: AdminMessageStatus,
  adminReply: string
): Promise<void> {
  if (adminReply.trim().length > 1500) {
    throw new Error('Balasan maksimal 1500 karakter.');
  }
  const path = `admin_messages/${msgId}`;
  try {
    await updateDoc(doc(db, 'admin_messages', msgId), {
      status,
      adminReply: adminReply.trim(),
      repliedBy: actor.nickname || actor.displayName,
      updatedAt: serverTimestamp(),
    });
    await createNotificationEvent(actor, {
      type: 'pesan-admin',
      title: `Balasan Pesan: ${subject}`,
      body: adminReply.trim() || `Status diperbarui menjadi ${status}.`,
      targetTab: 'pesan-admin',
      targetUid: senderId,
    });
    await recordActivityLog(actor, 'Balas Pesan Admin', 'admin_messages', `${subject} (${status})`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Settings & Diagnostics ---
export async function saveClassSettings(
  actor: UserPublic,
  settings: Omit<ClassSettings, 'updatedAt'>
): Promise<void> {
  if (actor.role !== 'owner') {
    throw new Error('Hanya Owner yang dapat mengubah pengaturan kelas dan aplikasi.');
  }
  const path = 'settings/class_config';
  try {
    await setDoc(doc(db, 'settings', 'class_config'), {
      ...DEFAULT_CLASS_SETTINGS,
      ...settings,
      classId: CLASS_ID,
      weeklyKasTarget: Math.max(0, Math.round(settings.weeklyKasTarget)),
      whatsappGroupUrl: (settings.whatsappGroupUrl || OFFICIAL_WHATSAPP_GROUP_URL).trim().slice(0, 300),
      allowGameCenter: settings.allowGameCenter ?? true,
      allowVoiceNotes: settings.allowVoiceNotes ?? true,
      allowMediaUpload: settings.allowMediaUpload ?? true,
      allowPrivateChat: settings.allowPrivateChat ?? true,
      updatedAt: serverTimestamp(),
    });
    await recordActivityLog(actor, 'Ubah Pengaturan Kelas', 'settings', 'Menyimpan konfigurasi Kelas 6A');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function checkFirebaseConnectionLatency(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  const start = performance.now();
  try {
    await getDocFromServer(doc(db, 'settings', 'class_config'));
    return {
      ok: true,
      latencyMs: Math.round(performance.now() - start),
      message: 'Terhubung langsung ke server Cloud Firestore.',
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('permission-denied')) {
      return {
        ok: true,
        latencyMs: Math.round(performance.now() - start),
        message: 'Server Cloud Firestore merespons aktif (akses terproteksi Rules).',
      };
    }
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      message: msg,
    };
  }
}
