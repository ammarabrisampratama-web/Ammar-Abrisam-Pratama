import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BellRing,
  BookCheck,
  Bot,
  CalendarDays,
  ClipboardCheck,
  Clock,
  ExternalLink,
  Gamepad2,
  Inbox,
  Megaphone,
  MessageSquare,
  Search,
  Sparkles,
  Wallet,
} from 'lucide-react';
import type {
  ActivityLog,
  AdminMessage,
  AgendaItem,
  Announcement,
  Assignment,
  ClassSettings,
  NavTab,
  NotificationItem,
  PicketScheduleItem,
  ScheduleItem,
  TaskProgressStatus,
  TreasuryEntry,
  UserPublic,
} from '../../types';
import {
  isSafeExternalHttpUrl,
  OFFICIAL_WHATSAPP_GROUP_URL,
} from '../../utils/mediaUtils';
import {
  calculateTreasurySummary,
  deriveTaskStatus,
  evaluateDayScheduleStatus,
  formatRupiah,
  formatScheduleTimeRange,
  formatTimestampId,
  getJakartaDateString,
  getJakartaFullDateTimeLabel,
  getJakartaTimeHHMM,
  getRoleLabel,
  getTodayIndonesianDay,
  getUserDisplayLabel,
  isSundayJakarta,
  sortSchedulesForDay,
} from '../../utils/validation';
import { canUseC6ABot } from '../../utils/c6aBot';
import { CrestLogo } from '../CrestLogo';

function WhatsAppIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12.03 2C6.51 2 2.02 6.48 2.02 12c0 1.97.57 3.81 1.56 5.36L2 22l4.79-1.54A9.96 9.96 0 0 0 12.03 22c5.52 0 10-4.48 10-10S17.55 2 12.03 2Zm5.84 14.12c-.25.7-1.45 1.34-2.01 1.42-.52.08-1.18.11-1.91-.12-.44-.14-1-.33-1.72-.64-3.03-1.31-5-4.37-5.15-4.57-.15-.2-1.23-1.64-1.23-3.13 0-1.49.78-2.22 1.05-2.52.27-.3.6-.38.8-.38.2 0 .4 0 .57.01.18.01.43-.07.67.51.25.6.85 2.08.92 2.23.08.15.13.33.03.53-.1.2-.15.33-.3.5-.15.18-.32.4-.45.54-.15.15-.31.32-.13.62.18.3.8 1.32 1.71 2.13 1.18 1.05 2.17 1.38 2.47 1.53.3.15.48.13.66-.08.18-.2.76-.88.96-1.18.2-.3.4-.25.67-.15.27.1 1.74.82 2.04.97.3.15.5.22.57.35.08.13.08.73-.17 1.42Z" />
    </svg>
  );
}

interface DashboardViewProps {
  profile: UserPublic;
  settings: ClassSettings;
  announcements: Announcement[];
  assignments: Assignment[];
  taskProgressMap: Map<string, TaskProgressStatus>;
  schedules: ScheduleItem[];
  picketSchedules?: PicketScheduleItem[];
  agendas: AgendaItem[];
  treasury: TreasuryEntry[];
  adminMessages: AdminMessage[];
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  activityLogs: ActivityLog[];
  onNavigate: (tab: NavTab) => void;
  onOpenSearch: () => void;
  needsOfficialScheduleSync: boolean;
  onInitSchedule: () => Promise<void>;
  isInitializingSchedule: boolean;
}

