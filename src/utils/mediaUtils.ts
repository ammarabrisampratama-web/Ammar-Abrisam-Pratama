import type { DayOfWeek, GameCommunityMeta, GameId, PicketScheduleItem } from '../types';

export const OFFICIAL_WHATSAPP_GROUP_URL =
  'https://chat.whatsapp.com/JztxBfh5S8cKQY32dxzGdH?s=cl&p=a&iam=2';

export const CHAT_MEDIA_LIMITS = {
  maxImagesPerMessage: 5,
  maxImageRawBytes: 8 * 1024 * 1024, // 8MB raw before canvas compression
  maxImageCompressedBytes: 1.5 * 1024 * 1024, // <= 1.5MB after compression
  maxVideoBytes: 15 * 1024 * 1024, // 15MB strict video cap
  maxAudioBytes: 5 * 1024 * 1024, // 5MB voice note cap
  maxVoiceDurationSec: 180, // 3 minutes
} as const;

export const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
export const ALLOWED_AUDIO_MIMES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/aac',
  'audio/wav',
]);

export function validateMediaFile(
  file: Pick<File, 'type' | 'size' | 'name'>,
  kind: 'image' | 'video' | 'audio'
): string | null {
  const mime = (file.type || '').split(';')[0].trim().toLowerCase();
  if (kind === 'image') {
    if (!ALLOWED_IMAGE_MIMES.has(mime)) {
      return `Format gambar "${file.name}" tidak didukung. Gunakan JPG, PNG, atau WebP.`;
    }
    if (file.size <= 0 || file.size > CHAT_MEDIA_LIMITS.maxImageRawBytes) {
      return `Ukuran gambar "${file.name}" melebihi batas 8 MB.`;
    }
    return null;
  }
  if (kind === 'video') {
    if (!ALLOWED_VIDEO_MIMES.has(mime)) {
      return `Format video "${file.name}" tidak didukung. Gunakan MP4 atau WebM.`;
    }
    if (file.size <= 0 || file.size > CHAT_MEDIA_LIMITS.maxVideoBytes) {
      return `Ukuran video "${file.name}" melebihi batas maksimal 15 MB.`;
    }
    return null;
  }
  if (mime && !ALLOWED_AUDIO_MIMES.has(mime)) {
    return `Format rekaman audio tidak didukung (${mime}).`;
  }
  if (file.size <= 0 || file.size > CHAT_MEDIA_LIMITS.maxAudioBytes) {
    return 'Ukuran pesan suara melebihi batas maksimal 5 MB.';
  }
  return null;
}

