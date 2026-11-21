import { useEffect, useMemo, useState } from 'react';
import { getRedirectResult, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  HelpCircle,
  Lock,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Users,
  WifiOff,
} from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import {
  detectBrowserEnvironment,
  mapFirebaseAuthError,
} from '../utils/resilience';
import { CLASS_TITLE, SCHOOL_NAME, validateProfileInput } from '../utils/validation';
import { CrestLogo } from './CrestLogo';

interface LoginScreenProps {
  pendingOnboardingUser: {
    uid: string;
    email: string;
    defaultName: string;
  } | null;
  onCompleteOnboarding: (displayName: string, nickname: string, absenNumber: number) => Promise<void>;
  onGoogleLoginSuccess: (preferredStudent?: { name: string; nickname: string; absen: number }) => void;
  authError: string | null;
  hasSignedInUserWithoutProfile?: boolean;
  onRetryConnection?: () => Promise<void>;
  isBusy: boolean;
}

export function LoginScreen({
  pendingOnboardingUser,
  onCompleteOnboarding,
  onGoogleLoginSuccess,
  authError,
  hasSignedInUserWithoutProfile = false,
  onRetryConnection,
  isBusy,
}: LoginScreenProps) {
  const [loginMode, setLoginMode] = useState<'siswa' | 'owner'>('siswa');
  const [studentName, setStudentName] = useState('');
  const [studentNickname, setStudentNickname] = useState('');
  const [studentAbsen, setStudentAbsen] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [suggestChromeBanner, setSuggestChromeBanner] = useState(false);
  const [showMissingStateHelp, setShowMissingStateHelp] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true
  );

  const browserEnv = useMemo(() => detectBrowserEnvironment(), []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    getRedirectResult(auth).catch((error) => {
      if (!active) return;
      const mapped = mapFirebaseAuthError(error);
      setFormError(mapped.message);
      if (mapped.suggestExternalBrowser) {
        setSuggestChromeBanner(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleCopyPortalLink = async () => {
    try {
      const targetUrl = window.location.origin;
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(targetUrl);
        setCopiedUrl(true);
        window.setTimeout(() => setCopiedUrl(false), 2500);
      }
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleGoogleSignIn = async () => {
    setFormError(null);
    let preferredStudent: { name: string; nickname: string; absen: number } | undefined;

    if (
      loginMode === 'siswa' &&
      (studentName.trim() !== '' || studentNickname.trim() !== '' || studentAbsen.trim() !== '')
    ) {
      const absenNum = Number(studentAbsen);
      const nick = studentNickname.trim() || studentName.trim().split(' ')[0] || '';
      const err = validateProfileInput(studentName, nick, absenNum, false);
      if (err) {
        setFormError(err);
        return;
      }
      preferredStudent = { name: studentName.trim(), nickname: nick, absen: absenNum };
    }

    if (!isOnline) {
      setFormError('Perangkat sedang offline. Aktifkan Wi-Fi atau data seluler lalu coba masuk kembali.');
      return;
    }

    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onGoogleLoginSuccess(preferredStudent);
    } catch (error) {
      const mapped = mapFirebaseAuthError(error);
      setFormError(mapped.message);
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code).toLowerCase()
          : '';
      if (
        mapped.suggestExternalBrowser ||
        code.includes('popup-closed-by-user') ||
        code.includes('missing-initial-state')
      ) {
        setShowMissingStateHelp(true);
      }
      if (mapped.suggestExternalBrowser) {
        setSuggestChromeBanner(true);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogleRedirectSignIn = async () => {
    setFormError(null);
    if (!isOnline) {
      setFormError('Perangkat sedang offline. Aktifkan Wi-Fi atau data seluler lalu coba masuk kembali.');
      return;
    }
    setSigningIn(true);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      const mapped = mapFirebaseAuthError(error);
      setFormError(mapped.message);
      setShowMissingStateHelp(true);
      setSigningIn(false);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const absenNum = Number(studentAbsen);
    const nick = studentNickname.trim() || studentName.trim().split(' ')[0] || '';
    const err = validateProfileInput(studentName, nick, absenNum, false);
    if (err) {
      setFormError(err);
      return;
    }
    try {
      await onCompleteOnboarding(studentName.trim(), nick, absenNum);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Gagal menyimpan profil siswa.');
    }
  };

  const showBrowserCompatibilityNotice =
    browserEnv.isInAppWebView ||
    !browserEnv.sessionStorageAvailable ||
    !browserEnv.localStorageAvailable ||
    suggestChromeBanner;

  return (
    <div className="min-h-screen bg-[#F4F9F5] text-[#0B2416] flex flex-col justify-between p-4 sm:p-8">
      <div className="max-w-5xl w-full mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* Left Brand & Institutional Info Panel (Green-White MI Al-Hidayah Showcase) */}
        <section className="lg:col-span-6 bg-white border border-[#D3E6D8] rounded-2xl p-5 sm:p-8 lg:p-10 flex flex-col justify-between gap-6 shadow-sm">
          <div className="space-y-5">
            {/* Official Dual Crests Banner */}
            <div className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-[#F0F7F2] border border-[#D3E6D8]">
              <CrestLogo size="xl" variant="kelas6a" />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-[11px] sm:text-xs font-semibold tracking-wider uppercase text-[#0B6B3A]">
                  Portal Digital Kelas
                </p>
                <h1 className="text-lg sm:text-2xl font-bold text-[#0B2416] tracking-tight text-balance">
                  {CLASS_TITLE} · <span className="whitespace-nowrap">MI Al-Hidayah</span> Sawotratap
                </h1>
                <p className="text-xs text-[#2F4F3C] font-medium">
                  Berilmu · Berakhlak · Berprestasi
                </p>
              </div>
              <div className="shrink-0">
                <div className="sm:hidden">
                  <CrestLogo size="md" variant="school" />
                </div>
                <div className="hidden sm:block">
                  <CrestLogo size="lg" variant="school" />
                </div>
              </div>
            </div>

            <p className="hidden sm:block text-sm lg:text-base text-[#2F4F3C] leading-relaxed max-w-prose">
              Portal terpadu untuk siswa, pengurus kelas, dan wali kelas. Pantau jadwal pelajaran 6 hari, tugas sekolah, agenda kelas, catatan uang kas, pengumuman real-time, asisten belajar C6A AI, serta layanan pesan Admin.
            </p>
          </div>

          <div className="hidden lg:grid grid-cols-2 gap-4 pt-6 border-t border-[#D3E6D8]">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#0B6B3A] text-sm font-semibold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Keamanan Berlapis</span>
              </div>
              <p className="text-xs text-[#52705E] leading-relaxed">
                Firebase Auth &amp; Security Rules memisahkan hak akses Owner, Admin, dan Siswa.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-700 text-sm font-semibold">
                <Users className="w-4 h-4 shrink-0" />
                <span>Sinkron Real-Time</span>
              </div>
              <p className="text-xs text-[#52705E] leading-relaxed">
                Jadwal, tugas, pengumuman, dan notifikasi langsung diperbarui untuk seluruh kelas.
              </p>
            </div>
          </div>
        </section>

        {/* Right Login / Onboarding Card */}
        <section className="lg:col-span-6 bg-white border border-[#D3E6D8] rounded-2xl p-5 sm:p-8 lg:p-10 flex flex-col justify-center shadow-sm">
          {pendingOnboardingUser ? (
            <form onSubmit={handleOnboardingSubmit} className="space-y-5">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#0B6B3A]">Pendaftaran Anggota Kelas 6A</p>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0B2416]">Lengkapi Identitas Siswa</h2>
                <p className="text-xs text-[#52705E]">
                  Terhubung sebagai {pendingOnboardingUser.email}
                </p>
              </div>

              {(formError || authError) && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5" role="alert">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError || authError}</span>
                </div>
              )}

              <div className="space-y-3.5">
                <div>
                  <label htmlFor="onboard-name" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                    Nama Lengkap Siswa
                  </label>
                  <input
                    id="onboard-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Contoh: Ahmad Fauzan Pratama"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] placeholder:text-[#6E8B79] focus:outline-none focus:border-[#0B6B3A] focus:ring-2 focus:ring-[#0B6B3A]/15"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="onboard-nick" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                      Nama Panggilan Asli
                    </label>
                    <input
                      id="onboard-nick"
                      type="text"
                      required
                      minLength={1}
                      maxLength={40}
                      value={studentNickname}
                      onChange={(e) => setStudentNickname(e.target.value)}
                      placeholder="Contoh: Fauzan"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] placeholder:text-[#6E8B79] focus:outline-none focus:border-[#0B6B3A] focus:ring-2 focus:ring-[#0B6B3A]/15"
                    />
                  </div>
                  <div>
                    <label htmlFor="onboard-absen" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                      Nomor Absen (1–60)
                    </label>
                    <input
                      id="onboard-absen"
                      type="number"
                      required
                      min={1}
                      max={60}
                      value={studentAbsen}
                      onChange={(e) => setStudentAbsen(e.target.value)}
                      placeholder="Contoh: 14"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] placeholder:text-[#6E8B79] focus:outline-none focus:border-[#0B6B3A] focus:ring-2 focus:ring-[#0B6B3A]/15 font-mono-num"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={isBusy}
                  className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{isBusy ? 'Menyimpan...' : 'Simpan & Masuk Kelas'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => signOut(auth)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F0F7F2] hover:bg-[#E2EFE6] border border-[#C6E0CE] text-[#2F4F3C] text-sm font-medium transition-colors cursor-pointer"
                >
                  Ganti Akun
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="text-xl sm:text-2xl font-bold text-[#0B2416]">Masuk ke Portal Kelas</h2>
                <p className="text-sm text-[#52705E]">
                  Gunakan Akun Google Anda agar sesi tetap aktif setelah halaman dimuat ulang.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F0F7F2] border border-[#D3E6D8] rounded-xl" role="tablist" aria-label="Pilih tipe login">
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginMode === 'siswa'}
                  onClick={() => {
                    setLoginMode('siswa');
                    setFormError(null);
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    loginMode === 'siswa'
                      ? 'bg-[#0B6B3A] text-white shadow-sm'
                      : 'text-[#52705E] hover:text-[#0B2416]'
                  }`}
                >
                  Login Siswa
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginMode === 'owner'}
                  onClick={() => {
                    setLoginMode('owner');
                    setFormError(null);
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    loginMode === 'owner'
                      ? 'bg-[#0B6B3A] text-white shadow-sm'
                      : 'text-[#52705E] hover:text-[#0B2416]'
                  }`}
                >
                  Owner &amp; Pengurus
                </button>
              </div>

              {!isOnline && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5" role="status">
                  <WifiOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    Koneksi internet perangkat sedang terputus. Nyalakan Wi-Fi atau data seluler untuk masuk ke portal kelas.
                  </span>
                </div>
              )}

              {showBrowserCompatibilityNotice && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2" role="status">
                  <div className="flex items-start gap-2">
                    <Smartphone className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-[#0B2416]">
                        {browserEnv.isInAppWebView
                          ? `Terbuka lewat ${browserEnv.inAppAppName}`
                          : 'Penyimpanan Browser Dibatasi'}
                      </p>
                      <p className="leading-relaxed">
                        {browserEnv.isInAppWebView
                          ? 'Login Google sering gagal di browser dalam aplikasi karena sessionStorage dibatasi. Ketuk menu titik tiga (⋮) lalu pilih "Buka di Chrome".'
                          : 'Browser memblokir cookie/sessionStorage. Izinkan Cookie & Data Situs di Chrome atau buka tab normal (bukan Incognito).'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyPortalLink()}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100/60 border border-amber-300 text-[#0B2416] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#0B6B3A]" /> : <Copy className="w-3.5 h-3.5 text-amber-700" />}
                    <span>{copiedUrl ? 'Tautan Disalin!' : 'Salin Tautan Portal untuk Chrome'}</span>
                  </button>
                </div>
              )}

              {(formError || authError) && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2.5" role="alert">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{formError || authError}</span>
                  </div>
                  {hasSignedInUserWithoutProfile && onRetryConnection && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void onRetryConnection()}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-60 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Coba Hubungkan Ulang</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void signOut(auth)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white hover:bg-rose-100 border border-rose-300 text-rose-800 font-semibold cursor-pointer"
                      >
                        Keluar / Ganti Akun
                      </button>
                    </div>
                  )}
                </div>
              )}

              {loginMode === 'siswa' ? (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="login-name" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                      Nama Lengkap (opsional saat masuk pertama)
                    </label>
                    <input
                      id="login-name"
                      type="text"
                      maxLength={80}
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Nama lengkap siswa"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] placeholder:text-[#6E8B79] focus:outline-none focus:border-[#0B6B3A] focus:ring-2 focus:ring-[#0B6B3A]/15"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label htmlFor="login-nick" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                        Nama Panggilan
                      </label>
                      <input
                        id="login-nick"
                        type="text"
                        maxLength={40}
                        value={studentNickname}
                        onChange={(e) => setStudentNickname(e.target.value)}
                        placeholder="Nama panggilan asli"
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] placeholder:text-[#6E8B79] focus:outline-none focus:border-[#0B6B3A] focus:ring-2 focus:ring-[#0B6B3A]/15"
                      />
                    </div>
                    <div>
                      <label htmlFor="login-absen" className="block text-xs font-medium text-[#2F4F3C] mb-1.5">
                        No. Absen
                      </label>
                      <input
                        id="login-absen"
                        type="number"
                        min={1}
                        max={60}
                        value={studentAbsen}
                        onChange={(e) => setStudentAbsen(e.target.value)}
                        placeholder="1–60"
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] placeholder:text-[#6E8B79] focus:outline-none focus:border-[#0B6B3A] focus:ring-2 focus:ring-[#0B6B3A]/15 font-mono-num"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-[#52705E] leading-relaxed">
                    Sudah pernah terdaftar? Langsung klik tombol masuk di bawah.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>Verifikasi Terproteksi Google Auth</span>
                  </div>
                  <p className="text-xs text-amber-900/90 leading-relaxed">
                    Hak akses Owner dan Admin diverifikasi otomatis di server menggunakan akun Google terdaftar. Tidak ada kata sandi atau PIN rahasia yang disimpan maupun ditampilkan.
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={signingIn || isBusy}
                onClick={handleGoogleSignIn}
                className={`w-full min-h-[48px] px-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shadow-sm ${
                  loginMode === 'owner'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-[#0B6B3A] hover:bg-[#09562E] text-white'
                } disabled:opacity-60`}
              >
                <span>
                  {signingIn || isBusy
                    ? 'Menghubungkan ke Firebase...'
                    : loginMode === 'owner'
                      ? 'Masuk Google (Owner / Admin)'
                      : 'Masuk Google (Siswa 6A)'}
                </span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setShowMissingStateHelp((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52705E] hover:text-[#0B6B3A] underline-offset-2 hover:underline cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>
                    {showMissingStateHelp
                      ? 'Tutup panduan login Chrome Android'
                      : 'Muncul error "missing initial state" / sessionStorage?'}
                  </span>
                </button>
              </div>

              {showMissingStateHelp && (
                <div className="p-3.5 rounded-xl bg-[#F4F9F5] border border-[#C6E0CE] text-xs text-[#2F4F3C] space-y-2.5">
                  <p className="font-semibold text-[#0B2416]">
                    Panduan jika tab ...firebaseapp.com menampilkan &ldquo;missing initial state&rdquo;:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 leading-relaxed">
                    <li>Tutup dulu tab <span className="font-mono-num">...firebaseapp.com</span> yang error.</li>
                    <li>Pastikan tidak memakai <strong>Mode Penyamaran (Incognito)</strong> atau browser dalam WhatsApp/Facebook.</li>
                    <li>
                      Di Chrome Android, buka <strong>⋮ → Setelan → Setelan situs → Cookie pihak ketiga</strong> lalu pilih{' '}
                      <strong>Izinkan cookie pihak ketiga</strong> (atau tambahkan{' '}
                      <span className="font-mono-num">firebaseapp.com</span> &amp; <span className="font-mono-num">accounts.google.com</span>).
                    </li>
                    <li>Muat ulang halaman ini lalu tekan tombol Masuk Google lagi.</li>
                  </ol>
                  <div className="pt-1 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={signingIn || isBusy}
                      onClick={() => void handleGoogleRedirectSignIn()}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white hover:bg-[#E6F4EC] border border-[#96CCA9] text-[#0B6B3A] font-semibold cursor-pointer disabled:opacity-60"
                    >
                      Coba Login Mode 1 Tab (Alternatif)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <footer className="max-w-5xl w-full mx-auto pt-6 text-center text-xs text-[#52705E]">
        {CLASS_TITLE} · {SCHOOL_NAME} · Zona Waktu WIB (Asia/Jakarta)
      </footer>
    </div>
  );
}
