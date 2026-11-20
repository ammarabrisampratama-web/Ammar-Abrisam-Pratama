import { useState } from 'react';
import { CalendarRange, Clock, Edit3, LayoutGrid, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import {
  createScheduleItem,
  deleteScheduleItem,
  updateScheduleItem,
} from '../../services/firestoreService';
import type { ClassSettings, DayOfWeek, ScheduleItem, UserPublic } from '../../types';
import {
  ALL_CLASS_SUBJECTS,
  canManageSchedule,
  DAYS_ORDER,
  evaluateDayScheduleStatus,
  formatScheduleTimeRange,
  getJakartaTimeHHMM,
  getTodayIndonesianDay,
  isSundayJakarta,
  sortSchedulesForDay,
} from '../../utils/validation';
import { ConfirmModal } from '../ConfirmModal';

interface ScheduleViewProps {
  profile: UserPublic;
  settings: ClassSettings;
  schedules: ScheduleItem[];
  rawSchedules: ScheduleItem[];
  isUsingFallback: boolean;
  needsOfficialSync: boolean;
  onSyncOfficialSchedule: () => Promise<void>;
  isSyncingOfficial: boolean;
}

export function ScheduleView({
  profile,
  settings,
  schedules,
  rawSchedules,
  isUsingFallback,
  needsOfficialSync,
  onSyncOfficialSchedule,
  isSyncingOfficial,
}: ScheduleViewProps) {
  const todayDay = getTodayIndonesianDay();
  const isSunday = isSundayJakarta();
  const [viewMode, setViewMode] = useState<'6-hari' | 'per-hari'>('6-hari');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayDay);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  const [day, setDay] = useState<DayOfWeek>(todayDay);
  const [order, setOrder] = useState('1');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [subject, setSubject] = useState(ALL_CLASS_SUBJECTS[0] || 'Matematika');
  const [teacher, setTeacher] = useState('');
  const [room, setRoom] = useState('Ruang 6A');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ScheduleItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);

  const canManage = canManageSchedule(profile.role, settings);
  const nowHHMM = getJakartaTimeHHMM();
  const todayList = isSunday ? [] : sortSchedulesForDay(schedules, todayDay);
  const todayStatus = evaluateDayScheduleStatus(todayList, nowHHMM);

  const openCreateForm = (targetDay: DayOfWeek) => {
    const existingCount = sortSchedulesForDay(rawSchedules, targetDay).length;
    setEditingItem(null);
    setDay(targetDay);
    setOrder(String(existingCount + 1));
    setStartTime('');
    setEndTime('');
    setSubject(ALL_CLASS_SUBJECTS[0] || 'Matematika');
    setTeacher('');
    setRoom('Ruang 6A');
    setErrorMsg(null);
    setShowForm(true);
  };

  const openEditForm = (item: ScheduleItem) => {
    setEditingItem(item);
    setDay(item.day);
    setOrder(String(item.order));
    setStartTime(item.startTime);
    setEndTime(item.endTime);
    setSubject(item.subject);
    setTeacher(item.teacher);
    setRoom(item.room);
    setErrorMsg(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const payload = {
        day,
        order: Number(order),
        startTime,
        endTime,
        subject,
        teacher,
        room,
      };
      if (editingItem && !editingItem.id.startsWith('default-')) {
        await updateScheduleItem(profile, editingItem.id, payload);
      } else {
        await createScheduleItem(profile, payload);
      }
      setShowForm(false);
      setEditingItem(null);
      setSelectedDay(day);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan jadwal.');
    } finally {
      setBusy(false);
    }
  };

  const handleTriggerSyncOfficial = async () => {
    if (rawSchedules.length > 0) {
      setConfirmSyncOpen(true);
      return;
    }
    setErrorMsg(null);
    try {
      await onSyncOfficialSchedule();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyinkronkan jadwal resmi 6 hari.');
    }
  };

  const handleConfirmSyncOfficial = async () => {
    setErrorMsg(null);
    try {
      await onSyncOfficialSchedule();
      setConfirmSyncOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyinkronkan jadwal resmi 6 hari.');
      setConfirmSyncOpen(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteScheduleItem(profile, deleteTarget.id, `${deleteTarget.day}: ${deleteTarget.subject}`);
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const dayList = sortSchedulesForDay(schedules, selectedDay);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B2416]">Jadwal Pelajaran Lengkap (Senin–Sabtu)</h2>
          <p className="text-sm text-[#52705E]">
            Jadwal enam hari Kelas 6A MI Al-Hidayah Sawotratap. Jam kosong ditampilkan &ldquo;Belum diatur&rdquo;.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex rounded-xl bg-white border border-[#D3E6D8] p-1">
            <button
              type="button"
              onClick={() => setViewMode('6-hari')}
              className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                viewMode === '6-hari' ? 'bg-[#0B6B3A] text-white' : 'text-[#52705E] hover:text-[#0B2416]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>6 Hari</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('per-hari')}
              className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'per-hari' ? 'bg-[#0B6B3A] text-white' : 'text-[#52705E] hover:text-[#0B2416]'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Per Hari</span>
            </button>
          </div>

          {canManage && (
            <button
              type="button"
              disabled={isSyncingOfficial}
              onClick={handleTriggerSyncOfficial}
              className={`min-h-[44px] px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-60 ${
                needsOfficialSync
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-white hover:bg-[#F0F7F2] border border-[#C6E0CE] text-[#0B2416]'
              }`}
            >
              {needsOfficialSync ? <Sparkles className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
              <span>
                {isSyncingOfficial
                  ? 'Menyinkronkan...'
                  : needsOfficialSync
                    ? 'Terapkan Jadwal Resmi 6 Hari'
                    : 'Reset Jadwal Resmi'}
              </span>
            </button>
          )}

          {canManage && (
            <button
              type="button"
              onClick={() => openCreateForm(selectedDay)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white font-semibold text-sm flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Pelajaran</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync / Fallback Info Banner */}
      {canManage && needsOfficialSync && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-amber-800">
              {isUsingFallback
                ? 'Jadwal Firestore Belum Disinkronkan'
                : 'Jadwal Firestore Berbeda dari Kurikulum Resmi 6 Hari'}
            </p>
            <p className="text-xs text-amber-900">
              {isUsingFallback
                ? 'Saat ini menampilkan daftar mata pelajaran resmi bawaan. Klik "Terapkan Jadwal Resmi 6 Hari" untuk menyimpan ke Firestore agar jam dapat diatur.'
                : 'Klik "Terapkan Jadwal Resmi 6 Hari" untuk mengganti daftar lama dengan urutan mata pelajaran resmi Senin–Sabtu.'}
            </p>
          </div>
          <button
            type="button"
            disabled={isSyncingOfficial}
            onClick={handleTriggerSyncOfficial}
            className="min-h-[40px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0 cursor-pointer"
          >
            {isSyncingOfficial ? 'Menyinkronkan...' : 'Terapkan Sekarang'}
          </button>
        </div>
      )}

      {!canManage && isUsingFallback && (
        <div className="p-3.5 rounded-xl bg-white border border-[#D3E6D8] text-xs text-[#2F4F3C]">
          Menampilkan jadwal mata pelajaran resmi Kelas 6A (Senin–Sabtu). Jam mulai dan jam selesai menunggu pengaturan oleh Owner.
        </div>
      )}

      {/* Current / Next Lesson Live Banner */}
      <section className="bg-white border border-[#D3E6D8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-[#0B6B3A] shrink-0" />
          <div>
            <p className="text-xs font-semibold text-[#0B6B3A]">
              {isSunday ? 'Hari Minggu (Libur Sekolah)' : `Status Hari Ini · ${todayDay}`}
            </p>
            <p className="text-sm font-semibold text-[#0B2416]">
              {isSunday
                ? 'Tidak ada jadwal tatap muka hari ini.'
                : todayStatus.currentLesson
                  ? `Sedang berlangsung: ${todayStatus.currentLesson.subject} (${formatScheduleTimeRange(todayStatus.currentLesson.startTime, todayStatus.currentLesson.endTime)})`
                  : todayStatus.hasConfiguredTimes
                    ? 'Tidak ada pelajaran yang sedang berlangsung pada jam ini.'
                    : 'Jam mulai & selesai belum diatur oleh Owner.'}
            </p>
          </div>
        </div>
        {!isSunday && todayStatus.nextLesson && (
          <div className="text-xs bg-[#F0F7F2] border border-[#D3E6D8] rounded-xl px-3.5 py-2 shrink-0">
            <span className="text-[#52705E]">Pelajaran berikutnya: </span>
            <span className="font-semibold text-[#0B6B3A]">{todayStatus.nextLesson.subject}</span>
          </div>
        )}
      </section>

      {/* Add / Edit Modal Form */}
      {canManage && showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-[#96CCA9] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-[#0B2416]">
              {editingItem ? 'Edit Mata Pelajaran & Jam' : 'Tambah Mata Pelajaran'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingItem(null);
              }}
              className="text-xs text-[#52705E] hover:text-[#0B2416] cursor-pointer"
            >
              Tutup
            </button>
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3">
              {errorMsg}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="sch-day" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Hari
              </label>
              <select
                id="sch-day"
                value={day}
                onChange={(e) => setDay(e.target.value as DayOfWeek)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              >
                {DAYS_ORDER.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sch-order" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Nomor Urut
              </label>
              <input
                id="sch-order"
                type="number"
                required
                min={1}
                max={20}
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] font-mono-num focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>

            <div>
              <label htmlFor="sch-start" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Jam Mulai (opsional)
              </label>
              <input
                id="sch-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] font-mono-num focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>

            <div>
              <label htmlFor="sch-end" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Jam Selesai (opsional)
              </label>
              <input
                id="sch-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] font-mono-num focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="sch-subject" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Mata Pelajaran
              </label>
              <input
                id="sch-subject"
                type="text"
                list="subject-suggestions"
                required
                minLength={2}
                maxLength={60}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Nama mata pelajaran"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              />
              <datalist id="subject-suggestions">
                {ALL_CLASS_SUBJECTS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="sch-teacher" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Guru Pengampu (opsional)
              </label>
              <input
                id="sch-teacher"
                type="text"
                maxLength={80}
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                placeholder="Kosongkan jika belum diatur"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>

            <div>
              <label htmlFor="sch-room" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Ruangan (opsional)
              </label>
              <input
                id="sch-room"
                type="text"
                maxLength={40}
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Ruang 6A"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setStartTime('');
                setEndTime('');
              }}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F0F7F2] hover:bg-[#E2EFE6] border border-[#C6E0CE] text-[#2F4F3C] text-xs font-medium cursor-pointer"
            >
              Kosongkan Jam
            </button>
            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
            >
              {busy ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Simpan Jadwal'}
            </button>
          </div>
        </form>
      )}

      {/* 6-Day Grid Mode */}
      {viewMode === '6-hari' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {DAYS_ORDER.map((dayName) => {
            const list = sortSchedulesForDay(schedules, dayName);
            const isToday = !isSunday && dayName === todayDay;

            return (
              <section
                key={dayName}
                className={`bg-white rounded-2xl border overflow-hidden flex flex-col ${
                  isToday ? 'border-[#0B6B3A] ring-1 ring-[#0B6B3A]/20' : 'border-[#D3E6D8]'
                }`}
              >
                <div
                  className={`px-4 py-3.5 border-b flex items-center justify-between gap-2 ${
                    isToday
                      ? 'bg-[#0B6B3A] border-[#0B6B3A] text-white'
                      : 'bg-[#F0F7F2] border-[#E2EFE6] text-[#0B2416]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold">{dayName}</h3>
                    {isToday && (
                      <span className="text-[11px] font-semibold text-emerald-100">· Hari Ini</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono-num text-xs ${isToday ? 'text-emerald-100' : 'text-[#52705E]'}`}>
                      {list.length} mapel
                    </span>
                    {canManage && !isUsingFallback && (
                      <button
                        type="button"
                        onClick={() => openCreateForm(dayName)}
                        aria-label={`Tambah pelajaran hari ${dayName}`}
                        className={`min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center cursor-pointer ${
                          isToday
                            ? 'bg-white/20 hover:bg-white/30 text-white'
                            : 'bg-white hover:bg-[#E2EFE6] text-[#0B6B3A] border border-[#C6E0CE]'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 flex-1">
                  {list.length === 0 ? (
                    <p className="text-xs text-[#52705E] py-6 text-center">
                      Belum ada pelajaran untuk hari {dayName}.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#E6F2EA]">
                      {list.map((slot) => {
                        const isFallbackItem = slot.id.startsWith('default-');
                        return (
                          <div key={slot.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-[#E6F4EC] text-[#0B6B3A] font-mono-num text-xs font-bold flex items-center justify-center shrink-0">
                                {slot.order}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[#0B2416] truncate">{slot.subject}</p>
                                <p className="text-[11px] text-[#52705E] font-mono-num">
                                  {formatScheduleTimeRange(slot.startTime, slot.endTime)}
                                  {slot.teacher ? ` · ${slot.teacher}` : ''}
                                </p>
                              </div>
                            </div>

                            {canManage && !isFallbackItem && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openEditForm(slot)}
                                  aria-label={`Edit ${slot.subject}`}
                                  className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[#52705E] hover:text-[#0B6B3A] cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(slot)}
                                  aria-label={`Hapus ${slot.subject}`}
                                  className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[#52705E] hover:text-rose-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Pilih hari pelajaran">
            {DAYS_ORDER.map((d) => {
              const isSelected = selectedDay === d;
              const isToday = !isSunday && d === todayDay;
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedDay(d)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#0B6B3A] text-white border-[#0B6B3A]'
                      : 'bg-white text-[#2F4F3C] border-[#D3E6D8] hover:bg-[#F0F7F2]'
                  }`}
                >
                  {d}
                  {isToday ? ' (Hari Ini)' : ''}
                </button>
              );
            })}
          </div>

          <section className="bg-white border border-[#D3E6D8] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 bg-[#F0F7F2] border-b border-[#E2EFE6] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0B6B3A]" />
                <h3 className="text-base font-semibold text-[#0B2416]">Hari {selectedDay}</h3>
              </div>
              <span className="font-mono-num text-xs text-[#52705E]">{dayList.length} mata pelajaran</span>
            </div>

            {dayList.length === 0 ? (
              <p className="p-8 text-center text-sm text-[#52705E]">
                Belum ada mata pelajaran untuk hari {selectedDay}.
              </p>
            ) : (
              <div className="divide-y divide-[#E6F2EA]">
                {dayList.map((slot) => {
                  const isFallbackItem = slot.id.startsWith('default-');
                  return (
                    <div key={slot.id} className="p-4 sm:px-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="w-8 h-8 rounded-xl bg-[#E6F4EC] text-[#0B6B3A] font-mono-num text-sm font-bold flex items-center justify-center shrink-0">
                          {slot.order}
                        </span>
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-[#0B2416] truncate">{slot.subject}</p>
                          <p className="text-xs text-[#52705E] mt-0.5">
                            Jam: <span className="font-mono-num text-[#0B6B3A] font-medium">{formatScheduleTimeRange(slot.startTime, slot.endTime)}</span>
                            {slot.teacher ? ` · ${slot.teacher}` : ''}
                            {slot.room ? ` · ${slot.room}` : ''}
                          </p>
                        </div>
                      </div>

                      {canManage && !isFallbackItem && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditForm(slot)}
                            aria-label={`Edit ${slot.subject}`}
                            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl text-[#52705E] hover:text-[#0B6B3A] cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(slot)}
                            aria-label={`Hapus ${slot.subject}`}
                            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl text-[#52705E] hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Jadwal Pelajaran?"
        description={`Yakin ingin menghapus ${deleteTarget?.subject ?? ''} (${deleteTarget?.day ?? ''}) dari jadwal kelas?`}
        confirmLabel="Hapus Pelajaran"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={deleteBusy}
      />

      <ConfirmModal
        open={confirmSyncOpen}
        title="Terapkan Jadwal Resmi 6 Hari?"
        description="Tindakan ini akan mengganti seluruh jadwal lama dengan urutan mata pelajaran resmi Senin–Sabtu Kelas 6A (jam mulai/selesai diset ke 'Belum diatur'). Lanjutkan?"
        confirmLabel="Ya, Terapkan Jadwal Resmi"
        onConfirm={handleConfirmSyncOfficial}
        onCancel={() => setConfirmSyncOpen(false)}
        busy={isSyncingOfficial}
      />
    </div>
  );
}
