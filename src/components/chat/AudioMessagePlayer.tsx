import { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play } from 'lucide-react';
import { formatDurationSec } from '../../utils/mediaUtils';

interface AudioMessagePlayerProps {
  src: string;
  durationSec?: number;
  isMine?: boolean;
}

export function AudioMessagePlayer({ src, durationSec = 0, isMine = false }: AudioMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState(durationSec);

  useEffect(() => {
    setTotalSec(durationSec);
  }, [durationSec]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  };

  const progressPct = totalSec > 0 ? Math.min(100, Math.round((currentSec / totalSec) * 100)) : 0;

  return (
    <div
      className={`flex items-center gap-3 min-w-[210px] sm:min-w-[240px] py-1 ${
        isMine ? 'text-white' : 'text-[#0B2416] dark:text-[#E9EDEF]'
      }`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setTotalSec(Math.round(d));
        }}
        onTimeUpdate={(e) => {
          setCurrentSec(Math.floor(e.currentTarget.currentTime));
        }}
        onEnded={() => {
          setPlaying(false);
          setCurrentSec(0);
        }}
        className="hidden"
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? 'Jeda pesan suara' : 'Putar pesan suara'}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
          isMine
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-[#0B6B3A] hover:bg-[#09562E] text-white'
        }`}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div
          onClick={(e) => {
            const audio = audioRef.current;
            if (!audio || !totalSec) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            audio.currentTime = ratio * totalSec;
            setCurrentSec(Math.floor(audio.currentTime));
          }}
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          className={`h-2 rounded-full overflow-hidden cursor-pointer ${
            isMine ? 'bg-white/25' : 'bg-[#D3E6D8] dark:bg-[#2A3942]'
          }`}
        >
          <div
            className={`h-full rounded-full transition-all ${
              isMine ? 'bg-amber-300' : 'bg-[#0B6B3A] dark:bg-emerald-400'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div
          className={`flex items-center justify-between text-[11px] font-mono-num ${
            isMine ? 'text-emerald-100/90' : 'text-[#52705E] dark:text-[#8696A0]'
          }`}
        >
          <span className="flex items-center gap-1">
            <Mic className="w-3 h-3" />
            <span>Pesan Suara</span>
          </span>
          <span>
            {formatDurationSec(playing ? currentSec : totalSec)}
          </span>
        </div>
      </div>
    </div>
  );
}
