export type UserRole = 'owner' | 'admin' | 'siswa';
export type AccountStatus = 'aktif' | 'nonaktif';

export type NavTab =
  | 'beranda'
  | 'jadwal'
  | 'tugas'
  | 'pengumuman'
  | 'agenda'
  | 'kas'
  | 'chat'
  | 'pesan-admin'
  | 'c6a-ai'
  | 'profil'
  | 'bantuan'
  | 'owner-panel';

export type AnnouncementCategory = 'Penting' | 'Akademik' | 'Kegiatan' | 'Umum';
export type AnnouncementPriority = 'normal' | 'penting' | 'mendesak';
export type AssignmentPriority = 'rendah' | 'sedang' | 'tinggi';
export type TaskProgressStatus = 'belum' | 'sedang' | 'selesai';
export type DerivedTaskStatus = TaskProgressStatus | 'terlambat';
export type DayOfWeek = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';
export type AgendaStatus = 'mendatang' | 'selesai';
export type TreasuryType = 'pemasukan' | 'pengeluaran';
export type TreasuryCategory = 'Iuran Kas' | 'Donasi' | 'Perlengkapan' | 'Kegiatan' | 'Lainnya';
export type TreasuryPaymentStatus = 'lunas' | 'belum' | 'operasional';
export type AdminMessageCategory = 'Izin' | 'Laporan' | 'Saran' | 'Pertanyaan';
export type AdminMessageStatus = 'menunggu' | 'dibaca' | 'selesai';
export type NotificationType = 'pengumuman' | 'tugas' | 'jadwal' | 'agenda' | 'pesan-admin' | 'info';

export interface UserPublic {
  uid: string;
  displayName: string;
  nickname: string;
  photoURL: string;
  absenNumber: number;
  role: UserRole;
  status: AccountStatus;
  classId: '6A';
  lastLoginAt: unknown;
  updatedAt: unknown;
}

export interface UserPrivate {
  uid: string;
  email: string;
  createdAt: unknown;
  lastLoginAt: unknown;
}

export interface TaskProgress {
  taskId: string;
  uid: string;
  completed: boolean;
  status: TaskProgressStatus;
  updatedAt: unknown;
}

export interface NotificationState {
  uid: string;
  readIds: string[];
  lastReadAt: unknown;
}

export interface LoginHistoryEntry {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  deviceInfo: string;
  loggedInAt: unknown;
}

export interface Announcement {
  id: string;
  classId: '6A';
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  pinned: boolean;
  archived: boolean;
  authorId: string;
  authorName: string;
  authorRole: 'owner' | 'admin';
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Assignment {
  id: string;
  classId: '6A';
  subject: string;
  title: string;
  description: string;
  assignedDate: string;
  dueDate: string;
  priority: AssignmentPriority;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  editHistory: string[];
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ScheduleItem {
  id: string;
  classId: '6A';
  day: DayOfWeek;
  order: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string;
  room: string;
  authorId: string;
  updatedAt: unknown;
}

export interface AgendaItem {
  id: string;
  classId: '6A';
  title: string;
  description: string;
  eventDate: string;
  eventTime: string;
  location: string;
  status: AgendaStatus;
  authorId: string;
  authorName: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface TreasuryEntry {
  id: string;
  classId: '6A';
  type: TreasuryType;
  amount: number;
  description: string;
  category: TreasuryCategory;
  studentName: string;
  paymentStatus: TreasuryPaymentStatus;
  correctionNote: string;
  date: string;
  recordedById: string;
  recordedByName: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ChatMessage {
  id: string;
  classId: '6A';
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  createdAt: unknown;
}

export interface AdminMessage {
  id: string;
  classId: '6A';
  senderId: string;
  senderName: string;
  category: AdminMessageCategory;
  subject: string;
  message: string;
  status: AdminMessageStatus;
  adminReply: string;
  repliedBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface NotificationItem {
  id: string;
  classId: '6A';
  type: NotificationType;
  title: string;
  body: string;
  targetTab: NavTab;
  targetUid: string;
  actorId: string;
  actorName: string;
  createdAt: unknown;
}

export interface ActivityLog {
  id: string;
  classId: '6A';
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetCollection: string;
  detail: string;
  createdAt: unknown;
}

export interface ClassSettings {
  classId: '6A';
  homeroomTeacher: string;
  academicYear: string;
  motto: string;
  adminContactNote: string;
  weeklyKasTarget: number;
  allowStudentCreateTask: boolean;
  allowStudentCreateAgenda: boolean;
  allowAdminManageTreasury: boolean;
  allowAdminManageSchedule: boolean;
  updatedAt: unknown;
}

export interface ClientErrorLog {
  id: string;
  source: string;
  message: string;
  timestamp: string;
}

export interface GlobalSearchResult {
  id: string;
  section: 'Tugas' | 'Pengumuman' | 'Agenda' | 'Jadwal' | 'Pesan Admin' | 'Chat';
  title: string;
  subtitle: string;
  tab: NavTab;
}

export interface C6AConversationMessage {
  id: string;
  role: 'user' | 'model';
  source: 'user' | 'bot' | 'ai';
  text: string;
  createdAtLabel: string;
}
