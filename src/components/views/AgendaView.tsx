import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Edit3, MapPin, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  createAgendaItem,
  deleteAgendaItem,
  updateAgendaItem,
} from '../../services/firestoreService';
import type { AgendaItem, ClassSettings, UserPublic } from '../../types';
import {
  canCreateAgenda,
  canEditOrDeleteOwnedItem,
  getJakartaDateString,
} from '../../utils/validation';
import { ConfirmModal } from '../ConfirmModal';

interface AgendaViewProps {
  profile: UserPublic;
  settings: ClassSettings;
  agendas: AgendaItem[];
  compactMode: boolean;
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function AgendaView({ profile, settings, agendas, compactMode }: AgendaViewProps) {
  const todayStr = getJakartaDateString();
  const [tab, setTab] = useState<'mendatang' | 'selesai' | 'kalender'>('mendatang');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(todayStr);
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AgendaItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [calYear, setCalYear] = useState<number>(() => Number(todayStr.slice(0, 4)));
  const [calMonth, setCalMonth] = useState<number>(() => Number(todayStr.slice(5, 7)) - 1);
  const [selectedCalDate, setSelectedCalDate] = useState<string>(todayStr);

  const canCreate = canCreateAgenda(profile.role, settings);

  const upcomingList = useMemo(
    () =>
      agendas
        .filter((a) => a.status === 'mendatang')
        .slice()
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    [agendas]
  );

  const completedList = useMemo(
    () =>
      agendas
        .filter((a) => a.status === 'selesai')
        .slice()
        .sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
    [agendas]
  );

  const calendarCells = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: Array<{ dateStr: string; dayNum: number } | null> = [];
    for (let i = 0; i < firstDay; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      const mm = String(calMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push({ dateStr: `${calYear}-${mm}-${dd}`, dayNum: d });
    }
    return cells;
  }, [calYear, calMonth]);

