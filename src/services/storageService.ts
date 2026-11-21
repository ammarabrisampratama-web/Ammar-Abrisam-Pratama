import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../firebase';
import { compressImageFile, validateMediaFile } from '../utils/mediaUtils';

export interface UploadMediaResult {
  url: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
}

function mapStorageError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('storage/unauthorized') || raw.includes('403')) {
    return 'Izin upload ke Firebase Storage ditolak. Pastikan Firebase Storage sudah aktif dan aturan di storage.rules sudah diterapkan pada Firebase Console.';
  }
  if (raw.includes('storage/canceled')) {
    return 'Upload dibatalkan oleh pengguna.';
  }
  if (raw.includes('storage/retry-limit-exceeded') || raw.includes('network')) {
    return 'Koneksi internet terputus saat mengunggah media. Periksa jaringan lalu coba lagi.';
  }
  if (raw.includes('storage/bucket-not-found') || raw.includes('404')) {
    return 'Bucket Firebase Storage belum aktif di project Firebase Console. Aktifkan menu Build -> Storage terlebih dahulu.';
  }
  return `Gagal mengunggah file media: ${raw.slice(0, 160)}`;
}

function getSafeExtension(fileName: string, mime: string): string {
  const parts = fileName.split('.');
  const extFromName = parts.length > 1 ? parts.pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  if (extFromName && extFromName.length <= 5) return extFromName;
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mpeg')) return 'mp3';
  return 'bin';
}

export async function uploadChatMediaFile(params: {
  roomId: string;
  uid: string;
  file: File;
  kind: 'image' | 'video' | 'audio';
  onProgress?: (percent: number) => void;
}): Promise<UploadMediaResult> {
  const validationErr = validateMediaFile(params.file, params.kind);
  if (validationErr) {
    throw new Error(validationErr);
  }

  let processedFile = params.file;
  if (params.kind === 'image') {
    processedFile = await compressImageFile(params.file, 1280, 0.78);
  }

  const safeRoom = params.roomId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const ext = getSafeExtension(processedFile.name, processedFile.type);
  const rand = Math.random().toString(36).slice(2, 8);
  const objectPath = `class6a_media/${safeRoom}/${params.uid}/${Date.now()}_${rand}.${ext}`;
  const storageRef = ref(storage, objectPath);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, processedFile, {
      contentType: processedFile.type || (params.kind === 'audio' ? 'audio/webm' : 'application/octet-stream'),
    });

    task.on(
      'state_changed',
      (snap) => {
        if (snap.totalBytes > 0 && params.onProgress) {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          params.onProgress(pct);
        }
      },
      (err) => {
        reject(new Error(mapStorageError(err)));
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({
            url,
            fileName: processedFile.name || `media.${ext}`,
            sizeBytes: processedFile.size,
            contentType: processedFile.type,
          });
        } catch (err) {
          reject(new Error(mapStorageError(err)));
        }
      }
    );
  });
}

export async function uploadProfileAvatar(params: {
  uid: string;
  file: File;
  onProgress?: (percent: number) => void;
}): Promise<string> {
  const validationErr = validateMediaFile(params.file, 'image');
  if (validationErr) {
    throw new Error(validationErr);
  }
  const compressed = await compressImageFile(params.file, 512, 0.82);
  if (compressed.size > 3 * 1024 * 1024) {
    throw new Error('Ukuran foto profil setelah kompresi maksimal 3 MB.');
  }
  const objectPath = `profile_avatars/${params.uid}/${Date.now()}_avatar.jpg`;
  const storageRef = ref(storage, objectPath);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, compressed, {
      contentType: compressed.type || 'image/jpeg',
    });

    task.on(
      'state_changed',
      (snap) => {
        if (snap.totalBytes > 0 && params.onProgress) {
          params.onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      (err) => reject(new Error(mapStorageError(err))),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(new Error(mapStorageError(err)));
        }
      }
    );
  });
}
