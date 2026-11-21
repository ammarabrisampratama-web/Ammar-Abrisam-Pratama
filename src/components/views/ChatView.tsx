import { useEffect, useMemo, useState } from 'react';
import {
  Gamepad2,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { ensureDmRoom, ensureSystemChatRoom } from '../../services/firestoreService';
import type {
  ChatMessage,
  ChatRoom,
  ClassSettings,
  UserPresence,
  UserPublic,
} from '../../types';
import type { C6AClassContextData } from '../../utils/c6aBot';
import { GAME_CATALOG, GAME_ROOM_IDS } from '../../utils/mediaUtils';
import {
  DEFAULT_CLASS_SETTINGS,
  formatRelativeLastSeen,
  formatTimeOnly,
  getRoleLabel,
  getUserDisplayLabel,
  toMillis,
} from '../../utils/validation';
import { ChatRoomPane } from '../chat/ChatRoomPane';

interface ChatViewProps {
  profile: UserPublic;
  messages: ChatMessage[];
  botContext?: C6AClassContextData;
  onOpenC6AAssistant?: () => void;
  settings?: ClassSettings;
  members?: UserPublic[];
  chatRooms?: ChatRoom[];
  presenceMap?: Map<string, UserPresence>;
  blockedUids?: Set<string>;
  initialRoomId?: string | null;
  onClearInitialRoomId?: () => void;
}

type RoomCategoryFilter = 'semua' | 'dm' | 'group' | 'game';

export function ChatView({
  profile,
  messages,
  botContext,
  onOpenC6AAssistant,
  settings = { ...DEFAULT_CLASS_SETTINGS, updatedAt: null },
  members = [],
  chatRooms = [],
  presenceMap = new Map(),
  blockedUids = new Set(),
  initialRoomId,
  onClearInitialRoomId,
}: ChatViewProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialRoomId || 'kelas-6a');
  const [mobileShowPane, setMobileShowPane] = useState<boolean>(Boolean(initialRoomId));
  const [filterType, setFilterType] = useState<RoomCategoryFilter>('semua');
  const [roomSearch, setRoomSearch] = useState('');
  const [dmModalOpen, setDmModalOpen] = useState(false);
  const [dmSearch, setDmSearch] = useState('');
  const [startingDmUid, setStartingDmUid] = useState<string | null>(null);

  useEffect(() => {
    void ensureSystemChatRoom('kelas-6a', profile);
  }, [profile]);

  useEffect(() => {
    if (initialRoomId) {
      setSelectedRoomId(initialRoomId);
      setMobileShowPane(true);
      onClearInitialRoomId?.();
    }
  }, [initialRoomId, onClearInitialRoomId]);

  // Ensure default system rooms always exist in sidebar
  const combinedRooms = useMemo<ChatRoom[]>(() => {
    const map = new Map<string, ChatRoom>();

    const latestLegacy = messages[messages.length - 1];
    map.set('kelas-6a', {
      id: 'kelas-6a',
      roomId: 'kelas-6a',
      classId: '6A',
      type: 'class',
      name: 'Grup Utama Kelas 6A',
      description: 'Diskusi resmi seluruh siswa, Admin, dan Wali Kelas 6A.',
      gameId: '',
      participantIds: [],
      pinnedMessageId: '',
      pinnedText: '',
      pinnedByName: '',
      lastMessageText: latestLegacy?.text || 'Ruang obrolan resmi Kelas 6A',
      lastMessageSenderId: latestLegacy?.senderId || '',
      lastMessageAt: latestLegacy?.createdAt ?? null,
      createdBy: 'system',
      updatedAt: null,
    });

    for (const g of GAME_CATALOG) {
      const gid = GAME_ROOM_IDS[g.gameId];
      map.set(gid, {
        id: gid,
        roomId: gid,
        classId: '6A',
        type: 'game',
        name: `Chat Mabar ${g.shortName}`,
        description: g.description,
        gameId: g.gameId,
        participantIds: [],
        pinnedMessageId: '',
        pinnedText: '',
        pinnedByName: '',
        lastMessageText: `Komunitas ${g.name}`,
        lastMessageSenderId: '',
        lastMessageAt: null,
        createdBy: 'system',
        updatedAt: null,
      });
    }

    for (const r of chatRooms) {
      if (r.type === 'dm') {
        if (!r.participantIds.includes(profile.uid)) continue;
        const peerUid = r.participantIds.find((id) => id !== profile.uid);
        if (peerUid && blockedUids.has(peerUid)) continue;
      }
      map.set(r.roomId || r.id, { ...r, roomId: r.roomId || r.id });
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.roomId === 'kelas-6a') return -1;
      if (b.roomId === 'kelas-6a') return 1;
      return toMillis(b.lastMessageAt) - toMillis(a.lastMessageAt);
    });
  }, [chatRooms, messages, profile.uid, blockedUids]);

  const getRoomDisplayTitle = (room: ChatRoom): string => {
    if (room.type === 'dm') {
      const peerUid = room.participantIds.find((id) => id !== profile.uid);
      const peer = members.find((m) => m.uid === peerUid);
      if (peer) return getUserDisplayLabel(peer);
    }
    return room.name;
  };

  const getDmPeer = (room: ChatRoom): UserPublic | undefined => {
    if (room.type !== 'dm') return undefined;
    const peerUid = room.participantIds.find((id) => id !== profile.uid);
    return members.find((m) => m.uid === peerUid);
  };

  const filteredRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    return combinedRooms.filter((r) => {
      if (filterType === 'dm' && r.type !== 'dm') return false;
      if (filterType === 'group' && r.type !== 'class' && r.type !== 'group') return false;
      if (filterType === 'game' && r.type !== 'game') return false;
      if (!q) return true;
      const title = getRoomDisplayTitle(r).toLowerCase();
      return title.includes(q) || r.lastMessageText.toLowerCase().includes(q);
    });
  }, [combinedRooms, filterType, roomSearch, members, profile.uid]);

  const activeRoom =
    combinedRooms.find((r) => r.roomId === selectedRoomId) ?? combinedRooms[0];

  const dmCandidates = useMemo(() => {
    const q = dmSearch.trim().toLowerCase();
    return members
      .filter(
        (m) =>
          m.uid !== profile.uid &&
          m.status === 'aktif' &&
          !blockedUids.has(m.uid)
      )
      .filter(
        (m) =>
          !q ||
          m.displayName.toLowerCase().includes(q) ||
          m.nickname.toLowerCase().includes(q)
      );
  }, [members, profile.uid, blockedUids, dmSearch]);

  const handleStartDm = async (target: UserPublic) => {
    setStartingDmUid(target.uid);
    try {
      const dmRoomId = await ensureDmRoom(profile, target);
      setSelectedRoomId(dmRoomId);
      setMobileShowPane(true);
      setDmModalOpen(false);
    } finally {
      setStartingDmUid(null);
    }
  };

  return (
    <div className="h-[calc(100vh-11.5rem)] lg:h-[calc(100vh-8rem)] min-h-[520px] grid grid-cols-1 md:grid-cols-12 gap-4">
      {/* Left Sidebar: Daftar Percakapan */}
      <aside
        className={`${
          mobileShowPane ? 'hidden md:flex' : 'flex'
        } md:col-span-4 lg:col-span-4 flex-col bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl overflow-hidden shadow-sm`}
      >
        <div className="p-3.5 bg-[#F0F7F2] dark:bg-[#132C1E] border-b border-[#E2EFE6] dark:border-emerald-900/60 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-5 h-5 text-[#0B6B3A] dark:text-emerald-400 shrink-0" />
              <h2 className="text-sm font-bold text-[#0B2416] dark:text-emerald-50 truncate">
                Percakapan Kelas 6A
              </h2>
            </div>

            {settings.allowPrivateChat !== false && (
              <button
                type="button"
                onClick={() => setDmModalOpen(true)}
                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>DM Baru</span>
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#52705E] dark:text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={roomSearch}
              onChange={(e) => setRoomSearch(e.target.value)}
              placeholder="Cari ruang chat atau teman..."
              className="w-full min-h-[36px] pl-8 pr-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs text-[#0B2416] dark:text-emerald-50 placeholder:text-[#6E8B79]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {(
              [
                { id: 'semua', label: 'Semua' },
                { id: 'group', label: 'Grup' },
                { id: 'dm', label: 'Pribadi' },
                { id: 'game', label: 'Game' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterType(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                  filterType === f.id
                    ? 'bg-[#0B6B3A] text-white'
                    : 'bg-white dark:bg-[#0D1E15] text-[#2F4F3C] dark:text-emerald-200 border border-[#D3E6D8] dark:border-emerald-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#E6F2EA] dark:divide-emerald-900/50">
          {filteredRooms.length === 0 ? (
            <p className="p-6 text-center text-xs text-[#52705E] dark:text-emerald-300/80">
              Tidak ada percakapan ditemukan.
            </p>
          ) : (
            filteredRooms.map((room) => {
              const isSelected = activeRoom?.roomId === room.roomId;
              const title = getRoomDisplayTitle(room);
              const peer = getDmPeer(room);
              const peerPres = peer ? presenceMap.get(peer.uid) : undefined;
              const isOnline =
                Boolean(peerPres?.isOnline) && !Boolean(peerPres?.hideOnlineStatus);
              const hasNewFromOther =
                Boolean(room.lastMessageSenderId) &&
                room.lastMessageSenderId !== profile.uid &&
                !isSelected;

              return (
                <button
                  key={room.roomId}
                  type="button"
                  onClick={() => {
                    setSelectedRoomId(room.roomId);
                    setMobileShowPane(true);
                  }}
                  className={`w-full text-left px-3.5 py-3 flex items-center gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#E6F4EC] dark:bg-[#173A26]'
                      : 'hover:bg-[#F7FBF8] dark:hover:bg-[#132C1E]'
                  }`}
                >
                  <div className="relative shrink-0">
                    {peer?.photoURL ? (
                      <img
                        src={peer.photoURL}
                        alt={title}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover border border-[#96CCA9]"
                      />
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border ${
                          room.type === 'game'
                            ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                            : room.type === 'dm'
                              ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-300'
                              : 'bg-[#E6F4EC] dark:bg-emerald-900/60 border-[#96CCA9] dark:border-emerald-700 text-[#0B6B3A] dark:text-emerald-200'
                        }`}
                      >
                        {room.type === 'game' ? (
                          <Gamepad2 className="w-4 h-4" />
                        ) : room.type === 'dm' ? (
                          title.slice(0, 2).toUpperCase()
                        ) : (
                          <Users className="w-4 h-4" />
                        )}
                      </div>
                    )}
                    {room.type === 'dm' && isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0F2419]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs sm:text-sm font-bold text-[#0B2416] dark:text-emerald-50 truncate">
                        {title}
                      </p>
                      <span className="font-mono-num text-[10px] text-[#52705E] dark:text-emerald-400 shrink-0">
                        {room.lastMessageAt ? formatTimeOnly(room.lastMessageAt) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-[11px] text-[#52705E] dark:text-emerald-300/80 truncate">
                        {room.lastMessageText || room.description}
                      </p>
                      {hasNewFromOther && (
                        <span
                          className="w-2.5 h-2.5 rounded-full bg-[#25D366] shrink-0"
                          title="Pesan baru"
                        />
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Pane: Ruang Chat Aktif */}
      <section
        className={`${
          mobileShowPane ? 'flex' : 'hidden md:flex'
        } md:col-span-8 lg:col-span-8 flex-col min-h-0`}
      >
        {activeRoom ? (
          <ChatRoomPane
            room={activeRoom}
            profile={profile}
            settings={settings}
            members={members}
            presenceMap={presenceMap}
            blockedUids={blockedUids}
            allRooms={combinedRooms}
            legacyClassMessages={activeRoom.roomId === 'kelas-6a' ? messages : undefined}
            botContext={botContext}
            onBackMobile={() => setMobileShowPane(false)}
            onOpenC6AAssistant={onOpenC6AAssistant}
            onForwardSuccess={(targetRoomId) => {
              setSelectedRoomId(targetRoomId);
              setMobileShowPane(true);
            }}
          />
        ) : (
          <div className="flex-1 bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl flex items-center justify-center text-sm text-[#52705E]">
            Pilih ruang chat untuk memulai percakapan.
          </div>
        )}
      </section>

      {/* Modal Mulai Chat Pribadi (DM) */}
      {dmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-[#0B2416]/50 backdrop-blur-sm"
            onClick={() => setDmModalOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 max-w-md w-full bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#E2EFE6] dark:border-emerald-900/60 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-[#0B2416] dark:text-emerald-50">
                Mulai Chat Pribadi Antarsiswa
              </h3>
              <button
                type="button"
                onClick={() => setDmModalOpen(false)}
                className="p-1.5 rounded-lg text-[#52705E] hover:text-[#0B2416] dark:text-emerald-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-[#E6F2EA] dark:border-emerald-900/60">
              <input
                type="search"
                autoFocus
                value={dmSearch}
                onChange={(e) => setDmSearch(e.target.value)}
                placeholder="Cari nama teman atau wali kelas..."
                className="w-full min-h-[40px] px-3.5 rounded-xl bg-[#F8FCF9] dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs sm:text-sm text-[#0B2416] dark:text-emerald-50"
              />
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-[#E6F2EA] dark:divide-emerald-900/50">
              {dmCandidates.length === 0 ? (
                <p className="p-6 text-center text-xs text-[#52705E] dark:text-emerald-300/80">
                  Tidak ada teman kelas lain yang tersedia.
                </p>
              ) : (
                dmCandidates.map((m) => {
                  const pres = presenceMap.get(m.uid);
                  const statusText = formatRelativeLastSeen(
                    pres?.lastSeenAt ?? null,
                    Boolean(pres?.isOnline),
                    Boolean(pres?.hideOnlineStatus)
                  );
                  return (
                    <button
                      key={m.uid}
                      type="button"
                      disabled={startingDmUid === m.uid}
                      onClick={() => void handleStartDm(m)}
                      className="w-full px-4 py-3 text-left hover:bg-[#F0F7F2] dark:hover:bg-[#132C1E] flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {m.photoURL ? (
                          <img
                            src={m.photoURL}
                            alt={getUserDisplayLabel(m)}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-full object-cover border border-[#96CCA9] shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#E6F4EC] dark:bg-emerald-900/60 border border-[#96CCA9] flex items-center justify-center text-xs font-bold text-[#0B6B3A] dark:text-emerald-200 shrink-0">
                            {getUserDisplayLabel(m).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-[#0B2416] dark:text-emerald-50 truncate">
                            {getUserDisplayLabel(m)}
                          </p>
                          <p className="text-[11px] text-[#52705E] dark:text-emerald-300/80 truncate">
                            {getRoleLabel(m.role)} · {statusText}
                          </p>
                        </div>
                      </div>
                      {startingDmUid === m.uid ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#0B6B3A] shrink-0" />
                      ) : (
                        <span className="text-xs font-bold text-[#0B6B3A] dark:text-emerald-400 shrink-0">
                          Chat
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
