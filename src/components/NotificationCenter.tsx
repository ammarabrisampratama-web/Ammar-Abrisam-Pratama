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
          className="fixed top-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-md border border-[#8CC9A3] rounded-2xl p-4 shadow-xl shadow-[#0B2416]/15"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E6F4EC] border border-[#B9D8C2] flex items-center justify-center shrink-0 text-[#0B6B3A]">
              <BellRing className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#0B6B3A]">
                {getNotifTypeLabel(liveToast.type)} Baru
              </p>
              <p className="text-sm font-semibold text-[#0B2416] truncate mt-0.5">{liveToast.title}</p>
              <p className="text-xs text-[#2F4F3C] line-clamp-2 mt-1">{liveToast.body}</p>
              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    onMarkOneRead(liveToast.id);
                    onNavigateTab(liveToast.targetTab || 'beranda');
                    onDismissToast();
                  }}
                  className="text-xs font-semibold text-[#0B6B3A] hover:text-[#084D2A] cursor-pointer"
                >
                  Buka Halaman
                </button>
                <button
                  type="button"
                  onClick={onDismissToast}
                  className="text-xs text-[#52705E] hover:text-[#0B2416] cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={onDismissToast}
              aria-label="Tutup notifikasi"
              className="text-[#52705E] hover:text-[#0B2416] p-1 cursor-pointer"
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
          className="relative min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#F0F7F2] hover:bg-[#E2EFE6] border border-[#C6E0CE] flex items-center justify-center gap-2 text-[#0B2416] transition-colors cursor-pointer"
        >
          {unreadCount > 0 ? (
            <BellRing className="w-4 h-4 text-amber-600" />
          ) : (
            <Bell className="w-4 h-4 text-[#0B6B3A]" />
          )}
          {unreadCount > 0 && (
            <span className="font-mono-num text-xs font-bold text-amber-700">
              {unreadCount}
            </span>
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
            <div className="absolute right-0 mt-2 w-80 sm:w-96 z-40 bg-white border border-[#D3E6D8] rounded-2xl shadow-xl shadow-[#0B2416]/15 overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2EFE6] flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[#0B2416]">Pusat Notifikasi</h3>
                  <p className="text-xs text-[#52705E]">
                    {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua notifikasi terbaca'}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="text-xs font-semibold text-[#0B6B3A] hover:text-[#084D2A] flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Tandai semua</span>
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#E6F2EA]">
                {notifications.length === 0 ? (
                  <p className="p-6 text-center text-xs text-[#52705E]">
                    Belum ada riwayat notifikasi kelas.
                  </p>
                ) : (
                  notifications.slice(0, 15).map((item) => {
                    const isRead = readIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 flex items-start justify-between gap-2 transition-colors ${
                          !isRead ? 'bg-[#EDF7F1]' : 'hover:bg-[#F7FBF8]'
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
                          <div className="flex items-center justify-between gap-2 text-[11px] text-[#52705E]">
                            <span className={!isRead ? 'text-[#0B6B3A] font-semibold' : ''}>
                              {getNotifTypeLabel(item.type)} · {item.actorName}
                            </span>
                            <span className="font-mono-num shrink-0">
                              {formatTimestampId(item.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-[#0B2416] mt-1 line-clamp-1">
                            {item.title}
                          </p>
                          <p className="text-xs text-[#2F4F3C] mt-0.5 line-clamp-2">{item.body}</p>
                        </button>
                        {!isRead && (
                          <button
                            type="button"
                            onClick={() => onMarkOneRead(item.id)}
                            aria-label={`Tandai ${item.title} sudah dibaca`}
                            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[#0B6B3A] hover:bg-[#DCF0E4] cursor-pointer shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3 bg-[#F0F7F2] border-t border-[#E2EFE6] flex items-center justify-between gap-2">
                {!browserPushEnabled ? (
                  <button
                    type="button"
                    onClick={onEnableBrowserPush}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
                  >
                    Aktifkan Notifikasi Perangkat
                  </button>
                ) : (
                  <span className="text-xs font-medium text-[#0B6B3A]">Notifikasi perangkat aktif</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab('pengumuman');
                    setOpen(false);
                  }}
                  className="text-xs font-semibold text-[#0B6B3A] hover:text-[#084D2A] cursor-pointer"
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
