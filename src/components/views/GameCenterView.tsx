import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Flag,
  Gamepad2,
  Loader2,
  LogOut as LeaveIcon,
  Megaphone,
  MessageSquare,
  Pin,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import {
  createGamePost,
  deleteGamePost,
  ensureDmRoom,
  ensureSystemChatRoom,
  joinOrUpdateGameCommunity,
  leaveGameCommunity,
  removeGameMemberByMod,
  submitUserReport,
} from '../../services/firestoreService';
import type {
  ChatRoom,
  ClassSettings,
  GameId,
  GameMembership,
  GamePost,
  LfgStatus,
  ReportCategory,
  UserPresence,
  UserPublic,
} from '../../types';
import type { C6AClassContextData } from '../../utils/c6aBot';
import { GAME_CATALOG, GAME_ROOM_IDS } from '../../utils/mediaUtils';
import { REPORT_CATEGORIES } from '../../utils/moderation';
import {
  formatRelativeLastSeen,
  formatTimestampId,
  getRoleLabel,
  isAdminOrOwnerRole,
  toMillis,
} from '../../utils/validation';
import { ChatRoomPane } from '../chat/ChatRoomPane';
import { ConfirmModal } from '../ConfirmModal';

interface GameCenterViewProps {
  profile: UserPublic;
  settings: ClassSettings;
  members: UserPublic[];
  chatRooms: ChatRoom[];
  presenceMap: Map<string, UserPresence>;
  blockedUids: Set<string>;
  botContext?: C6AClassContextData;
  onOpenChatRoom: (roomId: string) => void;
  onOpenC6AAssistant?: () => void;
}

type CommunityTab = 'chat' | 'anggota' | 'info' | 'aturan';

