const memoryStorage = new Map<string, string>();

function readBrowserStorage(storageKind: 'local' | 'session', key: string): string | null {
  try {
    if (typeof window === 'undefined') {
      return memoryStorage.get(`${storageKind}:${key}`) ?? null;
    }
    const store = storageKind === 'local' ? window.localStorage : window.sessionStorage;
    return store.getItem(key);
  } catch {
    return memoryStorage.get(`${storageKind}:${key}`) ?? null;
  }
}

function writeBrowserStorage(storageKind: 'local' | 'session', key: string, value: string): void {
  memoryStorage.set(`${storageKind}:${key}`, value);
  try {
    if (typeof window === 'undefined') return;
    const store = storageKind === 'local' ? window.localStorage : window.sessionStorage;
    store.setItem(key, value);
  } catch {
    // Ignore SecurityError / QuotaExceededError on restricted browsers/WebViews
  }
}

function deleteBrowserStorage(storageKind: 'local' | 'session', key: string): void {
  memoryStorage.delete(`${storageKind}:${key}`);
  try {
    if (typeof window === 'undefined') return;
    const store = storageKind === 'local' ? window.localStorage : window.sessionStorage;
    store.removeItem(key);
  } catch {
    // Ignore restricted storage errors
  }
}

export function safeLocalStorageGet(key: string): string | null {
  return readBrowserStorage('local', key);
}

export function safeLocalStorageSet(key: string, value: string): void {
  writeBrowserStorage('local', key, value);
}

export function safeLocalStorageRemove(key: string): void {
  deleteBrowserStorage('local', key);
}

export function safeSessionStorageGet(key: string): string | null {
  return readBrowserStorage('session', key);
}

export function safeSessionStorageSet(key: string, value: string): void {
  writeBrowserStorage('session', key, value);
}

export function safeSessionStorageRemove(key: string): void {
  deleteBrowserStorage('session', key);
}

export function safeNotificationPermission(): NotificationPermission | 'unsupported' {
  try {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

export async function safeRequestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  try {
    if (typeof Notification === 'undefined' || typeof Notification.requestPermission !== 'function') {
      return 'unsupported';
    }
    return await Notification.requestPermission();
  } catch {
    return 'unsupported';
  }
}

export function safeShowBrowserNotification(title: string, body: string): void {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification(title, { body });
  } catch {
    // Ignore restricted WebView or Android Notification constructor error
  }
}

export interface BrowserEnvironmentInfo {
  isAndroid: boolean;
  isIOS: boolean;
  isMobile: boolean;
  isInAppWebView: boolean;
  inAppAppName: string | null;
  localStorageAvailable: boolean;
  sessionStorageAvailable: boolean;
  indexedDBAvailable: boolean;
  isOnline: boolean;
}

function testWebStorage(kind: 'localStorage' | 'sessionStorage'): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const store = window[kind];
    const probeKey = '__c6a_probe__';
    store.setItem(probeKey, '1');
    const val = store.getItem(probeKey);
    store.removeItem(probeKey);
    return val === '1';
  } catch {
    return false;
  }
}

export function detectBrowserEnvironment(userAgent?: string): BrowserEnvironmentInfo {
  const ua =
    userAgent ??
    (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
      ? navigator.userAgent
      : '');

  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMobile = isAndroid || isIOS || /Mobile/i.test(ua);

  let inAppAppName: string | null = null;
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) inAppAppName = 'Facebook';
  else if (/Instagram/i.test(ua)) inAppAppName = 'Instagram';
  else if (/WhatsApp/i.test(ua)) inAppAppName = 'WhatsApp';
  else if (/\bLine\//i.test(ua)) inAppAppName = 'LINE';
  else if (/BytedanceWebview|musical_ly|TikTok/i.test(ua)) inAppAppName = 'TikTok';
  else if (/; wv\)/i.test(ua) || (isAndroid && /Version\/[\d.]+/i.test(ua) && /Chrome\//i.test(ua))) {
    inAppAppName = 'Browser Dalam Aplikasi (WebView)';
  }

  const localStorageAvailable = typeof window === 'undefined' ? true : testWebStorage('localStorage');
  const sessionStorageAvailable = typeof window === 'undefined' ? true : testWebStorage('sessionStorage');
  let indexedDBAvailable = false;
  try {
    indexedDBAvailable = typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    indexedDBAvailable = false;
  }

  const isOnline =
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;

  return {
    isAndroid,
    isIOS,
    isMobile,
    isInAppWebView: Boolean(inAppAppName),
    inAppAppName,
    localStorageAvailable,
    sessionStorageAvailable,
    indexedDBAvailable,
    isOnline,
  };
}

export interface FriendlyErrorInfo {
  title: string;
  message: string;
  hint: string;
  code: string;
  retryable: boolean;
  category: 'auth-storage' | 'permission' | 'network' | 'storage-blocked' | 'chunk' | 'unknown';
}

