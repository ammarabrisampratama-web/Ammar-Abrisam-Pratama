import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Ya, Lanjutkan',
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="fixed inset-0 bg-[#0B2416]/45 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative z-10 max-w-md w-full bg-white border border-[#D3E6D8] rounded-2xl p-6 space-y-4 shadow-xl shadow-[#0B2416]/15">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 text-amber-700">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h3 id="confirm-title" className="text-base font-bold text-[#0B2416]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup konfirmasi"
            className="text-[#52705E] hover:text-[#0B2416] p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-[#2F4F3C] leading-relaxed">{description}</p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#F0F7F2] hover:bg-[#E2EFE6] border border-[#D3E6D8] text-[#2F4F3C] text-sm font-medium cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
          >
            {busy ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
