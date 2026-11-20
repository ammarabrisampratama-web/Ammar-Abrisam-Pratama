import { useMemo, useRef, useState } from 'react';
import { CheckCheck, Inbox, Reply, Search, Send } from 'lucide-react';
import { replyAdminMessage, sendAdminMessage } from '../../services/firestoreService';
import type {
  AdminMessage,
  AdminMessageCategory,
  AdminMessageStatus,
  ClassSettings,
  UserPublic,
} from '../../types';
import {
  ADMIN_MSG_CATEGORIES,
  formatTimestampId,
  isAdminOrOwnerRole,
} from '../../utils/validation';

interface AdminMessagesViewProps {
  profile: UserPublic;
  settings: ClassSettings;
  messages: AdminMessage[];
}

export function AdminMessagesView({ profile, settings, messages }: AdminMessagesViewProps) {
  const isStaff = isAdminOrOwnerRole(profile.role);

  const [category, setCategory] = useState<AdminMessageCategory>('Pertanyaan');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const lastSentMsRef = useRef<number>(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'semua' | AdminMessageStatus>('semua');

  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<AdminMessageStatus>('selesai');
  const [replyBusy, setReplyBusy] = useState(false);

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return messages.filter((m) => {
      if (statusFilter !== 'semua' && m.status !== statusFilter) return false;
      if (
        q &&
        !m.subject.toLowerCase().includes(q) &&
        !m.message.toLowerCase().includes(q) &&
        !m.senderName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [messages, statusFilter, searchQuery]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastSentMsRef.current < 3000) {
      setFormError('Tunggu 3 detik sebelum mengirim pesan berikutnya.');
      return;
    }

    setFormError(null);
    setFormSuccess(null);
    setSending(true);
    try {
      await sendAdminMessage(profile, { category, subject, message });
      lastSentMsRef.current = Date.now();
      setSubject('');
      setMessage('');
      setFormSuccess('Pesan Anda telah terkirim ke Pengurus & Wali Kelas.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal mengirim pesan.');
    } finally {
      setSending(false);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent, item: AdminMessage) => {
    e.preventDefault();
    setReplyBusy(true);
    try {
      await replyAdminMessage(profile, item.id, item.senderId, item.subject, replyStatus, replyText);
      setReplyingId(null);
      setReplyText('');
    } finally {
      setReplyBusy(false);
    }
  };

  const handleQuickMarkRead = async (item: AdminMessage) => {
    await replyAdminMessage(profile, item.id, item.senderId, item.subject, 'dibaca', item.adminReply);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0B2416]">Pesan untuk Admin &amp; Wali Kelas</h2>
        <p className="text-sm text-[#52705E]">
          {isStaff
            ? 'Kotak masuk pesan pribadi dari siswa Kelas 6A. Tandai dibaca atau kirim balasan resmi.'
            : settings.adminContactNote}
        </p>
      </div>

      {/* Student Message Composer */}
      {!isStaff && (
        <form onSubmit={handleSend} className="bg-white border border-[#D3E6D8] rounded-2xl p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-semibold text-[#0B2416]">Kirim Pesan Baru ke Admin</h3>

          {formError && (
            <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3">
              {formError}
            </p>
          )}
          {formSuccess && (
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              {formSuccess}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="adm-cat" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Kategori
              </label>
              <select
                id="adm-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as AdminMessageCategory)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              >
                {ADMIN_MSG_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="adm-sub" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                Subjek Pesan
              </label>
              <input
                id="adm-sub"
                type="text"
                required
                minLength={3}
                maxLength={120}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Contoh: Izin tidak masuk karena sakit"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="adm-body" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
              Isi Pesan
            </label>
            <textarea
              id="adm-body"
              required
              rows={3}
              minLength={3}
              maxLength={1500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tuliskan pesan Anda dengan jelas dan sopan..."
              className="w-full p-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Mengirim...' : 'Kirim ke Admin'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#52705E] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari subjek, isi pesan, atau pengirim..."
            aria-label="Cari pesan untuk Admin"
            className="w-full min-h-[42px] pl-10 pr-3.5 rounded-xl bg-white border border-[#D3E6D8] text-sm text-[#0B2416] placeholder:text-[#6E8B79] focus:outline-none focus:border-[#0B6B3A]"
          />
        </div>
        <select
          aria-label="Filter status pesan admin"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'semua' | AdminMessageStatus)}
          className="min-h-[42px] px-3 rounded-xl bg-white border border-[#D3E6D8] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
        >
          <option value="semua">Semua Status</option>
          <option value="menunggu">Menunggu</option>
          <option value="dibaca">Dibaca</option>
          <option value="selesai">Selesai</option>
        </select>
      </div>

      {/* Messages List */}
      <div className="space-y-4">
        {filteredMessages.length === 0 ? (
          <div className="bg-white border border-[#D3E6D8] rounded-2xl p-10 text-center space-y-2">
            <Inbox className="w-8 h-8 text-[#96CCA9] mx-auto" />
            <p className="text-sm font-semibold text-[#2F4F3C]">Belum ada pesan</p>
          </div>
        ) : (
          filteredMessages.map((item) => (
            <article key={item.id} className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#52705E]">
                    <span className="text-[#0B6B3A] font-semibold">{item.category}</span>
                    <span>·</span>
                    <span>{item.senderName}</span>
                    <span>·</span>
                    <span className="font-mono-num">{formatTimestampId(item.createdAt)}</span>
                  </div>
                  <h3 className="text-base font-bold text-[#0B2416]">{item.subject}</h3>
                </div>

                <span
                  className={`text-xs font-semibold shrink-0 ${
                    item.status === 'selesai'
                      ? 'text-[#0B6B3A]'
                      : item.status === 'dibaca'
                        ? 'text-sky-700'
                        : 'text-amber-700'
                  }`}
                >
                  {item.status === 'selesai'
                    ? 'Selesai'
                    : item.status === 'dibaca'
                      ? 'Dibaca Admin'
                      : 'Menunggu Tanggapan'}
                </span>
              </div>

              <p className="text-sm text-[#2F4F3C] whitespace-pre-line leading-relaxed">{item.message}</p>

              {item.adminReply && (
                <div className="p-3.5 rounded-xl bg-[#F0F7F2] border border-[#D3E6D8] space-y-1">
                  <p className="text-xs font-semibold text-[#0B6B3A]">Balasan {item.repliedBy || 'Admin'}</p>
                  <p className="text-sm text-[#0B2416] whitespace-pre-line">{item.adminReply}</p>
                </div>
              )}

              {isStaff && (
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  {replyingId === item.id ? (
                    <form onSubmit={(e) => handleReplySubmit(e, item)} className="w-full space-y-3 pt-2 border-t border-[#E6F2EA]">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          value={replyStatus}
                          onChange={(e) => setReplyStatus(e.target.value as AdminMessageStatus)}
                          aria-label="Status pesan"
                          className="min-h-[42px] px-3 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416]"
                        >
                          <option value="dibaca">Dibaca</option>
                          <option value="selesai">Selesai</option>
                          <option value="menunggu">Menunggu</option>
                        </select>
                        <input
                          type="text"
                          maxLength={1500}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Tulis balasan untuk siswa..."
                          className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReplyingId(null)}
                          className="min-h-[38px] px-3 rounded-xl text-xs text-[#52705E] hover:text-[#0B2416] cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={replyBusy}
                          className="min-h-[38px] px-4 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold cursor-pointer"
                        >
                          {replyBusy ? 'Menyimpan...' : 'Simpan Balasan'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {item.status === 'menunggu' && (
                        <button
                          type="button"
                          onClick={() => handleQuickMarkRead(item)}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#F0F7F2] hover:bg-[#E2EFE6] border border-[#C6E0CE] text-xs font-semibold text-[#0B6B3A] flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Tandai Dibaca</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingId(item.id);
                          setReplyText(item.adminReply || '');
                          setReplyStatus(item.status === 'menunggu' ? 'selesai' : item.status);
                        }}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#E6F4EC] hover:bg-[#D5ECE0] border border-[#96CCA9] text-xs font-semibold text-[#0B6B3A] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Reply className="w-3.5 h-3.5" />
                        <span>{item.adminReply ? 'Edit Balasan' : 'Balas Pesan'}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