function tryParseJsonError(raw: string): { error?: string; operationType?: string; path?: string | null } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(trimmed) as { error?: unknown; operationType?: unknown; path?: unknown };
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.error === 'string') {
      return {
        error: parsed.error,
        operationType: typeof parsed.operationType === 'string' ? parsed.operationType : undefined,
        path: typeof parsed.path === 'string' ? parsed.path : null,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name || 'Error';
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isTransientNetworkError(error: unknown): boolean {
  const msg = extractErrorMessage(error).toLowerCase();
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code).toLowerCase()
      : '';
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : NaN;

  if (status === 502 || status === 503 || status === 504 || status === 408 || status === 429) {
    return true;
  }
  if (
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    code.includes('network-request-failed') ||
    code.includes('internal-error') ||
    code.includes('resource-exhausted')
  ) {
    return true;
  }

  return (
    msg.includes('the client is offline') ||
    msg.includes('failed to get document because the client is offline') ||
    msg.includes('could not reach cloud firestore backend') ||
    msg.includes('unavailable') ||
    msg.includes('deadline-exceeded') ||
    msg.includes('network-request-failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('err_connection')
  );
}

export function classifyApplicationError(error: unknown): FriendlyErrorInfo {
  const rawMessage = extractErrorMessage(error);
  const jsonInfo = tryParseJsonError(rawMessage);
  const inspected = jsonInfo?.error ? jsonInfo.error : rawMessage;
  const lower = inspected.toLowerCase();
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const lowerCode = code.toLowerCase();

  // 1. Storage blocked / SecurityError (Incognito, Android cookie block, WebView restriction)
  if (
    lower.includes('securityerror') ||
    lower.includes('localstorage') ||
    lower.includes('sessionstorage') ||
    lower.includes('missing initial state') ||
    lowerCode.includes('missing-initial-state') ||
    lowerCode.includes('web-storage-unsupported') ||
    lower.includes('storage-partitioned') ||
    lower.includes('access is denied for this document')
  ) {
    return {
      title: 'Penyimpanan Browser Dibatasi',
      message:
        'Browser atau aplikasi pembuka tautan memblokir sessionStorage/cookie yang dibutuhkan Firebase Login.',
      hint: 'Buka portal langsung menggunakan Google Chrome (bukan dari browser dalam WhatsApp/Facebook/IG), dan pastikan Cookie / Data Situs diizinkan.',
      code: code || 'STORAGE_BLOCKED',
      retryable: false,
      category: 'auth-storage',
    };
  }

  // 2. Firestore / Rules Permission Denied
  if (
    lower.includes('missing or insufficient permissions') ||
    lower.includes('permission-denied') ||
    lowerCode.includes('permission-denied')
  ) {
    const pathNote = jsonInfo?.path ? ` (koleksi: ${jsonInfo.path})` : '';
    return {
      title: 'Akses Data Ditolak Server',
      message: `Aturan keamanan Firestore menolak permintaan akses${pathNote}.`,
      hint: 'Pastikan Anda masuk memakai akun Google terverifikasi yang terdaftar di Kelas 6A dan status akun aktif. Jika baru terdaftar, coba muat ulang atau hubungi Owner/Wali Kelas.',
      code: 'PERMISSION_DENIED',
      retryable: true,
      category: 'permission',
    };
  }

  // 3. Stale JS chunk / bundle mismatch after Vercel deploy
  if (
    lower.includes('chunkloaderror') ||
    lower.includes('loading chunk') ||
    lower.includes('failed to fetch dynamically imported module') ||
    lower.includes('importing a module script failed')
  ) {
    return {
      title: 'Versi Halaman Perlu Diperbarui',
      message: 'File aplikasi versi baru tersedia di server sehingga cache lama perlu dimuat ulang.',
      hint: 'Tekan tombol "Muat Ulang Paksa" di bawah untuk mengambil versi terbaru dari server.',
      code: 'CHUNK_LOAD_ERROR',
      retryable: true,
      category: 'chunk',
    };
  }

  // 4. Network / Firestore backend / timeout / offline
  if (isTransientNetworkError(error) || lower.includes('network') || lower.includes('offline')) {
    return {
      title: 'Koneksi ke Server Kelas Terganggu',
      message:
        'Perangkat kesulitan terhubung ke server Firebase/API Kelas 6A (jaringan lambat, terputus, atau timeout).',
      hint: 'Periksa koneksi Wi-Fi / data seluler Anda lalu tekan "Coba Lagi". Aplikasi juga akan mencoba menyambung ulang secara otomatis.',
      code: code || 'NETWORK_UNAVAILABLE',
      retryable: true,
      category: 'network',
    };
  }

  // 5. Fallback unexpected runtime error (preserving short diagnostic detail)
  return {
    title: 'Terjadi Kesalahan Aplikasi',
    message: 'Sistem mendeteksi kendala teknis saat memproses halaman kelas.',
    hint: 'Tekan "Coba Lagi" atau "Muat Ulang Paksa". Jika terus berulang pada 1 perangkat, salin detail error di bawah lalu kirim ke Owner Kelas 6A.',
    code: code || 'RUNTIME_ERROR',
    retryable: true,
    category: 'unknown',
  };
}

export function mapFirebaseAuthError(error: unknown): { message: string; retryable: boolean; suggestExternalBrowser: boolean } {
  const raw = extractErrorMessage(error);
  const lower = raw.toLowerCase();
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code).toLowerCase()
      : '';

  if (code.includes('popup-closed-by-user')) {
    return {
      message: 'Jendela login Google ditutup sebelum proses selesai. Silakan klik tombol masuk lagi.',
      retryable: false,
      suggestExternalBrowser: false,
    };
  }
  if (code.includes('cancelled-popup-request')) {
    return {
      message: 'Permintaan login sebelumnya dibatalkan karena Anda menekan tombol terlalu cepat. Coba tekan masuk satu kali.',
      retryable: false,
      suggestExternalBrowser: false,
    };
  }
  if (code.includes('popup-blocked')) {
    return {
      message:
        'Popup login Google diblokir oleh browser. Izinkan popup untuk situs ini di pengaturan Chrome, atau buka portal di Google Chrome.',
      retryable: false,
      suggestExternalBrowser: true,
    };
  }
  if (
    code.includes('missing-initial-state') ||
    lower.includes('missing initial state') ||
    lower.includes('sessionstorage') ||
    code.includes('web-storage-unsupported') ||
    code.includes('operation-not-supported-in-this-environment')
  ) {
    return {
      message:
        'Browser memblokir atau mempartisi sessionStorage saat autentikasi Google (sering terjadi di browser dalam WhatsApp/Facebook/IG atau mode blokir cookie). Buka tautan langsung di Google Chrome dan izinkan Cookie situs ini.',
      retryable: false,
      suggestExternalBrowser: true,
    };
  }
  if (code.includes('unauthorized-domain') || lower.includes('unauthorized-domain')) {
    return {
      message:
        'Domain website ini belum terdaftar di Firebase Console (Authentication → Settings → Authorized domains). Hubungi Owner untuk menambahkan domain ini.',
      retryable: false,
      suggestExternalBrowser: false,
    };
  }
  if (code.includes('too-many-requests') || lower.includes('too-many-requests')) {
    return {
      message: 'Terlalu banyak percobaan login berturut-turut. Tunggu 1–2 menit lalu coba masuk lagi.',
      retryable: true,
      suggestExternalBrowser: false,
    };
  }
  if (code.includes('user-disabled')) {
    return {
      message: 'Akun Google ini sedang dinonaktifkan di Firebase Authentication. Hubungi Wali Kelas / Owner.',
      retryable: false,
      suggestExternalBrowser: false,
    };
  }
  if (
    code.includes('network-request-failed') ||
    code.includes('internal-error') ||
    lower.includes('network') ||
    lower.includes('timeout')
  ) {
    return {
      message:
        'Koneksi ke server autentikasi Google/Firebase terputus atau timeout. Periksa jaringan internet Anda lalu coba masuk kembali.',
      retryable: true,
      suggestExternalBrowser: false,
    };
  }

  return {
    message: `Autentikasi Google gagal (${code || raw.slice(0, 100)}). Silakan coba lagi atau buka melalui Google Chrome.`,
    retryable: true,
    suggestExternalBrowser: false,
  };
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, nextAttempt: number, delayMs: number) => void;
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = Math.max(50, options.baseDelayMs ?? 450);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 4000);
  const shouldRetry = options.shouldRetry ?? ((err) => isTransientNetworkError(err));

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error, attempt)) {
        throw error;
      }
      const jitter = Math.floor(Math.random() * 150);
      const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1) + jitter);
      options.onRetry?.(error, attempt + 1, delayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

export interface FetchRetryOptions {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export async function fetchWithTimeoutAndRetry(
  url: string,
  init: RequestInit,
  options: FetchRetryOptions = {}
): Promise<Response> {
  const timeoutMs = Math.max(1000, options.timeoutMs ?? 12000);
  const maxRetries = Math.max(0, options.maxRetries ?? 1);
  const retryDelayMs = Math.max(100, options.retryDelayMs ?? 500);

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
        continue;
      }
      return response;
    } catch (err) {
      clearTimeout(timer);
      const isAbort =
        err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'));
      lastError = isAbort
        ? new Error(`Koneksi ke ${url} melebihi batas waktu (${Math.round(timeoutMs / 1000)} detik).`)
        : err;
      if (attempt >= maxRetries) {
        throw lastError;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
    }
  }
  throw lastError;
}