  const agendasByDate = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const ag of agendas) {
      const arr = map.get(ag.eventDate) ?? [];
      arr.push(ag);
      map.set(ag.eventDate, arr);
    }
    return map;
  }, [agendas]);

  const openCreate = () => {
    setEditingItem(null);
    setTitle('');
    setDescription('');
    setEventDate(tab === 'kalender' ? selectedCalDate : todayStr);
    setEventTime('');
    setLocation('');
    setErrorMsg(null);
    setShowForm(true);
  };

  const openEdit = (item: AgendaItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setDescription(item.description);
    setEventDate(item.eventDate);
    setEventTime(item.eventTime);
    setLocation(item.location);
    setErrorMsg(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      if (editingItem) {
        await updateAgendaItem(profile, editingItem.id, {
          title,
          description,
          eventDate,
          eventTime,
          location,
          status: editingItem.status,
        });
      } else {
        await createAgendaItem(profile, { title, description, eventDate, eventTime, location });
      }
      setShowForm(false);
      setEditingItem(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan agenda.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleStatus = async (item: AgendaItem) => {
    const nextStatus = item.status === 'mendatang' ? 'selesai' : 'mendatang';
    await updateAgendaItem(profile, item.id, {
      title: item.title,
      description: item.description,
      eventDate: item.eventDate,
      eventTime: item.eventTime,
      location: item.location,
      status: nextStatus,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteAgendaItem(profile, deleteTarget.id, deleteTarget.title);
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(calYear, calMonth + delta, 1);
    setCalYear(next.getFullYear());
    setCalMonth(next.getMonth());
  };

  const displayedList = tab === 'mendatang' ? upcomingList : completedList;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B2416]">Agenda &amp; Kalender Kelas 6A</h2>
          <p className="text-sm text-[#52705E]">
            Rencana kegiatan belajar, kerja bakti, ulangan, dan acara kelas bersama.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={openCreate}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Agenda</span>
          </button>
        )}
      </div>

      {canCreate && showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-[#96CCA9] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-[#0B2416]">
              {editingItem ? 'Edit Agenda Kelas' : 'Usulkan / Tambah Agenda Kelas'}
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
            <div className="sm:col-span-2">
              <label htmlFor="ag-title" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Nama Kegiatan
              </label>
              <input
                id="ag-title"
                type="text"
                required
                minLength={3}
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Kerja Bakti Menghias Kelas"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>

            <div>
              <label htmlFor="ag-date" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Tanggal
              </label>
              <input
                id="ag-date"
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] font-mono-num focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>

            <div>
              <label htmlFor="ag-time" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Jam (opsional)
              </label>
              <input
                id="ag-time"
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] font-mono-num focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ag-loc" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
              Lokasi Kegiatan
            </label>
            <input
              id="ag-loc"
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Contoh: Ruang Kelas 6A / Halaman Madrasah"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
            />
          </div>

          <div>
            <label htmlFor="ag-desc" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
              Keterangan &amp; Perlengkapan
            </label>
            <textarea
              id="ag-desc"
              required
              rows={2}
              minLength={1}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan perlengkapan yang perlu dibawa atau susunan acara..."
              className="w-full p-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
            >
              {busy ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Simpan Agenda'}
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="inline-flex rounded-xl bg-white border border-[#D3E6D8] p-1">
        <button
          type="button"
          onClick={() => setTab('mendatang')}
          className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold cursor-pointer ${
            tab === 'mendatang' ? 'bg-[#0B6B3A] text-white' : 'text-[#52705E] hover:text-[#0B2416]'
          }`}
        >
          Mendatang ({upcomingList.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('selesai')}
          className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold cursor-pointer ${
            tab === 'selesai' ? 'bg-[#0B6B3A] text-white' : 'text-[#52705E] hover:text-[#0B2416]'
          }`}
        >
          Selesai ({completedList.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('kalender')}
          className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold cursor-pointer ${
            tab === 'kalender' ? 'bg-[#0B6B3A] text-white' : 'text-[#52705E] hover:text-[#0B2416]'
          }`}
        >
          Kalender
        </button>
      </div>

      {tab === 'kalender' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 bg-white border border-[#D3E6D8] rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-[#0B2416]">
                {MONTH_NAMES_ID[calMonth]} {calYear}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Bulan sebelumnya"
                  className="min-h-[38px] min-w-[38px] rounded-xl bg-[#F0F7F2] border border-[#C6E0CE] text-[#2F4F3C] hover:text-[#0B2416] flex items-center justify-center cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="Bulan berikutnya"
                  className="min-h-[38px] min-w-[38px] rounded-xl bg-[#F0F7F2] border border-[#C6E0CE] text-[#2F4F3C] hover:text-[#0B2416] flex items-center justify-center cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-[#52705E]">
              {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((cell, idx) => {
                if (!cell) return <div key={`empty-${idx}`} className="h-11 sm:h-12" />;
                const events = agendasByDate.get(cell.dateStr) ?? [];
                const isSelected = selectedCalDate === cell.dateStr;
                const isToday = cell.dateStr === todayStr;
                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => setSelectedCalDate(cell.dateStr)}
                    className={`h-11 sm:h-12 rounded-xl border flex flex-col items-center justify-center gap-0.5 text-xs font-mono-num transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#0B6B3A] border-[#0B6B3A] text-white font-bold'
                        : isToday
                          ? 'bg-amber-50 border-amber-400 text-amber-800 font-bold'
                          : 'bg-[#F0F7F2] border-[#D3E6D8] text-[#0B2416] hover:bg-[#E2EFE6]'
                    }`}
                  >
                    <span>{cell.dayNum}</span>
                    {events.length > 0 && (
                      <span className={`text-[10px] leading-none font-bold ${isSelected ? 'text-amber-200' : 'text-amber-700'}`}>
                        {events.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="lg:col-span-5 bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#0B2416]">
                Agenda Tanggal <span className="font-mono-num text-[#0B6B3A]">{selectedCalDate}</span>
              </h3>
            </div>
            {(agendasByDate.get(selectedCalDate) ?? []).length === 0 ? (
              <p className="text-xs text-[#52705E] py-8 text-center">
                Tidak ada agenda tercatat pada tanggal ini.
              </p>
            ) : (
              <div className="space-y-3">
                {(agendasByDate.get(selectedCalDate) ?? []).map((item) => (
                  <div key={item.id} className="p-3.5 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8] space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs text-amber-700 font-semibold font-mono-num">
                      <span>{item.eventTime || 'Waktu menyusul'}</span>
                      <span>{item.status === 'selesai' ? 'Selesai' : 'Mendatang'}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#0B2416]">{item.title}</p>
                    <p className="text-xs text-[#2F4F3C]">{item.description}</p>
                    <p className="text-[11px] text-[#52705E] flex items-center gap-1 pt-1">
                      <MapPin className="w-3 h-3" />
                      <span>{item.location}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedList.length === 0 ? (
            <div className="md:col-span-2 bg-white border border-[#D3E6D8] rounded-2xl p-10 text-center space-y-2">
              <CalendarDays className="w-8 h-8 text-[#96CCA9] mx-auto" />
              <p className="text-sm font-semibold text-[#2F4F3C]">
                Belum ada agenda {tab === 'mendatang' ? 'mendatang' : 'selesai'}
              </p>
            </div>
          ) : (
            displayedList.map((item) => {
              const canModify = canEditOrDeleteOwnedItem(profile.role, profile.uid, item.authorId);
              return (
                <article
                  key={item.id}
                  className={`bg-white border border-[#D3E6D8] rounded-2xl flex flex-col justify-between gap-4 ${
                    compactMode ? 'p-4' : 'p-5'
                  } ${item.status === 'selesai' ? 'opacity-80 bg-[#F8FCF9]' : ''}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono-num text-xs font-semibold text-amber-700">
                        {item.eventDate} {item.eventTime ? `· ${item.eventTime} WIB` : ''}
                      </span>

                      {canModify && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(item)}
                            aria-label={item.status === 'mendatang' ? 'Tandai selesai' : 'Kembalikan ke mendatang'}
                            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[#52705E] hover:text-[#0B6B3A] cursor-pointer"
                          >
                            {item.status === 'mendatang' ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            aria-label={`Edit agenda ${item.title}`}
                            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[#52705E] hover:text-[#0B6B3A] cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            aria-label={`Hapus agenda ${item.title}`}
                            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[#52705E] hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-[#0B2416]">{item.title}</h3>
                    <p className="text-sm text-[#2F4F3C] leading-relaxed">{item.description}</p>
                  </div>

                  <div className="pt-3 border-t border-[#E6F2EA] flex items-center justify-between text-xs text-[#52705E] gap-2">
                    <span className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-[#0B6B3A] shrink-0" />
                      <span className="truncate">{item.location}</span>
                    </span>
                    <span className="shrink-0">Oleh {item.authorName}</span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Agenda Kelas?"
        description={`Yakin ingin menghapus agenda "${deleteTarget?.title ?? ''}"?`}
        confirmLabel="Hapus Agenda"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={deleteBusy}
      />
    </div>
  );
}
