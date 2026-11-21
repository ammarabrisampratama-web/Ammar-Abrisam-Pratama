import type {
  AdminMessage,
  AdminMessageCategory,
  AgendaItem,
  Announcement,
  AnnouncementCategory,
  AnnouncementPriority,
  Assignment,
  AssignmentPriority,
  ChatMessage,
  ClassSettings,
  DayOfWeek,
  DerivedTaskStatus,
  GlobalSearchResult,
  NavTab,
  PicketScheduleItem,
  ScheduleItem,
  TaskProgressStatus,
  TreasuryCategory,
  TreasuryEntry,
  TreasuryPaymentStatus,
  TreasuryType,
  UserPublic,
  UserRole,
} from '../types';
import { OFFICIAL_WHATSAPP_GROUP_URL, GAME_CATALOG } from './mediaUtils';

export const CLASS_ID = '6A' as const;
export const SCHOOL_NAME = 'MI Al-Hidayah Sawotratap';
export const CLASS_TITLE = 'Kelas 6A';
export const JAKARTA_TZ = 'Asia/Jakarta';

export const DEFAULT_CLASS_SETTINGS: Omit<ClassSettings, 'updatedAt'> = {
  classId: '6A',
  homeroomTeacher: 'Wali Kelas 6A',
  academicYear: '2026/2027',
  motto: 'Berilmu, Berakhlak Mulia, dan Berprestasi',
  adminContactNote: 'Hubungi Pengurus Kelas atau Wali Kelas melalui menu Pesan Admin.',
  weeklyKasTarget: 5000,
  allowStudentCreateTask: true,
  allowStudentCreateAgenda: true,
  allowAdminManageTreasury: true,
  allowAdminManageSchedule: true,
  whatsappGroupUrl: OFFICIAL_WHATSAPP_GROUP_URL,
  allowGameCenter: true,
  allowVoiceNotes: true,
  allowMediaUpload: true,
  allowPrivateChat: true,
};

// Official 6-day curriculum for Kelas 6A MI Al-Hidayah Sawotratap (times empty until configured by Owner)
export const OFFICIAL_6_DAY_SCHEDULE: Record<DayOfWeek, string[]> = {
  Senin: ['Pancasila', 'Matematika', 'SKI', 'BTQ', 'Akidah', 'Aswaja'],
  Selasa: ['PJOK', 'Matematika', 'IPAS', 'BTQ', 'TIK'],
  Rabu: ['Pancasila', 'BTQ', 'Bahasa Arab', 'Bahasa Indonesia', 'IPAS'],
  Kamis: ["Al-Qur'an Hadis", 'BTQ', 'Bahasa Indonesia', 'Matematika', 'Bahasa Inggris'],
  Jumat: ['Bahasa Indonesia', 'IPAS', 'Bahasa Jawa'],
  Sabtu: ['Fikih', 'Seni Budaya', 'Bahasa Indonesia'],
};

export const ALL_CLASS_SUBJECTS: string[] = Array.from(
  new Set(Object.values(OFFICIAL_6_DAY_SCHEDULE).flat())
).sort((a, b) => a.localeCompare(b, 'id'));

export const SCHEMA_LIMITS = {
  idPattern: /^[a-zA-Z0-9_-]+$/,
  datePattern: /^\d{4}-\d{2}-\d{2}$/,
  timePattern: /^\d{2}:\d{2}$/,
  displayNameMin: 2,
  displayNameMax: 80,
  nicknameMin: 1,
  nicknameMax: 40,
  absenMin: 0,
  absenMax: 60,
  titleMin: 3,
  titleMax: 120,
  announcementContentMin: 3,
  announcementContentMax: 2000,
  subjectMin: 2,
  subjectMax: 60,
  assignmentDescMin: 1,
  assignmentDescMax: 1500,
  teacherMax: 80,
  roomMax: 40,
  agendaDescMin: 1,
  agendaDescMax: 1000,
  locationMin: 2,
  locationMax: 100,
  treasuryDescMin: 3,
  treasuryDescMax: 160,
  treasuryAmountMax: 100000000,
  chatTextMin: 1,
  chatTextMax: 1000,
  adminMsgMin: 3,
  adminMsgMax: 1500,
} as const;

