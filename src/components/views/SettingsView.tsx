import { useState } from 'react';
import {
  Ban,
  BellRing,
  Eye,
  EyeOff,
  LayoutGrid,
  Moon,
  Shield,
  Sun,
  UserCircle,
  UserX,
} from 'lucide-react';
import { unblockClassmate, updateOnlinePrivacy } from '../../services/firestoreService';
import type { BlockedUser, NavTab, UserPublic } from '../../types';

interface SettingsViewProps {
  profile: UserPublic;
  theme: 'light' | 'dark';
  onChangeTheme: (next: 'light' | 'dark') => void;
  compactMode: boolean;
  onToggleCompactMode: () => void;
  browserPushEnabled: boolean;
  onEnableBrowserPush: () => Promise<void>;
  blockedUsers: BlockedUser[];
  onNavigate: (tab: NavTab) => void;
}

export function SettingsView({
  profile,
  theme,
  onChangeTheme,
  compactMode,
  onToggleCompactMode,
  browserPushEnabled,
  onEnableBrowserPush,
  blockedUsers,
  onNavigate,
}: SettingsViewProps) {
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [unblockBusyUid, setUnblockBusyUid] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const hideOnline = Boolean(profile.hideOnlineStatus);

  const handleToggleOnlinePrivacy = async () => {
    setPrivacyBusy(true);
    setFeedback(null);
    try {
      await updateOnlinePrivacy(profile.uid, !hideOnline);
      setFeedback(
        !hideOnline
          ? 'Status online Anda sekarang disembunyikan dari pengguna lain.'
          : 'Status online Anda kembali ditampilkan.'
      );
    } finally {
      setPrivacyBusy(false);
    }
  };

  const handleUnblock = async (targetUid: string) => {
    setUnblockBusyUid(targetUid);
    try {
      await unblockClassmate(profile.uid, targetUid);
    } finally {
      setUnblockBusyUid(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0B2416] dark:text-emerald-50">
          Pengaturan Portal &amp; Privasi
        </h2>
        <p className="text-sm text-[#52705E] dark:text-emerald-300/80">
          Sesuaikan mode tema gelap/terang, notifikasi browser, privasi status online, dan daftar blokir chat.
        </p>
      </div>

      {feedback && (
        <p className="text-xs rounded-xl p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-medium">
          {feedback}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Theme & Display */}
        <section className="lg:col-span-6 bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Sun className="w-5 h-5 text-[#0B6B3A] dark:text-emerald-400" />
            <h3 className="text-base font-bold text-[#0B2416] dark:text-emerald-50">
              Tampilan &amp; Tema
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChangeTheme('light')}
              className={`p-4 rounded-xl border text-left space-y-2 transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'bg-[#EDF7F1] border-[#0B6B3A] ring-2 ring-[#0B6B3A]/20 text-[#0B2416]'
                  : 'bg-[#F8FCF9] dark:bg-[#132C1E] border-[#D3E6D8] dark:border-emerald-900 text-[#2F4F3C] dark:text-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <Sun className="w-5 h-5 text-amber-500" />
                {theme === 'light' && (
                  <span className="text-[10px] font-bold text-[#0B6B3A]">Aktif</span>
                )}
              </div>
              <div>
                <p className="text-sm font-bold">Mode Terang</p>
                <p className="text-[11px] opacity-80">Nuansa putih &amp; hijau segar</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onChangeTheme('dark')}
              className={`p-4 rounded-xl border text-left space-y-2 transition-colors cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[#132C1E] border-emerald-500 ring-2 ring-emerald-500/25 text-emerald-50'
                  : 'bg-[#F8FCF9] dark:bg-[#132C1E] border-[#D3E6D8] dark:border-emerald-900 text-[#2F4F3C] dark:text-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <Moon className="w-5 h-5 text-emerald-400" />
                {theme === 'dark' && (
                  <span className="text-[10px] font-bold text-emerald-300">Aktif</span>
                )}
              </div>
              <div>
                <p className="text-sm font-bold">Mode Gelap</p>
                <p className="text-[11px] opacity-80">Nyaman di mata saat malam</p>
              </div>
            </button>
          </div>

          <div className="pt-3 border-t border-[#E6F2EA] dark:border-emerald-900/60 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <LayoutGrid className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#0B2416] dark:text-emerald-50">
                  Mode Daftar Ringkas
                </p>
                <p className="text-xs text-[#52705E] dark:text-emerald-300/80">
                  Menampilkan daftar tugas, kas, dan agenda lebih padat di layar HP.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={compactMode}
              onClick={onToggleCompactMode}
              className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold border cursor-pointer shrink-0 ${
                compactMode
                  ? 'bg-[#0B6B3A] text-white border-[#0B6B3A]'
                  : 'bg-[#F0F7F2] dark:bg-[#132C1E] text-[#2F4F3C] dark:text-emerald-200 border-[#C6E0CE] dark:border-emerald-800'
              }`}
            >
              {compactMode ? 'Aktif' : 'Standar'}
            </button>
          </div>

          <div className="pt-3 border-t border-[#E6F2EA] dark:border-emerald-900/60 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <BellRing className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#0B2416] dark:text-emerald-50">
                  Notifikasi Push Browser
                </p>
                <p className="text-xs text-[#52705E] dark:text-emerald-300/80">
                  Pemberitahuan otomatis saat ada pengumuman atau pesan penting baru.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={browserPushEnabled}
              onClick={() => void onEnableBrowserPush()}
              className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold border shrink-0 ${
                browserPushEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-[#0B6B3A] hover:bg-[#09562E] text-white border-[#0B6B3A] cursor-pointer'
              }`}
            >
              {browserPushEnabled ? 'Diizinkan' : 'Aktifkan'}
            </button>
          </div>
        </section>

        {/* Privacy & Blocked Users */}
        <section className="lg:col-span-6 space-y-6">
          <div className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              {hideOnline ? (
                <EyeOff className="w-5 h-5 text-amber-600" />
              ) : (
                <Eye className="w-5 h-5 text-[#0B6B3A] dark:text-emerald-400" />
              )}
              <h3 className="text-base font-bold text-[#0B2416] dark:text-emerald-50">
                Privasi Status Online
              </h3>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0B2416] dark:text-emerald-50">
                  Sembunyikan Status Online &amp; Terakhir Dilihat
                </p>
                <p className="text-xs text-[#52705E] dark:text-emerald-300/80">
                  Jika aktif, teman lain tidak akan melihat status &ldquo;Online&rdquo; Anda di Chat maupun Game Center.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={hideOnline}
                disabled={privacyBusy}
                onClick={() => void handleToggleOnlinePrivacy()}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold border cursor-pointer shrink-0 ${
                  hideOnline
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-[#F0F7F2] dark:bg-[#132C1E] text-[#2F4F3C] dark:text-emerald-200 border-[#C6E0CE] dark:border-emerald-800'
                }`}
              >
                {privacyBusy ? '...' : hideOnline ? 'Tersembunyi' : 'Tampilkan'}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Ban className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <h3 className="text-base font-bold text-[#0B2416] dark:text-emerald-50">
                  Pengguna yang Diblokir ({blockedUsers.length})
                </h3>
              </div>
            </div>

            {blockedUsers.length === 0 ? (
              <p className="text-xs text-[#52705E] dark:text-emerald-300/80 py-3">
                Tidak ada pengguna yang sedang Anda blokir di fitur chat.
              </p>
            ) : (
              <div className="divide-y divide-[#E6F2EA] dark:divide-emerald-900/60">
                {blockedUsers.map((b) => (
                  <div key={b.targetUid} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserX className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="text-sm font-medium text-[#0B2416] dark:text-emerald-100 truncate">
                        {b.targetName}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={unblockBusyUid === b.targetUid}
                      onClick={() => void handleUnblock(b.targetUid)}
                      className="min-h-[34px] px-3 rounded-lg bg-[#E6F4EC] dark:bg-emerald-900/60 text-xs font-semibold text-[#0B6B3A] dark:text-emerald-200 cursor-pointer shrink-0"
                    >
                      {unblockBusyUid === b.targetUid ? '...' : 'Buka Blokir'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onNavigate('profil')}
              className="p-4 rounded-2xl bg-white dark:bg-[#0F2419] hover:bg-[#F0F7F2] dark:hover:bg-[#132C1E] border border-[#D3E6D8] dark:border-emerald-900/60 text-left flex items-center gap-3 cursor-pointer"
            >
              <UserCircle className="w-5 h-5 text-[#0B6B3A] dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-[#0B2416] dark:text-emerald-50">Edit Profil &amp; Foto</p>
                <p className="text-[11px] text-[#52705E] dark:text-emerald-300/80">Ubah avatar, bio &amp; ID game</p>
              </div>
            </button>

            {profile.role === 'owner' && (
              <button
                type="button"
                onClick={() => onNavigate('owner-panel')}
                className="p-4 rounded-2xl bg-white dark:bg-[#0F2419] hover:bg-[#F0F7F2] dark:hover:bg-[#132C1E] border border-[#D3E6D8] dark:border-emerald-900/60 text-left flex items-center gap-3 cursor-pointer"
              >
                <Shield className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-[#0B2416] dark:text-emerald-50">Panel Owner</p>
                  <p className="text-[11px] text-[#52705E] dark:text-emerald-300/80">Kelola sistem &amp; moderasi</p>
                </div>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
