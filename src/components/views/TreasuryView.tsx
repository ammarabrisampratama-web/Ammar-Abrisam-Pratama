import { useMemo, useState } from 'react';
import { Download, Edit3, Plus, Search, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import {
  createTreasuryEntry,
  deleteTreasuryEntry,
  updateTreasuryEntry,
} from '../../services/firestoreService';
import type {
  ClassSettings,
  TreasuryCategory,
  TreasuryEntry,
  TreasuryPaymentStatus,
  TreasuryType,
  UserPublic,
} from '../../types';
import {
  buildTreasuryCsv,
  calculateMonthlyTreasuryRecap,
  calculateTreasurySummary,
  canManageTreasury,
  formatRupiah,
  getJakartaDateString,
  TREASURY_CATEGORIES,
} from '../../utils/validation';
import { ConfirmModal } from '../ConfirmModal';

interface TreasuryViewProps {
  profile: UserPublic;
  settings: ClassSettings;
  treasury: TreasuryEntry[];
  compactMode: boolean;
}

export function TreasuryView({ profile, settings, treasury, compactMode }: TreasuryViewProps) {
  const todayStr = getJakartaDateString();
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TreasuryEntry | null>(null);

  const [type, setType] = useState<TreasuryType>('pemasukan');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TreasuryCategory>('Iuran Kas');
  const [studentName, setStudentName] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<TreasuryPaymentStatus>('lunas');
  const [correctionNote, setCorrectionNote] = useState('');
  const [date, setDate] = useState(todayStr);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'semua' | TreasuryType>('semua');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TreasuryEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const canManage = canManageTreasury(profile.role, settings);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return treasury
      .filter((t) => {
        if (typeFilter !== 'semua' && t.type !== typeFilter) return false;
        if (fromDate && t.date < fromDate) return false;
        if (toDate && t.date > toDate) return false;
        if (
          q &&
          !t.description.toLowerCase().includes(q) &&
          !t.studentName.toLowerCase().includes(q) &&
          !t.category.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [treasury, typeFilter, fromDate, toDate, searchQuery]);

  const summary = useMemo(() => calculateTreasurySummary(filteredEntries), [filteredEntries]);
  const monthlyRecap = useMemo(() => calculateMonthlyTreasuryRecap(treasury), [treasury]);

  const openCreate = () => {
    setEditingEntry(null);
    setType('pemasukan');
    setAmount('');
    setDescription('');
    setCategory('Iuran Kas');
    setStudentName('');
    setPaymentStatus('lunas');
    setCorrectionNote('');
    setDate(todayStr);
    setErrorMsg(null);
    setShowForm(true);
  };

  const openEdit = (entry: TreasuryEntry) => {
    setEditingEntry(entry);
    setType(entry.type);
    setAmount(String(entry.amount));
    setDescription(entry.description);
    setCategory(entry.category);
    setStudentName(entry.studentName || '');
    setPaymentStatus(entry.paymentStatus || 'lunas');
    setCorrectionNote('');
    setDate(entry.date);
    setErrorMsg(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const payload = {
        type,
        amount: Number(amount),
        description,
        category,
        studentName,
        paymentStatus,
        correctionNote,
        date,
      };
      if (editingEntry) {
        await updateTreasuryEntry(profile, editingEntry.id, payload);
      } else {
        await createTreasuryEntry(profile, payload);
      }
      setShowForm(false);
      setEditingEntry(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan catatan kas.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteTreasuryEntry(profile, deleteTarget.id, deleteTarget.description);
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleExportCsv = () => {
    const csv = buildTreasuryCsv(filteredEntries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uang-kas-6a-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(filteredEntries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uang-kas-6a-${todayStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B2416]">Catatan Uang Kas Kelas 6A</h2>
          <p className="text-sm text-[#52705E]">
            Target kas mingguan: <span className="font-mono-num text-[#0B6B3A] font-semibold">{formatRupiah(settings.weeklyKasTarget)}</span> · Transparansi pemasukan &amp; pengeluaran kelas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white hover:bg-[#F0F7F2] border border-[#C6E0CE] text-[#0B2416] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#0B6B3A]" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white hover:bg-[#F0F7F2] border border-[#C6E0CE] text-[#0B2416] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-700" />
            <span>JSON</span>
          </button>

          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Transaksi</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#52705E]">
            <span>Total Pemasukan</span>
            <TrendingUp className="w-4 h-4 text-[#0B6B3A]" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-[#0B6B3A] mt-2 font-mono-num">
            {formatRupiah(summary.totalIncome)}
          </p>
        </div>

        <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#52705E]">
            <span>Total Pengeluaran</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-rose-700 mt-2 font-mono-num">
            {formatRupiah(summary.totalExpense)}
          </p>
        </div>

        <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-[#52705E]">
            <span>Saldo Kas Tersedia</span>
            <Wallet className="w-4 h-4 text-[#0B6B3A]" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-[#0B2416] mt-2 font-mono-num">
            {formatRupiah(summary.balance)}
          </p>
        </div>
      </section>

      {/* Add / Audited Edit Form */}
      {canManage && showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-[#96CCA9] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-[#0B2416]">
              {editingEntry ? 'Koreksi Transaksi Uang Kas (Teraudit)' : 'Catat Transaksi Uang Kas Baru'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingEntry(null);
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
              <label htmlFor="kas-type" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Jenis Transaksi
              </label>
              <select
                id="kas-type"
                value={type}
                onChange={(e) => setType(e.target.value as TreasuryType)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              >
                <option value="pemasukan">Pemasukan</option>
                <option value="pengeluaran">Pengeluaran</option>
              </select>
            </div>

            <div>
              <label htmlFor="kas-cat" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Kategori
              </label>
              <select
                id="kas-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as TreasuryCategory)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              >
                {TREASURY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="kas-amount" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Nominal (Rp)
              </label>
              <input
                id="kas-amount"
                type="number"
                required
                min={1}
                max={100000000}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5000"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] font-mono-num focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>

            <div>
              <label htmlFor="kas-date" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Tanggal
              </label>
              <input
                id="kas-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] font-mono-num focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="kas-student" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Nama Siswa / Penyetor (opsional)
              </label>
              <input
                id="kas-student"
                type="text"
                maxLength={80}
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Contoh: Ahmad Fauzan"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>

            <div>
              <label htmlFor="kas-status" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Status Pembayaran
              </label>
              <select
                id="kas-status"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as TreasuryPaymentStatus)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              >
                <option value="lunas">Lunas</option>
                <option value="belum">Belum Lunas</option>
                <option value="operasional">Operasional Kelas</option>
              </select>
            </div>

            <div>
              <label htmlFor="kas-desc" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Keterangan
              </label>
              <input
                id="kas-desc"
                type="text"
                required
                minLength={3}
                maxLength={160}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Iuran Kas Pekan Ini / Beli Spidol"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>
          </div>

          {editingEntry && (
            <div>
              <label htmlFor="kas-correction" className="block text-xs font-semibold text-amber-800 mb-1.5">
                Catatan Koreksi Audit (Wajib diisi saat mengubah transaksi)
              </label>
              <input
                id="kas-correction"
                type="text"
                required
                minLength={3}
                maxLength={240}
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                placeholder="Contoh: Revisi salah ketik nominal dari Rp 50.000 menjadi Rp 5.000"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-amber-50 border border-amber-300 text-sm text-[#0B2416] focus:outline-none focus:border-amber-600"
              />
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
            >
              {busy ? 'Menyimpan...' : editingEntry ? 'Simpan Koreksi' : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Date Filters */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-5 relative">
          <Search className="w-4 h-4 text-[#52705E] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama siswa, kategori, atau keterangan..."
            aria-label="Cari catatan uang kas"
            className="w-full min-h-[42px] pl-10 pr-3.5 rounded-xl bg-white border border-[#D3E6D8] text-sm text-[#0B2416] placeholder:text-[#6E8B79] focus:outline-none focus:border-[#0B6B3A]"
          />
        </div>
        <select
          aria-label="Filter jenis transaksi"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'semua' | TreasuryType)}
          className="lg:col-span-3 min-h-[42px] px-3 rounded-xl bg-white border border-[#D3E6D8] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
        >
          <option value="semua">Semua Jenis</option>
          <option value="pemasukan">Pemasukan</option>
          <option value="pengeluaran">Pengeluaran</option>
        </select>
        <input
          type="date"
          aria-label="Dari tanggal"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="lg:col-span-2 min-h-[42px] px-3 rounded-xl bg-white border border-[#D3E6D8] text-xs text-[#0B2416] font-mono-num focus:outline-none focus:border-[#0B6B3A]"
        />
        <input
          type="date"
          aria-label="Sampai tanggal"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="lg:col-span-2 min-h-[42px] px-3 rounded-xl bg-white border border-[#D3E6D8] text-xs text-[#0B2416] font-mono-num focus:outline-none focus:border-[#0B6B3A]"
        />
      </section>

      {/* Monthly Recap Strip */}
      {monthlyRecap.length > 0 && (
        <section className="bg-white border border-[#D3E6D8] rounded-2xl p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[#0B2416]">Rekap Kas Bulanan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {monthlyRecap.slice(0, 4).map((m) => (
              <div key={m.monthKey} className="p-3 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono-num font-bold text-[#0B2416]">{m.monthKey}</span>
                  <span className="text-[#52705E]">{m.count} transaksi</span>
                </div>
                <p className="text-[#0B6B3A] font-semibold font-mono-num">Masuk: {formatRupiah(m.income)}</p>
                <p className="text-rose-700 font-semibold font-mono-num">Keluar: {formatRupiah(m.expense)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Transaction History */}
      <section className="bg-white border border-[#D3E6D8] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[#F0F7F2] border-b border-[#E2EFE6] flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#0B2416]">Riwayat Transaksi Kas</h3>
          <span className="font-mono-num text-xs text-[#52705E]">{filteredEntries.length} catatan</span>
        </div>

        {filteredEntries.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#52705E]">
            Belum ada catatan transaksi kas yang sesuai filter.
          </p>
        ) : (
          <div className="divide-y divide-[#E6F2EA]">
            {filteredEntries.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-4 ${compactMode ? 'p-3.5 sm:px-5' : 'p-4 sm:px-5'}`}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#52705E]">
                    <span className="font-mono-num">{item.date}</span>
                    <span>·</span>
                    <span className="text-[#0B6B3A] font-semibold">{item.category}</span>
                    {item.studentName && (
                      <>
                        <span>·</span>
                        <span className="text-[#0B2416] font-medium">{item.studentName}</span>
                      </>
                    )}
                    <span>·</span>
                    <span
                      className={
                        item.paymentStatus === 'belum'
                          ? 'text-amber-700 font-semibold'
                          : 'text-[#52705E]'
                      }
                    >
                      {item.paymentStatus === 'lunas'
                        ? 'Lunas'
                        : item.paymentStatus === 'belum'
                          ? 'Belum Lunas'
                          : 'Operasional'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[#0B2416] truncate">{item.description}</p>
                  {item.correctionNote && (
                    <p className="text-[11px] text-amber-700">Koreksi: {item.correctionNote}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-mono-num text-sm sm:text-base font-bold ${
                      item.type === 'pemasukan' ? 'text-[#0B6B3A]' : 'text-rose-700'
                    }`}
                  >
                    {item.type === 'pemasukan' ? '+' : '-'} {formatRupiah(item.amount)}
                  </span>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        aria-label={`Koreksi transaksi ${item.description}`}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#52705E] hover:text-[#0B6B3A] cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        aria-label={`Hapus transaksi ${item.description}`}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#52705E] hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Catatan Uang Kas?"
        description={`Yakin ingin menghapus transaksi "${deleteTarget?.description ?? ''}" senilai ${deleteTarget ? formatRupiah(deleteTarget.amount) : ''}?`}
        confirmLabel="Hapus Transaksi"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={deleteBusy}
      />
    </div>
  );
}