export const DAYS_ORDER: DayOfWeek[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const ANNOUNCEMENT_CATEGORIES: AnnouncementCategory[] = ['Penting', 'Akademik', 'Kegiatan', 'Umum'];
export const ANNOUNCEMENT_PRIORITIES: AnnouncementPriority[] = ['normal', 'penting', 'mendesak'];
export const ASSIGNMENT_PRIORITIES: AssignmentPriority[] = ['rendah', 'sedang', 'tinggi'];
export const TREASURY_CATEGORIES: TreasuryCategory[] = [
  'Iuran Kas',
  'Donasi',
  'Perlengkapan',
  'Kegiatan',
  'Lainnya',
];
export const ADMIN_MSG_CATEGORIES: AdminMessageCategory[] = ['Izin', 'Laporan', 'Saran', 'Pertanyaan'];

// --- Timezone Asia/Jakarta Helpers ---
export function getJakartaDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function getJakartaTimeHHMM(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: JAKARTA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function getJakartaFullDateTimeLabel(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: JAKARTA_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getTodayIndonesianDay(date: Date = new Date()): DayOfWeek {
  const weekday = new Intl.DateTimeFormat('id-ID', {
    timeZone: JAKARTA_TZ,
    weekday: 'long',
  }).format(date);
  const normalized = weekday.toLowerCase();
  if (normalized.includes('senin')) return 'Senin';
  if (normalized.includes('selasa')) return 'Selasa';
  if (normalized.includes('rabu')) return 'Rabu';
  if (normalized.includes('kamis')) return 'Kamis';
  if (normalized.includes('jumat') || normalized.includes("jum'at")) return 'Jumat';
  if (normalized.includes('sabtu')) return 'Sabtu';
  return 'Senin';
}

export function isSundayJakarta(date: Date = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat('id-ID', {
    timeZone: JAKARTA_TZ,
    weekday: 'long',
  }).format(date);
  return weekday.toLowerCase().includes('minggu');
}

// --- RBAC Matrix ---
export function isAdminOrOwnerRole(role: UserRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canAccessNavTab(role: UserRole | null | undefined, tab: NavTab): boolean {
  if (!role) return false;
  if (tab === 'owner-panel') return role === 'owner';
  return true;
}

export function canManageAnnouncements(role: UserRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageSchedule(
  role: UserRole | null | undefined,
  settings?: Pick<ClassSettings, 'allowAdminManageSchedule'>
): boolean {
  if (role === 'owner') return true;
  if (role === 'admin') return settings?.allowAdminManageSchedule ?? true;
  return false;
}

export function canManageTreasury(
  role: UserRole | null | undefined,
  settings?: Pick<ClassSettings, 'allowAdminManageTreasury'>
): boolean {
  if (role === 'owner') return true;
  if (role === 'admin') return settings?.allowAdminManageTreasury ?? true;
  return false;
}

export function canCreateAssignment(
  role: UserRole | null | undefined,
  settings?: Pick<ClassSettings, 'allowStudentCreateTask'>
): boolean {
  if (!role) return false;
  if (role === 'owner' || role === 'admin') return true;
  return settings?.allowStudentCreateTask ?? true;
}

export function canCreateAgenda(
  role: UserRole | null | undefined,
  settings?: Pick<ClassSettings, 'allowStudentCreateAgenda'>
): boolean {
  if (!role) return false;
  if (role === 'owner' || role === 'admin') return true;
  return settings?.allowStudentCreateAgenda ?? true;
}

export function canEditOrDeleteOwnedItem(
  role: UserRole | null | undefined,
  currentUid: string,
  itemAuthorId: string
): boolean {
  if (role === 'owner' || role === 'admin') return true;
  return Boolean(currentUid && currentUid === itemAuthorId);
}

export function canViewLoginHistory(role: UserRole | null | undefined): boolean {
  return role === 'owner';
}

export function canChangeUserRole(
  actorRole: UserRole | null | undefined,
  targetCurrentRole: UserRole,
  newRole: UserRole
): boolean {
  if (actorRole !== 'owner') return false;
  if (targetCurrentRole === 'owner') return false;
  return newRole === 'admin' || newRole === 'siswa';
}

// --- Validation Functions (Match firebase-blueprint.json & firestore.rules) ---
export function validateProfileInput(
  displayName: string,
  nickname: string,
  absenRaw: number | string,
  isOwnerAccount: boolean
): string | null {
  const name = displayName.trim();
  const nick = nickname.trim();
  if (name.length < SCHEMA_LIMITS.displayNameMin || name.length > SCHEMA_LIMITS.displayNameMax) {
    return `Nama lengkap harus ${SCHEMA_LIMITS.displayNameMin}–${SCHEMA_LIMITS.displayNameMax} karakter.`;
  }
  if (nick.length < SCHEMA_LIMITS.nicknameMin || nick.length > SCHEMA_LIMITS.nicknameMax) {
    return `Nama panggilan harus ${SCHEMA_LIMITS.nicknameMin}–${SCHEMA_LIMITS.nicknameMax} karakter.`;
  }
  const absen = typeof absenRaw === 'string' ? Number(absenRaw) : absenRaw;
  if (!Number.isInteger(absen) || absen < (isOwnerAccount ? 0 : 1) || absen > SCHEMA_LIMITS.absenMax) {
    return isOwnerAccount
      ? 'Nomor absen/kode harus bilangan bulat 0–60.'
      : 'Nomor absen siswa harus bilangan bulat 1–60.';
  }
  return null;
}

export function validateAnnouncementInput(input: {
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
}): string | null {
  const title = input.title.trim();
  const content = input.content.trim();
  if (title.length < SCHEMA_LIMITS.titleMin || title.length > SCHEMA_LIMITS.titleMax) {
    return `Judul pengumuman harus ${SCHEMA_LIMITS.titleMin}–${SCHEMA_LIMITS.titleMax} karakter.`;
  }
  if (
    content.length < SCHEMA_LIMITS.announcementContentMin ||
    content.length > SCHEMA_LIMITS.announcementContentMax
  ) {
    return `Isi pengumuman harus ${SCHEMA_LIMITS.announcementContentMin}–${SCHEMA_LIMITS.announcementContentMax} karakter.`;
  }
  if (!ANNOUNCEMENT_CATEGORIES.includes(input.category)) {
    return 'Kategori pengumuman tidak valid.';
  }
  if (!ANNOUNCEMENT_PRIORITIES.includes(input.priority)) {
    return 'Prioritas pengumuman tidak valid.';
  }
  return null;
}

export function validateAssignmentInput(input: {
  subject: string;
  title: string;
  description: string;
  assignedDate: string;
  dueDate: string;
  priority: AssignmentPriority;
}): string | null {
  if (input.subject.trim().length < SCHEMA_LIMITS.subjectMin || input.subject.trim().length > SCHEMA_LIMITS.subjectMax) {
    return `Mata pelajaran harus ${SCHEMA_LIMITS.subjectMin}–${SCHEMA_LIMITS.subjectMax} karakter.`;
  }
  if (input.title.trim().length < SCHEMA_LIMITS.titleMin || input.title.trim().length > SCHEMA_LIMITS.titleMax) {
    return `Judul tugas harus ${SCHEMA_LIMITS.titleMin}–${SCHEMA_LIMITS.titleMax} karakter.`;
  }
  if (
    input.description.trim().length < SCHEMA_LIMITS.assignmentDescMin ||
    input.description.trim().length > SCHEMA_LIMITS.assignmentDescMax
  ) {
    return `Deskripsi tugas harus ${SCHEMA_LIMITS.assignmentDescMin}–${SCHEMA_LIMITS.assignmentDescMax} karakter.`;
  }
  if (
    !SCHEMA_LIMITS.datePattern.test(input.assignedDate.trim()) ||
    !SCHEMA_LIMITS.datePattern.test(input.dueDate.trim())
  ) {
    return 'Tanggal diberikan dan tenggat harus berformat YYYY-MM-DD.';
  }
  if (!ASSIGNMENT_PRIORITIES.includes(input.priority)) {
    return 'Prioritas tugas tidak valid.';
  }
  return null;
}

export function validateScheduleInput(input: {
  day: DayOfWeek;
  order: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string;
  room: string;
}): string | null {
  if (!DAYS_ORDER.includes(input.day)) return 'Hari tidak valid.';
  if (!Number.isInteger(input.order) || input.order < 1 || input.order > 20) {
    return 'Nomor urut pelajaran harus antara 1–20.';
  }
  const s = input.startTime.trim();
  const e = input.endTime.trim();
  if ((s !== '' && !SCHEMA_LIMITS.timePattern.test(s)) || (e !== '' && !SCHEMA_LIMITS.timePattern.test(e))) {
    return 'Format jam harus HH:MM atau dikosongkan.';
  }
  if ((s === '' && e !== '') || (s !== '' && e === '')) {
    return 'Isi jam mulai dan jam selesai keduanya, atau kosongkan keduanya.';
  }
  if (s !== '' && e !== '' && s >= e) {
    return 'Jam selesai harus lebih akhir dari jam mulai.';
  }
  if (input.subject.trim().length < SCHEMA_LIMITS.subjectMin || input.subject.trim().length > SCHEMA_LIMITS.subjectMax) {
    return `Mata pelajaran harus ${SCHEMA_LIMITS.subjectMin}–${SCHEMA_LIMITS.subjectMax} karakter.`;
  }
  if (input.teacher.trim().length > SCHEMA_LIMITS.teacherMax) {
    return `Nama guru maksimal ${SCHEMA_LIMITS.teacherMax} karakter.`;
  }
  if (input.room.trim().length > SCHEMA_LIMITS.roomMax) {
    return `Ruangan maksimal ${SCHEMA_LIMITS.roomMax} karakter.`;
  }
  return null;
}

export function validatePicketInput(input: {
  day: DayOfWeek;
  students: string[];
  tasks: string[];
  coordinator: string;
  note: string;
}): string | null {
  if (!DAYS_ORDER.includes(input.day)) return 'Hari piket tidak valid.';
  if (input.students.length > 20) return 'Maksimal 20 siswa per hari piket.';
  if (input.tasks.length === 0 || input.tasks.length > 15) {
    return 'Jumlah daftar tugas piket harus antara 1–15 item.';
  }
  if (input.coordinator.trim().length > 80) return 'Nama koordinator maksimal 80 karakter.';
  if (input.note.trim().length > 200) return 'Catatan piket maksimal 200 karakter.';
  return null;
}

export function validateAgendaInput(input: {
  title: string;
  description: string;
  eventDate: string;
  eventTime: string;
  location: string;
}): string | null {
  if (input.title.trim().length < SCHEMA_LIMITS.titleMin || input.title.trim().length > SCHEMA_LIMITS.titleMax) {
    return `Judul agenda harus ${SCHEMA_LIMITS.titleMin}–${SCHEMA_LIMITS.titleMax} karakter.`;
  }
  if (
    input.description.trim().length < SCHEMA_LIMITS.agendaDescMin ||
    input.description.trim().length > SCHEMA_LIMITS.agendaDescMax
  ) {
    return `Deskripsi agenda harus ${SCHEMA_LIMITS.agendaDescMin}–${SCHEMA_LIMITS.agendaDescMax} karakter.`;
  }
  if (!SCHEMA_LIMITS.datePattern.test(input.eventDate.trim())) {
    return 'Tanggal agenda harus berformat YYYY-MM-DD.';
  }
  const t = input.eventTime.trim();
  if (t !== '' && !SCHEMA_LIMITS.timePattern.test(t)) {
    return 'Waktu agenda harus berformat HH:MM atau dikosongkan.';
  }
  if (input.location.trim().length < SCHEMA_LIMITS.locationMin || input.location.trim().length > SCHEMA_LIMITS.locationMax) {
    return `Lokasi harus ${SCHEMA_LIMITS.locationMin}–${SCHEMA_LIMITS.locationMax} karakter.`;
  }
  return null;
}

export function validateTreasuryInput(input: {
  type: TreasuryType;
  amount: number;
  description: string;
  category: TreasuryCategory;
  studentName: string;
  paymentStatus: TreasuryPaymentStatus;
  correctionNote: string;
  date: string;
}): string | null {
  if (input.type !== 'pemasukan' && input.type !== 'pengeluaran') {
    return 'Jenis transaksi tidak valid.';
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > SCHEMA_LIMITS.treasuryAmountMax) {
    return 'Nominal harus bilangan bulat antara Rp 1 hingga Rp 100.000.000.';
  }
  if (
    input.description.trim().length < SCHEMA_LIMITS.treasuryDescMin ||
    input.description.trim().length > SCHEMA_LIMITS.treasuryDescMax
  ) {
    return `Keterangan harus ${SCHEMA_LIMITS.treasuryDescMin}–${SCHEMA_LIMITS.treasuryDescMax} karakter.`;
  }
  if (!TREASURY_CATEGORIES.includes(input.category)) {
    return 'Kategori kas tidak valid.';
  }
  if (input.studentName.trim().length > 80) {
    return 'Nama siswa maksimal 80 karakter.';
  }
  if (!['lunas', 'belum', 'operasional'].includes(input.paymentStatus)) {
    return 'Status pembayaran tidak valid.';
  }
  if (input.correctionNote.trim().length > 240) {
    return 'Catatan koreksi maksimal 240 karakter.';
  }
  if (!SCHEMA_LIMITS.datePattern.test(input.date.trim())) {
    return 'Tanggal transaksi harus berformat YYYY-MM-DD.';
  }
  return null;
}

export function validateChatText(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < SCHEMA_LIMITS.chatTextMin || trimmed.length > SCHEMA_LIMITS.chatTextMax) {
    return `Pesan harus ${SCHEMA_LIMITS.chatTextMin}–${SCHEMA_LIMITS.chatTextMax} karakter.`;
  }
  return null;
}

export function validateAdminMessageInput(input: {
  category: AdminMessageCategory;
  subject: string;
  message: string;
}): string | null {
  if (!ADMIN_MSG_CATEGORIES.includes(input.category)) {
    return 'Kategori pesan tidak valid.';
  }
  if (input.subject.trim().length < SCHEMA_LIMITS.titleMin || input.subject.trim().length > SCHEMA_LIMITS.titleMax) {
    return `Subjek harus ${SCHEMA_LIMITS.titleMin}–${SCHEMA_LIMITS.titleMax} karakter.`;
  }
  if (input.message.trim().length < SCHEMA_LIMITS.adminMsgMin || input.message.trim().length > SCHEMA_LIMITS.adminMsgMax) {
    return `Isi pesan harus ${SCHEMA_LIMITS.adminMsgMin}–${SCHEMA_LIMITS.adminMsgMax} karakter.`;
  }
  return null;
}

// --- Domain Calculations ---
export interface TreasurySummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export function calculateTreasurySummary(entries: Pick<TreasuryEntry, 'type' | 'amount'>[]): TreasurySummary {
  let totalIncome = 0;
  let totalExpense = 0;
  for (const item of entries) {
    if (item.type === 'pemasukan') {
      totalIncome += item.amount;
    } else if (item.type === 'pengeluaran') {
      totalExpense += item.amount;
    }
  }
  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
  };
}

export interface MonthlyTreasuryRecap {
  monthKey: string; // YYYY-MM
  income: number;
  expense: number;
  net: number;
  count: number;
}

export function calculateMonthlyTreasuryRecap(entries: TreasuryEntry[]): MonthlyTreasuryRecap[] {
  const map = new Map<string, MonthlyTreasuryRecap>();
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    const cur = map.get(key) ?? { monthKey: key, income: 0, expense: 0, net: 0, count: 0 };
    if (entry.type === 'pemasukan') cur.income += entry.amount;
    else cur.expense += entry.amount;
    cur.net = cur.income - cur.expense;
    cur.count += 1;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

export function formatRupiah(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(Math.round(amount));
  return `${sign}Rp ${abs.toLocaleString('id-ID')}`;
}

export function sortSchedulesForDay(items: ScheduleItem[], day: DayOfWeek): ScheduleItem[] {
  return items
    .filter((item) => item.day === day)
    .slice()
    .sort((a, b) => {
      const orderDiff = (a.order ?? 99) - (b.order ?? 99);
      if (orderDiff !== 0) return orderDiff;
      return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
    });
}

export function buildDefaultOfficialScheduleItems(): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  for (const day of DAYS_ORDER) {
    OFFICIAL_6_DAY_SCHEDULE[day].forEach((subject, idx) => {
      items.push({
        id: `default-${day}-${idx + 1}`,
        classId: CLASS_ID,
        day,
        order: idx + 1,
        startTime: '',
        endTime: '',
        subject,
        teacher: '',
        room: 'Ruang 6A',
        authorId: 'system-default',
        updatedAt: null,
      });
    });
  }
  return items;
}

export function getEffectiveSchedules(firestoreSchedules: ScheduleItem[]): {
  items: ScheduleItem[];
  isUsingFallback: boolean;
} {
  if (firestoreSchedules.length > 0) {
    return { items: firestoreSchedules, isUsingFallback: false };
  }
  return { items: buildDefaultOfficialScheduleItems(), isUsingFallback: true };
}

export function matchesOfficial6DaySchedule(schedules: ScheduleItem[]): boolean {
  if (schedules.length === 0) return false;
  for (const day of DAYS_ORDER) {
    const actualSubjects = sortSchedulesForDay(schedules, day).map((s) => s.subject.trim());
    const expectedSubjects = OFFICIAL_6_DAY_SCHEDULE[day];
    if (actualSubjects.length !== expectedSubjects.length) return false;
    for (let i = 0; i < expectedSubjects.length; i += 1) {
      if (actualSubjects[i] !== expectedSubjects[i]) return false;
    }
  }
  return true;
}

export function formatScheduleTimeRange(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return 'Belum diatur';
  return `${startTime} – ${endTime}`;
}

export interface LessonStatusInfo {
  currentLesson: ScheduleItem | null;
  nextLesson: ScheduleItem | null;
  hasConfiguredTimes: boolean;
}

export function evaluateDayScheduleStatus(
  daySchedules: ScheduleItem[],
  nowHHMM: string
): LessonStatusInfo {
  const timed = daySchedules.filter((s) => Boolean(s.startTime && s.endTime));
  if (timed.length === 0) {
    return {
      currentLesson: null,
      nextLesson: daySchedules[0] ?? null,
      hasConfiguredTimes: false,
    };
  }
  const currentLesson =
    timed.find((s) => nowHHMM >= s.startTime && nowHHMM < s.endTime) ?? null;
  const nextLesson = timed.find((s) => s.startTime > nowHHMM) ?? null;
  return {
    currentLesson,
    nextLesson,
    hasConfiguredTimes: true,
  };
}

export function deriveTaskStatus(
  dueDate: string,
  progressStatus: TaskProgressStatus | undefined,
  todayStr: string = getJakartaDateString()
): DerivedTaskStatus {
  const status = progressStatus ?? 'belum';
  if (status === 'selesai') return 'selesai';
  if (dueDate < todayStr) return 'terlambat';
  return status;
}

export function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts instanceof Date) return ts.getTime();
  if (
    typeof ts === 'object' &&
    ts !== null &&
    'toMillis' in ts &&
    typeof (ts as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (
    typeof ts === 'object' &&
    ts !== null &&
    'seconds' in ts &&
    typeof (ts as { seconds: number }).seconds === 'number'
  ) {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return 0;
}

export function detectNewAnnouncements(
  currentList: Announcement[],
  previousIds: Set<string>,
  hasInitialized: boolean
): Announcement[] {
  if (!hasInitialized) return [];
  return currentList.filter((item) => !previousIds.has(item.id));
}

export function formatTimestampId(ts: unknown): string {
  const ms = toMillis(ts);
  if (!ms) return 'Baru saja';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: JAKARTA_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function formatTimeOnly(ts: unknown): string {
  const ms = toMillis(ts);
  if (!ms) return '--:--';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: JAKARTA_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function formatRelativeLastSeen(ts: unknown, isOnline: boolean, hideOnlineStatus?: boolean): string {
  if (hideOnlineStatus) return 'Status disembunyikan';
  if (isOnline) return 'Online';
  const ms = toMillis(ts);
  if (!ms) return 'Offline';
  const diffMin = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (diffMin < 2) return 'Baru saja aktif';
  if (diffMin < 60) return `Terakhir dilihat ${diffMin} menit lalu`;
  return `Terakhir dilihat ${formatTimeOnly(ms)} WIB`;
}

export function getRoleLabel(role: UserRole): string {
  if (role === 'owner') return 'Owner / Wali Kelas';
  if (role === 'admin') return 'Admin / Pengurus';
  return 'Siswa Kelas 6A';
}

export function getUserDisplayLabel(user: Pick<UserPublic, 'nickname' | 'displayName'>): string {
  return user.nickname?.trim() || user.displayName;
}

export function performGlobalSearch(params: {
  query: string;
  role: UserRole;
  currentUid: string;
  assignments: Assignment[];
  announcements: Announcement[];
  agendas: AgendaItem[];
  schedules: ScheduleItem[];
  adminMessages: AdminMessage[];
  chatMessages: ChatMessage[];
  picketSchedules?: PicketScheduleItem[];
}): GlobalSearchResult[] {
  const q = params.query.trim().toLowerCase();
  if (!q) return [];
  const results: GlobalSearchResult[] = [];

  for (const g of GAME_CATALOG) {
    if (
      g.name.toLowerCase().includes(q) ||
      g.shortName.toLowerCase().includes(q) ||
      g.genre.toLowerCase().includes(q) ||
      'mabar game'.includes(q)
    ) {
      results.push({
        id: `game-${g.id}`,
        section: 'Game Center',
        title: g.name,
        subtitle: `${g.genre} · Komunitas & Chat Mabar Kelas 6A`,
        tab: 'game-center',
      });
    }
  }

  for (const p of params.picketSchedules ?? []) {
    const joinedStudents = p.students.join(', ');
    if (
      p.day.toLowerCase().includes(q) ||
      joinedStudents.toLowerCase().includes(q) ||
      p.tasks.some((t) => t.toLowerCase().includes(q)) ||
      'piket'.includes(q)
    ) {
      results.push({
        id: `piket-${p.day}`,
        section: 'Jadwal Piket',
        title: `Piket Hari ${p.day}`,
        subtitle: joinedStudents || `${p.tasks.length} tugas kebersihan`,
        tab: 'piket',
      });
    }
  }

  for (const a of params.assignments) {
    if (
      a.title.toLowerCase().includes(q) ||
      a.subject.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q)
    ) {
      results.push({
        id: `task-${a.id}`,
        section: 'Tugas',
        title: a.title,
        subtitle: `${a.subject} · Tenggat ${a.dueDate}`,
        tab: 'tugas',
      });
    }
  }

  for (const ann of params.announcements) {
    if (ann.title.toLowerCase().includes(q) || ann.content.toLowerCase().includes(q)) {
      results.push({
        id: `ann-${ann.id}`,
        section: 'Pengumuman',
        title: ann.title,
        subtitle: `${ann.category} · ${ann.authorName}`,
        tab: 'pengumuman',
      });
    }
  }

  for (const ag of params.agendas) {
    if (
      ag.title.toLowerCase().includes(q) ||
      ag.location.toLowerCase().includes(q) ||
      ag.description.toLowerCase().includes(q)
    ) {
      results.push({
        id: `ag-${ag.id}`,
        section: 'Agenda',
        title: ag.title,
        subtitle: `${ag.eventDate} · ${ag.location}`,
        tab: 'agenda',
      });
    }
  }

  for (const s of params.schedules) {
    if (
      s.subject.toLowerCase().includes(q) ||
      s.teacher.toLowerCase().includes(q) ||
      s.day.toLowerCase().includes(q)
    ) {
      results.push({
        id: `sch-${s.id}`,
        section: 'Jadwal',
        title: `${s.subject} (${s.day})`,
        subtitle: `${formatScheduleTimeRange(s.startTime, s.endTime)}${s.teacher ? ` · ${s.teacher}` : ''}`,
        tab: 'jadwal',
      });
    }
  }

  // Respect RBAC on private Admin messages
  const isStaff = params.role === 'owner' || params.role === 'admin';
  for (const m of params.adminMessages) {
    if (!isStaff && m.senderId !== params.currentUid) continue;
    if (m.subject.toLowerCase().includes(q) || m.message.toLowerCase().includes(q)) {
      results.push({
        id: `adm-${m.id}`,
        section: 'Pesan Admin',
        title: m.subject,
        subtitle: `${m.category} · Status ${m.status}`,
        tab: 'pesan-admin',
      });
    }
  }

  for (const c of params.chatMessages) {
    if (c.text.toLowerCase().includes(q) || c.senderName.toLowerCase().includes(q)) {
      results.push({
        id: `chat-${c.id}`,
        section: 'Chat',
        title: c.senderName,
        subtitle: c.text.slice(0, 90),
        tab: 'chat',
      });
    }
  }

  return results.slice(0, 25);
}

export function buildTreasuryCsv(entries: TreasuryEntry[]): string {
  const escape = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
  const header = [
    'Tanggal',
    'Jenis',
    'Kategori',
    'Nominal',
    'Keterangan',
    'Nama Siswa',
    'Status',
    'Catatan Koreksi',
    'Dicatat Oleh',
  ].join(',');
  const rows = entries.map((e) =>
    [
      escape(e.date),
      escape(e.type),
      escape(e.category),
      String(e.amount),
      escape(e.description),
      escape(e.studentName || '-'),
      escape(e.paymentStatus),
      escape(e.correctionNote || '-'),
      escape(e.recordedByName),
    ].join(',')
  );
  return [header, ...rows].join('\n');
}
