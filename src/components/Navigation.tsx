import { useState } from 'react';
import {
  BookCheck,
  Bot,
  CalendarDays,
  Clock,
  HelpCircle,
  Home,
  Inbox,
  LogOut,
  Menu,
  Megaphone,
  MessageSquare,
  Shield,
  UserCircle,
  Wallet,
  X,
} from 'lucide-react';
import type { NavTab, UserPublic } from '../types';
import {
  canAccessNavTab,
  CLASS_TITLE,
  getRoleLabel,
  getUserDisplayLabel,
  SCHOOL_NAME,
} from '../utils/validation';
import { canUseC6ABot } from '../utils/c6aBot';
import { CrestLogo } from './CrestLogo';

export interface NavItemConfig {
  id: NavTab;
  label: string;
  shortLabel: string;
  icon: typeof Home;
}

export const NAV_ITEMS: NavItemConfig[] = [
  { id: 'beranda', label: 'Beranda', shortLabel: 'Beranda', icon: Home },
  { id: 'jadwal', label: 'Jadwal Pelajaran', shortLabel: 'Jadwal', icon: Clock },
  { id: 'tugas', label: 'Tugas Sekolah', shortLabel: 'Tugas', icon: BookCheck },
  { id: 'pengumuman', label: 'Pengumuman', shortLabel: 'Info', icon: Megaphone },
  { id: 'agenda', label: 'Agenda Kelas', shortLabel: 'Agenda', icon: CalendarDays },
  { id: 'kas', label: 'Uang Kas', shortLabel: 'Kas', icon: Wallet },
  { id: 'chat', label: 'Chat Kelas', shortLabel: 'Chat', icon: MessageSquare },
  { id: 'pesan-admin', label: 'Pesan untuk Admin', shortLabel: 'Admin', icon: Inbox },
  { id: 'c6a-ai', label: 'Bot & AI C6A v1', shortLabel: 'C6A AI', icon: Bot },
  { id: 'profil', label: 'Profil Saya', shortLabel: 'Profil', icon: UserCircle },
  { id: 'bantuan', label: 'Pusat Bantuan', shortLabel: 'Bantuan', icon: HelpCircle },
  { id: 'owner-panel', label: 'Panel Owner', shortLabel: 'Owner', icon: Shield },
];

export function getNavItemLabel(item: NavItemConfig, role: UserPublic['role'] | null | undefined): string {
  if (item.id === 'c6a-ai') {
    return canUseC6ABot(role) ? 'Bot & AI C6A v1' : 'C6A AI v1';
  }
  return item.label;
}

interface NavigationProps {
  profile: UserPublic;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onLogout: () => void;
  unreadNotificationsCount: number;
}

