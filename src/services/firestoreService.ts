import type { User } from 'firebase/auth';
import {
  addDoc,
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
  ClassSettings,
  DayOfWeek,
  NotificationType,
  TaskProgressStatus,
  TreasuryCategory,
  TreasuryPaymentStatus,
  TreasuryType,
  UserPublic,
  UserRole,
} from '../types';
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
  isFirstLoginAudit: boolean
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
    const photoURL = (firebaseUser.photoURL || '').slice(0, 500);

    if (existingSnap.exists()) {
      const existingData = normalizeUserPublic(existingSnap.data() as Partial<UserPublic> & { uid: string });
      await updateDoc(ref, {
        displayName: trimmedName,
        nickname: trimmedNick,
        photoURL,
        absenNumber,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncPrivateUserOnLogin(firebaseUser);
      const updatedProfile: UserPublic = {
        ...existingData,
        displayName: trimmedName,
        nickname: trimmedNick,
        photoURL,
        absenNumber,
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
      photoURL,
      absenNumber,
      role: assignedRole,
      status: 'aktif',
      classId: CLASS_ID,
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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

export async function updateMemberRoleAndStatus(
  actor: UserPublic,
  target: UserPublic,
  updates: { role?: 'admin' | 'siswa'; status?: AccountStatus; nickname?: string; displayName?: string; absenNumber?: number }
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

// --- Chat & Admin Messages ---
export async function sendChatMessage(actor: UserPublic, text: string): Promise<void> {
  const err = validateChatText(text);
  if (err) throw new Error(err);
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
      updatedAt: serverTimestamp(),
    });
    await recordActivityLog(actor, 'Ubah Pengaturan Kelas', 'settings', 'Menyimpan konfigurasi Kelas 6A');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function checkFirebaseConnectionLatency(): Promise<{ ok: boolean; latencyMs: number; message: string }> {
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
