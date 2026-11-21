import { useState } from 'react';
import {
  BookCheck,
  Bot,
  CalendarDays,
  ClipboardCheck,
  Clock,
  Gamepad2,
  HelpCircle,
  Home,
  Inbox,
  LogOut,
  Menu,
  Megaphone,
  MessageSquare,
  Settings,
  Shield,
  UserCircle,
  Users,
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
  group: 'core' | 'extra';
}

export const NAV_ITEMS: NavItemConfig[] = [
  // 12 Menu Utama Portal Super Upgrade
  { id: 'beranda', label: 'Beranda', shortLabel: 'Beranda', icon: Home, group: 'core' },
  { id: 'chat', label: 'Chat', shortLabel: 'Chat', icon: MessageSquare, group: 'core' },
  { id: 'grup-kelas', label: 'Grup Kelas', shortLabel: 'Grup WA', icon: Users, group: 'core' },
  { id: 'game-center', label: 'Game Center', shortLabel: 'Game', icon: Gamepad2, group: 'core' },
  { id: 'jadwal', label: 'Jadwal Pelajaran', shortLabel: 'Jadwal', icon: Clock, group: 'core' },
  { id: 'tugas', label: 'Tugas Sekolah', shortLabel: 'Tugas', icon: BookCheck, group: 'core' },
  { id: 'pengumuman', label: 'Pengumuman', shortLabel: 'Info', icon: Megaphone, group: 'core' },
  { id: 'agenda', label: 'Agenda Kelas', shortLabel: 'Agenda', icon: CalendarDays, group: 'core' },
  { id: 'kas', label: 'Uang Kas', shortLabel: 'Kas', icon: Wallet, group: 'core' },
  { id: 'piket', label: 'Jadwal Piket', shortLabel: 'Piket', icon: ClipboardCheck, group: 'core' },
  { id: 'profil', label: 'Profil Saya', shortLabel: 'Profil', icon: UserCircle, group: 'core' },
  { id: 'pengaturan', label: 'Pengaturan', shortLabel: 'Setelan', icon: Settings, group: 'core' },
  // Fitur Tambahan & Tata Kelola (Dipertahankan)
  { id: 'pesan-admin', label: 'Pesan untuk Admin', shortLabel: 'Admin', icon: Inbox, group: 'extra' },
  { id: 'c6a-ai', label: 'Bot & AI C6A v1', shortLabel: 'C6A AI', icon: Bot, group: 'extra' },
  { id: 'bantuan', label: 'Pusat Bantuan', shortLabel: 'Bantuan', icon: HelpCircle, group: 'extra' },
  { id: 'owner-panel', label: 'Panel Owner', shortLabel: 'Owner', icon: Shield, group: 'extra' },
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
  unreadChatCount?: number;
}

