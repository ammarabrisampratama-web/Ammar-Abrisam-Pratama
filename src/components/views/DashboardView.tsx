import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BellRing,
  BookCheck,
  Bot,
  CalendarDays,
  Clock,
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
  ScheduleItem,
  TaskProgressStatus,
  TreasuryEntry,
  UserPublic,
} from '../../types';
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

interface DashboardViewProps {
  profile: UserPublic;
  settings: ClassSettings;
  announcements: Announcement[];
  assignments: Assignment[];
  taskProgressMap: Map<string, TaskProgressStatus>;
  schedules: ScheduleItem[];
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

      {/* Primary Stats Grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigate('tugas')}
          className="text-left bg-white hover:bg-[#F7FBF8] border border-[#D3E6D8] rounded-2xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#52705E] text-xs">
            <span>Tugas Aktif</span>
            <BookCheck className="w-4 h-4 text-[#0B6B3A]" />
          </div>
          <p className="text-2xl font-bold text-[#0B2416] mt-2 font-mono-num">{activeTasks.length}</p>
          <p className="text-[11px] text-[#52705E] mt-0.5">
            {overdueTasksCount > 0 ? `${overdueTasksCount} terlambat` : `dari ${assignments.length} tugas`}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('jadwal')}
          className="text-left bg-white hover:bg-[#F7FBF8] border border-[#D3E6D8] rounded-2xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#52705E] text-xs">
            <span>Mapel {isSunday ? 'Minggu' : todayDay}</span>
            <Clock className="w-4 h-4 text-[#0B6B3A]" />
          </div>
          <p className="text-2xl font-bold text-[#0B2416] mt-2 font-mono-num">{todaySchedules.length}</p>
          <p className="text-[11px] text-[#52705E] mt-0.5 truncate">
            {isSunday ? 'Hari libur sekolah' : scheduleStatus.currentLesson?.subject || 'Lihat jadwal'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('pengumuman')}
          className="text-left bg-white hover:bg-[#F7FBF8] border border-[#D3E6D8] rounded-2xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#52705E] text-xs">
            <span>Pengumuman</span>
            <Megaphone className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-[#0B2416] mt-2 font-mono-num">{activeAnnouncements.length}</p>
          <p className="text-[11px] text-[#52705E] mt-0.5">informasi aktif</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('agenda')}
          className="text-left bg-white hover:bg-[#F7FBF8] border border-[#D3E6D8] rounded-2xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#52705E] text-xs">
            <span>Agenda</span>
            <CalendarDays className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-[#0B2416] mt-2 font-mono-num">{upcomingAgendas.length}</p>
          <p className="text-[11px] text-[#52705E] mt-0.5">kegiatan mendatang</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('kas')}
          className="text-left bg-white hover:bg-[#F7FBF8] border border-[#D3E6D8] rounded-2xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#52705E] text-xs">
            <span>Saldo Kas</span>
            <Wallet className="w-4 h-4 text-[#0B6B3A]" />
          </div>
          <p className="text-lg font-bold text-[#0B6B3A] mt-2 font-mono-num truncate">
            {formatRupiah(treasurySummary.balance)}
          </p>
          <p className="text-[11px] text-[#52705E] mt-0.5">{treasury.length} transaksi</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('pesan-admin')}
          className="text-left bg-white hover:bg-[#F7FBF8] border border-[#D3E6D8] rounded-2xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#52705E] text-xs">
            <span>Pesan &amp; Notif</span>
            <BellRing className="w-4 h-4 text-[#0B6B3A]" />
          </div>
          <p className="text-2xl font-bold text-[#0B2416] mt-2 font-mono-num">
            {unreadNotificationsCount}
          </p>
          <p className="text-[11px] text-[#52705E] mt-0.5">
            {pendingAdminMessages} pesan menunggu
          </p>
        </button>
      </section>

      {/* Main Content Columns */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Schedule & Active Assignments */}
        <div className="lg:col-span-7 space-y-6">
          {/* Today's Schedule */}
          <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#0B6B3A]" />
                <h3 className="text-base font-semibold text-[#0B2416]">
                  {isSunday ? 'Jadwal Hari Ini (Minggu · Libur)' : `Jadwal Hari ${todayDay}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('jadwal')}
                className="text-xs font-semibold text-[#0B6B3A] hover:text-[#084D2A] flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>6 Hari</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {!isSunday && todaySchedules.length > 0 && (
              <div className="p-3 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8] text-xs text-[#2F4F3C] flex flex-wrap items-center justify-between gap-2">
                <span>
                  {scheduleStatus.currentLesson
                    ? `Sedang berlangsung: ${scheduleStatus.currentLesson.subject}`
                    : scheduleStatus.hasConfiguredTimes
                      ? 'Tidak ada pelajaran aktif saat ini'
                      : 'Jam pelajaran belum diatur oleh Owner'}
                </span>
                {scheduleStatus.nextLesson && (
                  <span className="text-[#0B6B3A] font-semibold">
                    Berikutnya: {scheduleStatus.nextLesson.subject}
                  </span>
                )}
              </div>
            )}

            {todaySchedules.length === 0 ? (
              <p className="text-sm text-[#52705E] py-4 text-center">
                {isSunday
                  ? 'Hari Minggu tidak ada kegiatan belajar tatap muka.'
                  : `Belum ada pelajaran tercatat untuk hari ${todayDay}.`}
              </p>
            ) : (
              <div className="divide-y divide-[#E6F2EA]">
                {todaySchedules.map((slot) => (
                  <div key={slot.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-[#E6F4EC] text-[#0B6B3A] font-mono-num text-xs font-bold flex items-center justify-center shrink-0">
                        {slot.order}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0B2416] truncate">{slot.subject}</p>
                        {(slot.teacher || slot.room) && (
                          <p className="text-xs text-[#52705E] truncate">
                            {[slot.teacher, slot.room].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="font-mono-num text-xs text-[#0B6B3A] font-medium shrink-0">
                      {formatScheduleTimeRange(slot.startTime, slot.endTime)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tasks to Complete */}
          <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <BookCheck className="w-4 h-4 text-[#0B6B3A]" />
                <h3 className="text-base font-semibold text-[#0B2416]">Tugas yang Perlu Dikerjakan</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('tugas')}
                className="text-xs font-semibold text-[#0B6B3A] hover:text-[#084D2A] flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>Semua tugas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeTasks.length === 0 ? (
              <p className="text-sm text-[#52705E] py-4 text-center">
                Semua tugas Anda sudah ditandai selesai.
              </p>
            ) : (
              <div className="divide-y divide-[#E6F2EA]">
                {activeTasks.slice(0, 4).map((task) => {
                  const status = deriveTaskStatus(task.dueDate, taskProgressMap.get(task.id), todayStr);
                  return (
                    <div key={task.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-[#0B6B3A] font-semibold">{task.subject}</p>
                        <p className="text-sm font-semibold text-[#0B2416] truncate">{task.title}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono-num text-xs text-[#2F4F3C]">{task.dueDate}</p>
                        <p
                          className={`text-[11px] font-semibold ${
                            status === 'terlambat'
                              ? 'text-rose-700'
                              : status === 'sedang'
                                ? 'text-amber-700'
                                : 'text-[#52705E]'
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

        {/* Right Column: Announcements, Agenda, Messages & Activity */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Megaphone className="w-4 h-4 text-[#0B6B3A]" />
                <h3 className="text-base font-semibold text-[#0B2416]">Pengumuman Terbaru</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('pengumuman')}
                className="text-xs font-semibold text-[#0B6B3A] hover:text-[#084D2A] flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>Lihat semua</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeAnnouncements.length === 0 ? (
              <p className="text-sm text-[#52705E] py-4 text-center">Belum ada pengumuman aktif.</p>
            ) : (
              <div className="divide-y divide-[#E6F2EA]">
                {activeAnnouncements.slice(0, 3).map((item) => (
                  <article key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#52705E]">
                      <span className={item.pinned ? 'text-amber-700 font-semibold' : ''}>
                        {item.pinned ? 'Disematkan · ' : ''}
                        {item.category}
                      </span>
                      <span className="font-mono-num">{formatTimestampId(item.createdAt)}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-[#0B2416]">{item.title}</h4>
                    <p className="text-xs text-[#2F4F3C] line-clamp-2">{item.content}</p>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CalendarDays className="w-4 h-4 text-amber-600" />
                <h3 className="text-base font-semibold text-[#0B2416]">Agenda Terdekat</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('agenda')}
                className="text-xs font-semibold text-[#0B6B3A] hover:text-[#084D2A] flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>Kalender</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingAgendas.length === 0 ? (
              <p className="text-sm text-[#52705E] py-4 text-center">Belum ada agenda mendatang.</p>
            ) : (
              <div className="space-y-3">
                {upcomingAgendas.slice(0, 2).map((ag) => (
                  <div key={ag.id} className="p-3 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8] space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs text-amber-700 font-semibold font-mono-num">
                      <span>{ag.eventDate}</span>
                      <span>{ag.eventTime || 'Waktu menyusul'}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#0B2416]">{ag.title}</p>
                    <p className="text-xs text-[#52705E] truncate">{ag.location}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-[#0B6B3A]" />
                <h3 className="text-base font-semibold text-[#0B2416]">Aktivitas &amp; Pesan Terbaru</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('pesan-admin')}
                className="text-xs font-semibold text-[#0B6B3A] hover:text-[#084D2A] flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>Pesan Admin</span>
              </button>
            </div>

            {activityLogs.length === 0 ? (
              <p className="text-xs text-[#52705E] py-2 text-center">Belum ada aktivitas terbaru.</p>
            ) : (
              <div className="divide-y divide-[#E6F2EA]">
                {activityLogs.slice(0, 4).map((log) => (
                  <div key={log.id} className="py-2 first:pt-0 last:pb-0 text-xs space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#0B6B3A]">{log.action}</span>
                      <span className="text-[#52705E] font-mono-num">{formatTimestampId(log.createdAt)}</span>
                    </div>
                    <p className="text-[#2F4F3C] truncate">
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
