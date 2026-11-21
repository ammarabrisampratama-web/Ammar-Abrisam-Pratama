import { useEffect, useState } from 'react';
import { Film, ImageIcon, Loader2, Send, Trash2, X } from 'lucide-react';
import { formatBytesCompact } from '../../utils/mediaUtils';

export interface PendingMediaItem {
  id: string;
  file: File;
  kind: 'image' | 'video';
  previewUrl: string;
}

interface MediaPreviewModalProps {
  items: PendingMediaItem[];
  onRemoveItem: (id: string) => void;
  onCancel: () => void;
  onSend: (caption: string) => Promise<void>;
  uploadProgress: number | null;
  errorMsg: string | null;
}

export function MediaPreviewModal({
  items,
  onRemoveItem,
  onCancel,
  onSend,
  uploadProgress,
  errorMsg,
}: MediaPreviewModalProps) {
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  if (items.length === 0) return null;

  const isVideo = items[0].kind === 'video';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onSend(caption);
      setCaption('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-[#0B2416]/65 backdrop-blur-sm" onClick={() => !busy && onCancel()} />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 max-w-xl w-full bg-white dark:bg-[#111B21] border border-[#D3E6D8] dark:border-[#2A3942] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-4 py-3 border-b border-[#E2EFE6] dark:border-[#2A3942] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#0B2416] dark:text-white">
            {isVideo ? <Film className="w-4 h-4 text-[#0B6B3A]" /> : <ImageIcon className="w-4 h-4 text-[#0B6B3A]" />}
            <span>
              {isVideo ? 'Preview Kirim Video' : `Preview Kirim Foto (${items.length})`}
            </span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            aria-label="Batal kirim media"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#52705E] hover:text-[#0B2416] dark:text-[#AEBAC1] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 bg-[#F8FCF9] dark:bg-[#0B141A]">
          {errorMsg && (
            <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl p-3">
              {errorMsg}
            </p>
          )}

          {isVideo ? (
            <div className="space-y-2">
              <video
                src={items[0].previewUrl}
                controls
                className="w-full max-h-72 rounded-xl bg-black"
              />
              <p className="text-xs text-[#52705E] dark:text-[#8696A0]">
                {items[0].file.name} · {formatBytesCompact(items[0].file.size)} (batas maks. 15 MB)
              </p>
            </div>
          ) : (
            <div className={`grid gap-3 ${items.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="relative rounded-xl overflow-hidden border border-[#D3E6D8] dark:border-[#2A3942] bg-white dark:bg-[#1F2C34]"
                >
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px] text-[#52705E] dark:text-[#AEBAC1]">
                    <span className="truncate">
                      {formatBytesCompact(item.file.size)} · Akan dikompresi otomatis
                    </span>
                    {items.length > 1 && !busy && (
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        aria-label="Hapus foto dari antrean"
                        className="text-rose-600 hover:text-rose-700 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {uploadProgress !== null && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-[#0B6B3A] dark:text-emerald-400">
                <span>Mengunggah media ke Firebase Storage...</span>
                <span className="font-mono-num">{uploadProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#D3E6D8] dark:bg-[#2A3942] overflow-hidden">
                <div
                  className="h-full bg-[#0B6B3A] dark:bg-emerald-500 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-3.5 border-t border-[#E2EFE6] dark:border-[#2A3942] flex items-center gap-2.5">
          <input
            type="text"
            maxLength={500}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Tambahkan keterangan (opsional)..."
            className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-[#F4F9F5] dark:bg-[#202C33] border border-[#B9D8C2] dark:border-[#2A3942] text-sm text-[#0B2416] dark:text-white focus:outline-none focus:border-[#0B6B3A]"
          />
          <button
            type="submit"
            disabled={busy}
            className="min-h-[42px] px-4 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{busy ? 'Mengirim...' : 'Kirim'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
