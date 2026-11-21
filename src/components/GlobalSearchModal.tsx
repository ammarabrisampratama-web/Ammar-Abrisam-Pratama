import { useMemo, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import type {
  AdminMessage,
  AgendaItem,
  Announcement,
  Assignment,
  ChatMessage,
  NavTab,
  PicketScheduleItem,
  ScheduleItem,
  UserPublic,
} from '../types';
import { performGlobalSearch } from '../utils/validation';

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
  profile: UserPublic;
  assignments: Assignment[];
  announcements: Announcement[];
  agendas: AgendaItem[];
  schedules: ScheduleItem[];
  picketSchedules?: PicketScheduleItem[];
  adminMessages: AdminMessage[];
  chatMessages: ChatMessage[];
  onNavigate: (tab: NavTab) => void;
}

export function GlobalSearchModal({
  open,
  onClose,
  profile,
  assignments,
  announcements,
  agendas,
  schedules,
  picketSchedules = [],
  adminMessages,
  chatMessages,
  onNavigate,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');

  const results = useMemo(
    () =>
      performGlobalSearch({
        query,
        role: profile.role,
        currentUid: profile.uid,
        assignments,
        announcements,
        agendas,
        schedules,
        picketSchedules,
        adminMessages,
        chatMessages,
      }),
    [
      query,
      profile.role,
      profile.uid,
      assignments,
      announcements,
      agendas,
      schedules,
      picketSchedules,
      adminMessages,
      chatMessages,
    ]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Pencarian Global Kelas 6A"
    >
      <div
        className="fixed inset-0 bg-[#0B2416]/45 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 max-w-2xl w-full bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-800 rounded-2xl shadow-xl shadow-[#0B2416]/15 overflow-hidden">
        <div className="p-3.5 border-b border-[#E2EFE6] dark:border-emerald-900/60 flex items-center gap-3">
          <Search className="w-5 h-5 text-[#0B6B3A] dark:text-emerald-400 shrink-0 ml-1" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari tugas, pengumuman, jadwal, piket, game, agenda, atau chat..."
            aria-label="Kata kunci pencarian global"
            className="flex-1 min-h-[44px] bg-transparent text-sm sm:text-base text-[#0B2416] dark:text-emerald-50 placeholder:text-[#6E8B79] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pencarian"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#52705E] dark:text-emerald-300 hover:text-[#0B2416] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-[#E6F2EA] dark:divide-emerald-900/50">
          {!query.trim() ? (
            <div className="p-6 text-center text-xs text-[#52705E] dark:text-emerald-300/80 space-y-1">
              <p className="font-semibold text-[#2F4F3C] dark:text-emerald-200">
                Pencarian Lintas Fitur Kelas 6A
              </p>
              <p>
                Ketik nama mapel, tugas, game (FF, MLBB, Roblox, FC Mobile), piket, atau isi chat.
              </p>
            </div>
          ) : results.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#52705E] dark:text-emerald-300/80">
              Tidak ditemukan hasil untuk &ldquo;{query}&rdquo;.
            </p>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.tab);
                  onClose();
                }}
                className="w-full text-left p-4 hover:bg-[#F0F7F2] dark:hover:bg-[#132C1E] flex items-center justify-between gap-3 transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#0B6B3A] dark:text-emerald-400">
                    {item.section}
                  </p>
                  <p className="text-sm font-semibold text-[#0B2416] dark:text-emerald-50 truncate mt-0.5">
                    {item.title}
                  </p>
                  <p className="text-xs text-[#52705E] dark:text-emerald-300/80 truncate mt-0.5">
                    {item.subtitle}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-[#52705E] dark:text-emerald-400 shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
