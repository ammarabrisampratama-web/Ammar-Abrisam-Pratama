import { useMemo, useState } from 'react';
import { ArrowUpDown, BookCheck, CheckCircle2, Clock, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import {
  createAssignment,
  deleteAssignment,
  setTaskProgressStatus,
  updateAssignment,
} from '../../services/firestoreService';
import type {
  Assignment,
  AssignmentPriority,
  ClassSettings,
  DerivedTaskStatus,
  TaskProgressStatus,
  UserPublic,
} from '../../types';
import {
  ALL_CLASS_SUBJECTS,
  ASSIGNMENT_PRIORITIES,
  canCreateAssignment,
  canEditOrDeleteOwnedItem,
  deriveTaskStatus,
  getJakartaDateString,
} from '../../utils/validation';
import { ConfirmModal } from '../ConfirmModal';

interface AssignmentsViewProps {
  profile: UserPublic;
  settings: ClassSettings;
  assignments: Assignment[];
  taskProgressMap: Map<string, TaskProgressStatus>;
  compactMode: boolean;
}

export function AssignmentsView({
  profile,
  settings,
  assignments,
  taskProgressMap,
  compactMode,
}: AssignmentsViewProps) {
  const todayStr = getJakartaDateString();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Assignment | null>(null);

  const [subject, setSubject] = useState(ALL_CLASS_SUBJECTS[0] || 'Matematika');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedDate, setAssignedDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState(todayStr);
  const [priority, setPriority] = useState<AssignmentPriority>('sedang');

  const [subjectFilter, setSubjectFilter] = useState<string>('semua');
  const [statusFilter, setStatusFilter] = useState<'semua' | DerivedTaskStatus>('semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const canCreate = canCreateAssignment(profile.role, settings);

  const subjectOptions = useMemo(() => {
    const set = new Set<string>(ALL_CLASS_SUBJECTS);
    assignments.forEach((a) => set.add(a.subject));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'));
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assignments
      .filter((a) => {
        if (subjectFilter !== 'semua' && a.subject !== subjectFilter) return false;
        const derived = deriveTaskStatus(a.dueDate, taskProgressMap.get(a.id), todayStr);
        if (statusFilter !== 'semua' && derived !== statusFilter) return false;
        if (
          q &&
          !a.title.toLowerCase().includes(q) &&
          !a.subject.toLowerCase().includes(q) &&
          !a.description.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .slice()
      .sort((a, b) => (sortAsc ? a.dueDate.localeCompare(b.dueDate) : b.dueDate.localeCompare(a.dueDate)));
  }, [assignments, subjectFilter, statusFilter, searchQuery, sortAsc, taskProgressMap, todayStr]);

  const openCreate = () => {
    setEditingTask(null);
    setSubject(ALL_CLASS_SUBJECTS[0] || 'Matematika');
    setTitle('');
    setDescription('');
    setAssignedDate(todayStr);
    setDueDate(todayStr);
    setPriority('sedang');
    setErrorMsg(null);
    setShowForm(true);
  };

  const openEdit = (task: Assignment) => {
    setEditingTask(task);
    setSubject(task.subject);
    setTitle(task.title);
    setDescription(task.description);
    setAssignedDate(task.assignedDate || todayStr);
    setDueDate(task.dueDate);
    setPriority(task.priority || 'sedang');
    setErrorMsg(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const payload = { subject, title, description, assignedDate, dueDate, priority };
      if (editingTask) {
        await updateAssignment(profile, editingTask, payload);
      } else {
        await createAssignment(profile, payload);
      }
      setShowForm(false);
      setEditingTask(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan tugas.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteAssignment(profile, deleteTarget.id, deleteTarget.title);
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const completedCount = assignments.filter((a) => taskProgressMap.get(a.id) === 'selesai').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B2416]">Tugas Sekolah Kelas 6A</h2>
          <p className="text-sm text-[#52705E] font-mono-num">
            {completedCount} dari {assignments.length} tugas selesai dikerjakan
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={openCreate}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Tugas</span>
          </button>
        )}
      </div>

      {/* Create / Edit Form */}
      {canCreate && showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-[#96CCA9] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-[#0B2416]">
              {editingTask ? 'Edit Tugas Sekolah' : 'Tambah Tugas Sekolah Baru'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingTask(null);
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
              <label htmlFor="task-subject" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Mata Pelajaran
              </label>
              <input
                id="task-subject"
                type="text"
                list="task-subject-list"
                required
                minLength={2}
                maxLength={60}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              />
              <datalist id="task-subject-list">
                {subjectOptions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="task-assigned" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Tanggal Diberikan
              </label>
              <input
                id="task-assigned"
                type="date"
                required
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] font-mono-num focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>

            <div>
              <label htmlFor="task-due" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Tenggat Waktu
              </label>
              <input
                id="task-due"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] font-mono-num focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>

            <div>
              <label htmlFor="task-priority" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Prioritas
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as AssignmentPriority)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A] capitalize"
              >
                {ASSIGNMENT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p === 'tinggi' ? 'Tinggi' : p === 'sedang' ? 'Sedang' : 'Rendah'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="task-title" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
              Judul Tugas
            </label>
            <input
              id="task-title"
              type="text"
              required
              minLength={3}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Kerjakan LKS Matematika Hal. 24"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
            />
          </div>

          <div>
            <label htmlFor="task-desc" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
              Deskripsi / Instruksi
            </label>
            <textarea
              id="task-desc"
              required
              rows={3}
              minLength={1}
              maxLength={1500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan detail halaman, nomor soal, atau cara pengumpulan..."
              className="w-full p-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
            >
              {busy ? 'Menyimpan...' : editingTask ? 'Simpan Perubahan' : 'Simpan Tugas'}
            </button>
          </div>
        </form>
      )}

      {/* Search, Filters & Sort */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-5 relative">
          <Search className="w-4 h-4 text-[#52705E] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul atau mata pelajaran..."
            aria-label="Cari tugas sekolah"
            className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl bg-white border border-[#D3E6D8] text-sm text-[#0B2416] placeholder:text-[#6E8B79] focus:outline-none focus:border-[#0B6B3A]"
          />
        </div>

        <select
          aria-label="Filter mata pelajaran"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="lg:col-span-3 min-h-[44px] px-3 rounded-xl bg-white border border-[#D3E6D8] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
        >
          <option value="semua">Semua Mata Pelajaran</option>
          {subjectOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter status tugas"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'semua' | DerivedTaskStatus)}
          className="lg:col-span-2 min-h-[44px] px-3 rounded-xl bg-white border border-[#D3E6D8] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
        >
          <option value="semua">Semua Status</option>
          <option value="belum">Belum</option>
          <option value="sedang">Sedang</option>
          <option value="selesai">Selesai</option>
          <option value="terlambat">Terlambat</option>
        </select>

        <button
          type="button"
          onClick={() => setSortAsc((prev) => !prev)}
          className="lg:col-span-2 min-h-[44px] px-3 rounded-xl bg-white hover:bg-[#F0F7F2] border border-[#D3E6D8] text-xs font-semibold text-[#0B2416] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-[#0B6B3A]" />
          <span>{sortAsc ? 'Tenggat Terdekat' : 'Tenggat Terjauh'}</span>
        </button>
      </section>

      {/* Task Cards */}
      <div className={compactMode ? 'space-y-2.5' : 'space-y-4'}>
        {filteredAssignments.length === 0 ? (
          <div className="bg-white border border-[#D3E6D8] rounded-2xl p-10 text-center space-y-2">
            <BookCheck className="w-8 h-8 text-[#96CCA9] mx-auto" />
            <p className="text-sm font-semibold text-[#2F4F3C]">Tidak ada tugas yang sesuai filter</p>
            <p className="text-xs text-[#52705E]">
              Coba ubah pencarian/filter atau tambahkan tugas sekolah baru.
            </p>
          </div>
        ) : (
          filteredAssignments.map((item) => {
            const currentProgress = taskProgressMap.get(item.id) ?? 'belum';
            const derivedStatus = deriveTaskStatus(item.dueDate, currentProgress, todayStr);
            const canModify = canEditOrDeleteOwnedItem(profile.role, profile.uid, item.authorId);

            return (
              <article
                key={item.id}
                className={`bg-white border rounded-2xl transition-colors ${compactMode ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'} ${
                  derivedStatus === 'selesai'
                    ? 'border-emerald-300 bg-[#F8FCF9]'
                    : derivedStatus === 'terlambat'
                      ? 'border-rose-300'
                      : 'border-[#D3E6D8]'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-[#0B6B3A]">{item.subject}</span>
                      <span className="text-[#B9D8C2]">·</span>
                      <span
                        className={`font-semibold ${
                          item.priority === 'tinggi'
                            ? 'text-rose-700'
                            : item.priority === 'sedang'
                              ? 'text-amber-700'
                              : 'text-[#52705E]'
                        }`}
                      >
                        Prioritas {item.priority === 'tinggi' ? 'Tinggi' : item.priority === 'sedang' ? 'Sedang' : 'Rendah'}
                      </span>
                      <span className="text-[#B9D8C2]">·</span>
                      <span className="font-mono-num text-[#52705E]">
                        Diberikan {item.assignedDate || '-'} · Tenggat {item.dueDate}
                      </span>
                    </div>

                    <h3
                      className={`text-base font-bold ${
                        derivedStatus === 'selesai' ? 'text-[#52705E] line-through' : 'text-[#0B2416]'
                      }`}
                    >
                      {item.title}
                    </h3>

                    <p className="text-sm text-[#2F4F3C] whitespace-pre-line leading-relaxed">
                      {item.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#52705E] pt-1">
                      <span>Oleh {item.authorName}</span>
                      {item.editHistory && item.editHistory.length > 0 && (
                        <span>· {item.editHistory[item.editHistory.length - 1]}</span>
                      )}
                    </div>
                  </div>

                  {/* Progress Selector & Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="inline-flex rounded-xl bg-[#F0F7F2] border border-[#D3E6D8] p-1">
                      {(['belum', 'sedang', 'selesai'] as TaskProgressStatus[]).map((st) => {
                        const active = currentProgress === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setTaskProgressStatus(profile.uid, item.id, st)}
                            className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                              active
                                ? st === 'selesai'
                                  ? 'bg-[#0B6B3A] text-white'
                                  : st === 'sedang'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-[#0B2416] text-white'
                                : 'text-[#52705E] hover:text-[#0B2416]'
                            }`}
                          >
                            {st === 'selesai' && <CheckCircle2 className="w-3 h-3" />}
                            {st === 'sedang' && <Clock className="w-3 h-3" />}
                            <span>
                              {st === 'belum' ? 'Belum' : st === 'sedang' ? 'Sedang' : 'Selesai'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {derivedStatus === 'terlambat' && (
                      <span className="text-xs font-semibold text-rose-700 px-2">Terlambat</span>
                    )}

                    {canModify && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          aria-label={`Edit tugas ${item.title}`}
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#52705E] hover:text-[#0B6B3A] cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          aria-label={`Hapus tugas ${item.title}`}
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#52705E] hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Tugas Sekolah?"
        description={`Yakin ingin menghapus tugas "${deleteTarget?.title ?? ''}"? Data yang dihapus tidak bisa dikembalikan.`}
        confirmLabel="Hapus Tugas"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={deleteBusy}
      />
    </div>
  );
}
