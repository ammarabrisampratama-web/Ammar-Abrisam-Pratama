export type UserRole = 'owner' | 'admin' | 'siswa';
export type AccountStatus = 'aktif' | 'nonaktif';

export type NavTab =
  | 'beranda'
  | 'chat'
  | 'grup-kelas'
  | 'game-center'
  | 'jadwal'
  | 'tugas'
  | 'pengumuman'
  | 'agenda'
  | 'kas'
  | 'piket'
  | 'profil'
  | 'pengaturan'
  | 'pesan-admin'
  | 'c6a-ai'
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
export type NotificationType =
  | 'pengumuman'
  | 'tugas'
  | 'jadwal'
  | 'agenda'
  | 'pesan-admin'
  | 'game'
  | 'chat'
  | 'info';

export type GameId = 'ff' | 'mlbb' | 'roblox' | 'fc-mobile';
export type LfgStatus = 'offline' | 'siap-mabar' | 'dalam-game' | 'santai';
export type ChatRoomType = 'class' | 'group' | 'game' | 'dm';
export type ChatMessageType = 'text' | 'image' | 'video' | 'audio';
export type ReportCategory = 'spam' | 'penipuan' | 'perundungan' | 'info-pribadi' | 'lainnya';
export type ReportStatus = 'menunggu' | 'ditindak' | 'diabaikan';

export interface GameIdMap {
  ff?: string;
  mlbb?: string;
  roblox?: string;
  fcMobile?: string;
}

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
  bio?: string;
  gameIds?: GameIdMap;
  hideOnlineStatus?: boolean;
}

export interface UserPrivate {
  uid: string;
  email: string;
  createdAt: unknown;
  lastLoginAt: unknown;
}

export interface UserPresence {
  uid: string;
  isOnline: boolean;
  hideOnlineStatus: boolean;
  lastSeenAt: unknown;
}

export interface BlockedUser {
  targetUid: string;
  targetName: string;
  blockedAt: unknown;
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

export interface PicketScheduleItem {
  id: string;
  classId: '6A';
  day: DayOfWeek;
  students: string[];
  tasks: string[];
  coordinator: string;
  note: string;
  updatedById: string;
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

export interface ChatReplyRef {
  id: string;
  senderName: string;
  text: string;
  messageType: ChatMessageType;
}

export interface RoomChatMessage {
  id: string;
  roomId: string;
  classId: '6A';
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderPhoto: string;
  messageType: ChatMessageType;
  text: string;
  mediaUrls: string[];
  mediaNames: string[];
  mediaDurationSec: number;
  replyTo: ChatReplyRef | null;
  forwardedFrom: string;
  reactions: Record<string, string[]>;
  readBy: string[];
  deleted: boolean;
  moderatedBy: string;
  editedAt: unknown;
  createdAt: unknown;
}

export interface ChatRoom {
  id: string;
  roomId: string;
  classId: '6A';
  type: ChatRoomType;
  name: string;
  description: string;
  gameId: GameId | '';
  participantIds: string[];
  pinnedMessageId: string;
  pinnedText: string;
  pinnedByName: string;
  lastMessageText: string;
  lastMessageSenderId: string;
  lastMessageAt: unknown;
  createdBy: string;
  updatedAt: unknown;
}

export interface TypingIndicator {
  uid: string;
  displayName: string;
  updatedAt: unknown;
}

export interface GameCommunityMeta {
  id: string;
  gameId: GameId;
  classId: '6A';
  name: string;
  shortName: string;
  genre: string;
  description: string;
  rules: string;
  bannerUrl: string;
  accentColor: string;
  updatedAt: unknown;
}

export interface GameMembership {
  uid: string;
  gameId: GameId;
  classId: '6A';
  displayName: string;
  nickname: string;
  photoURL: string;
  role: UserRole;
  inGameName: string;
  inGameId: string;
  lfgStatus: LfgStatus;
  lfgNote: string;
  joinedAt: unknown;
  updatedAt: unknown;
}

export interface GamePost {
  id: string;
  gameId: GameId;
  classId: '6A';
  type: 'update' | 'pengumuman';
  title: string;
  content: string;
  pinned: boolean;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface UserReport {
  id: string;
  classId: '6A';
  reporterId: string;
  reporterName: string;
  targetUid: string;
  targetName: string;
  roomId: string;
  messageId: string;
  messageExcerpt: string;
  category: ReportCategory;
  reason: string;
  status: ReportStatus;
  resolutionNote: string;
  resolvedBy: string;
  createdAt: unknown;
  updatedAt: unknown;
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
  whatsappGroupUrl?: string;
  allowGameCenter?: boolean;
  allowVoiceNotes?: boolean;
  allowMediaUpload?: boolean;
  allowPrivateChat?: boolean;
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
  section: 'Tugas' | 'Pengumuman' | 'Agenda' | 'Jadwal' | 'Pesan Admin' | 'Chat' | 'Game Center' | 'Jadwal Piket';
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