export function DesktopSidebar({
  profile,
  activeTab,
  onSelectTab,
  onLogout,
  unreadNotificationsCount,
}: NavigationProps) {
  const visibleItems = NAV_ITEMS.filter((item) => canAccessNavTab(profile.role, item.id));

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-[#D3E6D8] min-h-screen sticky top-0 h-screen">
      <div className="p-4 border-b border-[#E2EFE6] flex items-center gap-3">
        <CrestLogo size="sm" variant="kelas6a" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#0B2416] truncate">{CLASS_TITLE}</p>
          <p className="text-[11px] text-[#52705E] truncate">{SCHOOL_NAME}</p>
        </div>
        <CrestLogo size="sm" variant="school" />
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Menu utama kelas">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl flex items-center justify-between gap-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#0B6B3A] text-white font-semibold shadow-sm'
                  : 'text-[#2F4F3C] hover:bg-[#EDF7F1] hover:text-[#0B2416] border border-transparent'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#0B6B3A]'}`} />
                <span className="truncate">{getNavItemLabel(item, profile.role)}</span>
              </span>
              {item.id === 'pengumuman' && unreadNotificationsCount > 0 && (
                <span
                  className={`font-mono-num text-xs font-bold ${
                    isActive ? 'text-amber-200' : 'text-amber-700'
                  }`}
                >
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#E2EFE6] space-y-3">
        <button
          type="button"
          onClick={() => onSelectTab('profil')}
          className="w-full text-left flex items-center gap-3 hover:bg-[#F0F7F2] p-1.5 rounded-xl transition-colors cursor-pointer"
        >
          {profile.photoURL ? (
            <img
              src={profile.photoURL}
              alt={getUserDisplayLabel(profile)}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover border border-[#96CCA9] shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#E6F4EC] border border-[#96CCA9] flex items-center justify-center text-xs font-bold text-[#0B6B3A] shrink-0">
              {getUserDisplayLabel(profile).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0B2416] truncate">{getUserDisplayLabel(profile)}</p>
            <p className="text-xs text-[#52705E] truncate">
              {getRoleLabel(profile.role)}
              {profile.absenNumber > 0 ? ` · Absen ${profile.absenNumber}` : ''}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F0F7F2] hover:bg-rose-50 border border-[#C6E0CE] hover:border-rose-300 text-[#2F4F3C] hover:text-rose-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar Akun</span>
        </button>
      </div>
    </aside>
  );
}

export function MobileBottomNav({
  profile,
  activeTab,
  onSelectTab,
  onLogout,
  unreadNotificationsCount,
}: NavigationProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const primaryTabs: NavTab[] = ['beranda', 'jadwal', 'tugas', 'chat'];
  const secondaryItems = NAV_ITEMS.filter(
    (item) => !primaryTabs.includes(item.id) && canAccessNavTab(profile.role, item.id)
  );
  const isSecondaryActive = secondaryItems.some((item) => item.id === activeTab);

  return (
    <>
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-[#0B2416]/45 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 bg-white border-t border-[#D3E6D8] rounded-t-3xl p-5 pb-8 space-y-4 max-h-[82vh] overflow-y-auto shadow-2xl">
            <div className="w-10 h-1.5 bg-[#C6E0CE] rounded-full mx-auto" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <CrestLogo size="sm" variant="school" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#0B2416] truncate">{getUserDisplayLabel(profile)}</p>
                  <p className="text-xs text-[#52705E]">
                    {getRoleLabel(profile.role)}
                    {profile.absenNumber > 0 ? ` · Absen ${profile.absenNumber}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Tutup menu lainnya"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#52705E] hover:text-[#0B2416] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      setDrawerOpen(false);
                    }}
                    className={`min-h-[48px] px-3.5 py-3 rounded-xl border text-left flex items-center gap-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#0B6B3A] border-[#0B6B3A] text-white'
                        : 'bg-[#F0F7F2] border-[#D3E6D8] text-[#0B2416] hover:bg-[#E2EFE6]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#0B6B3A]'}`} />
                    <span className="truncate">{getNavItemLabel(item, profile.role)}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                onLogout();
              }}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar Akun</span>
            </button>
          </div>
        </div>
      )}

      <nav
        aria-label="Navigasi cepat Android"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] bg-white/95 backdrop-blur-md border-t border-[#D3E6D8] grid grid-cols-5 items-center px-1"
      >
        {primaryTabs.map((tabId) => {
          const item = NAV_ITEMS.find((n) => n.id === tabId)!;
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors cursor-pointer ${
                isActive ? 'text-[#0B6B3A] font-semibold' : 'text-[#52705E] hover:text-[#0B2416]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">{item.shortLabel}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Buka menu kelas lainnya"
          className={`relative min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors cursor-pointer ${
            isSecondaryActive ? 'text-[#0B6B3A] font-semibold' : 'text-[#52705E] hover:text-[#0B2416]'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">Menu</span>
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1.5 right-3 font-mono-num text-[10px] font-bold text-amber-700">
              {unreadNotificationsCount}
            </span>
          )}
        </button>
      </nav>
    </>
  );
}
