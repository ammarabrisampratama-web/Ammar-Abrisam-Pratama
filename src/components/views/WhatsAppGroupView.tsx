import { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Info,
  MessageSquare,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { createCustomGroupRoom, deleteCustomGroupRoom } from '../../services/firestoreService';
import type { ChatRoom, ClassSettings, UserPublic } from '../../types';
import {
  isSafeExternalHttpUrl,
  OFFICIAL_WHATSAPP_GROUP_URL,
} from '../../utils/mediaUtils';
import { isAdminOrOwnerRole } from '../../utils/validation';
import { ConfirmModal } from '../ConfirmModal';

interface WhatsAppGroupViewProps {
  profile: UserPublic;
  settings: ClassSettings;
  chatRooms: ChatRoom[];
  onOpenRoom: (roomId: string) => void;
}

function WhatsAppIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12.03 2C6.51 2 2.02 6.48 2.02 12c0 1.97.57 3.81 1.56 5.36L2 22l4.79-1.54A9.96 9.96 0 0 0 12.03 22c5.52 0 10-4.48 10-10S17.55 2 12.03 2Zm5.84 14.12c-.25.7-1.45 1.34-2.01 1.42-.52.08-1.18.11-1.91-.12-.44-.14-1-.33-1.72-.64-3.03-1.31-5-4.37-5.15-4.57-.15-.2-1.23-1.64-1.23-3.13 0-1.49.78-2.22 1.05-2.52.27-.3.6-.38.8-.38.2 0 .4 0 .57.01.18.01.43-.07.67.51.25.6.85 2.08.92 2.23.08.15.13.33.03.53-.1.2-.15.33-.3.5-.15.18-.32.4-.45.54-.15.15-.31.32-.13.62.18.3.8 1.32 1.71 2.13 1.18 1.05 2.17 1.38 2.47 1.53.3.15.48.13.66-.08.18-.2.76-.88.96-1.18.2-.3.4-.25.67-.15.27.1 1.74.82 2.04.97.3.15.5.22.57.35.08.13.08.73-.17 1.42Z" />
    </svg>
  );
}