export function DashboardView({
  profile,
  settings,
  announcements,
  assignments,
  taskProgressMap,
  schedules,
  picketSchedules = [],
  agendas,
  treasury,
  adminMessages,
  unreadNotificationsCount,
  activityLogs,
  onNavigate,
  onOpenSearch,
  needsOfficialScheduleSync,
  onInitSchedule,
  isInitializingSchedule,
}: DashboardViewProps) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const todayStr = getJakartaDateString(now);
  const nowHHMM = getJakartaTimeHHMM(now);
  const isSunday = isSundayJakarta(now);
  const todayDay = getTodayIndonesianDay(now);
  const todaySchedules = isSunday ? [] : sortSchedulesForDay(schedules, todayDay);
  const scheduleStatus = evaluateDayScheduleStatus(todaySchedules, nowHHMM);
  const todayPicket = isSunday
    ? null
    : picketSchedules.find((p) => p.day === todayDay) ?? null;

  const activeTasks = assignments.filter((a) => {
    const derived = deriveTaskStatus(a.dueDate, taskProgressMap.get(a.id), todayStr);
    return derived !== 'selesai';
  });
  const overdueTasksCount = activeTasks.filter(
    (a) => deriveTaskStatus(a.dueDate, taskProgressMap.get(a.id), todayStr) === 'terlambat'
  ).length;

  const activeAnnouncements = announcements
    .filter((a) => !a.archived)
    .slice()
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  const upcomingAgendas = agendas
    .filter((a) => a.status === 'mendatang')
    .slice()
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  const treasurySummary = calculateTreasurySummary(treasury);
  const pendingAdminMessages = adminMessages.filter((m) => m.status === 'menunggu').length;
  const nickname = getUserDisplayLabel(profile);

  const rawWaUrl = settings.whatsappGroupUrl?.trim() || OFFICIAL_WHATSAPP_GROUP_URL;
  const waUrl = isSafeExternalHttpUrl(rawWaUrl) ? rawWaUrl : OFFICIAL_WHATSAPP_GROUP_URL;

  return (
    <div className="space-y-6">
      {/* Welcome Banner + Live WIB Clock + Class Info + Official Emblem */}
      <section className="bg-gradient-to-br from-[#0B6B3A] to-[#084D2A] text-white rounded-2xl p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-sm">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <div className="hidden sm:block shrink-0">
            <CrestLogo size="lg" variant="kelas6a" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
              <span className="font-semibold text-emerald-100">
                {getRoleLabel(profile.role)}
                {profile.absenNumber > 0 ? ` · No. Absen ${profile.absenNumber}` : ''}
              </span>
              <span className="text-emerald-300/70">·</span>
              <span className="font-mono-num text-emerald-50/90">
                {getJakartaFullDateTimeLabel(now)} WIB
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white text-balance">
              Assalamu&apos;alaikum, {nickname}
            </h2>
            <p className="text-sm text-emerald-50/90 max-w-2xl">
              {settings.homeroomTeacher} · Tahun Ajaran {settings.academicYear}.{' '}
              <span className="text-emerald-100/80">{settings.motto}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenSearch}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Search className="w-4 h-4" />
            <span>Cari Portal</span>
          </button>

          {(profile.role === 'owner' || profile.role === 'admin') && needsOfficialScheduleSync && (
            <button
              type="button"
              disabled={isInitializingSchedule}
              onClick={onInitSchedule}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-[#0B2416] font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isInitializingSchedule ? 'Menyinkronkan...' : 'Terapkan Jadwal 6 Hari'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigate('c6a-ai')}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Bot className="w-4 h-4" />
            <span>{canUseC6ABot(profile.role) ? 'Bot & AI C6A' : 'C6A AI'}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('chat')}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white hover:bg-[#ECF7F0] text-[#0B6B3A] font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shadow-sm"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat Kelas</span>
          </button>
        </div>
      </section>

      {/* Super Upgrade Quick Hub: WhatsApp Grup 6A + Game Center + Piket Hari Ini */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#0F2419] border border-[#C6E0CE] dark:border-emerald-800/70 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#075E54] dark:text-emerald-300">
                <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                <span>Grup WhatsApp Kelas 6A</span>
              </span>
              <button
                type="button"
                onClick={() => onNavigate('grup-kelas')}
                className="text-[11px] font-semibold text-[#0B6B3A] dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Info Grup
              </button>
            </div>
            <p className="text-xs text-[#52705E] dark:text-emerald-300/80 leading-relaxed">
              Tautan resmi grup WhatsApp siswa &amp; info komunitas kelas (dibuka langsung via WhatsApp).
            </p>
          </div>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#1EBE5B] text-[#062E19] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <WhatsAppIcon className="w-4 h-4" />
            <span>Gabung Grup WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B2416] dark:text-emerald-100">
              <Gamepad2 className="w-4 h-4 text-amber-600" />
              <span>Game Center &amp; Cari Teman Mabar</span>
            </span>
            <p className="text-xs text-[#52705E] dark:text-emerald-300/80 leading-relaxed">
              Komunitas Free Fire, Mobile Legends, Roblox, dan EA SPORTS FC Mobile dengan ruang chat &amp; moderasi.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('game-center')}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#F0F7F2] dark:bg-[#132C1E] hover:bg-[#E2EFE6] dark:hover:bg-[#1A3927] border border-[#C6E0CE] dark:border-emerald-800 text-[#0B6B3A] dark:text-emerald-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Buka Game Center</span>
          </button>
        </div>

        <div className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B2416] dark:text-emerald-100">
                <ClipboardCheck className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
                <span>Piket {isSunday ? 'Minggu' : todayDay}</span>
              </span>
              <button
                type="button"
                onClick={() => onNavigate('piket')}
                className="text-[11px] font-semibold text-[#0B6B3A] dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Jadwal Piket
              </button>
            </div>
            <p className="text-xs text-[#52705E] dark:text-emerald-300/80 leading-relaxed truncate">
              {isSunday
                ? 'Hari Minggu libur sekolah.'
                : todayPicket && todayPicket.students.length > 0
                  ? `Petugas: ${todayPicket.students.join(', ')}`
                  : 'Daftar siswa piket dapat dilihat di menu Piket Kelas.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('piket')}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#F0F7F2] dark:bg-[#132C1E] hover:bg-[#E2EFE6] dark:hover:bg-[#1A3927] border border-[#C6E0CE] dark:border-emerald-800 text-[#0B6B3A] dark:text-emerald-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Lihat Piket 6 Hari</span>
          </button>
        </div>
      </section>

      {/* Primary Stats Grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigate('tugas')}
          className="text-left bg-white dark:bg-[#0F2419] hover:bg-[#F7FBF8] dark:hover:bg-[#132C1E] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#52705E] dark:text-emerald-300/80 text-xs">
            <span>Tugas Aktif</span>
            <BookCheck className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-[#0B2416] dark:text-emerald-50 mt-2 font-mono-num">
            {activeTasks.length}
          </p>
          <p className="text-[11px] text-[#52705E] dark:text-emerald-300/80 mt-0.5">
            {overdueTasksCount > 0 ? `${overdueTasksCount} terlambat` : `dari ${assignments.length} tugas`}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('jadwal')}
          className="text-left bg-white dark:bg-[#0F2419] hover:bg-[#F7FBF8] dark:hover:bg-[#132C1E] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#52705E] dark:text-emerald-300/80 text-xs">
            <span>Mapel {isSunday ? 'Minggu' : todayDay}</span>
            <Clock className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-[#0B2416] dark:text-emerald-50 mt-2 font-mono-num">
            {todaySchedules.length}
          </p>
          <p className="text-[11px] text-[#52705E] dark:text-emerald-300/80 mt-0.5 truncate">
            {isSunday ? 'Hari libur sekolah' : scheduleStatus.currentLesson?.subject || 'Lihat jadwal'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('pengumuman')}
          className="text-left bg-white dark:bg-[#0F2419] hover:bg-[#F7FBF8] dark:hover:bg-[#132C1E] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#52705E] dark:text-emerald-300/80 text-xs">
            <span>Pengumuman</span>
            <Megaphone className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-[#0B2416] dark:text-emerald-50 mt-2 font-mono-num">
            {activeAnnouncements.length}
          </p>
          <p className="text-[11px] text-[#52705E] dark:text-emerald-300/80 mt-0.5">informasi aktif</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('agenda')}
          className="text-left bg-white dark:bg-[#0F2419] hover:bg-[#F7FBF8] dark:hover:bg-[#132C1E] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#52705E] dark:text-emerald-300/80 text-xs">
            <span>Agenda</span>
            <CalendarDays className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-[#0B2416] dark:text-emerald-50 mt-2 font-mono-num">
            {upcomingAgendas.length}
          </p>
          <p className="text-[11px] text-[#52705E] dark:text-emerald-300/80 mt-0.5">kegiatan mendatang</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('kas')}
          className="text-left bg-white dark:bg-[#0F2419] hover:bg-[#F7FBF8] dark:hover:bg-[#132C1E] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#52705E] dark:text-emerald-300/80 text-xs">
            <span>Saldo Kas</span>
            <Wallet className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
          </div>
          <p className="text-lg font-bold text-[#0B6B3A] dark:text-emerald-300 mt-2 font-mono-num truncate">
            {formatRupiah(treasurySummary.balance)}
          </p>
          <p className="text-[11px] text-[#52705E] dark:text-emerald-300/80 mt-0.5">{treasury.length} transaksi</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('pesan-admin')}
          className="text-left bg-white dark:bg-[#0F2419] hover:bg-[#F7FBF8] dark:hover:bg-[#132C1E] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#52705E] dark:text-emerald-300/80 text-xs">
            <span>Pesan &amp; Notif</span>
            <BellRing className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-[#0B2416] dark:text-emerald-50 mt-2 font-mono-num">
            {unreadNotificationsCount}
          </p>
          <p className="text-[11px] text-[#52705E] dark:text-emerald-300/80 mt-0.5">
            {pendingAdminMessages} pesan menunggu
          </p>
        </button>
      </section>

      {/* Main Content Columns */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {/* Today's Schedule */}
          <div className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
                <h3 className="text-base font-semibold text-[#0B2416] dark:text-emerald-50">
                  {isSunday ? 'Jadwal Hari Ini (Minggu · Libur)' : `Jadwal Hari ${todayDay}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('jadwal')}
                className="text-xs font-semibold text-[#0B6B3A] dark:text-emerald-400 hover:text-[#084D2A] flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>6 Hari</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {!isSunday && todaySchedules.length > 0 && (
              <div className="p-3 rounded-xl bg-[#F0F7F2] dark:bg-[#132C1E] border border-[#D3E6D8] dark:border-emerald-900 text-xs text-[#2F4F3C] dark:text-emerald-200 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {scheduleStatus.currentLesson
                    ? `Sedang berlangsung: ${scheduleStatus.currentLesson.subject}`
                    : scheduleStatus.hasConfiguredTimes
                      ? 'Tidak ada pelajaran aktif saat ini'
                      : 'Jam pelajaran belum diatur oleh Owner'}
                </span>
                {scheduleStatus.nextLesson && (
                  <span className="text-[#0B6B3A] dark:text-emerald-300 font-semibold">
                    Berikutnya: {scheduleStatus.nextLesson.subject}
                  </span>
                )}
              </div>
            )}

            {todaySchedules.length === 0 ? (
              <p className="text-sm text-[#52705E] dark:text-emerald-300/80 py-4 text-center">
                {isSunday
                  ? 'Hari Minggu tidak ada kegiatan belajar tatap muka.'
                  : `Belum ada pelajaran tercatat untuk hari ${todayDay}.`}
              </p>
            ) : (
              <div className="divide-y divide-[#E6F2EA] dark:divide-emerald-900/50">
                {todaySchedules.map((slot) => (
                  <div key={slot.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-[#E6F4EC] dark:bg-emerald-900/60 text-[#0B6B3A] dark:text-emerald-200 font-mono-num text-xs font-bold flex items-center justify-center shrink-0">
                        {slot.order}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0B2416] dark:text-emerald-50 truncate">
                          {slot.subject}
                        </p>
                        {(slot.teacher || slot.room) && (
                          <p className="text-xs text-[#52705E] dark:text-emerald-300/80 truncate">
                            {[slot.teacher, slot.room].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="font-mono-num text-xs text-[#0B6B3A] dark:text-emerald-300 font-medium shrink-0">
                      {formatScheduleTimeRange(slot.startTime, slot.endTime)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tasks to Complete */}
          <div className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <BookCheck className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
                <h3 className="text-base font-semibold text-[#0B2416] dark:text-emerald-50">
                  Tugas yang Perlu Dikerjakan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('tugas')}
                className="text-xs font-semibold text-[#0B6B3A] dark:text-emerald-400 hover:text-[#084D2A] flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>Semua tugas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeTasks.length === 0 ? (
              <p className="text-sm text-[#52705E] dark:text-emerald-300/80 py-4 text-center">
                Semua tugas Anda sudah ditandai selesai.
              </p>
            ) : (
              <div className="divide-y divide-[#E6F2EA] dark:divide-emerald-900/50">
                {activeTasks.slice(0, 4).map((task) => {
                  const status = deriveTaskStatus(task.dueDate, taskProgressMap.get(task.id), todayStr);
                  return (
                    <div key={task.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-[#0B6B3A] dark:text-emerald-400 font-semibold">
                          {task.subject}
                        </p>
                        <p className="text-sm font-semibold text-[#0B2416] dark:text-emerald-50 truncate">
                          {task.title}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono-num text-xs text-[#2F4F3C] dark:text-emerald-200">
                          {task.dueDate}
                        </p>
                        <p
                          className={`text-[11px] font-semibold ${
                            status === 'terlambat'
                              ? 'text-rose-700 dark:text-rose-400'
                              : status === 'sedang'
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-[#52705E] dark:text-emerald-300/80'
                          }`}
                        >
                          {status === 'terlambat'
                            ? 'Terlambat'
                            : status === 'sedang'
                              ? 'Sedang dikerjakan'
                              : 'Belum selesai'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Megaphone className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
                <h3 className="text-base font-semibold text-[#0B2416] dark:text-emerald-50">
                  Pengumuman Terbaru
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('pengumuman')}
                className="text-xs font-semibold text-[#0B6B3A] dark:text-emerald-400 hover:text-[#084D2A] flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>Lihat semua</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeAnnouncements.length === 0 ? (
              <p className="text-sm text-[#52705E] dark:text-emerald-300/80 py-4 text-center">
                Belum ada pengumuman aktif.
              </p>
            ) : (
              <div className="divide-y divide-[#E6F2EA] dark:divide-emerald-900/50">
                {activeAnnouncements.slice(0, 3).map((item) => (
                  <article key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#52705E] dark:text-emerald-300/80">
                      <span className={item.pinned ? 'text-amber-700 dark:text-amber-300 font-semibold' : ''}>
                        {item.pinned ? 'Disematkan · ' : ''}
                        {item.category}
                      </span>
                      <span className="font-mono-num">{formatTimestampId(item.createdAt)}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-[#0B2416] dark:text-emerald-50">
                      {item.title}
                    </h4>
                    <p className="text-xs text-[#2F4F3C] dark:text-emerald-200/90 line-clamp-2">
                      {item.content}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CalendarDays className="w-4 h-4 text-amber-600" />
                <h3 className="text-base font-semibold text-[#0B2416] dark:text-emerald-50">
                  Agenda Terdekat
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('agenda')}
                className="text-xs font-semibold text-[#0B6B3A] dark:text-emerald-400 hover:text-[#084D2A] flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>Kalender</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingAgendas.length === 0 ? (
              <p className="text-sm text-[#52705E] dark:text-emerald-300/80 py-4 text-center">
                Belum ada agenda mendatang.
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingAgendas.slice(0, 2).map((ag) => (
                  <div key={ag.id} className="p-3 rounded-xl bg-[#F0F7F2] dark:bg-[#132C1E] border border-[#D3E6D8] dark:border-emerald-900 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-300 font-semibold font-mono-num">
                      <span>{ag.eventDate}</span>
                      <span>{ag.eventTime || 'Waktu menyusul'}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#0B2416] dark:text-emerald-50">{ag.title}</p>
                    <p className="text-xs text-[#52705E] dark:text-emerald-300/80 truncate">{ag.location}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
                <h3 className="text-base font-semibold text-[#0B2416] dark:text-emerald-50">
                  Aktivitas &amp; Pesan Terbaru
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('pesan-admin')}
                className="text-xs font-semibold text-[#0B6B3A] dark:text-emerald-400 hover:text-[#084D2A] flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>Pesan Admin</span>
              </button>
            </div>

            {activityLogs.length === 0 ? (
              <p className="text-xs text-[#52705E] dark:text-emerald-300/80 py-2 text-center">
                Belum ada aktivitas terbaru.
              </p>
            ) : (
              <div className="divide-y divide-[#E6F2EA] dark:divide-emerald-900/50">
                {activityLogs.slice(0, 4).map((log) => (
                  <div key={log.id} className="py-2 first:pt-0 last:pb-0 text-xs space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#0B6B3A] dark:text-emerald-400">
                        {log.action}
                      </span>
                      <span className="text-[#52705E] dark:text-emerald-400/80 font-mono-num">
                        {formatTimestampId(log.createdAt)}
                      </span>
                    </div>
                    <p className="text-[#2F4F3C] dark:text-emerald-200/90 truncate">
                      {log.actorName}: {log.detail}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
