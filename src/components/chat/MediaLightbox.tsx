import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';

interface MediaLightboxProps {
  urls: string[];
  initialIndex: number;
  kind: 'image' | 'video';
  senderName?: string;
  onClose: () => void;
}

export function MediaLightbox({
  urls,
  initialIndex,
  kind,
  senderName,
  onClose,
}: MediaLightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && urls.length > 1) setIndex((i) => (i + 1) % urls.length);
      if (e.key === 'ArrowLeft' && urls.length > 1) setIndex((i) => (i - 1 + urls.length) % urls.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [urls.length, onClose]);

  if (urls.length === 0) return null;
  const activeUrl = urls[Math.min(index, urls.length - 1)];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/92 flex flex-col justify-between p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Penampil media layar penuh"
    >
      <div className="flex items-center justify-between gap-3 text-white">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{senderName || 'Media Kelas 6A'}</p>
          {urls.length > 1 && (
            <p className="text-xs text-white/70 font-mono-num">
              {index + 1} dari {urls.length}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={activeUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="min-h-[40px] px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Unduh</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup tampilan layar penuh"
            className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center my-4 min-h-0">
        {urls.length > 1 && (
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + urls.length) % urls.length)}
            aria-label="Foto sebelumnya"
            className="absolute left-2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {kind === 'video' ? (
          <video
            src={activeUrl}
            controls
            autoPlay
            className="max-h-full max-w-full rounded-xl shadow-2xl"
          />
        ) : (
          <img
            src={activeUrl}
            alt={`Lampiran media ${index + 1}`}
            referrerPolicy="no-referrer"
            className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
          />
        )}

        {urls.length > 1 && (
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % urls.length)}
            aria-label="Foto berikutnya"
            className="absolute right-2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="h-4" />
    </div>
  );
}