export function WhatsAppGroupView({
  profile,
  settings,
  chatRooms,
  onOpenRoom,
}: WhatsAppGroupViewProps) {
  const [copied, setCopied] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatRoom | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const isStaff = isAdminOrOwnerRole(profile.role);
  const rawWaUrl = settings.whatsappGroupUrl?.trim() || OFFICIAL_WHATSAPP_GROUP_URL;
  const waUrl = isSafeExternalHttpUrl(rawWaUrl) ? rawWaUrl : OFFICIAL_WHATSAPP_GROUP_URL;

  const portalGroupRooms = chatRooms.filter(
    (r) => r.type === 'class' || r.type === 'group'
  );

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(waUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    setCreating(true);
    try {
      await createCustomGroupRoom(profile, groupName, groupDesc);
      setGroupName('');
      setGroupDesc('');
      setFormMsg({ type: 'ok', text: 'Grup diskusi internal kelas berhasil dibuat.' });
    } catch (err) {
      setFormMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal membuat grup kelas.',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteCustomGroupRoom(profile, deleteTarget.roomId, deleteTarget.name);
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Hero WhatsApp Resmi Kelas 6A */}
      <section className="rounded-2xl overflow-hidden border border-[#C6E0CE] dark:border-emerald-800/70 bg-gradient-to-br from-[#075E54] via-[#0B6B3A] to-[#128C7E] text-white shadow-sm">
        <div className="p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-semibold">
              <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
              <span>Grup Resmi WhatsApp · Kelas 6A MI Al-Hidayah Sawotratap</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Grup WhatsApp &amp; Komunitas Kelas 6A
            </h2>
            <p className="text-sm text-emerald-50/95 leading-relaxed">
              Gunakan tombol resmi di bawah untuk membuka atau bergabung ke Grup WhatsApp Kelas 6A langsung melalui aplikasi WhatsApp di perangkat Anda maupun WhatsApp Web.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[48px] px-5 py-3 rounded-xl bg-[#25D366] hover:bg-[#1EBE5B] text-[#062E19] font-bold text-sm flex items-center justify-center gap-2.5 shadow-md transition-colors"
            >
              <WhatsAppIcon className="w-5 h-5 shrink-0" />
              <span>Gabung Grup WhatsApp</span>
              <ExternalLink className="w-4 h-4 shrink-0" />
            </a>

            <button
              type="button"
              onClick={handleCopyLink}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Tautan Grup Disalin' : 'Salin Tautan Grup WA'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Clarifying Notice */}
      <section className="bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/70 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs sm:text-sm text-amber-950 dark:text-amber-100">
          <p className="font-semibold">Informasi Integrasi Tautan WhatsApp</p>
          <p className="leading-relaxed text-amber-900 dark:text-amber-200">
            Tombol di atas menggunakan tautan undangan grup resmi WhatsApp (<span className="font-mono text-xs break-all">{waUrl}</span>). Website portal ini <strong>tidak menarik atau menyinkronkan isi percakapan dari server WhatsApp</strong> secara otomatis. Untuk chat langsung di dalam portal web bersama teman sekelas, gunakan fitur <strong>Chat Real-Time Portal</strong> di bawah ini.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Info & Tata Tertib Grup */}
        <section className="lg:col-span-5 bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0B6B3A] dark:text-emerald-400" />
            <h3 className="text-base font-bold text-[#0B2416] dark:text-emerald-50">
              Informasi &amp; Tata Tertib Grup
            </h3>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-[#2F4F3C] dark:text-emerald-200/90">
            <div className="p-3.5 rounded-xl bg-[#F4F9F5] dark:bg-[#132C1E] border border-[#D3E6D8] dark:border-emerald-900/60 space-y-1">
              <p className="text-xs font-semibold text-[#52705E] dark:text-emerald-400">Identitas Grup</p>
              <p className="font-bold text-[#0B2416] dark:text-emerald-50">Grup Resmi Kelas 6A · {settings.academicYear}</p>
              <p className="text-xs text-[#52705E] dark:text-emerald-300/80">
                Pembina: {settings.homeroomTeacher}
              </p>
            </div>

            <ul className="space-y-2.5 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#E6F4EC] dark:bg-emerald-900/60 text-[#0B6B3A] dark:text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>Gunakan bahasa yang sopan, Islami, dan saling menghormati sesama siswa maupun guru.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#E6F4EC] dark:bg-emerald-900/60 text-[#0B6B3A] dark:text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>Dilarang mengirim spam, tautan penipuan/phishing, perundungan, atau konten tidak pantas.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#E6F4EC] dark:bg-emerald-900/60 text-[#0B6B3A] dark:text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>Jangan menyebarkan informasi pribadi sensitif (password, OTP, atau alamat rumah lengkap).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#E6F4EC] dark:bg-emerald-900/60 text-[#0B6B3A] dark:text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  4
                </span>
                <span>Pastikan link grup hanya dibagikan kepada siswa/wali murid resmi Kelas 6A MI Al-Hidayah Sawotratap.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Grup Chat Internal Portal */}
        <section className="lg:col-span-7 bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-[#0B6B3A] dark:text-emerald-400" />
              <div>
                <h3 className="text-base font-bold text-[#0B2416] dark:text-emerald-50">
                  Grup Chat Internal Portal
                </h3>
                <p className="text-xs text-[#52705E] dark:text-emerald-300/80">
                  Ruang diskusi real-time dengan pesan suara, foto, reaksi emoji, dan pin pesan.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-[#F0F7F2] dark:bg-[#132C1E] border border-[#C6E0CE] dark:border-emerald-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#0B2416] dark:text-emerald-50">
                    Grup Utama Kelas 6A
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#0B6B3A] text-white text-[10px] font-bold">
                    Utama
                  </span>
                </div>
                <p className="text-xs text-[#52705E] dark:text-emerald-300/80 mt-0.5 truncate">
                  {chatRooms.find((r) => r.roomId === 'kelas-6a')?.lastMessageText ||
                    'Diskusi kelas, pengumuman, dan koordinasi tugas harian.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenRoom('kelas-6a')}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Buka Chat Grup</span>
              </button>
            </div>

            {portalGroupRooms
              .filter((r) => r.roomId !== 'kelas-6a')
              .map((room) => (
                <div
                  key={room.roomId}
                  className="p-4 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#D3E6D8] dark:border-emerald-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0B2416] dark:text-emerald-50 truncate">
                      {room.name}
                    </p>
                    <p className="text-xs text-[#52705E] dark:text-emerald-300/80 truncate mt-0.5">
                      {room.description || room.lastMessageText}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenRoom(room.roomId)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#E6F4EC] dark:bg-emerald-900/60 hover:bg-[#D3EBD9] text-[#0B6B3A] dark:text-emerald-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Buka</span>
                    </button>
                    {isStaff && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(room)}
                        aria-label={`Hapus grup ${room.name}`}
                        className="min-h-[38px] min-w-[38px] rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {isStaff && (
            <form
              onSubmit={handleCreateGroup}
              className="pt-4 border-t border-[#E6F2EA] dark:border-emerald-900/60 space-y-3"
            >
              <p className="text-xs font-bold text-[#0B2416] dark:text-emerald-100 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
                <span>Buat Sub-Grup Diskusi Portal (Owner/Admin)</span>
              </p>

              {formMsg && (
                <p
                  className={`text-xs rounded-xl p-2.5 border ${
                    formMsg.type === 'ok'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  {formMsg.text}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={100}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Nama grup (mis. Kelompok Sains 6A)"
                  className="min-h-[42px] px-3.5 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs sm:text-sm text-[#0B2416] dark:text-emerald-50 focus:outline-none focus:border-[#0B6B3A]"
                />
                <input
                  type="text"
                  maxLength={240}
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Deskripsi singkat grup (opsional)"
                  className="min-h-[42px] px-3.5 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs sm:text-sm text-[#0B2416] dark:text-emerald-50 focus:outline-none focus:border-[#0B6B3A]"
                />
              </div>

              <button
                type="submit"
                disabled={creating || !groupName.trim()}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {creating ? 'Membuat Grup...' : 'Tambah Sub-Grup Portal'}
              </button>
            </form>
          )}
        </section>
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Sub-Grup Portal?"
        description={`Yakin ingin menghapus grup "${deleteTarget?.name || ''}"?`}
        confirmLabel="Hapus Grup"
        onConfirm={handleDeleteGroup}
        onCancel={() => setDeleteTarget(null)}
        busy={deleteBusy}
      />
    </div>
  );
}
