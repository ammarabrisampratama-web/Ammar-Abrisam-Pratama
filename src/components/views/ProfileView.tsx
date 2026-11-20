import { useState } from 'react';
import { Activity, LogOut, Save, ShieldCheck, UserCircle } from 'lucide-react';
import { createOrUpdateUserProfile } from '../../services/firestoreService';
import type { User } from 'firebase/auth';
import type { ActivityLog, UserPublic } from '../../types';
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
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

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
        false
      );
      onProfileUpdated(updated);
      setFeedback({ type: 'ok', text: 'Profil Anda berhasil diperbarui.' });
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
          <h2 className="text-xl font-bold text-[#0B2416]">Profil Pengguna</h2>
          <p className="text-sm text-[#52705E]">
            Kelola identitas panggilan, pengaturan tampilan, dan riwayat aktivitas pribadi Anda.
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar Akun</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Identity Summary & Form */}
        <section className="lg:col-span-7 bg-white border border-[#D3E6D8] rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-4 pb-5 border-b border-[#E6F2EA]">
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-2xl object-cover border border-[#96CCA9] shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-[#E6F4EC] border border-[#96CCA9] flex items-center justify-center text-[#0B6B3A] shrink-0">
                <UserCircle className="w-8 h-8" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-[#0B2416] truncate">{profile.displayName}</h3>
              <p className="text-xs font-semibold text-[#0B6B3A]">
                Panggilan: {profile.nickname} · {getRoleLabel(profile.role)}
              </p>
              <p className="text-xs text-[#52705E] mt-0.5">
                Status Akun:{' '}
                <span className={profile.status === 'aktif' ? 'text-[#0B6B3A] font-semibold' : 'text-rose-700 font-semibold'}>
                  {profile.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                </span>
                {' · '}Login terakhir:{' '}
                <span className="font-mono-num">{formatTimestampId(profile.lastLoginAt)}</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {feedback && (
              <p
                className={`text-xs rounded-xl p-3 border ${
                  feedback.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {feedback.text}
              </p>
            )}

            <div>
              <label htmlFor="prof-name" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
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
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="prof-nick" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
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
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A]"
                />
              </div>
              <div>
                <label htmlFor="prof-absen" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
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
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] focus:outline-none focus:border-[#0B6B3A] font-mono-num"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#52705E] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#0B6B3A]" />
                <span>Email akun pribadi ({firebaseUser.email}) hanya terlihat oleh Anda &amp; Owner.</span>
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
          <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-3">
            <h3 className="text-base font-semibold text-[#0B2416]">Pengaturan Tampilan</h3>
            <div className="flex items-center justify-between gap-3 pt-1">
              <div>
                <p className="text-sm font-medium text-[#0B2416]">Mode Daftar Ringkas</p>
                <p className="text-xs text-[#52705E]">Menampilkan lebih banyak baris pada layar kecil.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={compactMode}
                onClick={onToggleCompactMode}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  compactMode
                    ? 'bg-[#0B6B3A] text-white border-[#0B6B3A]'
                    : 'bg-[#F0F7F2] text-[#2F4F3C] border-[#C6E0CE]'
                }`}
              >
                {compactMode ? 'Aktif' : 'Standar'}
              </button>
            </div>
          </div>

          <div className="bg-white border border-[#D3E6D8] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#0B6B3A]" />
                <h3 className="text-base font-semibold text-[#0B2416]">Riwayat Aktivitas Saya</h3>
              </div>
              <span className="font-mono-num text-xs text-[#52705E]">{myActivities.length}</span>
            </div>

            {myActivities.length === 0 ? (
              <p className="text-xs text-[#52705E] py-4 text-center">
                Belum ada riwayat aktivitas tercatat untuk akun Anda.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-[#E6F2EA]">
                {myActivities.slice(0, 15).map((log) => (
                  <div key={log.id} className="py-2.5 space-y-0.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#0B6B3A]">{log.action}</span>
                      <span className="font-mono-num text-[#52705E]">
                        {formatTimestampId(log.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-[#2F4F3C] truncate">{log.detail}</p>
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
