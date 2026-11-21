import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BellRing,
  BookCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Edit3,
  FileSearch,
  Flag,
  History,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Plus,
  Save,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
  Trash2,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  Wifi,
} from 'lucide-react';
import firebaseConfig from '../../../firebase-applet-config.json';
import {
  checkFirebaseConnectionLatency,
  createCustomGroupRoom,
  createNotificationEvent,
  deleteAgendaItem,
  deleteAnnouncement,
  deleteAssignment,
  deleteCustomGroupRoom,
  deleteScheduleItem,
  deleteTreasuryEntry,
  replyAdminMessage,
  resolveUserReport,
  saveClassSettings,
  updateAnnouncement,
  updateMemberRoleAndStatus,
} from '../../services/firestoreService';
import type {
  ActivityLog,
  AdminMessage,
  AgendaItem,
  Announcement,
  Assignment,
  ChatRoom,
  ClassSettings,
  ClientErrorLog,
  LoginHistoryEntry,
  NavTab,
  NotificationItem,
  ScheduleItem,
  TreasuryEntry,
  UserPublic,
  UserReport,
} from '../../types';
import { OFFICIAL_WHATSAPP_GROUP_URL } from '../../utils/mediaUtils';
import {
  buildTreasuryCsv,
  calculateTreasurySummary,
  formatRupiah,
  formatScheduleTimeRange,
  formatTimestampId,
  getJakartaDateString,
  getRoleLabel,
} from '../../utils/validation';
import { ConfirmModal } from '../ConfirmModal';

type OwnerSectionId =
  | 'dashboard'
  | 'pengguna'
  | 'role'
  | 'login-history'
  | 'aktivitas'
  | 'jadwal'
  | 'tugas'
  | 'pengumuman'
  | 'agenda'
  | 'kas'
  | 'pesan-admin'
  | 'notifikasi'
  | 'pengaturan-kelas'
  | 'pengaturan-aplikasi'
  | 'koneksi-firebase'
  | 'log-kesalahan'
  | 'backup-ekspor'
  | 'audit-perubahan'
  | 'moderasi-laporan'
  | 'grup-game-chat';

const OWNER_SECTIONS: Array<{ id: OwnerSectionId; num: number; label: string; icon: typeof Shield }> = [
  { id: 'dashboard', num: 1, label: 'Dashboard Owner', icon: LayoutDashboard },
  { id: 'pengguna', num: 2, label: 'Manajemen Pengguna', icon: Users },
  { id: 'role', num: 3, label: 'Manajemen Role', icon: UserCog },
  { id: 'login-history', num: 4, label: 'Riwayat Login', icon: History },
  { id: 'aktivitas', num: 5, label: 'Aktivitas Pengguna', icon: Activity },
  { id: 'jadwal', num: 6, label: 'Manajemen Jadwal', icon: Clock },
  { id: 'tugas', num: 7, label: 'Manajemen Tugas', icon: BookCheck },
  { id: 'pengumuman', num: 8, label: 'Manajemen Pengumuman', icon: Megaphone },
  { id: 'agenda', num: 9, label: 'Manajemen Agenda', icon: CalendarDays },
  { id: 'kas', num: 10, label: 'Manajemen Uang Kas', icon: Wallet },
  { id: 'pesan-admin', num: 11, label: 'Manajemen Pesan Admin', icon: Inbox },
  { id: 'notifikasi', num: 12, label: 'Manajemen Notifikasi', icon: BellRing },
  { id: 'pengaturan-kelas', num: 13, label: 'Pengaturan Kelas', icon: Settings },
  { id: 'pengaturan-aplikasi', num: 14, label: 'Pengaturan Aplikasi', icon: Sliders },
  { id: 'koneksi-firebase', num: 15, label: 'Status Koneksi Firebase', icon: Wifi },
  { id: 'log-kesalahan', num: 16, label: 'Log Kesalahan', icon: AlertTriangle },
  { id: 'backup-ekspor', num: 17, label: 'Backup & Ekspor Data', icon: Database },
  { id: 'audit-perubahan', num: 18, label: 'Audit Perubahan Data', icon: FileSearch },
  { id: 'moderasi-laporan', num: 19, label: 'Moderasi & Laporan Chat', icon: ShieldAlert },
  { id: 'grup-game-chat', num: 20, label: 'Grup Chat & Game Center', icon: MessageSquare },
];

interface OwnerPanelViewProps {
  profile: UserPublic;
  settings: ClassSettings;
  members: UserPublic[];
  loginHistory: LoginHistoryEntry[];
  activityLogs: ActivityLog[];
  schedules: ScheduleItem[];
  assignments: Assignment[];
  announcements: Announcement[];
  agendas: AgendaItem[];
  treasury: TreasuryEntry[];
  adminMessages: AdminMessage[];
  notifications: NotificationItem[];
  clientErrors: ClientErrorLog[];
  userReports?: UserReport[];
  chatRooms?: ChatRoom[];
  onClearClientErrors: () => void;
  onNavigateTab: (tab: NavTab) => void;
  onOpenChatRoom?: (roomId: string) => void;
  onSyncOfficialSchedule: () => Promise<void>;
}