export async function compressImageFile(
  file: File,
  maxDimension: number = 1280,
  quality: number = 0.78
): Promise<File> {
  if (typeof document === 'undefined' || file.type === 'image/gif' || file.size < 180 * 1024) {
    return file;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const targetW = Math.max(1, Math.round(img.width * scale));
      const targetH = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
          resolve(new File([blob], cleanName, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

export function formatDurationSec(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatBytesCompact(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildDmRoomId(uidA: string, uidB: string): string {
  const a = uidA.trim();
  const b = uidB.trim();
  if (!a || !b || a === b) {
    throw new Error('UID peserta chat pribadi tidak valid.');
  }
  return a < b ? `dm_${a}_${b}` : `dm_${b}_${a}`;
}

export function isSafeExternalHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isValidWhatsAppGroupUrl(url: string): boolean {
  if (!isSafeExternalHttpUrl(url)) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.hostname === 'chat.whatsapp.com' || parsed.hostname.endsWith('.whatsapp.com');
  } catch {
    return false;
  }
}

export const GAME_ROOM_IDS: Record<GameId, string> = {
  ff: 'game-ff',
  mlbb: 'game-mlbb',
  roblox: 'game-roblox',
  'fc-mobile': 'game-fc-mobile',
};

export const GAME_CATALOG: Array<Omit<GameCommunityMeta, 'updatedAt'>> = [
  {
    id: 'ff',
    gameId: 'ff',
    classId: '6A',
    name: 'Free Fire (FF)',
    shortName: 'FF',
    genre: 'Battle Royale Squad',
    description:
      'Komunitas mabar Clash Squad & Battle Royale siswa Kelas 6A setelah belajar dan tugas sekolah tuntas.',
    rules:
      'Utamakan shalat & PR sebelum mabar. Dilarang toxic, pamer akun berbahaya, atau membagikan kode OTP/password.',
    bannerUrl: '/src/assets/images/game_banner_ff_1795261301388.jpg',
    accentColor: '#EA580C',
  },
  {
    id: 'mlbb',
    gameId: 'mlbb',
    classId: '6A',
    name: 'Mobile Legends (MLBB)',
    shortName: 'MLBB',
    genre: '5v5 MOBA Arena',
    description:
      'Ruang koordinasi push rank, classic santai, dan turnamen persahabatan antar teman Kelas 6A.',
    rules:
      'Bermain sportif, tidak AFK, tidak menghina rekan tim, dan jaga bahasa yang baik di chat.',
    bannerUrl: '/src/assets/images/game_banner_mlbb_1795261301606.jpg',
    accentColor: '#2563EB',
  },
  {
    id: 'roblox',
    gameId: 'roblox',
    classId: '6A',
    name: 'Roblox',
    shortName: 'Roblox',
    genre: 'Sandbox & Obby',
    description:
      'Komunitas main bareng map obby, simulator, roleplay edukatif, dan kreasi dunia bersama teman sekelas.',
    rules:
      'Hanya bagikan username (opsional). Dilarang keras membagikan tautan scam Robux gratis atau file mencurigakan.',
    bannerUrl: '/src/assets/images/game_banner_roblox_1795261300891.jpg',
    accentColor: '#0D9488',
  },
  {
    id: 'fc-mobile',
    gameId: 'fc-mobile',
    classId: '6A',
    name: 'EA SPORTS FC Mobile',
    shortName: 'FC Mobile',
    genre: 'Football Match',
    description:
      'Liga persahabatan H2H & VS Attack untuk pecinta sepak bola digital di Kelas 6A MI Al-Hidayah.',
    rules:
      'Fair play saat H2H match, saling menghargai pemenang maupun yang kalah, dan tetap fokus pada pelajaran.',
    bannerUrl: '/src/assets/images/game_banner_fcmobile_1795261301586.jpg',
    accentColor: '#16A34A',
  },
];

export const DEFAULT_PICKET_TASKS_BY_DAY: Record<DayOfWeek, string[]> = {
  Senin: ['Menyapu lantai kelas', 'Menghapus papan tulis', 'Merapikan bangku & meja guru', 'Membuang sampah'],
  Selasa: ['Menyapu lantai kelas', 'Membersihkan kaca jendela', 'Menghapus papan tulis', 'Menata rak buku'],
  Rabu: ['Menyapu & mengepel teras', 'Menghapus papan tulis', 'Merapikan peralatan kebersihan', 'Membuang sampah'],
  Kamis: ['Menyapu lantai kelas', 'Membersihkan debu meja', 'Menghapus papan tulis', 'Menyiram tanaman kelas'],
  Jumat: ['Jumat Bersih ruang kelas', 'Menata mukena/perlengkapan ibadah', 'Menghapus papan tulis', 'Membuang sampah'],
  Sabtu: ['Menyapu menyeluruh akhir pekan', 'Memeriksa jendela & lampu', 'Menata meja belajar', 'Membuang sampah'],
};

export function buildDefaultPicketSchedules(): PicketScheduleItem[] {
  const days: DayOfWeek[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days.map((day) => ({
    id: day.toLowerCase(),
    classId: '6A',
    day,
    students: [],
    tasks: DEFAULT_PICKET_TASKS_BY_DAY[day],
    coordinator: '',
    note: 'Hadir 10 menit lebih awal sebelum bel masuk.',
    updatedById: 'system-default',
    updatedAt: null,
  }));
}
