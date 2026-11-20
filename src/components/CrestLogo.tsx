import { useState } from 'react';
import { BookOpen } from 'lucide-react';

export type CrestVariant = 'kelas6a' | 'school';

interface CrestLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: CrestVariant;
}

const CREST_PATHS: Record<CrestVariant, { src: string; alt: string }> = {
  kelas6a: {
    src: '/assets/aistudio/Screenshot_20261120-123916_46a23e21.jpg',
    alt: 'Logo Resmi Kelas 6A MI Al-Hidayah Sawotratap',
  },
  school: {
    src: '/assets/aistudio/Screenshot_20261120-123838_b0af6756.jpg',
    alt: "Lambang Lembaga Pendidikan Ma'arif MI Al-Hidayah",
  },
};

export function CrestLogo({ size = 'md', variant = 'kelas6a' }: CrestLogoProps) {
  const [failed, setFailed] = useState(false);

  const dims =
    size === 'sm'
      ? 'w-9 h-9'
      : size === 'lg'
        ? 'w-16 h-16'
        : size === 'xl'
          ? 'w-20 h-20 sm:w-24 sm:h-24'
          : 'w-11 h-11';

  const { src, alt } = CREST_PATHS[variant];

  if (failed) {
    return (
      <div
        className={`${dims} rounded-full bg-gradient-to-br from-[#0B6B3A] to-[#084D2A] border-2 border-[#D3E6D8] flex items-center justify-center shrink-0 shadow-sm`}
        aria-label={alt}
      >
        <BookOpen className="w-5 h-5 text-white" />
      </div>
    );
  }

  if (variant === 'school') {
    return (
      <div
        className={`${dims} shrink-0 flex items-center justify-center`}
        aria-label={alt}
      >
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover [clip-path:polygon(50%_4.5%,73%_15.5%,94.5%_36.5%,88.5%_68%,78.5%_92.5%,50%_97%,21.5%_92.5%,11.5%_68%,5.5%_36.5%,27%_15.5%)] bg-[#0B6B3A]"
        />
      </div>
    );
  }

  return (
    <div
      className={`${dims} rounded-full overflow-hidden border-2 border-[#0B6B3A] bg-white shrink-0 shadow-sm`}
    >
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover scale-[1.08]"
      />
    </div>
  );
}