export function OwnerPanelView({
  profile,
  settings,
  members,
  loginHistory,
  activityLogs,
  schedules,
  assignments,
  announcements,
  agendas,
  treasury,
  adminMessages,
  notifications,
  clientErrors,
  userReports = [],
  chatRooms = [],
  onClearClientErrors,
  onNavigateTab,
  onOpenChatRoom,
  onSyncOfficialSchedule,
}: OwnerPanelViewProps) {
  const [section, setSection] = useState<OwnerSectionId>('dashboard');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editingMember, setEditingMember] = useState<UserPublic | null>(null);
  const [editName, setEditName] = useState('');
  const [editNick, setEditNick] = useState('');
  const [editAbsen, setEditAbsen] = useState('1');

  const [homeroomTeacher, setHomeroomTeacher] = useState(settings.homeroomTeacher);
  const [academicYear, setAcademicYear] = useState(settings.academicYear);
  const [motto, setMotto] = useState(settings.motto);
  const [adminContactNote, setAdminContactNote] = useState(settings.adminContactNote);
  const [weeklyKasTarget, setWeeklyKasTarget] = useState(String(settings.weeklyKasTarget));
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState(
    settings.whatsappGroupUrl || OFFICIAL_WHATSAPP_GROUP_URL
  );
  const [allowStudentCreateTask, setAllowStudentCreateTask] = useState(settings.allowStudentCreateTask);
  const [allowStudentCreateAgenda, setAllowStudentCreateAgenda] = useState(settings.allowStudentCreateAgenda);
  const [allowAdminManageTreasury, setAllowAdminManageTreasury] = useState(settings.allowAdminManageTreasury);
  const [allowAdminManageSchedule, setAllowAdminManageSchedule] = useState(settings.allowAdminManageSchedule);
  const [allowGameCenter, setAllowGameCenter] = useState(settings.allowGameCenter ?? true);
  const [allowVoiceNotes, setAllowVoiceNotes] = useState(settings.allowVoiceNotes ?? true);
  const [allowMediaUpload, setAllowMediaUpload] = useState(settings.allowMediaUpload ?? true);
  const [allowPrivateChat, setAllowPrivateChat] = useState(settings.allowPrivateChat ?? true);
  const [savingSettings, setSavingSettings] = useState(false);

  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifTab, setNotifTab] = useState<NavTab>('pengumuman');
  const [sendingNotif, setSendingNotif] = useState(false);

  const [connResult, setConnResult] = useState<{ ok: boolean; latencyMs: number; message: string } | null>(null);
  const [checkingConn, setCheckingConn] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    run: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const treasurySummary = useMemo(() => calculateTreasurySummary(treasury), [treasury]);

  const auditLogs = useMemo(
    () =>
      activityLogs.filter((l) =>
        /Edit|Koreksi|Hapus|Kelola|Ubah|Inisialisasi/i.test(l.action)
      ),
    [activityLogs]
  );

  if (profile.role !== 'owner') {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center">
        <p className="text-sm font-semibold text-rose-700">
          Halaman ini khusus untuk Owner Kelas 6A.
        </p>
      </div>
    );
  }

  const runConfirmed = async () => {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      await confirmAction.run();
      setConfirmAction(null);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Operasi gagal diproses.');
      setConfirmAction(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleSaveMemberEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setBusyId(editingMember.uid);
    setFeedback(null);
    try {
      await updateMemberRoleAndStatus(profile, editingMember, {
        displayName: editName,
        nickname: editNick,
        absenNumber: Number(editAbsen),
      });
      setFeedback(`Profil ${editName} berhasil diperbarui.`);
      setEditingMember(null);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Gagal memperbarui anggota.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setFeedback(null);
    try {
      await saveClassSettings(profile, {
        classId: '6A',
        homeroomTeacher: homeroomTeacher.trim(),
        academicYear: academicYear.trim(),
        motto: motto.trim(),
        adminContactNote: adminContactNote.trim(),
        weeklyKasTarget: Number(weeklyKasTarget) || 0,
        allowStudentCreateTask,
        allowStudentCreateAgenda,
        allowAdminManageTreasury,
        allowAdminManageSchedule,
        whatsappGroupUrl: whatsappGroupUrl.trim() || OFFICIAL_WHATSAPP_GROUP_URL,
        allowGameCenter,
        allowVoiceNotes,
        allowMediaUpload,
        allowPrivateChat,
      });
      setFeedback('Pengaturan kelas & aplikasi berhasil disimpan ke Firestore.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleBroadcastNotif = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) return;
    setSendingNotif(true);
    setFeedback(null);
    try {
      await createNotificationEvent(profile, {
        type: 'info',
        title: notifTitle,
        body: notifBody,
        targetTab: notifTab,
      });
      setNotifTitle('');
      setNotifBody('');
      setFeedback('Notifikasi kelas real-time berhasil dikirim ke seluruh siswa.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Gagal mengirim notifikasi.');
    } finally {
      setSendingNotif(false);
    }
  };

  const handleTestFirebase = async () => {
    setCheckingConn(true);
    const res = await checkFirebaseConnectionLatency();
    setConnResult(res);
    setCheckingConn(false);
  };

  const handleBackupJson = () => {
    const todayStr = getJakartaDateString();
    const payload = {
      exportedAt: new Date().toISOString(),
      project: 'Kelas 6A MI Al-Hidayah Sawotratap',
      settings,
      members,
      schedules,
      assignments,
      announcements,
      agendas,
      treasury,
      adminMessages,
      notifications,
      activityLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-kelas-6a-${todayStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBackupTreasuryCsv = () => {
    const todayStr = getJakartaDateString();
    const csv = buildTreasuryCsv(treasury);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-kas-6a-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const q = searchQuery.trim().toLowerCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B2416] flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" />
            <span>Panel Kontrol Owner (18 Modul)</span>
          </h2>
          <p className="text-sm text-[#52705E]">
            Pusat kendali penuh Kelas 6A: akun, role, riwayat login, konten, pengaturan sistem, diagnostik, dan backup.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-[#EDF7F1] border border-[#96CCA9] text-xs text-[#0B6B3A] font-medium flex items-center justify-between gap-2">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[#52705E] hover:text-[#0B2416] cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 18-Menu Owner Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-4 xl:col-span-3 bg-white border border-[#D3E6D8] rounded-2xl p-2.5 space-y-1 max-h-[60vh] lg:max-h-none overflow-y-auto">
          {OWNER_SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  setSearchQuery('');
                }}
                className={`w-full min-h-[40px] px-3 py-2 rounded-xl flex items-center gap-2.5 text-left text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#0B6B3A] text-white shadow-sm'
                    : 'text-[#2F4F3C] hover:bg-[#F0F7F2] border border-transparent'
                }`}
              >
                <span className={`font-mono-num text-[11px] w-4 shrink-0 ${active ? 'text-amber-200' : 'text-amber-700'}`}>
                  {item.num}.
                </span>
                <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-white' : 'text-[#0B6B3A]'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </aside>

        <section className="lg:col-span-8 xl:col-span-9 space-y-4 min-w-0">
          {/* 1. Dashboard Owner */}
          {section === 'dashboard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-white border border-[#D3E6D8] rounded-2xl p-4">
                  <p className="text-xs text-[#52705E]">Total Akun</p>
                  <p className="text-2xl font-bold text-[#0B2416] mt-1 font-mono-num">{members.length}</p>
                  <p className="text-[11px] text-[#0B6B3A] font-medium mt-0.5">
                    {members.filter((m) => m.status === 'aktif').length} aktif · {members.filter((m) => m.role === 'admin').length} admin
                  </p>
                </div>
                <div className="bg-white border border-[#D3E6D8] rounded-2xl p-4">
                  <p className="text-xs text-[#52705E]">Konten Akademik</p>
                  <p className="text-2xl font-bold text-[#0B2416] mt-1 font-mono-num">
                    {schedules.length + assignments.length}
                  </p>
                  <p className="text-[11px] text-[#52705E] mt-0.5">
                    {schedules.length} jadwal · {assignments.length} tugas
                  </p>
                </div>
                <div className="bg-white border border-[#D3E6D8] rounded-2xl p-4">
                  <p className="text-xs text-[#52705E]">Saldo Kas</p>
                  <p className="text-lg font-bold text-[#0B6B3A] mt-1 font-mono-num truncate">
                    {formatRupiah(treasurySummary.balance)}
                  </p>
                  <p className="text-[11px] text-[#52705E] mt-0.5">{treasury.length} transaksi</p>
                </div>
                <div className="bg-white border border-[#D3E6D8] rounded-2xl p-4">
                  <p className="text-xs text-[#52705E]">Audit &amp; Login</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1 font-mono-num">
                    {loginHistory.length}
                  </p>
                  <p className="text-[11px] text-[#52705E] mt-0.5">
                    {activityLogs.length} log aktivitas
                  </p>
                </div>
              </div>

              <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-3">
                <h3 className="text-base font-semibold text-[#0B2416]">Ringkasan Kesehatan Sistem</h3>
                <p className="text-xs text-[#2F4F3C] leading-relaxed">
                  Seluruh koleksi berjalan online di proyek Firebase <span className="font-mono-num text-[#0B6B3A] font-semibold">{firebaseConfig.projectId}</span>. Gunakan menu di sebelah kiri untuk mengelola anggota, menonaktifkan akun bermasalah, mengaudit perubahan kas/tugas, mengatur izin siswa/admin, atau mengunduh backup lengkap.
                </p>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSection('pengguna')}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold cursor-pointer"
                  >
                    Kelola Pengguna
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('pengaturan-aplikasi')}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F0F7F2] hover:bg-[#E2EFE6] border border-[#C6E0CE] text-[#0B2416] text-xs font-semibold cursor-pointer"
                  >
                    Pengaturan Hak Akses Fitur
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('backup-ekspor')}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F0F7F2] hover:bg-[#E2EFE6] border border-[#C6E0CE] text-[#0B2416] text-xs font-semibold cursor-pointer"
                  >
                    Unduh Backup Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. Manajemen Pengguna */}
          {section === 'pengguna' && (
            <div className="bg-white border border-[#D3E6D8] rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-5 bg-[#F0F7F2] border-b border-[#E2EFE6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-[#0B2416]">Manajemen Pengguna ({members.length})</h3>
                <div className="relative sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[#52705E] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama atau panggilan..."
                    className="w-full min-h-[38px] pl-9 pr-3 rounded-xl bg-white border border-[#B9D8C2] text-xs text-[#0B2416]"
                  />
                </div>
              </div>

              {editingMember && (
                <form onSubmit={handleSaveMemberEdit} className="p-4 sm:p-5 bg-[#F8FCF9] border-b border-[#E2EFE6] space-y-3">
                  <p className="text-xs font-semibold text-[#0B6B3A]">
                    Edit Identitas: {editingMember.displayName}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nama Lengkap"
                      className="min-h-[40px] px-3 rounded-xl bg-white border border-[#B9D8C2] text-xs text-[#0B2416]"
                    />
                    <input
                      type="text"
                      required
                      value={editNick}
                      onChange={(e) => setEditNick(e.target.value)}
                      placeholder="Nama Panggilan"
                      className="min-h-[40px] px-3 rounded-xl bg-white border border-[#B9D8C2] text-xs text-[#0B2416]"
                    />
                    <input
                      type="number"
                      required
                      min={editingMember.role === 'owner' ? 0 : 1}
                      max={60}
                      value={editAbsen}
                      onChange={(e) => setEditAbsen(e.target.value)}
                      placeholder="Absen"
                      className="min-h-[40px] px-3 rounded-xl bg-white border border-[#B9D8C2] text-xs text-[#0B2416] font-mono-num"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingMember(null)}
                      className="px-3 py-1.5 rounded-lg text-xs text-[#52705E] hover:text-[#0B2416] cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={busyId === editingMember.uid}
                      className="px-4 py-1.5 rounded-lg bg-[#0B6B3A] text-white text-xs font-semibold cursor-pointer"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </form>
              )}

              <div className="divide-y divide-[#E6F2EA]">
                {members
                  .filter(
                    (m) =>
                      !q ||
                      m.displayName.toLowerCase().includes(q) ||
                      m.nickname.toLowerCase().includes(q)
                  )
                  .map((m) => (
                    <div key={m.uid} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0B2416] truncate">
                          {m.displayName}{' '}
                          <span className="text-xs font-medium text-[#0B6B3A]">({m.nickname})</span>
                        </p>
                        <p className="text-xs text-[#52705E]">
                          {getRoleLabel(m.role)}
                          {m.absenNumber > 0 ? ` · Absen ${m.absenNumber}` : ''}
                          {' · '}Status:{' '}
                          <span className={m.status === 'aktif' ? 'text-[#0B6B3A] font-semibold' : 'text-rose-700 font-semibold'}>
                            {m.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMember(m);
                            setEditName(m.displayName);
                            setEditNick(m.nickname);
                            setEditAbsen(String(m.absenNumber));
                          }}
                          className="min-h-[36px] px-3 rounded-xl bg-[#F0F7F2] hover:bg-[#E2EFE6] border border-[#C6E0CE] text-xs font-semibold text-[#0B2416] flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        {m.role !== 'owner' && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({
                                title: m.status === 'aktif' ? 'Nonaktifkan Akun?' : 'Aktifkan Kembali Akun?',
                                description:
                                  m.status === 'aktif'
                                    ? `Akun ${m.displayName} tidak akan dapat mengakses portal sampai diaktifkan kembali.`
                                    : `Akun ${m.displayName} akan diizinkan masuk ke portal Kelas 6A.`,
                                confirmLabel: m.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan',
                                run: async () => {
                                  await updateMemberRoleAndStatus(profile, m, {
                                    status: m.status === 'aktif' ? 'nonaktif' : 'aktif',
                                  });
                                  setFeedback(`Status akun ${m.displayName} berhasil diperbarui.`);
                                },
                              })
                            }
                            className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold border cursor-pointer ${
                              m.status === 'aktif'
                                ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                                : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-[#0B6B3A]'
                            }`}
                          >
                            {m.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 3. Manajemen Role */}
          {section === 'role' && (
            <div className="bg-white border border-[#D3E6D8] rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-5 bg-[#F0F7F2] border-b border-[#E2EFE6]">
                <h3 className="text-base font-semibold text-[#0B2416]">Manajemen Role (Owner / Admin / Siswa)</h3>
                <p className="text-xs text-[#52705E]">
                  Admin dapat membantu mengelola pengumuman, tugas, agenda, jadwal/kas (sesuai pengaturan), dan membalas pesan siswa.
                </p>
              </div>
              <div className="divide-y divide-[#E6F2EA]">
                {members.map((m) => (
                  <div key={m.uid} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0B2416] truncate">{m.displayName}</p>
                      <p className="text-xs text-[#52705E]">{getRoleLabel(m.role)}</p>
                    </div>
                    {m.role === 'owner' ? (
                      <span className="text-xs font-semibold text-amber-700">Owner Utama</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const nextRole = m.role === 'admin' ? 'siswa' : 'admin';
                          setConfirmAction({
                            title: 'Ubah Hak Akses Pengguna?',
                            description: `Ubah peran ${m.displayName} dari ${getRoleLabel(m.role)} menjadi ${getRoleLabel(nextRole)}?`,
                            confirmLabel: nextRole === 'admin' ? 'Jadikan Admin' : 'Turunkan ke Siswa',
                            run: async () => {
                              await updateMemberRoleAndStatus(profile, m, { role: nextRole });
                              setFeedback(`Role ${m.displayName} diubah menjadi ${getRoleLabel(nextRole)}.`);
                            },
                          });
                        }}
                        className={`min-h-[38px] px-4 rounded-xl text-xs font-semibold cursor-pointer ${
                          m.role === 'admin'
                            ? 'bg-[#F0F7F2] border border-[#C6E0CE] text-[#0B2416]'
                            : 'bg-[#E6F4EC] border border-[#96CCA9] text-[#0B6B3A]'
                        }`}
                      >
                        {m.role === 'admin' ? 'Turunkan ke Siswa' : 'Jadikan Admin'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Riwayat Login */}
          {section === 'login-history' && (
            <div className="bg-white border border-[#D3E6D8] rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-5 bg-[#F0F7F2] border-b border-[#E2EFE6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-[#0B2416]">Riwayat Login (Khusus Owner)</h3>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama atau email..."
                  className="sm:w-64 min-h-[38px] px-3 rounded-xl bg-white border border-[#B9D8C2] text-xs text-[#0B2416]"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E2EFE6] bg-[#F8FCF9] text-[#52705E]">
                      <th className="py-3 px-4">Pengguna</th>
                      <th className="py-3 px-4">Peran</th>
                      <th className="py-3 px-4">Perangkat</th>
                      <th className="py-3 px-4 text-right">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6F2EA]">
                    {loginHistory
                      .filter(
                        (l) =>
                          !q ||
                          l.displayName.toLowerCase().includes(q) ||
                          l.email.toLowerCase().includes(q)
                      )
                      .map((l) => (
                        <tr key={l.id}>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-[#0B2416]">{l.displayName}</p>
                            <p className="text-[#52705E]">{l.email}</p>
                          </td>
                          <td className="py-3 px-4 text-[#2F4F3C]">{getRoleLabel(l.role)}</td>
                          <td className="py-3 px-4 text-[#52705E]">{l.deviceInfo}</td>
                          <td className="py-3 px-4 text-right font-mono-num text-[#2F4F3C] whitespace-nowrap">
                            {formatTimestampId(l.loggedInAt)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. Aktivitas Pengguna */}
          {section === 'aktivitas' && (
            <div className="bg-white border border-[#D3E6D8] rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-5 bg-[#F0F7F2] border-b border-[#E2EFE6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-[#0B2416]">Aktivitas Pengguna ({activityLogs.length})</h3>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari aktor atau aksi..."
                  className="sm:w-64 min-h-[38px] px-3 rounded-xl bg-white border border-[#B9D8C2] text-xs text-[#0B2416]"
                />
              </div>
              <div className="divide-y divide-[#E6F2EA] max-h-[520px] overflow-y-auto">
                {activityLogs
                  .filter(
                    (l) =>
                      !q ||
                      l.actorName.toLowerCase().includes(q) ||
                      l.action.toLowerCase().includes(q) ||
                      l.detail.toLowerCase().includes(q)
                  )
                  .map((log) => (
                    <div key={log.id} className="p-4 flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold text-[#0B6B3A]">
                          {log.action} · <span className="text-[#0B2416]">{log.actorName}</span>
                        </p>
                        <p className="text-[#2F4F3C]">{log.detail}</p>
                      </div>
                      <span className="font-mono-num text-[#52705E] shrink-0">
                        {formatTimestampId(log.createdAt)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 6. Manajemen Jadwal */}
          {section === 'jadwal' && (
            <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[#0B2416]">Manajemen Jadwal Pelajaran ({schedules.length})</h3>
                  <p className="text-xs text-[#52705E]">Kelola mata pelajaran dan atur jam mulai/selesai dari halaman Jadwal.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (schedules.length > 0) {
                        setConfirmAction({
                          title: 'Terapkan Jadwal Resmi 6 Hari?',
                          description:
                            'Seluruh entri jadwal saat ini akan diganti dengan urutan mata pelajaran resmi Senin–Sabtu Kelas 6A.',
                          confirmLabel: 'Terapkan Jadwal Resmi',
                          run: async () => {
                            await onSyncOfficialSchedule();
                            setFeedback('Jadwal resmi 6 hari berhasil disinkronkan ke Firestore.');
                          },
                        });
                      } else {
                        onSyncOfficialSchedule().then(() =>
                          setFeedback('Jadwal resmi 6 hari berhasil dimuat ke Firestore.')
                        );
                      }
                    }}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Terapkan Jadwal Resmi 6 Hari</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('jadwal')}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold cursor-pointer"
                  >
                    Buka Editor Jadwal Lengkap
                  </button>
                </div>
              </div>
              <div className="divide-y divide-[#E6F2EA] max-h-96 overflow-y-auto">
                {schedules.map((s) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-semibold text-[#0B2416]">
                        {s.day} (#{s.order}) · {s.subject}
                      </p>
                      <p className="text-[#52705E] font-mono-num">
                        {formatScheduleTimeRange(s.startTime, s.endTime)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          title: 'Hapus Jadwal?',
                          description: `Hapus ${s.subject} (${s.day}) dari jadwal?`,
                          confirmLabel: 'Hapus',
                          run: async () => {
                            await deleteScheduleItem(profile, s.id, s.subject);
                          },
                        })
                      }
                      className="text-[#52705E] hover:text-rose-600 p-2 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. Manajemen Tugas */}
          {section === 'tugas' && (
            <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-[#0B2416]">Manajemen Tugas Sekolah ({assignments.length})</h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab('tugas')}
                  className="min-h-[38px] px-3.5 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold cursor-pointer"
                >
                  Buka Menu Tugas
                </button>
              </div>
              <div className="divide-y divide-[#E6F2EA] max-h-96 overflow-y-auto">
                {assignments.map((t) => (
                  <div key={t.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0B2416] truncate">
                        {t.subject}: {t.title}
                      </p>
                      <p className="text-[#52705E]">
                        Tenggat {t.dueDate} · Oleh {t.authorName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          title: 'Hapus Tugas?',
                          description: `Hapus tugas "${t.title}"?`,
                          confirmLabel: 'Hapus Tugas',
                          run: async () => {
                            await deleteAssignment(profile, t.id, t.title);
                          },
                        })
                      }
                      className="text-[#52705E] hover:text-rose-600 p-2 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. Manajemen Pengumuman */}
          {section === 'pengumuman' && (
            <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-[#0B2416]">Manajemen Pengumuman ({announcements.length})</h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab('pengumuman')}
                  className="min-h-[38px] px-3.5 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold cursor-pointer"
                >
                  Buka Menu Pengumuman
                </button>
              </div>
              <div className="divide-y divide-[#E6F2EA] max-h-96 overflow-y-auto">
                {announcements.map((a) => (
                  <div key={a.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0B2416] truncate">{a.title}</p>
                      <p className="text-[#52705E]">
                        {a.category} · {a.pinned ? 'Disematkan' : 'Normal'} · {a.archived ? 'Arsip' : 'Aktif'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateAnnouncement(profile, a.id, { archived: !a.archived })}
                        className="px-2.5 py-1 rounded-lg bg-[#F0F7F2] border border-[#C6E0CE] text-[#0B2416] font-medium cursor-pointer"
                      >
                        {a.archived ? 'Aktifkan' : 'Arsipkan'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmAction({
                            title: 'Hapus Pengumuman?',
                            description: `Hapus pengumuman "${a.title}"?`,
                            confirmLabel: 'Hapus',
                            run: async () => {
                              await deleteAnnouncement(profile, a.id, a.title);
                            },
                          })
                        }
                        className="text-[#52705E] hover:text-rose-600 p-2 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. Manajemen Agenda */}
          {section === 'agenda' && (
            <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-[#0B2416]">Manajemen Agenda ({agendas.length})</h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab('agenda')}
                  className="min-h-[38px] px-3.5 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold cursor-pointer"
                >
                  Buka Menu Agenda
                </button>
              </div>
              <div className="divide-y divide-[#E6F2EA] max-h-96 overflow-y-auto">
                {agendas.map((ag) => (
                  <div key={ag.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0B2416] truncate">{ag.title}</p>
                      <p className="text-[#52705E]">
                        {ag.eventDate} · {ag.location} · {ag.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          title: 'Hapus Agenda?',
                          description: `Hapus agenda "${ag.title}"?`,
                          confirmLabel: 'Hapus',
                          run: async () => {
                            await deleteAgendaItem(profile, ag.id, ag.title);
                          },
                        })
                      }
                      className="text-[#52705E] hover:text-rose-600 p-2 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 10. Manajemen Uang Kas */}
          {section === 'kas' && (
            <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[#0B2416]">Manajemen Uang Kas ({treasury.length})</h3>
                  <p className="text-xs text-[#0B6B3A] font-semibold font-mono-num">
                    Saldo saat ini: {formatRupiah(treasurySummary.balance)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleBackupTreasuryCsv}
                    className="min-h-[38px] px-3.5 rounded-xl bg-[#F0F7F2] border border-[#C6E0CE] text-xs font-semibold text-[#0B2416] cursor-pointer"
                  >
                    Ekspor CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('kas')}
                    className="min-h-[38px] px-3.5 rounded-xl bg-[#0B6B3A] text-white text-xs font-semibold cursor-pointer"
                  >
                    Buka Halaman Kas
                  </button>
                </div>
              </div>
              <div className="divide-y divide-[#E6F2EA] max-h-96 overflow-y-auto">
                {treasury.map((t) => (
                  <div key={t.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0B2416] truncate">{t.description}</p>
                      <p className="text-[#52705E]">
                        {t.date} · {t.category} · {formatRupiah(t.amount)} ({t.type})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          title: 'Hapus Transaksi Kas?',
                          description: `Hapus catatan kas "${t.description}"?`,
                          confirmLabel: 'Hapus',
                          run: async () => {
                            await deleteTreasuryEntry(profile, t.id, t.description);
                          },
                        })
                      }
                      className="text-[#52705E] hover:text-rose-600 p-2 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 11. Manajemen Pesan Admin */}
          {section === 'pesan-admin' && (
            <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-[#0B2416]">Manajemen Pesan Admin ({adminMessages.length})</h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab('pesan-admin')}
                  className="min-h-[38px] px-3.5 rounded-xl bg-[#0B6B3A] text-white text-xs font-semibold cursor-pointer"
                >
                  Buka Kotak Masuk
                </button>
              </div>
              <div className="divide-y divide-[#E6F2EA] max-h-96 overflow-y-auto">
                {adminMessages.map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0B2416] truncate">
                        [{m.category}] {m.subject}
                      </p>
                      <p className="text-[#52705E]">
                        Dari {m.senderName} · Status: {m.status}
                      </p>
                    </div>
                    {m.status === 'menunggu' && (
                      <button
                        type="button"
                        onClick={() =>
                          replyAdminMessage(profile, m.id, m.senderId, m.subject, 'dibaca', m.adminReply)
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#F0F7F2] border border-[#C6E0CE] text-[#0B6B3A] font-semibold cursor-pointer shrink-0"
                      >
                        Tandai Dibaca
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 12. Manajemen Notifikasi */}
          {section === 'notifikasi' && (
            <div className="space-y-4">
              <form onSubmit={handleBroadcastNotif} className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-3">
                <h3 className="text-base font-semibold text-[#0B2416]">Kirim Notifikasi Info Kelas Real-Time</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    placeholder="Judul notifikasi"
                    className="sm:col-span-2 min-h-[42px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416]"
                  />
                  <select
                    value={notifTab}
                    onChange={(e) => setNotifTab(e.target.value as NavTab)}
                    aria-label="Halaman tujuan notifikasi"
                    className="min-h-[42px] px-3 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416]"
                  >
                    <option value="beranda">Beranda</option>
                    <option value="pengumuman">Pengumuman</option>
                    <option value="tugas">Tugas</option>
                    <option value="jadwal">Jadwal</option>
                    <option value="agenda">Agenda</option>
                    <option value="kas">Uang Kas</option>
                  </select>
                </div>
                <textarea
                  required
                  rows={2}
                  maxLength={300}
                  value={notifBody}
                  onChange={(e) => setNotifBody(e.target.value)}
                  placeholder="Isi pesan notifikasi untuk seluruh anggota kelas..."
                  className="w-full p-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416]"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={sendingNotif}
                    className="min-h-[42px] px-4 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold cursor-pointer"
                  >
                    {sendingNotif ? 'Mengirim...' : 'Kirim Notifikasi'}
                  </button>
                </div>
              </form>

              <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-[#0B2416]">Riwayat Notifikasi ({notifications.length})</h3>
                <div className="divide-y divide-[#E6F2EA] max-h-72 overflow-y-auto">
                  {notifications.slice(0, 20).map((n) => (
                    <div key={n.id} className="py-2.5 text-xs space-y-0.5">
                      <div className="flex justify-between text-[#52705E]">
                        <span className="text-[#0B6B3A] font-semibold">{n.type} · {n.actorName}</span>
                        <span className="font-mono-num">{formatTimestampId(n.createdAt)}</span>
                      </div>
                      <p className="font-semibold text-[#0B2416]">{n.title}</p>
                      <p className="text-[#2F4F3C]">{n.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 13. Pengaturan Kelas */}
          {section === 'pengaturan-kelas' && (
            <form onSubmit={handleSaveSettings} className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-semibold text-[#0B2416]">Pengaturan Profil &amp; Identitas Kelas 6A</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#2F4F3C] font-medium mb-1">Nama Wali Kelas</label>
                  <input
                    type="text"
                    required
                    value={homeroomTeacher}
                    onChange={(e) => setHomeroomTeacher(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#2F4F3C] font-medium mb-1">Tahun Ajaran</label>
                  <input
                    type="text"
                    required
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#2F4F3C] font-medium mb-1">Motto Kelas</label>
                <input
                  type="text"
                  required
                  value={motto}
                  onChange={(e) => setMotto(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#2F4F3C] font-medium mb-1">Target Uang Kas Mingguan (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={weeklyKasTarget}
                    onChange={(e) => setWeeklyKasTarget(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#2F4F3C] font-medium mb-1">Catatan Kontak Admin</label>
                  <input
                    type="text"
                    value={adminContactNote}
                    onChange={(e) => setAdminContactNote(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#2F4F3C] font-medium mb-1">
                  Tautan Undangan Resmi Grup WhatsApp Kelas 6A
                </label>
                <input
                  type="url"
                  value={whatsappGroupUrl}
                  onChange={(e) => setWhatsappGroupUrl(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  className="w-full min-h-[42px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-xs sm:text-sm text-[#0B2416] font-mono-num"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="min-h-[42px] px-4 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan Kelas'}</span>
                </button>
              </div>
            </form>
          )}

          {/* 14. Pengaturan Aplikasi */}
          {section === 'pengaturan-aplikasi' && (
            <form onSubmit={handleSaveSettings} className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-semibold text-[#0B2416]">Pengaturan Fitur &amp; Izin Aplikasi</h3>
              <div className="space-y-3 text-sm">
                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8] cursor-pointer">
                  <div>
                    <p className="font-semibold text-[#0B2416]">Izinkan Siswa Menambah Tugas Sekolah</p>
                    <p className="text-xs text-[#52705E]">Siswa dapat mencatat tugas baru untuk diketahui teman sekelas.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowStudentCreateTask}
                    onChange={(e) => setAllowStudentCreateTask(e.target.checked)}
                    className="w-4 h-4 accent-[#0B6B3A]"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8] cursor-pointer">
                  <div>
                    <p className="font-semibold text-[#0B2416]">Izinkan Siswa Menambah Agenda Kelas</p>
                    <p className="text-xs text-[#52705E]">Siswa dapat mengusulkan jadwal kegiatan atau kerja bakti.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowStudentCreateAgenda}
                    onChange={(e) => setAllowStudentCreateAgenda(e.target.checked)}
                    className="w-4 h-4 accent-[#0B6B3A]"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8] cursor-pointer">
                  <div>
                    <p className="font-semibold text-[#0B2416]">Izinkan Admin Mengelola Jadwal Pelajaran</p>
                    <p className="text-xs text-[#52705E]">Pengurus Admin diperbolehkan menambah atau memperbarui jam pelajaran.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowAdminManageSchedule}
                    onChange={(e) => setAllowAdminManageSchedule(e.target.checked)}
                    className="w-4 h-4 accent-[#0B6B3A]"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8] cursor-pointer">
                  <div>
                    <p className="font-semibold text-[#0B2416]">Izinkan Admin Mengelola Uang Kas</p>
                    <p className="text-xs text-[#52705E]">Bendahara/Admin diperbolehkan mencatat &amp; mengoreksi uang kas.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowAdminManageTreasury}
                    onChange={(e) => setAllowAdminManageTreasury(e.target.checked)}
                    className="w-4 h-4 accent-[#0B6B3A]"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8] cursor-pointer">
                  <div>
                    <p className="font-semibold text-[#0B2416]">Aktifkan Fitur Game Center &amp; Komunitas Mabar</p>
                    <p className="text-xs text-[#52705E]">Menampilkan halaman Game Center (FF, MLBB, Roblox, FC Mobile) untuk siswa.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowGameCenter}
                    onChange={(e) => setAllowGameCenter(e.target.checked)}
                    className="w-4 h-4 accent-[#0B6B3A]"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8] cursor-pointer">
                  <div>
                    <p className="font-semibold text-[#0B2416]">Izinkan Chat Pribadi Antarsiswa (DM)</p>
                    <p className="text-xs text-[#52705E]">Siswa dapat mengirim pesan 1-on-1 terpantau di portal kelas.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowPrivateChat}
                    onChange={(e) => setAllowPrivateChat(e.target.checked)}
                    className="w-4 h-4 accent-[#0B6B3A]"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8] cursor-pointer">
                  <div>
                    <p className="font-semibold text-[#0B2416]">Izinkan Rekam &amp; Kirim Pesan Suara (Mikrofon)</p>
                    <p className="text-xs text-[#52705E]">Mengaktifkan tombol mikrofon di kolom chat real-time.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowVoiceNotes}
                    onChange={(e) => setAllowVoiceNotes(e.target.checked)}
                    className="w-4 h-4 accent-[#0B6B3A]"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8] cursor-pointer">
                  <div>
                    <p className="font-semibold text-[#0B2416]">Izinkan Upload Foto, Kamera, &amp; Video di Chat</p>
                    <p className="text-xs text-[#52705E]">Siswa dapat mengirim foto terkompresi dan video maks. 15 MB di ruang chat.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowMediaUpload}
                    onChange={(e) => setAllowMediaUpload(e.target.checked)}
                    className="w-4 h-4 accent-[#0B6B3A]"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="min-h-[42px] px-4 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan Aplikasi'}</span>
                </button>
              </div>
            </form>
          )}

          {/* 15. Status Koneksi Firebase */}
          {section === 'koneksi-firebase' && (
            <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[#0B2416]">Status Koneksi Firebase &amp; Persistensi</h3>
                  <p className="text-xs text-[#52705E]">
                    Uji latensi langsung ke server Cloud Firestore.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={checkingConn}
                  onClick={handleTestFirebase}
                  className="min-h-[42px] px-4 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold cursor-pointer"
                >
                  {checkingConn ? 'Menguji...' : 'Uji Koneksi Sekarang'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8]">
                  <p className="text-[#52705E]">Firebase Project ID</p>
                  <p className="font-mono-num font-bold text-[#0B2416] mt-1">{firebaseConfig.projectId}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8]">
                  <p className="text-[#52705E]">Firestore Database ID</p>
                  <p className="font-mono-num font-bold text-[#0B6B3A] mt-1">{firebaseConfig.firestoreDatabaseId}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8]">
                  <p className="text-[#52705E]">Auth Persistence</p>
                  <p className="font-semibold text-[#0B6B3A] mt-1 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>browserLocalPersistence (Tetap Login)</span>
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8]">
                  <p className="text-[#52705E]">Status Jaringan Browser</p>
                  <p className="font-semibold text-[#0B2416] mt-1">
                    {typeof navigator !== 'undefined' && navigator.onLine ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>

              {connResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                    connResult.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{connResult.message}</span>
                  </span>
                  <span className="font-mono-num font-bold">{connResult.latencyMs} ms</span>
                </div>
              )}
            </div>
          )}

          {/* 16. Log Kesalahan */}
          {section === 'log-kesalahan' && (
            <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[#0B2416]">Log Kesalahan Sesi ({clientErrors.length})</h3>
                  <p className="text-xs text-[#52705E]">Catatan error runtime atau penolakan jaringan pada sesi browser ini.</p>
                </div>
                {clientErrors.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearClientErrors}
                    className="px-3 py-1.5 rounded-xl bg-[#F0F7F2] border border-[#C6E0CE] text-xs font-medium text-[#0B2416] cursor-pointer"
                  >
                    Bersihkan Log
                  </button>
                )}
              </div>
              {clientErrors.length === 0 ? (
                <p className="py-8 text-center text-xs text-[#0B6B3A] font-medium">
                  Tidak ada error yang tercatat pada sesi ini.
                </p>
              ) : (
                <div className="divide-y divide-[#E6F2EA] max-h-80 overflow-y-auto">
                  {clientErrors.map((err) => (
                    <div key={err.id} className="py-2.5 text-xs space-y-0.5">
                      <div className="flex justify-between text-rose-700">
                        <span className="font-semibold">{err.source}</span>
                        <span className="font-mono-num text-[#52705E]">{err.timestamp}</span>
                      </div>
                      <p className="text-[#2F4F3C] break-words">{err.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 17. Backup & Ekspor Data */}
          {section === 'backup-ekspor' && (
            <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-semibold text-[#0B2416]">Backup &amp; Ekspor Data Kelas</h3>
              <p className="text-xs text-[#2F4F3C] leading-relaxed">
                Unduh salinan cadangan data kelas secara aman ke perangkat Anda dalam format JSON lengkap atau CSV khusus keuangan uang kas. Tidak tersedia penghapusan massal database demi keamanan data kelas.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleBackupJson}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Backup Lengkap (.JSON)</span>
                </button>
                <button
                  type="button"
                  onClick={handleBackupTreasuryCsv}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Laporan Kas (.CSV)</span>
                </button>
              </div>
            </div>
          )}

          {/* 18. Audit Perubahan Data */}
          {section === 'audit-perubahan' && (
            <div className="bg-white border border-[#D3E6D8] rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-5 bg-[#F0F7F2] border-b border-[#E2EFE6]">
                <h3 className="text-base font-semibold text-[#0B2416]">Audit Perubahan &amp; Koreksi Data ({auditLogs.length})</h3>
                <p className="text-xs text-[#52705E]">
                  Jejak khusus pengeditan, penghapusan, koreksi kas, perubahan role, dan pembaruan pengaturan.
                </p>
              </div>
              {auditLogs.length === 0 ? (
                <p className="p-8 text-center text-xs text-[#52705E]">Belum ada catatan perubahan data.</p>
              ) : (
                <div className="divide-y divide-[#E6F2EA] max-h-96 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-4 flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold text-amber-800">
                          {log.action} · <span className="text-[#0B2416]">{log.actorName}</span> ({log.targetCollection})
                        </p>
                        <p className="text-[#2F4F3C]">{log.detail}</p>
                      </div>
                      <span className="font-mono-num text-[#52705E] shrink-0">
                        {formatTimestampId(log.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 19. Moderasi & Laporan Chat / Game */}
          {section === 'moderasi-laporan' && (
            <div className="bg-white border border-[#D3E6D8] rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-5 bg-[#F0F7F2] border-b border-[#E2EFE6] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-[#0B2416]">
                    Moderasi &amp; Laporan Pelanggaran ({userReports.length})
                  </h3>
                  <p className="text-xs text-[#52705E]">
                    Tinjau laporan spam, penipuan, perundungan, atau penyebaran data pribadi dari Chat &amp; Game Center.
                  </p>
                </div>
                <span className="font-mono-num text-xs font-bold text-rose-700">
                  {userReports.filter((r) => r.status === 'menunggu').length} menunggu
                </span>
              </div>

              {userReports.length === 0 ? (
                <p className="p-8 text-center text-xs text-[#52705E]">
                  Belum ada laporan moderasi dari anggota kelas.
                </p>
              ) : (
                <div className="divide-y divide-[#E6F2EA] max-h-[32rem] overflow-y-auto">
                  {userReports.map((rep) => {
                    const targetMember = members.find((m) => m.uid === rep.targetUid);
                    const noteVal = resolutionNotes[rep.id] ?? rep.resolutionNote ?? '';
                    return (
                      <div key={rep.id} className="p-4 space-y-2.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Flag className="w-3.5 h-3.5 text-rose-600" />
                            <span className="font-bold text-[#0B2416]">
                              Terlapor: {rep.targetName}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-semibold text-[10px]">
                              {rep.category}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                                rep.status === 'menunggu'
                                  ? 'bg-rose-100 text-rose-800'
                                  : rep.status === 'ditindak'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {rep.status}
                            </span>
                          </div>
                          <span className="font-mono-num text-[#52705E]">
                            Pelapor: {rep.reporterName} · {formatTimestampId(rep.createdAt)}
                          </span>
                        </div>

                        <p className="text-[#2F4F3C]">{rep.reason}</p>
                        {rep.messageExcerpt && (
                          <p className="p-2 rounded-lg bg-[#F8FCF9] border border-[#D3E6D8] italic text-[#52705E]">
                            Kutipan pesan: &ldquo;{rep.messageExcerpt}&rdquo;
                          </p>
                        )}

                        {rep.status === 'menunggu' ? (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={noteVal}
                              onChange={(e) =>
                                setResolutionNotes((prev) => ({
                                  ...prev,
                                  [rep.id]: e.target.value,
                                }))
                              }
                              placeholder="Catatan tindakan (opsional)"
                              className="flex-1 min-w-[180px] min-h-[34px] px-3 rounded-lg border border-[#B9D8C2] text-xs"
                            />
                            <button
                              type="button"
                              disabled={busyId === rep.id}
                              onClick={async () => {
                                setBusyId(rep.id);
                                try {
                                  await resolveUserReport(profile, rep.id, 'ditindak', noteVal);
                                  setFeedback(`Laporan terhadap ${rep.targetName} ditandai ditindak.`);
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                              className="min-h-[34px] px-3 rounded-lg bg-[#0B6B3A] text-white font-semibold cursor-pointer"
                            >
                              Tandai Ditindak
                            </button>
                            <button
                              type="button"
                              disabled={busyId === rep.id}
                              onClick={async () => {
                                setBusyId(rep.id);
                                try {
                                  await resolveUserReport(profile, rep.id, 'diabaikan', noteVal);
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                              className="min-h-[34px] px-3 rounded-lg bg-[#F0F7F2] border border-[#C6E0CE] text-[#2F4F3C] font-semibold cursor-pointer"
                            >
                              Abaikan
                            </button>
                            {targetMember && targetMember.role !== 'owner' && targetMember.status === 'aktif' && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmAction({
                                    title: 'Nonaktifkan Akun Pelanggar?',
                                    description: `Nonaktifkan sementara akun ${targetMember.displayName}?`,
                                    confirmLabel: 'Nonaktifkan',
                                    run: async () => {
                                      await updateMemberRoleAndStatus(profile, targetMember, {
                                        status: 'nonaktif',
                                      });
                                      await resolveUserReport(
                                        profile,
                                        rep.id,
                                        'ditindak',
                                        noteVal || 'Akun dinonaktifkan oleh Owner.'
                                      );
                                    },
                                  })
                                }
                                className="min-h-[34px] px-3 rounded-lg bg-rose-600 text-white font-semibold cursor-pointer"
                              >
                                Nonaktifkan Akun
                              </button>
                            )}
                          </div>
                        ) : (
                          rep.resolutionNote && (
                            <p className="text-[11px] text-[#0B6B3A]">
                              Catatan {rep.resolvedBy}: {rep.resolutionNote}
                            </p>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 20. Grup Chat & Game Center */}
          {section === 'grup-game-chat' && (
            <div className="space-y-4">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setCreatingGroup(true);
                  setFeedback(null);
                  try {
                    await createCustomGroupRoom(profile, newGroupName, newGroupDesc);
                    setNewGroupName('');
                    setNewGroupDesc('');
                    setFeedback('Sub-grup diskusi internal kelas berhasil dibuat.');
                  } catch (err) {
                    setFeedback(err instanceof Error ? err.message : 'Gagal membuat grup.');
                  } finally {
                    setCreatingGroup(false);
                  }
                }}
                className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-3"
              >
                <h3 className="text-base font-semibold text-[#0B2416] flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#0B6B3A]" />
                  <span>Buat Grup Chat Internal Kelas Baru</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={100}
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Nama grup diskusi"
                    className="min-h-[42px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416]"
                  />
                  <input
                    type="text"
                    maxLength={240}
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="Deskripsi singkat grup"
                    className="min-h-[42px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('game-center')}
                    className="min-h-[40px] px-4 rounded-xl bg-[#F0F7F2] border border-[#C6E0CE] text-xs font-semibold text-[#0B6B3A] cursor-pointer"
                  >
                    Buka Game Center
                  </button>
                  <button
                    type="submit"
                    disabled={creatingGroup}
                    className="min-h-[40px] px-4 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold cursor-pointer"
                  >
                    {creatingGroup ? 'Membuat...' : 'Tambah Grup'}
                  </button>
                </div>
              </form>

              <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-[#0B2416]">
                  Daftar Ruang Chat Aktif ({chatRooms.length})
                </h3>
                {chatRooms.length === 0 ? (
                  <p className="text-xs text-[#52705E] py-4 text-center">
                    Belum ada ruang chat kustom/tercatat di Firestore.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E6F2EA] max-h-96 overflow-y-auto">
                    {chatRooms.map((r) => (
                      <div key={r.roomId} className="py-3 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0B2416] truncate">
                            [{r.type.toUpperCase()}] {r.name}
                          </p>
                          <p className="text-[#52705E] truncate">{r.lastMessageText || r.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {onOpenChatRoom && (
                            <button
                              type="button"
                              onClick={() => onOpenChatRoom(r.roomId)}
                              className="px-3 py-1.5 rounded-lg bg-[#E6F4EC] text-[#0B6B3A] font-semibold cursor-pointer"
                            >
                              Buka
                            </button>
                          )}
                          {r.type === 'group' && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmAction({
                                  title: 'Hapus Grup Diskusi?',
                                  description: `Hapus grup "${r.name}"?`,
                                  confirmLabel: 'Hapus',
                                  run: async () => {
                                    await deleteCustomGroupRoom(profile, r.roomId, r.name);
                                  },
                                })
                              }
                              className="p-2 text-rose-600 hover:text-rose-800 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <ConfirmModal
        open={Boolean(confirmAction)}
        title={confirmAction?.title ?? ''}
        description={confirmAction?.description ?? ''}
        confirmLabel={confirmAction?.confirmLabel ?? 'Lanjutkan'}
        onConfirm={runConfirmed}
        onCancel={() => setConfirmAction(null)}
        busy={confirmBusy}
      />
    </div>
  );
}
