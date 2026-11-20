import { useMemo, useState } from 'react';
import { Archive, Edit3, Megaphone, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react';
import {
  createAnnouncement,
  deleteAnnouncement,
  updateAnnouncement,
} from '../../services/firestoreService';
import type {
  Announcement,
  AnnouncementCategory,
  AnnouncementPriority,
  UserPublic,
} from '../../types';
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_PRIORITIES,
  canManageAnnouncements,
  formatTimestampId,
} from '../../utils/validation';
import { ConfirmModal } from '../ConfirmModal';

interface AnnouncementsViewProps {
  profile: UserPublic;
  announcements: Announcement[];
  compactMode: boolean;
}

export function AnnouncementsView({
  profile,
  announcements,
  compactMode,
}: AnnouncementsViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<AnnouncementCategory>('Penting');
  const [priority, setPriority] = useState<AnnouncementPriority>('normal');
  const [pinned, setPinned] = useState(false);

  const [tab, setTab] = useState<'aktif' | 'arsip'>('aktif');
  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState<'semua' | AnnouncementCategory>('semua');

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const canManage = canManageAnnouncements(profile.role);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return announcements
      .filter((a) => (tab === 'arsip' ? a.archived : !a.archived))
      .filter((a) => (catFilter === 'semua' ? true : a.category === catFilter))
      .filter((a) => (!q ? true : a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)))
      .slice()
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [announcements, tab, catFilter, searchQuery]);

  const openCreate = () => {
    setEditingItem(null);
    setTitle('');
    setContent('');
    setCategory('Penting');
    setPriority('normal');
    setPinned(false);
    setErrorMsg(null);
    setShowForm(true);
  };

  const openEdit = (item: Announcement) => {
    setEditingItem(item);
    setTitle(item.title);
    setContent(item.content);
    setCategory(item.category);
    setPriority(item.priority || 'normal');
    setPinned(Boolean(item.pinned));
    setErrorMsg(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      if (editingItem) {
        await updateAnnouncement(profile, editingItem.id, {
          title: title.trim(),
          content: content.trim(),
          category,
          priority,
          pinned,
        });
      } else {
        await createAnnouncement(profile, { title, content, category, priority, pinned });
      }
      setShowForm(false);
      setEditingItem(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan pengumuman.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteAnnouncement(profile, deleteTarget.id, deleteTarget.title);
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B2416]">Pengumuman Resmi Kelas 6A</h2>
          <p className="text-sm text-[#52705E]">
            Informasi resmi dari Owner/Admin dengan notifikasi real-time ke seluruh anggota kelas.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Pengumuman</span>
          </button>
        )}
      </div>

      {canManage && showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-[#96CCA9] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-[#0B2416]">
              {editingItem ? 'Edit Pengumuman' : 'Publikasikan Pengumuman Baru'}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="ann-title" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Judul Pengumuman
              </label>
              <input
                id="ann-title"
                type="text"
                required
                minLength={3}
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Jadwal Penilaian Tengah Semester"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>

            <div>
              <label htmlFor="ann-cat" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Kategori
              </label>
              <select
                id="ann-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              >
                {ANNOUNCEMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label htmlFor="ann-prio" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Prioritas
              </label>
              <select
                id="ann-prio"
                value={priority}
                onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A] capitalize"
              >
                {ANNOUNCEMENT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p === 'mendesak' ? 'Mendesak' : p === 'penting' ? 'Penting' : 'Normal'}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2.5 text-sm text-[#0B2416] cursor-pointer pt-4 sm:pt-5">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="w-4 h-4 accent-[#0B6B3A]"
              />
              <span>Sematkan di bagian paling atas</span>
            </label>
          </div>

          <div>
            <label htmlFor="ann-content" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
              Isi Pengumuman
            </label>
            <textarea
              id="ann-content"
              required
              rows={4}
              minLength={3}
              maxLength={2000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tuliskan informasi lengkap untuk seluruh siswa dan wali murid..."
              className="w-full p-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
            >
              {busy ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Publikasikan'}
            </button>
          </div>
        </form>
      )}

      {/* Tabs, Search & Category Filter */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-white border border-[#D3E6D8] p-1 self-start">
          <button
            type="button"
            onClick={() => setTab('aktif')}
            className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold cursor-pointer ${
              tab === 'aktif' ? 'bg-[#0B6B3A] text-white' : 'text-[#52705E] hover:text-[#0B2416]'
            }`}
          >
            Aktif ({announcements.filter((a) => !a.archived).length})
          </button>
          <button
            type="button"
            onClick={() => setTab('arsip')}
            className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold cursor-pointer ${
              tab === 'arsip' ? 'bg-[#0B6B3A] text-white' : 'text-[#52705E] hover:text-[#0B2416]'
            }`}
          >
            Arsip ({announcements.filter((a) => a.archived).length})
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 flex-1 md:max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#52705E] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pengumuman..."
              aria-label="Cari pengumuman"
              className="w-full min-h-[42px] pl-10 pr-3.5 rounded-xl bg-white border border-[#D3E6D8] text-sm text-[#0B2416] placeholder:text-[#6E8B79] focus:outline-none focus:border-[#0B6B3A]"
            />
          </div>
          <select
            aria-label="Filter kategori pengumuman"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value as 'semua' | AnnouncementCategory)}
            className="min-h-[42px] px-3 rounded-xl bg-white border border-[#D3E6D8] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
          >
            <option value="semua">Semua Kategori</option>
            {ANNOUNCEMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Announcements List */}
      <div className={compactMode ? 'space-y-3' : 'space-y-4'}>
        {filteredList.length === 0 ? (
          <div className="bg-white border border-[#D3E6D8] rounded-2xl p-10 text-center space-y-2">
            <Megaphone className="w-8 h-8 text-[#96CCA9] mx-auto" />
            <p className="text-sm font-semibold text-[#2F4F3C]">
              {tab === 'arsip' ? 'Belum ada pengumuman di arsip' : 'Belum ada pengumuman aktif'}
            </p>
          </div>
        ) : (
          filteredList.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border space-y-2.5 ${compactMode ? 'p-4' : 'p-5 sm:p-6'} ${
                item.pinned
                  ? 'bg-[#FFFDF5] border-amber-300'
                  : 'bg-white border-[#D3E6D8]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#52705E]">
                    {item.pinned && (
                      <span className="font-semibold text-amber-700 flex items-center gap-1">
                        <Pin className="w-3.5 h-3.5" />
                        <span>Disematkan</span>
                      </span>
                    )}
                    <span className="text-[#0B6B3A] font-semibold">{item.category}</span>
                    <span>·</span>
                    <span
                      className={
                        item.priority === 'mendesak'
                          ? 'text-rose-700 font-semibold'
                          : item.priority === 'penting'
                            ? 'text-amber-700 font-semibold'
                            : 'text-[#52705E]'
                      }
                    >
                      Prioritas {item.priority === 'mendesak' ? 'Mendesak' : item.priority === 'penting' ? 'Penting' : 'Normal'}
                    </span>
                    <span>·</span>
                    <span>{item.authorName}</span>
                    <span>·</span>
                    <span className="font-mono-num">{formatTimestampId(item.createdAt)}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[#0B2416]">{item.title}</h3>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateAnnouncement(profile, item.id, { pinned: !item.pinned })}
                      aria-label={item.pinned ? 'Lepas sematan' : 'Sematkan pengumuman'}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#52705E] hover:text-amber-700 cursor-pointer"
                    >
                      {item.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      aria-label={`Edit pengumuman ${item.title}`}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#52705E] hover:text-[#0B6B3A] cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAnnouncement(profile, item.id, { archived: !item.archived })}
                      aria-label={item.archived ? 'Pulihkan dari arsip' : 'Arsipkan pengumuman'}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#52705E] hover:text-[#0B6B3A] cursor-pointer"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      aria-label={`Hapus pengumuman ${item.title}`}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#52705E] hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-sm text-[#2F4F3C] whitespace-pre-line leading-relaxed">
                {item.content}
              </p>
            </article>
          ))
        )}
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Pengumuman?"
        description={`Yakin ingin menghapus pengumuman "${deleteTarget?.title ?? ''}" secara permanen?`}
        confirmLabel="Hapus Pengumuman"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={deleteBusy}
      />
    </div>
  );
}
