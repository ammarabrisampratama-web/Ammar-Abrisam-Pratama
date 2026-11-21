import type { ReportCategory } from '../types';

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
  severity?: 'spam' | 'phishing' | 'pii' | 'bullying' | 'unsafe_link';
}

const UNSAFE_SCHEME_REGEX = /\b(javascript:|data:text\/html|vbscript:)/i;

const SCAM_PHISHING_PATTERNS: RegExp[] = [
  /diamond\s+gratis/i,
  /top\s*up\s+gratis/i,
  /bagi[\s-]+bagi\s+(akun|diamond|robux)/i,
  /kirim\s+(password|kata\s+sandi|otp|pin)/i,
  /hack\s+(akun|ff|ml|roblox)/i,
  /cheat\s+(ff|mlbb|roblox|fc\s*mobile)/i,
  /mod\s+apk/i,
];

const BULLYING_PROFANITY_PATTERNS: RegExp[] = [
  /\b(anjing|babi|bangsat|kontol|memek|ngentot|goblok|tolol|idiot|bodoh\s+banget|mati\s+aja|bego)\b/i,
];

// Detects personal phone/WA numbers (08xxxxxxxxxx / +628xxxxxxxxxx) or 16-digit NIK in public/game rooms
const PII_PHONE_REGEX = /(?:\+62|62|0)8[1-9][0-9\-\s]{7,12}/;
const PII_NIK_REGEX = /\b\d{16}\b/;

export function inspectMessageSafety(
  text: string,
  options: { isPublicRoom?: boolean; checkPii?: boolean } = {}
): SafetyCheckResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { allowed: true };
  }

  if (UNSAFE_SCHEME_REGEX.test(trimmed)) {
    return {
      allowed: false,
      severity: 'unsafe_link',
      reason: 'Tautan tidak aman terdeteksi dan diblokir otomatis demi keamanan akun siswa.',
    };
  }

  for (const pattern of SCAM_PHISHING_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        severity: 'phishing',
        reason:
          'Pesan ditolak oleh filter anti-penipuan: dilarang membagikan cheat, mod APK, iming-iming top-up gratis, atau meminta kata sandi/OTP.',
      };
    }
  }

  for (const pattern of BULLYING_PROFANITY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        severity: 'bullying',
        reason:
          'Pesan mengandung kata-kata kasar atau tidak pantas. Mari jaga sopan santun Kelas 6A MI Al-Hidayah.',
      };
    }
  }

  if (options.checkPii !== false && options.isPublicRoom) {
    if (PII_PHONE_REGEX.test(trimmed) || PII_NIK_REGEX.test(trimmed)) {
      return {
        allowed: false,
        severity: 'pii',
        reason:
          'Demi privasi siswa, dilarang menuliskan nomor HP/WhatsApp pribadi atau NIK 16 digit di ruang publik / Game Center.',
      };
    }
  }

  return { allowed: true };
}

export function checkSpamCooldown(
  lastSentMs: number,
  nowMs: number,
  lastText: string,
  nextText: string,
  cooldownMs: number = 1500
): string | null {
  if (nowMs - lastSentMs < cooldownMs) {
    return 'Terlalu cepat. Tunggu sebentar sebelum mengirim pesan berikutnya.';
  }
  const normalizedNext = nextText.trim().toLowerCase();
  if (
    normalizedNext.length >= 6 &&
    normalizedNext === lastText.trim().toLowerCase() &&
    nowMs - lastSentMs < 8000
  ) {
    return 'Pesan yang sama persis tidak boleh dikirim berulang kali (anti-spam).';
  }
  return null;
}

export const REPORT_CATEGORIES: Array<{ id: ReportCategory; label: string; description: string }> = [
  { id: 'spam', label: 'Spam / Banjir Pesan', description: 'Mengirim pesan berulang atau mengganggu diskusi.' },
  { id: 'penipuan', label: 'Penipuan / Phishing', description: 'Tautan mencurigakan, scam top-up, atau minta kata sandi.' },
  { id: 'perundungan', label: 'Perundungan / Kata Kasar', description: 'Mengejek, mengancam, atau berkata tidak sopan.' },
  { id: 'info-pribadi', label: 'Sebar Informasi Pribadi', description: 'Membagikan nomor HP, alamat rumah, atau data pribadi orang lain.' },
  { id: 'lainnya', label: 'Pelanggaran Lainnya', description: 'Hal lain yang melanggar tata tertib Kelas 6A.' },
];

export function validateReportInput(input: {
  category: ReportCategory;
  reason: string;
  targetUid: string;
}): string | null {
  const validCategories: ReportCategory[] = ['spam', 'penipuan', 'perundungan', 'info-pribadi', 'lainnya'];
  if (!validCategories.includes(input.category)) {
    return 'Kategori laporan tidak valid.';
  }
  if (!input.targetUid.trim()) {
    return 'Target pengguna tidak valid.';
  }
  const r = input.reason.trim();
  if (r.length < 5 || r.length > 500) {
    return 'Alasan laporan harus 5–500 karakter.';
  }
  return null;
}
