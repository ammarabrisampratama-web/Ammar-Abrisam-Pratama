import { useRef, useState } from 'react';
import {
  Activity,
  Camera,
  Eye,
  EyeOff,
  Gamepad2,
  Loader2,
  LogOut,
  Save,
  ShieldCheck,
  UserCircle,
} from 'lucide-react';
import {
  createOrUpdateUserProfile,
  updateOnlinePrivacy,
} from '../../services/firestoreService';
import { uploadProfileAvatar } from '../../services/storageService';
import type { User } from 'firebase/auth';
import type { ActivityLog, GameIdMap, UserPublic } from '../../types';
import { formatTimestampId, getRoleLabel } from '../../utils/validation';

interface ProfileViewProps {
  firebaseUser: User;
  profile: UserPublic;
  myActivities: ActivityLog[];
  compactMode: boolean;
  onToggleCompactMode: () => void;
  onProfileUpdated: (updated: UserPublic) => void;
  onLogout: () => void;
}

export function ProfileView({
  firebaseUser,
  profile,
  myActivities,
  compactMode,
  onToggleCompactMode,
  onProfileUpdated,
  onLogout,
}: ProfileViewProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [nickname, setNickname] = useState(profile.nickname);
  const [absenNumber, setAbsenNumber] = useState(String(profile.absenNumber));
  const [bio, setBio] = useState(profile.bio || '');
  const [gameIds, setGameIds] = useState<GameIdMap>({
    ff: profile.gameIds?.ff || '',
    mlbb: profile.gameIds?.mlbb || '',
    roblox: profile.gameIds?.roblox || '',
    fcMobile: profile.gameIds?.fcMobile || '',
  });
  const [hideOnline, setHideOnline] = useState(Boolean(profile.hideOnlineStatus));
  const [photoURL, setPhotoURL] = useState(profile.photoURL || '');
  const [avatarPct, setAvatarPct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFeedback(null);
    setAvatarPct(5);
    try {
      const url = await uploadProfileAvatar({
        uid: firebaseUser.uid,
        file,
        onProgress: (pct) => setAvatarPct(pct),
      });
      setPhotoURL(url);
      const updated = await createOrUpdateUserProfile(
        firebaseUser,
        displayName,
        nickname,
        Number(absenNumber),
        false,
        {
          photoURL: url,
          bio,
          gameIds,
          hideOnlineStatus: hideOnline,
        }
      );
      onProfileUpdated(updated);
      setFeedback({ type: 'ok', text: 'Foto profil berhasil diunggah dan disimpan.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengunggah foto profil.',
      });
    } finally {
      setAvatarPct(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      const updated = await createOrUpdateUserProfile(
        firebaseUser,
        displayName,
        nickname,
        Number(absenNumber),
        false,
        {
          photoURL,
          bio,
          gameIds,
          hideOnlineStatus: hideOnline,
        }
      );
      if (Boolean(profile.hideOnlineStatus) !== hideOnline) {
        await updateOnlinePrivacy(profile.uid, hideOnline);
      }
      onProfileUpdated(updated);
      setFeedback({ type: 'ok', text: 'Profil, bio, dan ID game opsional Anda berhasil diperbarui.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan profil.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B2416] dark:text-emerald-50">Profil Pengguna</h2>
          <p className="text-sm text-[#52705E] dark:text-emerald-300/80">
            Kelola foto profil, identitas panggilan, ID game opsional, privasi, dan riwayat aktivitas Anda.
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar Akun</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Identity Summary & Form */}
        <section className="lg:col-span-7 bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-4 pb-5 border-b border-[#E6F2EA] dark:border-emerald-900/60">
            <div className="relative shrink-0">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={profile.displayName}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-2xl object-cover border border-[#96CCA9]"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-[#E6F4EC] dark:bg-emerald-900/60 border border-[#96CCA9] flex items-center justify-center text-[#0B6B3A] dark:text-emerald-200">
                  <UserCircle className="w-8 h-8" />
                </div>
              )}

              <button
                type="button"
                disabled={avatarPct !== null}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Ubah foto profil"
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-[#0B6B3A] hover:bg-[#09562E] text-white flex items-center justify-center shadow cursor-pointer"
              >
                {avatarPct !== null ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarSelected}
              />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-[#0B2416] dark:text-emerald-50 truncate">
                {profile.displayName}
              </h3>
              <p className="text-xs font-semibold text-[#0B6B3A] dark:text-emerald-400">
                Panggilan: {profile.nickname} · {getRoleLabel(profile.role)}
              </p>
              <p className="text-xs text-[#52705E] dark:text-emerald-300/80 mt-0.5">
                Status Akun:{' '}
                <span
                  className={
                    profile.status === 'aktif'
                      ? 'text-[#0B6B3A] dark:text-emerald-300 font-semibold'
                      : 'text-rose-700 font-semibold'
                  }
                >
                  {profile.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                </span>
                {' · '}Login terakhir:{' '}
                <span className="font-mono-num">{formatTimestampId(profile.lastLoginAt)}</span>
              </p>
              {avatarPct !== null && (
                <p className="text-[11px] font-semibold text-[#0B6B3A] dark:text-emerald-300 mt-1">
                  Mengunggah foto: {avatarPct}%
                </p>
              )}
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
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

            <div>
              <label htmlFor="prof-name" className="block text-xs font-medium text-[#2F4F3C] dark:text-emerald-200 mb-1.5">
                Nama Lengkap
              </label>
              <input
                id="prof-name"
                type="text"
                required
                minLength={2}
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-sm text-[#0B2416] dark:text-emerald-50 focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="prof-nick" className="block text-xs font-medium text-[#2F4F3C] dark:text-emerald-200 mb-1.5">
                  Nama Panggilan Tampilan
                </label>
                <input
                  id="prof-nick"
                  type="text"
                  required
                  minLength={1}
                  maxLength={40}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-sm text-[#0B2416] dark:text-emerald-50 focus:outline-none focus:border-[#0B6B3A]"
                />
              </div>
              <div>
                <label htmlFor="prof-absen" className="block text-xs font-medium text-[#2F4F3C] dark:text-emerald-200 mb-1.5">
                  Nomor Absen
                </label>
                <input
                  id="prof-absen"
                  type="number"
                  required
                  min={profile.role === 'owner' ? 0 : 1}
                  max={60}
                  value={absenNumber}
                  onChange={(e) => setAbsenNumber(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-sm text-[#0B2416] dark:text-emerald-50 focus:outline-none focus:border-[#0B6B3A] font-mono-num"
                />
              </div>
            </div>

            <div>
              <label htmlFor="prof-bio" className="block text-xs font-medium text-[#2F4F3C] dark:text-emerald-200 mb-1.5">
                Bio / Status Singkat (Opsional)
              </label>
              <input
                id="prof-bio"
                type="text"
                maxLength={200}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Mis. Semangat belajar Kelas 6A!"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-sm text-[#0B2416] dark:text-emerald-50 focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>

            <div className="p-4 rounded-xl bg-[#F8FCF9] dark:bg-[#132C1E] border border-[#D3E6D8] dark:border-emerald-900/60 space-y-3">
              <p className="text-xs font-bold text-[#0B2416] dark:text-emerald-100 flex items-center gap-1.5">
                <Gamepad2 className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
                <span>ID Game Komunitas (Opsional · Untuk Game Center)</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  maxLength={40}
                  value={gameIds.ff || ''}
                  onChange={(e) => setGameIds((prev) => ({ ...prev, ff: e.target.value }))}
                  placeholder="Free Fire ID / Nick"
                  className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs text-[#0B2416] dark:text-emerald-50"
                />
                <input
                  type="text"
                  maxLength={40}
                  value={gameIds.mlbb || ''}
                  onChange={(e) => setGameIds((prev) => ({ ...prev, mlbb: e.target.value }))}
                  placeholder="MLBB ID (Server)"
                  className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs text-[#0B2416] dark:text-emerald-50"
                />
                <input
                  type="text"
                  maxLength={40}
                  value={gameIds.roblox || ''}
                  onChange={(e) => setGameIds((prev) => ({ ...prev, roblox: e.target.value }))}
                  placeholder="Username Roblox"
                  className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs text-[#0B2416] dark:text-emerald-50"
                />
                <input
                  type="text"
                  maxLength={40}
                  value={gameIds.fcMobile || ''}
                  onChange={(e) => setGameIds((prev) => ({ ...prev, fcMobile: e.target.value }))}
                  placeholder="EA FC Mobile Username"
                  className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs text-[#0B2416] dark:text-emerald-50"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#52705E] dark:text-emerald-300/80 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400 shrink-0" />
                <span>Email akun ({firebaseUser.email}) hanya terlihat oleh Anda &amp; Owner.</span>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Profil'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Display Preferences & Own Activity History */}
        <section className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-[#0B2416] dark:text-emerald-50">
              Preferensi &amp; Privasi
            </h3>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#0B2416] dark:text-emerald-100">
                  Mode Daftar Ringkas
                </p>
                <p className="text-xs text-[#52705E] dark:text-emerald-300/80">
                  Menampilkan lebih banyak baris pada layar kecil.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={compactMode}
                onClick={onToggleCompactMode}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  compactMode
                    ? 'bg-[#0B6B3A] text-white border-[#0B6B3A]'
                    : 'bg-[#F0F7F2] dark:bg-[#132C1E] text-[#2F4F3C] dark:text-emerald-200 border-[#C6E0CE] dark:border-emerald-800'
                }`}
              >
                {compactMode ? 'Aktif' : 'Standar'}
              </button>
            </div>

            <div className="pt-3 border-t border-[#E6F2EA] dark:border-emerald-900/60 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#0B2416] dark:text-emerald-100 flex items-center gap-1.5">
                  {hideOnline ? <EyeOff className="w-4 h-4 text-amber-600" /> : <Eye className="w-4 h-4 text-[#0B6B3A]" />}
                  <span>Sembunyikan Status Online</span>
                </p>
                <p className="text-xs text-[#52705E] dark:text-emerald-300/80">
                  Atur apakah status Online terlihat di Chat.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={hideOnline}
                onClick={() => setHideOnline((prev) => !prev)}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  hideOnline
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-[#F0F7F2] dark:bg-[#132C1E] text-[#2F4F3C] dark:text-emerald-200 border-[#C6E0CE] dark:border-emerald-800'
                }`}
              >
                {hideOnline ? 'Privat' : 'Terlihat'}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
                <h3 className="text-base font-semibold text-[#0B2416] dark:text-emerald-50">
                  Riwayat Aktivitas Saya
                </h3>
              </div>
              <span className="font-mono-num text-xs text-[#52705E] dark:text-emerald-400">
                {myActivities.length}
              </span>
            </div>

            {myActivities.length === 0 ? (
              <p className="text-xs text-[#52705E] dark:text-emerald-300/80 py-4 text-center">
                Belum ada riwayat aktivitas tercatat untuk akun Anda.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-[#E6F2EA] dark:divide-emerald-900/50">
                {myActivities.slice(0, 15).map((log) => (
                  <div key={log.id} className="py-2.5 space-y-0.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#0B6B3A] dark:text-emerald-400">
                        {log.action}
                      </span>
                      <span className="font-mono-num text-[#52705E] dark:text-emerald-400/80">
                        {formatTimestampId(log.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-[#2F4F3C] dark:text-emerald-200/90 truncate">{log.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