const LFG_OPTIONS: Array<{ value: LfgStatus; label: string; badgeClass: string }> = [
  {
    value: 'siap-mabar',
    label: 'Siap Mabar',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700',
  },
  {
    value: 'dalam-game',
    label: 'Dalam Game',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-700',
  },
  {
    value: 'santai',
    label: 'Main Santai',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700',
  },
  {
    value: 'offline',
    label: 'Sedang Istirahat',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
];

export function GameCenterView({
  profile,
  settings,
  members,
  chatRooms,
  presenceMap,
  blockedUids,
  botContext,
  onOpenChatRoom,
  onOpenC6AAssistant,
}: GameCenterViewProps) {
  const [selectedGameId, setSelectedGameId] = useState<GameId | null>(null);
  const [communityTab, setCommunityTab] = useState<CommunityTab>('chat');
  const [membersByGame, setMembersByGame] = useState<Record<GameId, GameMembership[]>>({
    ff: [],
    mlbb: [],
    roblox: [],
    'fc-mobile': [],
  });
  const [postsByGame, setPostsByGame] = useState<Record<GameId, GamePost[]>>({
    ff: [],
    mlbb: [],
    roblox: [],
    'fc-mobile': [],
  });
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  // Join / LFG form
  const [inGameName, setInGameName] = useState('');
  const [inGameId, setInGameId] = useState('');
  const [lfgStatus, setLfgStatus] = useState<LfgStatus>('siap-mabar');
  const [lfgNote, setLfgNote] = useState('');
  const [savingJoin, setSavingJoin] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // LFG filter & actions
  const [lfgFilter, setLfgFilter] = useState<'semua' | 'aktif-mabar'>('semua');
  const [dmBusyUid, setDmBusyUid] = useState<string | null>(null);
  const [kickTarget, setKickTarget] = useState<GameMembership | null>(null);
  const [kickBusy, setKickBusy] = useState(false);

  // Game info/update post composer (Owner/Admin)
  const [postType, setPostType] = useState<'update' | 'pengumuman'>('update');
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postPinned, setPostPinned] = useState(false);
  const [postingInfo, setPostingInfo] = useState(false);
  const [postFeedback, setPostFeedback] = useState<string | null>(null);

  // Report modal
  const [reportTarget, setReportTarget] = useState<GameMembership | null>(null);
  const [reportCategory, setReportCategory] = useState<ReportCategory>('spam');
  const [reportReason, setReportReason] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDone, setReportDone] = useState<string | null>(null);

  const isStaff = isAdminOrOwnerRole(profile.role);

  // Subscribe to member rosters for all 4 communities
  useEffect(() => {
    const unsubs = GAME_CATALOG.map((g) =>
      onSnapshot(
        query(collection(db, 'game_communities', g.gameId, 'members')),
        (snap) => {
          const list = snap.docs.map((d) => ({
            ...(d.data() as GameMembership),
            uid: d.id,
          }));
          setMembersByGame((prev) => ({ ...prev, [g.gameId]: list }));
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `game_communities/${g.gameId}/members`)
      )
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  // Subscribe to posts + ensure system room when viewing a specific game
  useEffect(() => {
    if (!selectedGameId) return;
    void ensureSystemChatRoom(GAME_ROOM_IDS[selectedGameId], profile);
    const unsub = onSnapshot(
      query(collection(db, 'game_communities', selectedGameId, 'posts')),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<GamePost, 'id'>) }))
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || toMillis(b.createdAt) - toMillis(a.createdAt));
        setPostsByGame((prev) => ({ ...prev, [selectedGameId]: list }));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `game_communities/${selectedGameId}/posts`)
    );
    return () => unsub();
  }, [selectedGameId, profile]);

  const selectedGame = useMemo(
    () => GAME_CATALOG.find((g) => g.gameId === selectedGameId) ?? null,
    [selectedGameId]
  );

  const currentMembers = selectedGameId ? membersByGame[selectedGameId] : [];
  const myMembership = useMemo(
    () => currentMembers.find((m) => m.uid === profile.uid) ?? null,
    [currentMembers, profile.uid]
  );

  // Sync editor inputs when switching game or membership updates
  useEffect(() => {
    if (!selectedGameId) return;
    if (myMembership) {
      setInGameName(myMembership.inGameName || '');
      setInGameId(myMembership.inGameId || '');
      setLfgStatus(myMembership.lfgStatus || 'siap-mabar');
      setLfgNote(myMembership.lfgNote || '');
    } else {
      const savedId =
        selectedGameId === 'ff'
          ? profile.gameIds?.ff
          : selectedGameId === 'mlbb'
            ? profile.gameIds?.mlbb
            : selectedGameId === 'roblox'
              ? profile.gameIds?.roblox
              : profile.gameIds?.fcMobile;
      setInGameName('');
      setInGameId(savedId || '');
      setLfgStatus('siap-mabar');
      setLfgNote('');
    }
    setJoinFeedback(null);
  }, [selectedGameId, myMembership, profile.gameIds]);

  if (settings.allowGameCenter === false && !isStaff) {
    return (
      <div className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-8 text-center space-y-3">
        <Gamepad2 className="w-10 h-10 text-[#0B6B3A] dark:text-emerald-400 mx-auto" />
        <h2 className="text-lg font-bold text-[#0B2416] dark:text-emerald-50">
          Game Center Sedang Dinonaktifkan Sementara
        </h2>
        <p className="text-sm text-[#52705E] dark:text-emerald-300/80 max-w-md mx-auto">
          Wali Kelas sedang menonaktifkan fitur Game Center untuk sementara waktu agar fokus pada agenda akademik kelas.
        </p>
      </div>
    );
  }

  const handleSaveJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGameId) return;
    setJoinFeedback(null);
    setSavingJoin(true);
    try {
      await joinOrUpdateGameCommunity(
        profile,
        selectedGameId,
        { inGameName, inGameId, lfgStatus, lfgNote },
        Boolean(myMembership)
      );
      setJoinFeedback({
        type: 'ok',
        text: myMembership
          ? 'Status mabar & ID game opsional Anda diperbarui.'
          : 'Selamat datang! Anda berhasil bergabung ke komunitas ini.',
      });
    } catch (err) {
      setJoinFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal memperbarui keanggotaan komunitas.',
      });
    } finally {
      setSavingJoin(false);
    }
  };

  const handleLeave = async () => {
    if (!selectedGameId) return;
    setSavingJoin(true);
    try {
      await leaveGameCommunity(profile, selectedGameId);
      setJoinFeedback({ type: 'ok', text: 'Anda telah keluar dari komunitas game ini.' });
    } finally {
      setSavingJoin(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGameId) return;
    setPostFeedback(null);
    setPostingInfo(true);
    try {
      await createGamePost(profile, selectedGameId, {
        type: postType,
        title: postTitle,
        content: postContent,
        pinned: postPinned,
      });
      setPostTitle('');
      setPostContent('');
      setPostPinned(false);
    } catch (err) {
      setPostFeedback(err instanceof Error ? err.message : 'Gagal mempublikasikan info game.');
    } finally {
      setPostingInfo(false);
    }
  };

  const handleStartDm = async (targetMember: GameMembership) => {
    if (settings.allowPrivateChat === false) return;
    const matchedUser = members.find((m) => m.uid === targetMember.uid) ?? {
      uid: targetMember.uid,
      displayName: targetMember.displayName,
      nickname: targetMember.nickname,
      photoURL: targetMember.photoURL,
      absenNumber: 1,
      role: targetMember.role,
      status: 'aktif' as const,
      classId: '6A' as const,
      lastLoginAt: null,
      updatedAt: null,
    };
    setDmBusyUid(targetMember.uid);
    try {
      const dmRoomId = await ensureDmRoom(profile, matchedUser);
      onOpenChatRoom(dmRoomId);
    } finally {
      setDmBusyUid(null);
    }
  };

  const handleConfirmKick = async () => {
    if (!selectedGameId || !kickTarget) return;
    setKickBusy(true);
    try {
      await removeGameMemberByMod(
        profile,
        selectedGameId,
        kickTarget.uid,
        kickTarget.nickname || kickTarget.displayName
      );
      setKickTarget(null);
    } finally {
      setKickBusy(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget) return;
    setReportBusy(true);
    try {
      await submitUserReport(profile, {
        targetUid: reportTarget.uid,
        targetName: reportTarget.nickname || reportTarget.displayName,
        roomId: selectedGameId ? GAME_ROOM_IDS[selectedGameId] : '',
        category: reportCategory,
        reason: reportReason,
      });
      setReportTarget(null);
      setReportReason('');
      setReportDone('Laporan moderasi berhasil dikirim ke Owner/Admin untuk ditinjau.');
      window.setTimeout(() => setReportDone(null), 4000);
    } finally {
      setReportBusy(false);
    }
  };

  // Lobby Grid View
  if (!selectedGame) {
    return (
      <div className="space-y-6">
        <section className="bg-gradient-to-br from-[#0B6B3A] to-[#084D2A] text-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-semibold">
              <Gamepad2 className="w-4 h-4 text-amber-300" />
              <span>Komunitas Mabar Aman · Kelas 6A</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Game Center Kelas 6A</h2>
            <p className="text-xs sm:text-sm text-emerald-50/90 max-w-2xl">
              Pilih game favorit untuk mencari teman bermain, berbagi ID game (opsional), membaca pengumuman mabar, dan berdiskusi di ruang chat khusus game.
            </p>
          </div>
          <div className="px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-xs space-y-1 shrink-0">
            <p className="font-bold flex items-center gap-1.5 text-emerald-100">
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>Moderasi Aktif</span>
            </p>
            <p className="text-emerald-50/85">Anti-spam, anti-penipuan, &amp; ramah anak.</p>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {GAME_CATALOG.map((game) => {
            const roster = membersByGame[game.gameId] || [];
            const activeLfgCount = roster.filter(
              (m) => m.lfgStatus === 'siap-mabar' || m.lfgStatus === 'dalam-game'
            ).length;
            const isJoined = roster.some((m) => m.uid === profile.uid);
            const imgBroken = brokenImages.has(game.gameId);

            return (
              <article
                key={game.gameId}
                className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:border-[#0B6B3A] dark:hover:border-emerald-500 transition-colors"
              >
                <div className="relative h-44 bg-gradient-to-br from-[#0B2416] to-[#0B6B3A] overflow-hidden">
                  {!imgBroken ? (
                    <img
                      src={game.bannerUrl}
                      alt={game.name}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setBrokenImages((prev) => new Set(prev).add(game.gameId))
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/90 gap-2">
                      <Gamepad2 className="w-10 h-10" />
                      <span className="font-bold text-lg">{game.name}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                    <div>
                      <span
                        className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold text-white mb-1"
                        style={{ backgroundColor: game.accentColor }}
                      >
                        {game.genre}
                      </span>
                      <h3 className="text-lg font-bold text-white leading-tight">{game.name}</h3>
                    </div>
                    {isJoined && (
                      <span className="px-2.5 py-1 rounded-lg bg-[#25D366] text-[#062E19] text-[11px] font-bold shrink-0">
                        Tergabung
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <p className="text-xs sm:text-sm text-[#2F4F3C] dark:text-emerald-200/90 leading-relaxed">
                    {game.description}
                  </p>

                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#E6F2EA] dark:border-emerald-900/60">
                    <div className="flex items-center gap-3 text-xs text-[#52705E] dark:text-emerald-300/80">
                      <span className="flex items-center gap-1 font-semibold">
                        <Users className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
                        <span className="font-mono-num">{roster.length}</span> anggota
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-mono-num">{activeLfgCount}</span> siap mabar
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGameId(game.gameId);
                        setCommunityTab('chat');
                      }}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-bold cursor-pointer shrink-0"
                    >
                      Buka Komunitas
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  // Detail View for Selected Game Community
  const gameRoomId = GAME_ROOM_IDS[selectedGame.gameId];
  const gameRoomObj: ChatRoom =
    chatRooms.find((r) => r.roomId === gameRoomId) ?? {
      id: gameRoomId,
      roomId: gameRoomId,
      classId: '6A',
      type: 'game',
      name: `Chat Mabar ${selectedGame.shortName}`,
      description: selectedGame.description,
      gameId: selectedGame.gameId,
      participantIds: [],
      pinnedMessageId: '',
      pinnedText: '',
      pinnedByName: '',
      lastMessageText: '',
      lastMessageSenderId: '',
      lastMessageAt: null,
      createdBy: 'system',
      updatedAt: null,
    };

  const posts = postsByGame[selectedGame.gameId] || [];
  const filteredMembers = currentMembers.filter((m) => {
    if (lfgFilter === 'aktif-mabar') {
      return m.lfgStatus === 'siap-mabar' || m.lfgStatus === 'dalam-game';
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setSelectedGameId(null)}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#0F2419] hover:bg-[#F0F7F2] dark:hover:bg-[#132C1E] border border-[#D3E6D8] dark:border-emerald-900/60 text-xs font-semibold text-[#0B2416] dark:text-emerald-100 flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Semua Game Center</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-[#52705E] dark:text-emerald-300">
          <Users className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
          <span>
            <strong className="font-mono-num">{currentMembers.length}</strong> anggota tergabung
          </span>
        </div>
      </div>

      {reportDone && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
          {reportDone}
        </div>
      )}

      {/* Community Header & Join/LFG Card */}
      <section className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl overflow-hidden shadow-sm">
        <div className="relative h-36 sm:h-44 bg-[#0B2416]">
          {!brokenImages.has(selectedGame.gameId) && (
            <img
              src={selectedGame.bannerUrl}
              alt={selectedGame.name}
              referrerPolicy="no-referrer"
              onError={() =>
                setBrokenImages((prev) => new Set(prev).add(selectedGame.gameId))
              }
              className="w-full h-full object-cover opacity-85"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span
                className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold text-white mb-1"
                style={{ backgroundColor: selectedGame.accentColor }}
              >
                {selectedGame.genre}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white">{selectedGame.name}</h2>
            </div>
            {myMembership && (
              <button
                type="button"
                onClick={handleLeave}
                disabled={savingJoin}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <LeaveIcon className="w-3.5 h-3.5" />
                <span>Keluar Komunitas</span>
              </button>
            )}
          </div>
        </div>

        {/* Join / LFG Status Control */}
        <form onSubmit={handleSaveJoin} className="p-4 sm:p-5 space-y-3 border-b border-[#E6F2EA] dark:border-emerald-900/60 bg-[#F8FCF9] dark:bg-[#11271B]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-[#0B2416] dark:text-emerald-100 flex items-center gap-1.5">
              {myMembership ? (
                <>
                  <UserCheck className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
                  <span>Status Mencari Teman &amp; Profil Game Anda (Tergabung)</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
                  <span>Gabung Komunitas {selectedGame.shortName} &amp; Atur Status Mabar</span>
                </>
              )}
            </p>
            <span className="text-[11px] text-[#52705E] dark:text-emerald-300/80">
              Berbagi ID game bersifat opsional · Jangan bagikan kata sandi!
            </span>
          </div>

          {joinFeedback && (
            <p
              className={`text-xs rounded-xl p-2.5 border ${
                joinFeedback.type === 'ok'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}
            >
              {joinFeedback.text}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-[#52705E] dark:text-emerald-300 mb-1">
                Status Mabar (LFG)
              </label>
              <select
                value={lfgStatus}
                onChange={(e) => setLfgStatus(e.target.value as LfgStatus)}
                className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs font-semibold text-[#0B2416] dark:text-emerald-50"
              >
                {LFG_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#52705E] dark:text-emerald-300 mb-1">
                Nickname In-Game (Opsional)
              </label>
              <input
                type="text"
                maxLength={50}
                value={inGameName}
                onChange={(e) => setInGameName(e.target.value)}
                placeholder="Mis. Ahmad6A"
                className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs text-[#0B2416] dark:text-emerald-50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#52705E] dark:text-emerald-300 mb-1">
                ID Game (Opsional)
              </label>
              <input
                type="text"
                maxLength={50}
                value={inGameId}
                onChange={(e) => setInGameId(e.target.value)}
                placeholder="Kosongkan jika privat"
                className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs font-mono-num text-[#0B2416] dark:text-emerald-50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#52705E] dark:text-emerald-300 mb-1">
                Catatan Ajakan (Opsional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={120}
                  value={lfgNote}
                  onChange={(e) => setLfgNote(e.target.value)}
                  placeholder="Mis. Ayo push sore jam 4"
                  className="flex-1 min-w-0 min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs text-[#0B2416] dark:text-emerald-50"
                />
                <button
                  type="submit"
                  disabled={savingJoin}
                  className="min-h-[40px] px-4 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-50 text-white text-xs font-bold shrink-0 cursor-pointer"
                >
                  {savingJoin ? '...' : myMembership ? 'Simpan' : 'Gabung'}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Community Sub-Tabs */}
        <div className="px-4 sm:px-5 py-2.5 flex items-center gap-2 overflow-x-auto bg-white dark:bg-[#0F2419]">
          {(
            [
              { id: 'chat', label: 'Ruang Chat Game', icon: MessageSquare },
              { id: 'anggota', label: `Cari Teman & Anggota (${currentMembers.length})`, icon: Users },
              { id: 'info', label: `Update & Pengumuman (${posts.length})`, icon: Megaphone },
              { id: 'aturan', label: 'Aturan & Moderasi', icon: ShieldCheck },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = communityTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setCommunityTab(t.id)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#0B6B3A] text-white'
                    : 'bg-[#F0F7F2] dark:bg-[#132C1E] text-[#2F4F3C] dark:text-emerald-200 hover:bg-[#E2EFE6] dark:hover:bg-[#1A3927]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Sub-Tab Content */}
      {communityTab === 'chat' && (
        <div className="h-[calc(100vh-18rem)] min-h-[480px]">
          <ChatRoomPane
            room={gameRoomObj}
            profile={profile}
            settings={settings}
            members={members}
            presenceMap={presenceMap}
            blockedUids={blockedUids}
            allRooms={chatRooms}
            botContext={botContext}
            onOpenC6AAssistant={onOpenC6AAssistant}
          />
        </div>
      )}

      {communityTab === 'anggota' && (
        <section className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#0B2416] dark:text-emerald-50">
                Daftar Anggota &amp; Pencari Teman Mabar
              </h3>
              <p className="text-xs text-[#52705E] dark:text-emerald-300/80">
                Temukan teman sekelas yang siap bermain bersama di {selectedGame.name}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLfgFilter('semua')}
                className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold cursor-pointer ${
                  lfgFilter === 'semua'
                    ? 'bg-[#0B6B3A] text-white'
                    : 'bg-[#F0F7F2] dark:bg-[#132C1E] text-[#2F4F3C] dark:text-emerald-200'
                }`}
              >
                Semua ({currentMembers.length})
              </button>
              <button
                type="button"
                onClick={() => setLfgFilter('aktif-mabar')}
                className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold cursor-pointer ${
                  lfgFilter === 'aktif-mabar'
                    ? 'bg-[#0B6B3A] text-white'
                    : 'bg-[#F0F7F2] dark:bg-[#132C1E] text-[#2F4F3C] dark:text-emerald-200'
                }`}
              >
                Siap / Dalam Game
              </button>
            </div>
          </div>

          {filteredMembers.length === 0 ? (
            <p className="text-sm text-[#52705E] dark:text-emerald-300/80 py-8 text-center">
              Belum ada anggota komunitas untuk filter ini. Jadilah yang pertama bergabung di atas!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredMembers.map((m) => {
                const lfgMeta =
                  LFG_OPTIONS.find((o) => o.value === m.lfgStatus) ?? LFG_OPTIONS[3];
                const pres = presenceMap.get(m.uid);
                const isMe = m.uid === profile.uid;
                const isBlocked = blockedUids.has(m.uid);

                return (
                  <div
                    key={m.uid}
                    className="p-4 rounded-xl bg-[#F8FCF9] dark:bg-[#132C1E] border border-[#D3E6D8] dark:border-emerald-900/60 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {m.photoURL ? (
                          <img
                            src={m.photoURL}
                            alt={m.nickname || m.displayName}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover border border-[#96CCA9] shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#E6F4EC] dark:bg-emerald-900/60 border border-[#96CCA9] flex items-center justify-center text-xs font-bold text-[#0B6B3A] dark:text-emerald-200 shrink-0">
                            {(m.nickname || m.displayName).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#0B2416] dark:text-emerald-50 truncate">
                            {m.nickname || m.displayName} {isMe && '(Anda)'}
                          </p>
                          <p className="text-[11px] text-[#52705E] dark:text-emerald-300/80 truncate">
                            {getRoleLabel(m.role)} ·{' '}
                            {formatRelativeLastSeen(
                              pres?.lastSeenAt ?? null,
                              Boolean(pres?.isOnline),
                              Boolean(pres?.hideOnlineStatus)
                            )}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold shrink-0 ${lfgMeta.badgeClass}`}
                      >
                        {lfgMeta.label}
                      </span>
                    </div>

                    {(m.inGameName || m.inGameId || m.lfgNote) && (
                      <div className="text-xs space-y-1 bg-white dark:bg-[#0D1E15] rounded-lg p-2.5 border border-[#E2EFE6] dark:border-emerald-900/60">
                        {(m.inGameName || m.inGameId) && (
                          <p className="text-[#0B2416] dark:text-emerald-100 font-medium">
                            {m.inGameName && <span>Nick: {m.inGameName}</span>}
                            {m.inGameName && m.inGameId && <span> · </span>}
                            {m.inGameId && (
                              <span className="font-mono-num text-[#0B6B3A] dark:text-emerald-400">
                                ID: {m.inGameId}
                              </span>
                            )}
                          </p>
                        )}
                        {m.lfgNote && (
                          <p className="text-[#52705E] dark:text-emerald-300/85 italic">
                            &ldquo;{m.lfgNote}&rdquo;
                          </p>
                        )}
                      </div>
                    )}

                    {!isMe && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {settings.allowPrivateChat !== false && !isBlocked && (
                          <button
                            type="button"
                            disabled={dmBusyUid === m.uid}
                            onClick={() => handleStartDm(m)}
                            className="min-h-[34px] px-3 rounded-lg bg-[#0B6B3A] hover:bg-[#09562E] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            {dmBusyUid === m.uid ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <MessageSquare className="w-3.5 h-3.5" />
                            )}
                            <span>Ajak Mabar (DM)</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setReportTarget(m)}
                          className="min-h-[34px] px-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Flag className="w-3.5 h-3.5" />
                          <span>Laporkan</span>
                        </button>
                        {isStaff && (
                          <button
                            type="button"
                            onClick={() => setKickTarget(m)}
                            className="min-h-[34px] px-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Keluarkan</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {communityTab === 'info' && (
        <section className="space-y-5">
          {isStaff && (
            <form
              onSubmit={handleCreatePost}
              className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 space-y-3"
            >
              <p className="text-sm font-bold text-[#0B2416] dark:text-emerald-50 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#0B6B3A] dark:text-emerald-400" />
                <span>Publikasikan Update Game / Pengumuman Mabar ({selectedGame.shortName})</span>
              </p>

              {postFeedback && (
                <p className="text-xs rounded-xl p-2.5 bg-rose-50 border border-rose-200 text-rose-800">
                  {postFeedback}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={postType}
                  onChange={(e) => setPostType(e.target.value as 'update' | 'pengumuman')}
                  className="min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs font-semibold text-[#0B2416] dark:text-emerald-50"
                >
                  <option value="update">Info Update Game</option>
                  <option value="pengumuman">Pengumuman Komunitas</option>
                </select>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={120}
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="Judul info/pengumuman..."
                  className="sm:col-span-2 min-h-[42px] px-3.5 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs sm:text-sm text-[#0B2416] dark:text-emerald-50"
                />
              </div>

              <textarea
                required
                minLength={3}
                maxLength={1500}
                rows={3}
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="Tulis informasi patch terbaru, jadwal turnamen persahabatan, atau pengumuman komunitas..."
                className="w-full p-3.5 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs sm:text-sm text-[#0B2416] dark:text-emerald-50"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#2F4F3C] dark:text-emerald-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postPinned}
                    onChange={(e) => setPostPinned(e.target.checked)}
                    className="rounded border-[#96CCA9] text-[#0B6B3A]"
                  />
                  <span>Sematkan di atas (Pin)</span>
                </label>
                <button
                  type="submit"
                  disabled={postingInfo}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                >
                  {postingInfo ? 'Mempublikasikan...' : 'Terbitkan Info'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 space-y-4">
            <h3 className="text-base font-bold text-[#0B2416] dark:text-emerald-50">
              Papan Update &amp; Pengumuman {selectedGame.shortName}
            </h3>

            {posts.length === 0 ? (
              <p className="text-sm text-[#52705E] dark:text-emerald-300/80 py-6 text-center">
                Belum ada pengumuman atau catatan update game di komunitas ini.
              </p>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <article
                    key={post.id}
                    className="p-4 rounded-xl bg-[#F8FCF9] dark:bg-[#132C1E] border border-[#D3E6D8] dark:border-emerald-900/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        {post.pinned && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 font-bold text-[10px]">
                            <Pin className="w-3 h-3" />
                            <span>Disematkan</span>
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            post.type === 'pengumuman'
                              ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                              : 'bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200'
                          }`}
                        >
                          {post.type === 'pengumuman' ? 'Pengumuman' : 'Update Game'}
                        </span>
                        <span className="text-[#52705E] dark:text-emerald-300/80">
                          {post.authorName} · {formatTimestampId(post.createdAt)}
                        </span>
                      </div>
                      {isStaff && (
                        <button
                          type="button"
                          onClick={() => void deleteGamePost(profile, selectedGame.gameId, post.id, post.title)}
                          aria-label="Hapus info game"
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-[#0B2416] dark:text-emerald-50">{post.title}</h4>
                    <p className="text-xs sm:text-sm text-[#2F4F3C] dark:text-emerald-200/90 whitespace-pre-wrap leading-relaxed">
                      {post.content}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {communityTab === 'aturan' && (
        <section className="bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-900/60 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-[#0B6B3A] dark:text-emerald-400" />
            <h3 className="text-base font-bold text-[#0B2416] dark:text-emerald-50">
              Aturan Khusus &amp; Sistem Moderasi {selectedGame.name}
            </h3>
          </div>
          <div className="p-4 rounded-xl bg-[#F0F7F2] dark:bg-[#132C1E] border border-[#C6E0CE] dark:border-emerald-800 text-sm text-[#0B2416] dark:text-emerald-100">
            {selectedGame.rules}
          </div>
          <ul className="space-y-2 text-xs sm:text-sm text-[#2F4F3C] dark:text-emerald-200/90 leading-relaxed">
            <li>• Filter otomatis memblokir spam beruntun, kata kasar/perundungan, serta tautan phishing (seperti iming-iming top-up/diamond gratis).</li>
            <li>• Sistem juga mencegah kebocoran informasi pribadi sensitif (password, OTP, atau nomor telepon) di ruang chat publik/game.</li>
            <li>• Setiap siswa dapat menekan tombol <strong>Laporkan</strong> apabila melihat pelanggaran untuk segera ditindaklanjuti Owner/Admin.</li>
          </ul>
        </section>
      )}

      {/* Kick Member Confirm */}
      <ConfirmModal
        open={Boolean(kickTarget)}
        title="Keluarkan dari Komunitas?"
        description={`Yakin ingin mengeluarkan ${kickTarget?.nickname || kickTarget?.displayName || 'anggota ini'} dari komunitas ${selectedGame.shortName}?`}
        confirmLabel="Keluarkan"
        onConfirm={handleConfirmKick}
        onCancel={() => setKickTarget(null)}
        busy={kickBusy}
      />

      {/* Report Member Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-[#0B2416]/50 backdrop-blur-sm"
            onClick={() => !reportBusy && setReportTarget(null)}
            aria-hidden="true"
          />
          <form
            onSubmit={handleSubmitReport}
            className="relative z-10 max-w-md w-full bg-white dark:bg-[#0F2419] border border-[#D3E6D8] dark:border-emerald-800 rounded-2xl p-5 space-y-4 shadow-xl"
          >
            <h3 className="text-base font-bold text-[#0B2416] dark:text-emerald-50">
              Laporkan Pelanggaran Komunitas
            </h3>
            <p className="text-xs text-[#52705E] dark:text-emerald-300">
              Terlapor: <strong>{reportTarget.nickname || reportTarget.displayName}</strong>
            </p>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#2F4F3C] dark:text-emerald-200">
                Kategori Pelanggaran
              </label>
              <select
                value={reportCategory}
                onChange={(e) => setReportCategory(e.target.value as ReportCategory)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs sm:text-sm text-[#0B2416] dark:text-emerald-50"
              >
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#2F4F3C] dark:text-emerald-200">
                Penjelasan Singkat
              </label>
              <textarea
                required
                minLength={5}
                maxLength={500}
                rows={3}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Jelaskan spam, penipuan, perundungan, atau penyebaran data pribadi yang terjadi..."
                className="w-full p-3 rounded-xl bg-white dark:bg-[#0D1E15] border border-[#B9D8C2] dark:border-emerald-800 text-xs sm:text-sm text-[#0B2416] dark:text-emerald-50"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={reportBusy}
                onClick={() => setReportTarget(null)}
                className="min-h-[40px] px-4 rounded-xl bg-[#F0F7F2] dark:bg-[#132C1E] text-xs font-semibold text-[#2F4F3C] dark:text-emerald-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={reportBusy}
                className="min-h-[40px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                {reportBusy ? 'Mengirim...' : 'Kirim Laporan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
