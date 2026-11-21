import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  RefreshCw,
  Save,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  initializeDefaultPicketSchedules,
  savePicketSchedule,
} from '../../services/firestoreService';
import type { DayOfWeek, PicketScheduleItem, UserPublic } from '../../types';
import { buildDefaultPicketSchedules } from '../../utils/mediaUtils';
import {
  DAYS_ORDER,
  getTodayIndonesianDay,
  isAdminOrOwnerRole,
  isSundayJakarta,
} from '../../utils/validation';

interface PicketScheduleViewProps {
  profile: UserPublic;
  picketSchedules: PicketScheduleItem[];
}

export function PicketScheduleView({
  profile,
  picketSchedules,
}: PicketScheduleViewProps) {
  const [editingDay, setEditingDay] = useState<DayOfWeek | null>(null);
  const [studentsText, setStudentsText] = useState('');
  const [tasksText, setTasksText] = useState('');
  const [coordinator, setCoordinator] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const isStaff = isAdminOrOwnerRole(profile.role);
  const isSunday = isSundayJakarta();
  const todayDay = getTodayIndonesianDay();

  const mergedSchedules = useMemo(() => {
    const defaults = buildDefaultPicketSchedules();
    return DAYS_ORDER.map((day) => {
      const found = picketSchedules.find((p) => p.day === day);
      if (found) return found;
      return defaults.find((d) => d.day === day)!;
    });
  }, [picketSchedules]);

  const todayPicket = useMemo(
    () => (isSunday ? null : mergedSchedules.find((p) => p.day === todayDay) ?? null),
    [isSunday, mergedSchedules, todayDay]
  );

  const openEditor = (item: PicketScheduleItem) => {
    setEditingDay(item.day);
    setStudentsText(item.students.join('\n'));
    setTasksText(item.tasks.join('\n'));
    setCoordinator(item.coordinator || '');
    setNote(item.note || '');
    setFeedback(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDay) return;
    setFeedback(null);
    setSaving(true);
    try {
      const students = studentsText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const tasks = tasksText
        .split(/\n+/)
        .map((t) => t.trim())
        .filter(Boolean);
      await savePicketSchedule(profile, {
        day: editingDay,
        students,
        tasks,
        coordinator,
        note,
      });
      setEditingDay(null);
      setFeedback({ type: 'ok', text: `Jadwal piket hari ${editingDay} berhasil diperbarui.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan jadwal piket.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInitDefaults = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      await initializeDefaultPicketSchedules(profile);
      setFeedback({ type: 'ok', text: 'Template tugas piket Senin–Sabtu disinkronkan ke Firestore.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyinkronkan template piket.',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B2416] dark:text-emerald-50">
            Jadwal Piket Kebersihan Kelas 6A
          </h2>
          <p className="text-sm text-[#52705E] dark:text-emerald-300/80">
            Pembagian tugas kebersihan ruang kelas Senin sampai Sabtu · MI Al-Hidayah Sawotratap.
          </p>
        </div>

        {isStaff && picketSchedules.length < 6 && (
          <button
            type="button"
            disabled={syncing}
            onClick={handleInitDefaults}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Menyinkronkan...' : 'Simpan Template ke Database'}</span>
          </button>
        )}
      </div>

      {feedback && (
        <p
          className={`text-xs rounded-xl p-3 border ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {feedback.text}
        </p>
      )}

      {/* Highlight Piket Hari Ini */}
      <section className="bg-gradient-to-br from-[#0B6B3A] to-[#084D2A] text-white rounded-2xl p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{isSunday ? 'Hari Minggu (Libur)' : `Petugas Piket Hari ${todayDay}`}</span>
          </div>
          {todayPicket?.coordinator && (
            <span className="text-xs text-emerald-100">
              Koordinator: <strong>{todayPicket.coordinator}</strong>
            </span>
          )}
        </div>

        {isSunday ? (
          <p className="text-sm text-emerald-50">
            Hari Minggu libur sekolah. Persiapkan perlengkapan piket untuk besok hari Senin!
          </p>
        ) : todayPicket ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <p className="text-xs font-semibold text-emerald-200 mb-1.5">Anggota Piket Hari Ini</p>
              {todayPicket.students.length === 0 ? (
                <p className="text-xs text-emerald-100/90 italic">
                  Daftar siswa piket hari {todayDay} belum diisi oleh Admin/Owner.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {todayPicket.students.map((st, idx) => (
                    <span
                      key={`${st}-${idx}`}
                      className="px-2.5 py-1 rounded-lg bg-white/15 border border-white/25 text-xs font-semibold text-white"
                    >
                      {st}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-200 mb-1.5">Tugas Kebersihan</p>
              <ul className="space-y-1 text-xs text-emerald-50">
                {todayPicket.tasks.map((t, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      {/* Grid Senin - Sabtu */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {mergedSchedules.map((item) => {
          const isToday = !isSunday && item.day === todayDay;
          return (
            <article
              key={item.day}
              className={`bg-white dark:bg-[#0F2419] rounded-2xl border p-5 flex flex-col justify-between gap-4 shadow-sm ${
                isToday
                  ? 'border-[#0B6B3A] dark:border-emerald-500 ring-2 ring-[#0B6B3A]/15'
                  : 'border-[#D3E6D8] dark:border-emerald-900/60'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E6F2EA] dark:border-emerald-900/60">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
                    <h3 className="text-base font-bold text-[#0B2416] dark:text-emerald-50">
                      Hari {item.day}
                    </h3>
                  </div>
                  {isToday && (
                    <span className="px-2 py-0.5 rounded-md bg-[#0B6B3A] text-white text-[10px] font-bold">
                      Hari Ini
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#52705E] dark:text-emerald-300/80 flex items-center gap-1.5 mb-2">
                    <Users className="w-3.5 h-3.5" />
                    <span>Siswa Bertugas ({item.students.length})</span>
                  </p>
                  {item.students.length === 0 ? (
                    <p className="text-xs text-[#6E8B79] dark:text-emerald-400/70 italic">
                      Belum ada daftar nama siswa untuk hari {item.day}.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {item.students.map((student, idx) => (
                        <span
                          key={`${student}-${idx}`}
                          className="px-2.5 py-1 rounded-lg bg-[#F0F7F2] dark:bg-[#132C1E] border border-[#C6E0CE] dark:border-emerald-800 text-xs font-medium text-[#0B2416] dark:text-emerald-100"
                        >
                          {student}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#52705E] dark:text-emerald-300/80 mb-1.5">
                    Daftar Tugas
                  </p>
                  <ul className="space-y-1 text-xs text-[#2F4F3C] dark:text-emerald-200/90">
                    {item.tasks.map((task, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-[#0B6B3A] dark:text-emerald-400 font-bold">•</span>
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {(item.coordinator || item.note) && (
                  <div className="p-2.5 rounded-xl bg-[#F8FCF9] dark:bg-[#0D1E15] border border-[#E2EFE6] dark:border-emerald-900/60 text-[11px] text-[#52705E] dark:text-emerald-300/85 space-y-0.5">
                    {item.coordinator && (
                      <p>
                        Koordinator: <strong className="text-[#0B2416] dark:text-emerald-100">{item.coordinator}</strong>
                      </p>
                    )}
                    {item.note && <p>{item.note}</p>}
                  </div>
                )}
              </div>

              {isStaff && (
                <button
                  type="button"
                  onClick={() => openEditor(item)}
                  className="min-h-[38px] w-full px-3 py-1.5 rounded-xl bg-[#F0F7F2] dark:bg-[#132C1E] hover:bg-[#E2EFE6] dark:hover:bg-[#1A3927] border border-[#C6E0CE] dark:border-emerald-800 text-xs font-semibold text-[#0B6B3A] dark:text-emerald-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Atur Piket {item.day}</span>
                </button>
              )}
            </article>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editingDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-[#0B2416]/50 backdrop-blur-sm"
            onClick={() => !saving && setEditingDay(null)}
            aria-hidden="true"
          />
          <form
            onSubmit={handleSave}
            className="relative z-10 max-w-lg w-full bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0B2416] dark:text-emerald-50">
                Atur Jadwal Piket Hari {editingDay}
              </h3>
              <button
                type="button"
                onClick={() => setEditingDay(null)}
                className="p-1.5 rounded-lg text-[#52705E] hover:text-[#0B2416] dark:text-emerald-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2F4F3C] dark:text-emerald-200 mb-1">
                Daftar Nama Siswa Piket (pisahkan dengan baris baru atau koma)
              </label>
              <textarea
                rows={4}
                value={studentsText}
                onChange={(e) => setStudentsText(e.target.value)}
                placeholder={'Contoh:\nAhmad Fauzan\nSiti Aisyah\nMuhammad Rizky'}
                className="w-full p-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs sm:text-sm text-[#0B2416] dark:text-emerald-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2F4F3C] dark:text-emerald-200 mb-1">
                Daftar Tugas Kebersihan (1 baris per tugas)
              </label>
              <textarea
                rows={4}
                required
                value={tasksText}
                onChange={(e) => setTasksText(e.target.value)}
                className="w-full p-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs sm:text-sm text-[#0B2416] dark:text-emerald-50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#2F4F3C] dark:text-emerald-200 mb-1">
                  Koordinator Hari (Opsional)
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={coordinator}
                  onChange={(e) => setCoordinator(e.target.value)}
                  placeholder="Nama ketua piket"
                  className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs sm:text-sm text-[#0B2416] dark:text-emerald-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2F4F3C] dark:text-emerald-200 mb-1">
                  Catatan Tambahan
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Mis. Hadir 10 menit lebih awal"
                  className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs sm:text-sm text-[#0B2416] dark:text-emerald-50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditingDay(null)}
                className="min-h-[42px] px-4 rounded-xl bg-[#F0F7F2] dark:bg-[#132C1E] text-xs font-semibold text-[#2F4F3C] dark:text-emerald-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] px-5 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Jadwal Piket'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
