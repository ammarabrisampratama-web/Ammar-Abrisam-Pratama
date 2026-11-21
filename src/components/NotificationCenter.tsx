import { useState } from 'react';
import { Bell, BellRing, Check, CheckCheck, X } from 'lucide-react';
import type { NavTab, NotificationItem } from '../types';
import { formatTimestampId } from '../utils/validation';

interface NotificationCenterProps {
  notifications: NotificationItem[];
  readIds: Set<string>;
  liveToast: NotificationItem | null;
  onDismissToast: () => void;
  onMarkOneRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigateTab: (tab: NavTab) => void;
  onEnableBrowserPush: () => void;
  browserPushEnabled: boolean;
}

function getNotifTypeLabel(type: NotificationItem['type']): string {
  switch (type) {
    case 'pengumuman':
      return 'Pengumuman';
    case 'tugas':
      return 'Tugas Sekolah';
    case 'jadwal':
      return 'Jadwal Pelajaran';
    case 'agenda':
      return 'Agenda Kelas';
    case 'pesan-admin':
      return 'Pesan Admin';
    case 'game':
      return 'Game Center';
    case 'chat':
      return 'Chat Kelas';
    default:
      return 'Info Kelas';
  }
}

export function NotificationCenter({
  notifications,
  readIds,
  liveToast,
  onDismissToast,
  onMarkOneRead,
  onMarkAllRead,
  onNavigateTab,
  onEnableBrowserPush,
  browserPushEnabled,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  return (
    <>
      {liveToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] bg-white/95 dark:bg-[#0F2419]/95 backdrop-blur-md border border-[#8CC9A3] dark:border-emerald-700 rounded-2xl p-4 shadow-xl shadow-[#0B2416]/15"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E6F4EC] dark:bg-emerald-900/60 border border-[#B9D8C2] dark:border-emerald-700 flex items-center justify-center shrink-0 text-[#0B6B3A] dark:text-emerald-300">
              <BellRing className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#0B6B3A] dark:text-emerald-400">
                {getNotifTypeLabel(liveToast.type)} Baru
              </p>
              <p className="text-sm font-semibold text-[#0B2416] dark:text-emerald-50 truncate mt-0.5">
                {liveToast.title}
              </p>
              <p className="text-xs text-[#2F4F3C] dark:text-emerald-200/90 line-clamp-2 mt-1">
                {liveToast.body}
              </p>
              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    onMarkOneRead(liveToast.id);
                    onNavigateTab(liveToast.targetTab || 'beranda');
                    onDismissToast();
                  }}
                  className="text-xs font-semibold text-[#0B6B3A] dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Buka Halaman
                </button>
                <button
                  type="button"
                  onClick={onDismissToast}
                  className="text-xs text-[#52705E] dark:text-emerald-300 hover:text-[#0B2416] cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={onDismissToast}
              aria-label="Tutup notifikasi"
              className="text-[#52705E] dark:text-emerald-300 hover:text-[#0B2416] p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={`Pusat notifikasi (${unreadCount} belum dibaca)`}
          aria-expanded={open}
          className="relative min-h-[42px] min-w-[42px] px-3 rounded-xl bg-[#F0F7F2] dark:bg-[#132C1E] hover:bg-[#E2EFE6] dark:hover:bg-[#1A3927] border border-[#C6E0CE] dark:border-emerald-800 flex items-center justify-center gap-2 text-[#0B2416] dark:text-emerald-100 transition-colors cursor-pointer"
        >
          {unreadCount > 0 ? (
            <BellRing className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <Bell className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
          )}
          {unreadCount > 0 && (
            <span className="font-mono-num text-xs font-bold text-amber-700 dark:text-amber-300">
              {unreadCount}
            </span>
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
            <div className="absolute right-0 mt-2 w-80 sm:w-96 z-40 bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-800 rounded-2xl shadow-xl shadow-[#0B2416]/15 overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2EFE6] dark:border-emerald-900/60 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[#0B2416] dark:text-emerald-50">
                    Pusat Notifikasi
                  </h3>
                  <p className="text-xs text-[#52705E] dark:text-emerald-300/80">
                    {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua notifikasi terbaca'}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="text-xs font-semibold text-[#0B6B3A] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Tandai semua</span>
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#E6F2EA] dark:divide-emerald-900/50">
                {notifications.length === 0 ? (
                  <p className="p-6 text-center text-xs text-[#52705E] dark:text-emerald-300/80">
                    Belum ada riwayat notifikasi kelas.
                  </p>
                ) : (
                  notifications.slice(0, 15).map((item) => {
                    const isRead = readIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 flex items-start justify-between gap-2 transition-colors ${
                          !isRead
                            ? 'bg-[#EDF7F1] dark:bg-[#143021]'
                            : 'hover:bg-[#F7FBF8] dark:hover:bg-[#132C1E]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onMarkOneRead(item.id);
                            onNavigateTab(item.targetTab || 'beranda');
                            setOpen(false);
                          }}
                          className="flex-1 text-left min-w-0 cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] text-[#52705E] dark:text-emerald-300/80">
                            <span className={!isRead ? 'text-[#0B6B3A] dark:text-emerald-400 font-semibold' : ''}>
                              {getNotifTypeLabel(item.type)} · {item.actorName}
                            </span>
                            <span className="font-mono-num shrink-0">
                              {formatTimestampId(item.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-[#0B2416] dark:text-emerald-50 mt-1 line-clamp-1">
                            {item.title}
                          </p>
                          <p className="text-xs text-[#2F4F3C] dark:text-emerald-200/90 mt-0.5 line-clamp-2">
                            {item.body}
                          </p>
                        </button>
                        {!isRead && (
                          <button
                            type="button"
                            onClick={() => onMarkOneRead(item.id)}
                            aria-label={`Tandai ${item.title} sudah dibaca`}
                            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[#0B6B3A] dark:text-emerald-300 hover:bg-[#DCF0E4] cursor-pointer shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3 bg-[#F0F7F2] dark:bg-[#132C1E] border-t border-[#E2EFE6] dark:border-emerald-900/60 flex items-center justify-between gap-2">
                {!browserPushEnabled ? (
                  <button
                    type="button"
                    onClick={onEnableBrowserPush}
                    className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                  >
                    Aktifkan Notifikasi Perangkat
                  </button>
                ) : (
                  <span className="text-xs font-medium text-[#0B6B3A] dark:text-emerald-400">
                    Notifikasi perangkat aktif
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab('pengumuman');
                    setOpen(false);
                  }}
                  className="text-xs font-semibold text-[#0B6B3A] dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Pengumuman
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