export function DesktopSidebar({
  profile,
  activeTab,
  onSelectTab,
  onLogout,
  unreadNotificationsCount,
  unreadChatCount = 0,
}: NavigationProps) {
  const visibleItems = NAV_ITEMS.filter((item) => canAccessNavTab(profile.role, item.id));
  const coreItems = visibleItems.filter((i) => i.group === 'core');
  const extraItems = visibleItems.filter((i) => i.group === 'extra');

  const renderItem = (item: NavItemConfig) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const badgeCount =
      item.id === 'pengumuman'
        ? unreadNotificationsCount
        : item.id === 'chat'
          ? unreadChatCount
          : 0;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelectTab(item.id)}
        className={`w-full min-h-[40px] px-3.5 py-2 rounded-xl flex items-center justify-between gap-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
          isActive
            ? 'bg-[#0B6B3A] text-white font-semibold shadow-sm'
            : 'text-[#2F4F3C] dark:text-emerald-100/90 hover:bg-[#EDF7F1] dark:hover:bg-[#132C1E] hover:text-[#0B2416] dark:hover:text-white border border-transparent'
        }`}
      >
        <span className="flex items-center gap-3 min-w-0">
          <Icon
            className={`w-4 h-4 shrink-0 ${
              isActive ? 'text-white' : 'text-[#0B6B3A] dark:text-emerald-400'
            }`}
          />
          <span className="truncate">{getNavItemLabel(item, profile.role)}</span>
        </span>
        {badgeCount > 0 && (
          <span
            className={`font-mono-num text-xs font-bold ${
              isActive ? 'text-amber-200' : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {badgeCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white dark:bg-[#0B1B12] border-r border-[#D3E6D8] dark:border-emerald-900/60 min-h-screen sticky top-0 h-screen">
      <div className="p-4 border-b border-[#E2EFE6] dark:border-emerald-900/60 flex items-center gap-3">
        <CrestLogo size="sm" variant="kelas6a" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#0B2416] dark:text-emerald-50 truncate">{CLASS_TITLE}</p>
          <p className="text-[11px] text-[#52705E] dark:text-emerald-300/80 truncate">{SCHOOL_NAME}</p>
        </div>
        <CrestLogo size="sm" variant="school" />
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Menu utama kelas">
        {coreItems.map(renderItem)}
        {extraItems.length > 0 && (
          <div className="pt-2 mt-2 border-t border-[#E2EFE6] dark:border-emerald-900/60 space-y-1">
            <p className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#6E8B79] dark:text-emerald-400/70">
              Layanan &amp; Pengurus
            </p>
            {extraItems.map(renderItem)}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-[#E2EFE6] dark:border-emerald-900/60 space-y-3">
        <button
          type="button"
          onClick={() => onSelectTab('profil')}
          className="w-full text-left flex items-center gap-3 hover:bg-[#F0F7F2] dark:hover:bg-[#132C1E] p-1.5 rounded-xl transition-colors cursor-pointer"
        >
          {profile.photoURL ? (
            <img
              src={profile.photoURL}
              alt={getUserDisplayLabel(profile)}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover border border-[#96CCA9] shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#E6F4EC] dark:bg-emerald-900/60 border border-[#96CCA9] flex items-center justify-center text-xs font-bold text-[#0B6B3A] dark:text-emerald-200 shrink-0">
              {getUserDisplayLabel(profile).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0B2416] dark:text-emerald-50 truncate">
              {getUserDisplayLabel(profile)}
            </p>
            <p className="text-xs text-[#52705E] dark:text-emerald-300/80 truncate">
              {getRoleLabel(profile.role)}
              {profile.absenNumber > 0 ? ` · Absen ${profile.absenNumber}` : ''}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#F0F7F2] dark:bg-[#132C1E] hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-[#C6E0CE] dark:border-emerald-800 hover:border-rose-300 text-[#2F4F3C] dark:text-emerald-200 hover:text-rose-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
  unreadChatCount = 0,
}: NavigationProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const primaryTabs: NavTab[] = ['beranda', 'chat', 'game-center', 'tugas'];
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
          <div className="relative z-10 bg-white dark:bg-[#0F2419] border-t border-[#D3E6D8] dark:border-emerald-800 rounded-t-3xl p-5 pb-8 space-y-4 max-h-[84vh] overflow-y-auto shadow-2xl">
            <div className="w-10 h-1.5 bg-[#C6E0CE] dark:bg-emerald-800 rounded-full mx-auto" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <CrestLogo size="sm" variant="school" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#0B2416] dark:text-emerald-50 truncate">
                    {getUserDisplayLabel(profile)}
                  </p>
                  <p className="text-xs text-[#52705E] dark:text-emerald-300/80">
                    {getRoleLabel(profile.role)}
                    {profile.absenNumber > 0 ? ` · Absen ${profile.absenNumber}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Tutup menu lainnya"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#52705E] dark:text-emerald-300 hover:text-[#0B2416] cursor-pointer"
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
                    className={`min-h-[46px] px-3.5 py-2.5 rounded-xl border text-left flex items-center gap-2.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#0B6B3A] border-[#0B6B3A] text-white'
                        : 'bg-[#F0F7F2] dark:bg-[#132C1E] border-[#D3E6D8] dark:border-emerald-800 text-[#0B2416] dark:text-emerald-100 hover:bg-[#E2EFE6]'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-[#0B6B3A] dark:text-emerald-400'
                      }`}
                    />
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
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar Akun</span>
            </button>
          </div>
        </div>
      )}

      <nav
        aria-label="Navigasi cepat Android"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] bg-white/95 dark:bg-[#0B1B12]/95 backdrop-blur-md border-t border-[#D3E6D8] dark:border-emerald-900/60 grid grid-cols-5 items-center px-1"
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
                isActive
                  ? 'text-[#0B6B3A] dark:text-emerald-400 font-semibold'
                  : 'text-[#52705E] dark:text-emerald-300/75 hover:text-[#0B2416]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">{item.shortLabel}</span>
              {item.id === 'chat' && unreadChatCount > 0 && (
                <span className="absolute top-1.5 right-3 w-2 h-2 rounded-full bg-[#25D366]" />
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Buka menu kelas lainnya"
          className={`relative min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors cursor-pointer ${
            isSecondaryActive
              ? 'text-[#0B6B3A] dark:text-emerald-400 font-semibold'
              : 'text-[#52705E] dark:text-emerald-300/75 hover:text-[#0B2416]'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">Menu</span>
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1.5 right-3 font-mono-num text-[10px] font-bold text-amber-700 dark:text-amber-300">
              {unreadNotificationsCount}
            </span>
          )}
        </button>
      </nav>
    </>
  );
}
