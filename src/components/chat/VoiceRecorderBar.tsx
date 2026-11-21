import { useEffect, useRef, useState } from 'react';
import { Mic, Play, Pause, Send, Square, Trash2, X } from 'lucide-react';
import { CHAT_MEDIA_LIMITS, formatDurationSec } from '../../utils/mediaUtils';

interface VoiceRecorderBarProps {
  onSendVoiceNote: (file: File, durationSec: number) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
}

export function VoiceRecorderBar({ onSendVoiceNote, onCancel, disabled }: VoiceRecorderBarProps) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [sending, setSending] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startMsRef = useRef<number>(0);

  const cleanupStreamAndTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupStreamAndTimer();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const startRecording = async () => {
    setErrorMsg(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMsg('Browser atau perangkat ini tidak mendukung perekaman suara.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const chosenType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const recorder = chosenType ? new MediaRecorder(stream, { mimeType: chosenType }) : new MediaRecorder(stream);

      chunksRef.current = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        cleanupStreamAndTimer();
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const finalDuration = Math.max(1, Math.round((Date.now() - startMsRef.current) / 1000));
        if (blob.size === 0) {
          setErrorMsg('Rekaman suara kosong. Coba rekam ulang.');
          setPhase('idle');
          return;
        }
        const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `pesan_suara_${Date.now()}.${ext}`, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedFile(file);
        setPreviewUrl(url);
        setElapsedSec(finalDuration);
        setPhase('preview');
      };

      startMsRef.current = Date.now();
      setElapsedSec(0);
      setPhase('recording');
      recorder.start(250);

      timerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startMsRef.current) / 1000);
        setElapsedSec(secs);
        if (secs >= CHAT_MEDIA_LIMITS.maxVoiceDurationSec) {
          recorder.stop();
        }
      }, 250);
    } catch (err) {
      cleanupStreamAndTimer();
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('notallowed')) {
        setErrorMsg('Izin mikrofon ditolak oleh browser. Aktifkan izin mikrofon pada pengaturan situs lalu coba lagi.');
      } else if (msg.toLowerCase().includes('notfound') || msg.toLowerCase().includes('device')) {
        setErrorMsg('Mikrofon tidak ditemukan pada perangkat ini.');
      } else {
        setErrorMsg(`Tidak dapat mengakses mikrofon: ${msg}`);
      }
      setPhase('idle');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const resetPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlayingPreview(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecordedFile(null);
    setElapsedSec(0);
    setPhase('idle');
  };

  const handleTogglePreviewPlay = () => {
    if (!audioRef.current) return;
    if (isPlayingPreview) {
      audioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioRef.current.play().catch(() => setIsPlayingPreview(false));
      setIsPlayingPreview(true);
    }
  };

  const handleSend = async () => {
    if (!recordedFile || sending) return;
    setSending(true);
    setErrorMsg(null);
    try {
      await onSendVoiceNote(recordedFile, elapsedSec);
      resetPreview();
      onCancel();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengirim pesan suara.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-3 rounded-2xl bg-[#ECF7F1] dark:bg-[#1F2C34] border border-[#96CCA9] dark:border-[#2A3942] space-y-2">
      {errorMsg && (
        <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="font-semibold cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {phase === 'idle' && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-[#0B2416] dark:text-[#E9EDEF]">
            <div className="w-9 h-9 rounded-full bg-[#0B6B3A] text-white flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold">Rekam Pesan Suara</p>
              <p className="text-[11px] text-[#52705E] dark:text-[#8696A0]">
                Tekan Mulai untuk meminta izin mikrofon secara aman (maks. 3 menit).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              aria-label="Tutup perekam suara"
              className="min-h-[40px] px-3 rounded-xl border border-[#C6E0CE] dark:border-[#2A3942] text-xs font-semibold text-[#52705E] dark:text-[#AEBAC1] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={startRecording}
              className="min-h-[40px] px-4 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Mulai Rekam</span>
            </button>
          </div>
        </div>
      )}

      {phase === 'recording' && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-rose-600 animate-pulse shrink-0" />
            <div>
              <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Sedang merekam suara...</p>
              <p className="font-mono-num text-sm font-bold text-[#0B2416] dark:text-white">
                {formatDurationSec(elapsedSec)} / 03:00
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="min-h-[40px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Berhenti</span>
          </button>
        </div>
      )}

      {phase === 'preview' && previewUrl && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <audio
            ref={audioRef}
            src={previewUrl}
            onEnded={() => setIsPlayingPreview(false)}
            className="hidden"
          />
          <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
            <button
              type="button"
              onClick={handleTogglePreviewPlay}
              aria-label={isPlayingPreview ? 'Jeda preview rekaman' : 'Putar preview rekaman'}
              className="w-10 h-10 rounded-full bg-[#0B6B3A] text-white flex items-center justify-center shrink-0 cursor-pointer"
            >
              {isPlayingPreview ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#0B2416] dark:text-white">
                Preview Pesan Suara
              </p>
              <p className="text-[11px] font-mono-num text-[#52705E] dark:text-[#8696A0]">
                Durasi {formatDurationSec(elapsedSec)} · Siap dikirim
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={resetPreview}
              aria-label="Hapus rekaman"
              className="min-h-[40px] px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Ulangi</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Batal kirim suara"
              className="min-h-[40px] min-w-[40px] rounded-xl border border-[#C6E0CE] dark:border-[#2A3942] text-[#52705E] dark:text-[#AEBAC1] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={handleSend}
              className="min-h-[40px] px-4 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? 'Mengirim...' : 'Kirim Suara'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
