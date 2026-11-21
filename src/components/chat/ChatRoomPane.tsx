import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Ban,
  Bot,
  Camera,
  Check,
  CheckCheck,
  CornerUpRight,
  Edit3,
  Flag,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Mic,
  Pin,
  PinOff,
  RefreshCw,
  Reply,
  Search,
  Send,
  Smile,
  Sparkles,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { buildFirestoreErrorInfo, db, OperationType } from '../../firebase';
import {
  blockClassmate,
  deleteChatMessage,
  editRoomMessage,
  ensureSystemChatRoom,
  markRoomMessageRead,
  pinRoomMessage,
  sendRoomMessage,
  setTypingStatus,
  softDeleteRoomMessage,
  submitUserReport,
  toggleMessageReaction,
  unpinRoomMessage,
} from '../../services/firestoreService';
import { uploadChatMediaFile } from '../../services/storageService';
import type {
  ChatMessage,
  ChatReplyRef,
  ChatRoom,
  ClassSettings,
  ReportCategory,
  RoomChatMessage,
  TypingIndicator,
  UserPresence,
  UserPublic,
} from '../../types';
import {
  buildSanitizedC6AContextSummary,
  canUseC6ABot,
  type C6AClassContextData,
  extractChatBotQuery,
  runC6ABotCommand,
} from '../../utils/c6aBot';
import { CHAT_MEDIA_LIMITS, validateMediaFile } from '../../utils/mediaUtils';
import { checkSpamCooldown, REPORT_CATEGORIES } from '../../utils/moderation';
import { classifyApplicationError, fetchWithTimeoutAndRetry } from '../../utils/resilience';
import {
  formatRelativeLastSeen,
  formatTimeOnly,
  getRoleLabel,
  getUserDisplayLabel,
  isAdminOrOwnerRole,
  toMillis,
} from '../../utils/validation';
import { ConfirmModal } from '../ConfirmModal';
import { AudioMessagePlayer } from './AudioMessagePlayer';
import { MediaLightbox } from './MediaLightbox';
import { MediaPreviewModal, type PendingMediaItem } from './MediaPreviewModal';
import { VoiceRecorderBar } from './VoiceRecorderBar';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🤲', '🎉'];
const EMOJI_GROUPS: Array<{ label: string; emojis: string[] }> = [
  {
    label: 'Ekspresi & Sapaan',
    emojis: ['😊', '😄', '😂', '🤣', '😍', '🥳', '😎', '🤔', '😅', '🙏', '🤲', '👋', '👍', '👏', '🎉', '🔥'],
  },
  {
    label: 'Sekolah & Game',
    emojis: ['📚', '✏️', '📝', '🏫', '🕌', '⏰', '✅', '⭐', '🎮', '🏆', '⚽', '🛡️', '⚔️', '💬', '❤️', '💚'],
  },
];

interface EphemeralBotReply {
  id: string;
  source: 'bot' | 'ai';
  prompt: string;
  text: string;
  timeLabel: string;
  isError?: boolean;
}

interface ChatRoomPaneProps {
  room: ChatRoom;
  profile: UserPublic;
  settings: ClassSettings;
  members: UserPublic[];
  presenceMap: Map<string, UserPresence>;
  blockedUids: Set<string>;
  allRooms: ChatRoom[];
  legacyClassMessages?: ChatMessage[];
  botContext?: C6AClassContextData;
  onBackMobile?: () => void;
  onOpenC6AAssistant?: () => void;
  onForwardSuccess?: (targetRoomId: string) => void;
}

export function ChatRoomPane({
  room,
  profile,
  settings,
  members,
  presenceMap,
  blockedUids,
  allRooms,
  legacyClassMessages = [],
  botContext,
  onBackMobile,
  onOpenC6AAssistant,
  onForwardSuccess,
}: ChatRoomPaneProps) {
  const [roomMessages, setRoomMessages] = useState<RoomChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const [text, setText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [roomListenerError, setRoomListenerError] = useState<string | null>(null);
  const [roomRetryTick, setRoomRetryTick] = useState(0);

  const [emojiOpen, setEmojiOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatReplyRef | null>(null);
  const [editingMsg, setEditingMsg] = useState<RoomChatMessage | null>(null);
  const [reactingMsgId, setReactingMsgId] = useState<string | null>(null);

  const [pendingMedia, setPendingMedia] = useState<PendingMediaItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [lightbox, setLightbox] = useState<{
    urls: string[];
    initialIndex: number;
    kind: 'image' | 'video';
    senderName: string;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    msg: RoomChatMessage;
    isLegacy: boolean;
  } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [forwardMsg, setForwardMsg] = useState<RoomChatMessage | null>(null);
  const [forwardBusy, setForwardBusy] = useState(false);

  const [reportTarget, setReportTarget] = useState<{
    uid: string;
    name: string;
    msgId?: string;
    excerpt?: string;
  } | null>(null);
  const [reportCategory, setReportCategory] = useState<ReportCategory>('spam');
  const [reportReason, setReportReason] = useState('');
  const [reportAlsoBlock, setReportAlsoBlock] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);

  const [botReplies, setBotReplies] = useState<EphemeralBotReply[]>([]);
  const [botThinking, setBotThinking] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const lastSentMsRef = useRef<number>(0);
  const lastSentTextRef = useRef<string>('');
  const typingTimeoutRef = useRef<number | null>(null);
  const markedReadRef = useRef<Set<string>>(new Set());

  const isPublicRoom = room.type !== 'dm';
  const allowVoice = settings.allowVoiceNotes ?? true;
  const allowMedia = settings.allowMediaUpload ?? true;
  const botAllowed = canUseC6ABot(profile.role);

  const dmPartner = useMemo(() => {
    if (room.type !== 'dm') return null;
    const partnerUid = room.participantIds.find((id) => id !== profile.uid);
    return members.find((m) => m.uid === partnerUid) ?? null;
  }, [room, profile.uid, members]);

  const partnerPresence = dmPartner ? presenceMap.get(dmPartner.uid) : undefined;
  const partnerBlocked = dmPartner ? blockedUids.has(dmPartner.uid) : false;

  // Ensure system rooms exist & reset UI state when switching rooms
  useEffect(() => {
    setReplyTo(null);
    setEditingMsg(null);
    setEmojiOpen(false);
    setVoiceMode(false);
    setErrorMsg(null);
    setReactingMsgId(null);
    void ensureSystemChatRoom(room.roomId, profile);
  }, [room.roomId, profile.uid]);

  // Real-time messages listener
  useEffect(() => {
    setRoomListenerError(null);
    const q = query(
      collection(db, 'chat_rooms', room.roomId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(250)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRoomListenerError(null);
        const list = snap.docs.map((d) => {
          const raw = d.data() as Partial<RoomChatMessage>;
          return {
            id: d.id,
            roomId: raw.roomId || room.roomId,
            classId: '6A' as const,
            senderId: raw.senderId || '',
            senderName: raw.senderName || 'Anggota 6A',
            senderRole: raw.senderRole || 'siswa',
            senderPhoto: raw.senderPhoto || '',
            messageType: raw.messageType || 'text',
            text: raw.text || '',
            mediaUrls: Array.isArray(raw.mediaUrls) ? raw.mediaUrls : [],
            mediaNames: Array.isArray(raw.mediaNames) ? raw.mediaNames : [],
            mediaDurationSec: typeof raw.mediaDurationSec === 'number' ? raw.mediaDurationSec : 0,
            replyTo: raw.replyTo ?? null,
            forwardedFrom: raw.forwardedFrom || '',
            reactions: raw.reactions && typeof raw.reactions === 'object' ? raw.reactions : {},
            readBy: Array.isArray(raw.readBy) ? raw.readBy : [],
            deleted: Boolean(raw.deleted),
            moderatedBy: raw.moderatedBy || '',
            editedAt: raw.editedAt ?? null,
            createdAt: raw.createdAt ?? null,
          };
        });
        setRoomMessages(list);
      },
      (error) => {
        console.error(
          'Room messages listener error:',
          buildFirestoreErrorInfo(error, OperationType.LIST, `chat_rooms/${room.roomId}/messages`)
        );
        const friendly = classifyApplicationError(error);
        setRoomListenerError(`${friendly.title}: ${friendly.message}`);
      }
    );
    return () => unsub();
  }, [room.roomId, roomRetryTick]);

  // Typing indicator listener
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'chat_rooms', room.roomId, 'typing'),
      (snap) => {
        const now = Date.now();
        const active = snap.docs
          .map((d) => d.data() as TypingIndicator)
          .filter(
            (t) =>
              t.uid !== profile.uid &&
              toMillis(t.updatedAt) > 0 &&
              now - toMillis(t.updatedAt) < 7000
          );
        setTypingUsers(active);
      },
      () => {
        // Ignore typing read error
      }
    );
    return () => unsub();
  }, [room.roomId, profile.uid]);

  // Merge legacy class messages into 'kelas-6a' so zero history is lost
  const mergedMessages = useMemo(() => {
    const base: Array<RoomChatMessage & { isLegacy?: boolean }> = roomMessages.map((m) => ({
      ...m,
      isLegacy: false,
    }));
    if (room.roomId === 'kelas-6a' && legacyClassMessages.length > 0) {
      for (const leg of legacyClassMessages) {
        base.push({
          id: leg.id,
          roomId: 'kelas-6a',
          classId: '6A',
          senderId: leg.senderId,
          senderName: leg.senderName,
          senderRole: leg.senderRole,
          senderPhoto: members.find((m) => m.uid === leg.senderId)?.photoURL || '',
          messageType: 'text',
          text: leg.text,
          mediaUrls: [],
          mediaNames: [],
          mediaDurationSec: 0,
          replyTo: null,
          forwardedFrom: '',
          reactions: {},
          readBy: [leg.senderId],
          deleted: false,
          moderatedBy: '',
          editedAt: null,
          createdAt: leg.createdAt,
          isLegacy: true,
        });
      }
    }
    return base.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  }, [room.roomId, roomMessages, legacyClassMessages, members]);

  // Mark unread room messages as read
  useEffect(() => {
    const toMark = roomMessages
      .filter(
        (m) =>
          m.senderId !== profile.uid &&
          !m.readBy.includes(profile.uid) &&
          !markedReadRef.current.has(`${room.roomId}:${m.id}`)
      )
      .slice(-15);
    for (const msg of toMark) {
      markedReadRef.current.add(`${room.roomId}:${msg.id}`);
      void markRoomMessageRead(room.roomId, msg.id, profile.uid);
    }
  }, [roomMessages, room.roomId, profile.uid]);

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return mergedMessages;
    return mergedMessages.filter(
      (m) => m.text.toLowerCase().includes(q) || m.senderName.toLowerCase().includes(q)
    );
  }, [mergedMessages, searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mergedMessages.length, botReplies.length, botThinking, searchQuery]);

  const handleBotTrigger = async (submittedText: string) => {
    if (room.roomId !== 'kelas-6a' || !botContext) return;
    const extracted = extractChatBotQuery(submittedText, profile.role);
    if (!extracted.isBotTrigger) return;

    let nowLabel = '--.--';
    try {
      nowLabel = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());
    } catch {
      const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
      nowLabel = `${String(wib.getUTCHours()).padStart(2, '0')}.${String(wib.getUTCMinutes()).padStart(2, '0')}`;
    }

    if (extracted.mode === 'bot') {
      const botRes = runC6ABotCommand(extracted.queryText, botContext, profile.role);
      setBotReplies((prev) => [
        ...prev.slice(-4),
        {
          id: `c6a-bot-${Date.now()}`,
          source: 'bot',
          prompt: submittedText,
          text: botRes.reply,
          timeLabel: nowLabel,
        },
      ]);
      return;
    }

    setBotThinking(true);
    const replyId = `c6a-ai-${Date.now()}`;
    try {
      const requestBody = {
        message: extracted.queryText,
        history: [],
        contextSummary: buildSanitizedC6AContextSummary(botContext),
        userLabel: getUserDisplayLabel(profile),
        userRole: profile.role,
      };
      let res = await fetchWithTimeoutAndRetry(
        '/api/c6a/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...requestBody, stream: true }),
        },
        { timeoutMs: 14000, maxRetries: 1, retryDelayMs: 450 }
      );
      if (res.status === 504 || res.status === 503 || res.status === 502) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        res = await fetchWithTimeoutAndRetry(
          '/api/c6a/chat',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...requestBody, stream: false, fastMode: true }),
          },
          { timeoutMs: 14000, maxRetries: 1, retryDelayMs: 500 }
        );
      }

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('text/event-stream') || !res.body) {
        const rawText = await res.text().catch(() => '');
        let payload: { reply?: string; error?: string } = {};
        if (rawText) {
          try {
            payload = JSON.parse(rawText) as { reply?: string; error?: string };
          } catch {
            payload = {};
          }
        }
        if (!res.ok || !payload.reply) {
          throw new Error(payload.error || `Gagal menghubungi C6A AI v1 (HTTP ${res.status}).`);
        }
        setBotReplies((prev) => [
          ...prev.slice(-4),
          { id: replyId, source: 'ai', prompt: submittedText, text: payload.reply!, timeLabel: nowLabel },
        ]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullReply = '';
      let inserted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          const evt = JSON.parse(jsonStr) as { delta?: string; error?: string };
          if (evt.error) throw new Error(evt.error);
          if (evt.delta) {
            fullReply += evt.delta;
            if (!inserted) {
              inserted = true;
              setBotThinking(false);
              setBotReplies((prev) => [
                ...prev.slice(-4),
                { id: replyId, source: 'ai', prompt: submittedText, text: fullReply, timeLabel: nowLabel },
              ]);
            } else {
              setBotReplies((prev) => prev.map((r) => (r.id === replyId ? { ...r, text: fullReply } : r)));
            }
          }
        }
      }
      if (!inserted) throw new Error('C6A AI v1 belum menerima jawaban.');
    } catch (err) {
      setBotReplies((prev) => [
        ...prev.slice(-4),
        {
          id: `c6a-err-${Date.now()}`,
          source: 'ai',
          prompt: submittedText,
          text: err instanceof Error ? err.message : 'Kendala menghubungi C6A AI.',
          timeLabel: nowLabel,
          isError: true,
        },
      ]);
    } finally {
      setBotThinking(false);
    }
  };

  const notifyTyping = (val: string) => {
    setText(val);
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    if (val.trim()) {
      void setTypingStatus(room.roomId, profile, true);
      typingTimeoutRef.current = window.setTimeout(() => {
        void setTypingStatus(room.roomId, profile, false);
      }, 3500);
    } else {
      void setTypingStatus(room.roomId, profile, false);
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || sending || partnerBlocked) return;

    if (editingMsg) {
      setSending(true);
      setErrorMsg(null);
      try {
        await editRoomMessage(profile, room.roomId, editingMsg.id, clean, isPublicRoom);
        setEditingMsg(null);
        setText('');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal mengedit pesan.');
      } finally {
        setSending(false);
      }
      return;
    }

    const now = Date.now();
    const spamErr = checkSpamCooldown(lastSentMsRef.current, now, lastSentTextRef.current, clean, 1200);
    if (spamErr) {
      setErrorMsg(spamErr);
      return;
    }

    setErrorMsg(null);
    setSending(true);
    try {
      await sendRoomMessage(profile, {
        roomId: room.roomId,
        isPublicRoom,
        messageType: 'text',
        text: clean,
        replyTo,
      });
      lastSentMsRef.current = Date.now();
      lastSentTextRef.current = clean;
      setText('');
      setReplyTo(null);
      setEmojiOpen(false);
      void setTypingStatus(room.roomId, profile, false);
      void handleBotTrigger(clean);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengirim pesan.');
    } finally {
      setSending(false);
    }
  };

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg(null);
    setMediaError(null);
    const files = Array.from(fileList);

    const firstIsVideo = files[0].type.startsWith('video/');
    if (firstIsVideo) {
      const vErr = validateMediaFile(files[0], 'video');
      if (vErr) {
        setErrorMsg(vErr);
        return;
      }
      setPendingMedia([
        {
          id: `${Date.now()}-vid`,
          file: files[0],
          kind: 'video',
          previewUrl: URL.createObjectURL(files[0]),
        },
      ]);
      return;
    }

    const images = files.filter((f) => f.type.startsWith('image/')).slice(0, CHAT_MEDIA_LIMITS.maxImagesPerMessage);
    if (images.length === 0) {
      setErrorMsg('Pilih file foto (JPG/PNG/WebP) atau video (MP4/WebM).');
      return;
    }

    for (const img of images) {
      const iErr = validateMediaFile(img, 'image');
      if (iErr) {
        setErrorMsg(iErr);
        return;
      }
    }

    setPendingMedia(
      images.map((file, idx) => ({
        id: `${Date.now()}-${idx}`,
        file,
        kind: 'image',
        previewUrl: URL.createObjectURL(file),
      }))
    );
  };

  const clearPendingMedia = () => {
    pendingMedia.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPendingMedia([]);
    setUploadProgress(null);
    setMediaError(null);
  };

  const handleSendPendingMedia = async (caption: string) => {
    if (pendingMedia.length === 0) return;
    setMediaError(null);
    setUploadProgress(5);
    try {
      const uploadedUrls: string[] = [];
      const uploadedNames: string[] = [];
      const total = pendingMedia.length;

      for (let i = 0; i < total; i += 1) {
        const item = pendingMedia[i];
        const res = await uploadChatMediaFile({
          roomId: room.roomId,
          uid: profile.uid,
          file: item.file,
          kind: item.kind,
          onProgress: (pct) => {
            const overall = Math.round(((i + pct / 100) / total) * 100);
            setUploadProgress(overall);
          },
        });
        uploadedUrls.push(res.url);
        uploadedNames.push(res.fileName);
      }

      await sendRoomMessage(profile, {
        roomId: room.roomId,
        isPublicRoom,
        messageType: pendingMedia[0].kind,
        text: caption,
        mediaUrls: uploadedUrls,
        mediaNames: uploadedNames,
        replyTo,
      });
      setReplyTo(null);
      clearPendingMedia();
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Gagal mengunggah media.');
      setUploadProgress(null);
      throw err;
    }
  };

  const handleSendVoiceNote = async (file: File, durationSec: number) => {
    setErrorMsg(null);
    const res = await uploadChatMediaFile({
      roomId: room.roomId,
      uid: profile.uid,
      file,
      kind: 'audio',
    });
    await sendRoomMessage(profile, {
      roomId: room.roomId,
      isPublicRoom,
      messageType: 'audio',
      text: '',
      mediaUrls: [res.url],
      mediaNames: [res.fileName],
      mediaDurationSec: durationSec,
      replyTo,
    });
    setReplyTo(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      if (deleteTarget.isLegacy) {
        await deleteChatMessage(deleteTarget.msg.id);
      } else {
        const isModeration =
          deleteTarget.msg.senderId !== profile.uid && isAdminOrOwnerRole(profile.role);
        await softDeleteRoomMessage(profile, room.roomId, deleteTarget.msg.id, isModeration);
      }
      setDeleteTarget(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghapus pesan.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleForwardToRoom = async (targetRoom: ChatRoom) => {
    if (!forwardMsg || forwardBusy) return;
    setForwardBusy(true);
    try {
      await sendRoomMessage(profile, {
        roomId: targetRoom.roomId,
        isPublicRoom: targetRoom.type !== 'dm',
        messageType: forwardMsg.messageType,
        text: forwardMsg.text,
        mediaUrls: forwardMsg.mediaUrls,
        mediaNames: forwardMsg.mediaNames,
        mediaDurationSec: forwardMsg.mediaDurationSec,
        forwardedFrom: forwardMsg.senderName,
      });
      setForwardMsg(null);
      if (onForwardSuccess) onForwardSuccess(targetRoom.roomId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal meneruskan pesan.');
    } finally {
      setForwardBusy(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget || reportBusy) return;
    setReportBusy(true);
    try {
      await submitUserReport(profile, {
        targetUid: reportTarget.uid,
        targetName: reportTarget.name,
        roomId: room.roomId,
        messageId: reportTarget.msgId,
        messageExcerpt: reportTarget.excerpt,
        category: reportCategory,
        reason: reportReason,
      });
      if (reportAlsoBlock) {
        await blockClassmate(profile.uid, reportTarget.uid, reportTarget.name);
      }
      setReportTarget(null);
      setReportReason('');
      setReportAlsoBlock(false);
      setErrorMsg('Laporan moderasi berhasil dikirim ke Admin & Owner Kelas 6A.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengirim laporan.');
    } finally {
      setReportBusy(false);
    }
  };

  const headerTitle = dmPartner ? getUserDisplayLabel(dmPartner) : room.name;
  const headerSubtitle = dmPartner
    ? partnerPresence
      ? formatRelativeLastSeen(
          partnerPresence.lastSeenAt,
          partnerPresence.isOnline,
          partnerPresence.hideOnlineStatus || dmPartner.hideOnlineStatus
        )
      : 'Anggota Kelas 6A'
    : room.description;

  const isStaff = isAdminOrOwnerRole(profile.role);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#111B21] overflow-hidden">
      {/* Chat Header */}
      <div className="px-3 sm:px-4 py-3 bg-[#F0F7F2] dark:bg-[#202C33] border-b border-[#D3E6D8] dark:border-[#2A3942] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBackMobile && (
            <button
              type="button"
              onClick={onBackMobile}
              aria-label="Kembali ke daftar chat"
              className="md:hidden min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#0B2416] dark:text-[#E9EDEF] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {dmPartner?.photoURL ? (
            <div className="relative shrink-0">
              <img
                src={dmPartner.photoURL}
                alt={headerTitle}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-[#96CCA9] dark:border-[#2A3942]"
              />
              {partnerPresence?.isOnline && !partnerPresence.hideOnlineStatus && !dmPartner.hideOnlineStatus && (
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#202C33]" />
              )}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#0B6B3A] text-white flex items-center justify-center text-xs font-bold shrink-0">
              {headerTitle.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#0B2416] dark:text-[#E9EDEF] truncate">
              {headerTitle}
            </h3>
            <p className="text-[11px] text-[#52705E] dark:text-[#8696A0] truncate">
              {typingUsers.length > 0 ? (
                <span className="text-[#0B6B3A] dark:text-emerald-400 font-semibold">
                  {typingUsers.map((t) => t.displayName).join(', ')} sedang mengetik...
                </span>
              ) : (
                headerSubtitle
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {room.roomId === 'kelas-6a' && onOpenC6AAssistant && (
            <button
              type="button"
              onClick={onOpenC6AAssistant}
              className="hidden sm:flex min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#111B21] hover:bg-[#E6F4EC] border border-[#96CCA9] dark:border-[#2A3942] text-xs font-semibold text-[#0B6B3A] dark:text-emerald-400 items-center gap-1.5 cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{botAllowed ? 'Bot & AI' : 'C6A AI'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSearchOpen((prev) => !prev);
              setSearchQuery('');
            }}
            aria-label="Cari pesan dalam percakapan"
            className={`min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center border cursor-pointer ${
              searchOpen
                ? 'bg-[#0B6B3A] text-white border-[#0B6B3A]'
                : 'bg-white dark:bg-[#111B21] border-[#C6E0CE] dark:border-[#2A3942] text-[#2F4F3C] dark:text-[#AEBAC1]'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>
          {dmPartner && (
            <button
              type="button"
              onClick={() =>
                setReportTarget({
                  uid: dmPartner.uid,
                  name: getUserDisplayLabel(dmPartner),
                })
              }
              aria-label="Laporkan pengguna"
              title="Laporkan atau blokir pengguna"
              className="min-h-[38px] min-w-[38px] rounded-xl bg-white dark:bg-[#111B21] border border-[#C6E0CE] dark:border-[#2A3942] text-[#52705E] hover:text-rose-600 flex items-center justify-center cursor-pointer"
            >
              <Flag className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* In-Room Search Bar */}
      {searchOpen && (
        <div className="px-4 py-2 bg-[#F8FCF9] dark:bg-[#182229] border-b border-[#E2EFE6] dark:border-[#2A3942] flex items-center gap-2">
          <Search className="w-4 h-4 text-[#52705E] shrink-0" />
          <input
            type="search"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari isi pesan atau nama pengirim..."
            className="flex-1 min-h-[36px] bg-transparent text-xs text-[#0B2416] dark:text-white focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-[#52705E] hover:text-[#0B2416] dark:text-[#AEBAC1] cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* Pinned Message Banner */}
      {room.pinnedText && (
        <div className="px-4 py-2 bg-[#FEFCE8] dark:bg-[#1D2B22] border-b border-amber-200 dark:border-[#2A3942] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <p className="truncate text-[#0B2416] dark:text-[#E9EDEF]">
              <span className="font-semibold text-amber-700 dark:text-amber-400">Disematkan:</span>{' '}
              {room.pinnedText}
            </p>
          </div>
          {isStaff && (
            <button
              type="button"
              onClick={() => unpinRoomMessage(room.roomId)}
              aria-label="Lepas pin pesan"
              className="text-[#52705E] hover:text-[#0B2416] dark:text-[#AEBAC1] shrink-0 cursor-pointer"
            >
              <PinOff className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Room Listener Error Banner */}
      {roomListenerError && (
        <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
          <span>{roomListenerError}</span>
          <button
            type="button"
            onClick={() => setRoomRetryTick((t) => t + 1)}
            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sambung Ulang</span>
          </button>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5 bg-[#EFEAE2]/55 dark:bg-[#0B141A]">
        {filteredMessages.length === 0 && botReplies.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#52705E] dark:text-[#8696A0] space-y-1.5 py-10">
            <MessageSquare className="w-9 h-9 text-[#96CCA9] dark:text-[#2A3942]" />
            <p className="text-sm font-semibold text-[#2F4F3C] dark:text-[#AEBAC1]">
              {searchQuery.trim()
                ? 'Tidak ditemukan pesan yang cocok.'
                : `Mulai percakapan di ${headerTitle}`}
            </p>
            <p className="text-xs max-w-sm">
              Kirim teks, emoji, pesan suara, foto, atau video dengan sopan dan aman.
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMine = msg.senderId === profile.uid;
            const isLegacy = Boolean((msg as { isLegacy?: boolean }).isLegacy);
            const isBlockedSender = !isMine && blockedUids.has(msg.senderId);
            const canDelete = !msg.deleted && (isMine || isStaff);
            const canEdit = !isLegacy && !msg.deleted && isMine && msg.messageType === 'text';

            // Read status check: for DM check if other participant read; for group check >= 2 readers
            const isReadByOther = isMine && msg.readBy.some((id) => id !== profile.uid);

            if (isBlockedSender) {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="px-3.5 py-2 rounded-xl bg-white/70 dark:bg-[#182229] border border-[#D3E6D8] dark:border-[#2A3942] text-xs italic text-[#52705E] dark:text-[#8696A0]">
                    Pesan dari pengguna yang Anda blokir disembunyikan.
                  </div>
                </div>
              );
            }

            const reactionEntries = Object.entries(msg.reactions || {}).filter(
              ([, uids]) => Array.isArray(uids) && uids.length > 0
            );

            return (
              <div key={msg.id} className={`group flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-end gap-2 max-w-[90%] sm:max-w-[75%] ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMine && isPublicRoom && (
                    msg.senderPhoto ? (
                      <img
                        src={msg.senderPhoto}
                        alt={msg.senderName}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-full object-cover border border-[#96CCA9] dark:border-[#2A3942] shrink-0 mb-1"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#E6F4EC] dark:bg-[#202C33] text-[#0B6B3A] dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center shrink-0 mb-1">
                        {msg.senderName.slice(0, 2).toUpperCase()}
                      </div>
                    )
                  )}

                  <div
                    className={`rounded-2xl px-3.5 py-2.5 border shadow-xs min-w-[120px] ${
                      isMine
                        ? 'bg-[#0B6B3A] dark:bg-[#005C4B] border-[#0B6B3A] dark:border-[#005C4B] text-white rounded-br-sm'
                        : 'bg-white dark:bg-[#202C33] border-[#D3E6D8] dark:border-[#2A3942] text-[#0B2416] dark:text-[#E9EDEF] rounded-bl-sm'
                    }`}
                  >
                    {/* Sender Header */}
                    {(!isMine || isPublicRoom) && (
                      <div className="flex items-center justify-between gap-3 text-[11px] mb-1">
                        <span
                          className={`font-semibold truncate ${
                            isMine ? 'text-emerald-100' : 'text-[#0B6B3A] dark:text-emerald-400'
                          }`}
                        >
                          {msg.senderName}
                          {msg.senderRole !== 'siswa' && (
                            <span
                              className={`font-normal ${
                                isMine ? 'text-amber-200' : 'text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {' '}· {getRoleLabel(msg.senderRole)}
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {/* Forwarded tag */}
                    {msg.forwardedFrom && !msg.deleted && (
                      <p
                        className={`text-[10px] italic flex items-center gap-1 mb-1 ${
                          isMine ? 'text-emerald-100/80' : 'text-[#52705E] dark:text-[#8696A0]'
                        }`}
                      >
                        <CornerUpRight className="w-3 h-3" />
                        <span>Diteruskan dari {msg.forwardedFrom}</span>
                      </p>
                    )}

                    {/* Quoted Reply Block */}
                    {msg.replyTo && !msg.deleted && (
                      <div
                        className={`mb-1.5 pl-2.5 pr-2 py-1.5 rounded-lg border-l-4 text-xs ${
                          isMine
                            ? 'bg-black/15 border-amber-300 text-emerald-50'
                            : 'bg-[#F0F7F2] dark:bg-[#111B21] border-[#0B6B3A] dark:border-emerald-400 text-[#2F4F3C] dark:text-[#AEBAC1]'
                        }`}
                      >
                        <p className="font-bold text-[11px] truncate">{msg.replyTo.senderName}</p>
                        <p className="truncate opacity-90">
                          {msg.replyTo.text ||
                            (msg.replyTo.messageType === 'audio'
                              ? '🎤 Pesan suara'
                              : msg.replyTo.messageType === 'video'
                                ? '🎥 Video'
                                : '📷 Foto')}
                        </p>
                      </div>
                    )}

                    {/* Media Attachments */}
                    {!msg.deleted && msg.messageType === 'image' && msg.mediaUrls.length > 0 && (
                      <div
                        className={`grid gap-1.5 mb-1.5 ${
                          msg.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                        }`}
                      >
                        {msg.mediaUrls.map((url, idx) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() =>
                              setLightbox({
                                urls: msg.mediaUrls,
                                initialIndex: idx,
                                kind: 'image',
                                senderName: msg.senderName,
                              })
                            }
                            className="overflow-hidden rounded-xl border border-black/10 cursor-pointer block text-left"
                          >
                            <img
                              src={url}
                              alt={`Lampiran dari ${msg.senderName}`}
                              referrerPolicy="no-referrer"
                              className="w-full max-h-60 object-cover hover:scale-[1.02] transition-transform"
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    {!msg.deleted && msg.messageType === 'video' && msg.mediaUrls[0] && (
                      <div className="mb-1.5 space-y-1">
                        <video
                          src={msg.mediaUrls[0]}
                          controls
                          className="w-full max-w-[280px] max-h-56 rounded-xl bg-black"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setLightbox({
                              urls: msg.mediaUrls,
                              initialIndex: 0,
                              kind: 'video',
                              senderName: msg.senderName,
                            })
                          }
                          className={`text-[11px] underline cursor-pointer ${
                            isMine ? 'text-emerald-100' : 'text-[#0B6B3A] dark:text-emerald-400'
                          }`}
                        >
                          Buka video layar penuh
                        </button>
                      </div>
                    )}

                    {!msg.deleted && msg.messageType === 'audio' && msg.mediaUrls[0] && (
                      <AudioMessagePlayer
                        src={msg.mediaUrls[0]}
                        durationSec={msg.mediaDurationSec}
                        isMine={isMine}
                      />
                    )}

                    {/* Text Body */}
                    {(msg.text || msg.deleted) && (
                      <p
                        className={`text-sm whitespace-pre-wrap break-words leading-relaxed ${
                          msg.deleted ? 'italic opacity-75 text-xs' : ''
                        }`}
                      >
                        {msg.text}
                      </p>
                    )}

                    {/* Footer: Timestamp + Edited + Read Checks */}
                    <div
                      className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] font-mono-num ${
                        isMine ? 'text-emerald-100/85' : 'text-[#52705E] dark:text-[#8696A0]'
                      }`}
                    >
                      {Boolean(msg.editedAt) && !msg.deleted && <span>(diedit)</span>}
                      <span>{formatTimeOnly(msg.createdAt)}</span>
                      {isMine && !isLegacy && (
                        isReadByOther ? (
                          <CheckCheck className="w-3.5 h-3.5 text-sky-300" aria-label="Dibaca" />
                        ) : (
                          <Check className="w-3.5 h-3.5" aria-label="Terkirim" />
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Reactions Strip */}
                {reactionEntries.length > 0 && !msg.deleted && (
                  <div className={`flex flex-wrap gap-1 mt-1 px-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                    {reactionEntries.map(([emoji, uids]) => {
                      const iReacted = uids.includes(profile.uid);
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() =>
                            void toggleMessageReaction(room.roomId, msg.id, profile.uid, emoji, msg.reactions)
                          }
                          className={`px-2 py-0.5 rounded-full text-xs border flex items-center gap-1 cursor-pointer ${
                            iReacted
                              ? 'bg-[#E6F4EC] dark:bg-[#005C4B] border-[#0B6B3A] text-[#0B6B3A] dark:text-white'
                              : 'bg-white dark:bg-[#202C33] border-[#D3E6D8] dark:border-[#2A3942] text-[#0B2416] dark:text-[#E9EDEF]'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="font-mono-num text-[10px] font-semibold">{uids.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Reaction Popover */}
                {reactingMsgId === msg.id && !isLegacy && !msg.deleted && (
                  <div className="mt-1 px-2 py-1 rounded-full bg-white dark:bg-[#202C33] border border-[#D3E6D8] dark:border-[#2A3942] shadow-md flex items-center gap-1">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          void toggleMessageReaction(room.roomId, msg.id, profile.uid, emoji, msg.reactions);
                          setReactingMsgId(null);
                        }}
                        className="w-7 h-7 rounded-full hover:bg-[#F0F7F2] dark:hover:bg-[#2A3942] text-base flex items-center justify-center cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* Action Bar on Message */}
                {!msg.deleted && (
                  <div
                    className={`flex flex-wrap items-center gap-1 mt-0.5 px-1 text-[11px] opacity-85 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ${
                      isMine ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {!isLegacy && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setReplyTo({
                              id: msg.id,
                              senderName: msg.senderName,
                              text: msg.text.slice(0, 120),
                              messageType: msg.messageType,
                            })
                          }
                          className="p-1 text-[#52705E] dark:text-[#8696A0] hover:text-[#0B6B3A] cursor-pointer"
                          title="Balas pesan"
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setReactingMsgId((cur) => (cur === msg.id ? null : msg.id))}
                          className="p-1 text-[#52705E] dark:text-[#8696A0] hover:text-[#0B6B3A] cursor-pointer"
                          title="Beri reaksi emoji"
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setForwardMsg(msg)}
                          className="p-1 text-[#52705E] dark:text-[#8696A0] hover:text-[#0B6B3A] cursor-pointer"
                          title="Teruskan pesan"
                        >
                          <CornerUpRight className="w-3.5 h-3.5" />
                        </button>
                        {isStaff && (
                          <button
                            type="button"
                            onClick={() =>
                              void pinRoomMessage(
                                profile,
                                room.roomId,
                                msg.id,
                                msg.text || `[${msg.messageType}] dari ${msg.senderName}`
                              )
                            }
                            className="p-1 text-[#52705E] dark:text-[#8696A0] hover:text-amber-600 cursor-pointer"
                            title="Sematkan pesan"
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMsg(msg);
                          setText(msg.text);
                          setReplyTo(null);
                        }}
                        className="p-1 text-[#52705E] dark:text-[#8696A0] hover:text-[#0B6B3A] cursor-pointer"
                        title="Edit pesan"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ msg, isLegacy })}
                        className="p-1 text-[#52705E] dark:text-[#8696A0] hover:text-rose-600 cursor-pointer"
                        title="Hapus pesan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!isMine && (
                      <button
                        type="button"
                        onClick={() =>
                          setReportTarget({
                            uid: msg.senderId,
                            name: msg.senderName,
                            msgId: msg.id,
                            excerpt: msg.text.slice(0, 140) || `[${msg.messageType}]`,
                          })
                        }
                        className="p-1 text-[#52705E] dark:text-[#8696A0] hover:text-rose-600 cursor-pointer"
                        title="Laporkan atau blokir"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Inline C6A Bot & AI Responses inside Kelas 6A room */}
        {botReplies.map((reply) => (
          <div key={reply.id} className="flex flex-col items-start">
            <div
              className={`max-w-[90%] sm:max-w-[75%] rounded-2xl px-4 py-3 border ${
                reply.isError
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  : 'bg-[#EDF7F1] dark:bg-[#1D2B22] border-[#96CCA9] dark:border-[#2A3942] text-[#0B2416] dark:text-[#E9EDEF]'
              }`}
            >
              <div className="flex items-center justify-between gap-3 text-[11px] mb-1.5">
                <span className="font-semibold flex items-center gap-1.5">
                  {reply.source === 'bot' ? (
                    <>
                      <Terminal className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                      <span className="text-amber-800 dark:text-amber-300">Bot C6A v1</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-[#0B6B3A] dark:text-emerald-400" />
                      <span className="text-[#0B6B3A] dark:text-emerald-300">C6A AI v1</span>
                    </>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono-num opacity-75">{reply.timeLabel}</span>
                  <button
                    type="button"
                    onClick={() => setBotReplies((prev) => prev.filter((r) => r.id !== reply.id))}
                    className="cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{reply.text}</p>
            </div>
          </div>
        ))}

        {botThinking && (
          <div className="flex items-start">
            <div className="rounded-2xl px-4 py-2.5 bg-[#EDF7F1] dark:bg-[#1D2B22] border border-[#96CCA9] dark:border-[#2A3942] text-xs font-medium text-[#0B6B3A] dark:text-emerald-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>C6A AI sedang menyiapkan jawaban...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer Area */}
      <div className="p-2.5 sm:p-3.5 border-t border-[#D3E6D8] dark:border-[#2A3942] bg-[#F0F7F2] dark:bg-[#202C33] shrink-0 space-y-2">
        {errorMsg && (
          <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg(null)} className="font-semibold cursor-pointer">
              Tutup
            </button>
          </div>
        )}

        {partnerBlocked && dmPartner ? (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-[#182229] border border-amber-200 dark:border-[#2A3942] text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Ban className="w-4 h-4 shrink-0" />
              <span>Anda telah memblokir {getUserDisplayLabel(dmPartner)}. Buka blokir di menu Pengaturan untuk mengirim pesan.</span>
            </span>
          </div>
        ) : (
          <>
            {/* Reply or Edit Preview Strip */}
            {(replyTo || editingMsg) && (
              <div className="px-3 py-2 rounded-xl bg-white dark:bg-[#111B21] border-l-4 border-[#0B6B3A] dark:border-emerald-400 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-[#0B6B3A] dark:text-emerald-400">
                    {editingMsg ? 'Mengedit pesan Anda' : `Membalas ${replyTo?.senderName}`}
                  </p>
                  <p className="truncate text-[#52705E] dark:text-[#AEBAC1]">
                    {editingMsg ? editingMsg.text : replyTo?.text || '[Media]'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null);
                    setEditingMsg(null);
                    if (editingMsg) setText('');
                  }}
                  aria-label="Batalkan balas atau edit"
                  className="text-[#52705E] hover:text-[#0B2416] dark:text-[#AEBAC1] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Emoji Picker */}
            {emojiOpen && (
              <div className="p-3 rounded-2xl bg-white dark:bg-[#111B21] border border-[#D3E6D8] dark:border-[#2A3942] shadow-lg space-y-2 max-h-48 overflow-y-auto">
                {EMOJI_GROUPS.map((grp) => (
                  <div key={grp.label} className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#52705E] dark:text-[#8696A0]">
                      {grp.label}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {grp.emojis.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => notifyTyping(text + em)}
                          className="w-8 h-8 rounded-lg hover:bg-[#ECF7F1] dark:hover:bg-[#202C33] text-lg flex items-center justify-center cursor-pointer"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Voice Recorder Mode OR Standard Input Bar */}
            {voiceMode ? (
              <VoiceRecorderBar
                onSendVoiceNote={handleSendVoiceNote}
                onCancel={() => setVoiceMode(false)}
              />
            ) : (
              <form onSubmit={handleSendText} className="flex items-center gap-1.5 sm:gap-2">
                {/* Hidden File Inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  multiple
                  onChange={(e) => {
                    handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => setEmojiOpen((prev) => !prev)}
                  aria-label="Pilih emoji"
                  className={`min-h-[42px] min-w-[38px] sm:min-w-[42px] rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                    emojiOpen
                      ? 'bg-[#0B6B3A] text-white'
                      : 'text-[#52705E] dark:text-[#AEBAC1] hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  <Smile className="w-5 h-5" />
                </button>

                {allowMedia && !editingMsg && (
                  <>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      aria-label="Ambil foto dengan kamera"
                      title="Kamera"
                      className="min-h-[42px] min-w-[38px] sm:min-w-[42px] rounded-xl text-[#52705E] dark:text-[#AEBAC1] hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center cursor-pointer"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      aria-label="Pilih foto atau video dari galeri"
                      title="Galeri Foto / Video"
                      className="min-h-[42px] min-w-[38px] sm:min-w-[42px] rounded-xl text-[#52705E] dark:text-[#AEBAC1] hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center cursor-pointer"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                  </>
                )}

                <input
                  type="text"
                  maxLength={1500}
                  value={text}
                  onChange={(e) => notifyTyping(e.target.value)}
                  placeholder={
                    editingMsg
                      ? 'Edit teks pesan...'
                      : room.roomId === 'kelas-6a'
                        ? botAllowed
                          ? 'Ketik pesan, /rekap, atau @C6A...'
                          : 'Ketik pesan atau @C6A <tanya>...'
                        : 'Ketik pesan...'
                  }
                  className="flex-1 min-w-0 min-h-[42px] px-3.5 rounded-xl bg-white dark:bg-[#2A3942] border border-[#B9D8C2] dark:border-[#374248] text-sm text-[#0B2416] dark:text-white placeholder:text-[#6E8B79] dark:placeholder:text-[#8696A0] focus:outline-none focus:border-[#0B6B3A]"
                />

                {allowVoice && !text.trim() && !editingMsg ? (
                  <button
                    type="button"
                    onClick={() => setVoiceMode(true)}
                    aria-label="Rekam pesan suara"
                    title="Rekam Pesan Suara"
                    className="min-h-[42px] min-w-[42px] px-3 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] text-white flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={sending || !text.trim()}
                    aria-label="Kirim pesan"
                    className="min-h-[42px] min-w-[42px] px-3.5 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">{editingMsg ? 'Simpan' : 'Kirim'}</span>
                  </button>
                )}
              </form>
            )}
          </>
        )}
      </div>

      {/* Media Preview Modal */}
      <MediaPreviewModal
        items={pendingMedia}
        onRemoveItem={(id) =>
          setPendingMedia((prev) => {
            const removed = prev.find((p) => p.id === id);
            if (removed) URL.revokeObjectURL(removed.previewUrl);
            return prev.filter((p) => p.id !== id);
          })
        }
        onCancel={clearPendingMedia}
        onSend={handleSendPendingMedia}
        uploadProgress={uploadProgress}
        errorMsg={mediaError}
      />

      {/* Fullscreen Lightbox */}
      {lightbox && (
        <MediaLightbox
          urls={lightbox.urls}
          initialIndex={lightbox.initialIndex}
          kind={lightbox.kind}
          senderName={lightbox.senderName}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Pesan?"
        description={
          deleteTarget?.msg.senderId === profile.uid
            ? 'Pesan ini akan dihapus dari percakapan.'
            : 'Pesan ini melanggar aturan dan akan dihapus sebagai tindakan moderasi.'
        }
        confirmLabel="Hapus Pesan"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={deleteBusy}
      />

      {/* Forward Message Modal */}
      {forwardMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-[#0B2416]/50 backdrop-blur-sm" onClick={() => setForwardMsg(null)} />
          <div className="relative z-10 max-w-md w-full bg-white dark:bg-[#111B21] border border-[#D3E6D8] dark:border-[#2A3942] rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-[#0B2416] dark:text-white">Teruskan Pesan Ke...</h4>
              <button type="button" onClick={() => setForwardMsg(null)} className="cursor-pointer text-[#52705E]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-[#E6F2EA] dark:divide-[#2A3942]">
              {allRooms
                .filter((r) => r.roomId !== room.roomId)
                .map((target) => (
                  <button
                    key={target.roomId}
                    type="button"
                    disabled={forwardBusy}
                    onClick={() => void handleForwardToRoom(target)}
                    className="w-full py-3 px-2 text-left hover:bg-[#F0F7F2] dark:hover:bg-[#202C33] rounded-xl flex items-center justify-between gap-2 text-sm text-[#0B2416] dark:text-white cursor-pointer"
                  >
                    <span className="truncate font-semibold">{target.name}</span>
                    <CornerUpRight className="w-4 h-4 text-[#0B6B3A] shrink-0" />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Report & Block Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-[#0B2416]/50 backdrop-blur-sm" onClick={() => setReportTarget(null)} />
          <form
            onSubmit={handleSubmitReport}
            className="relative z-10 max-w-md w-full bg-white dark:bg-[#111B21] border border-[#D3E6D8] dark:border-[#2A3942] rounded-2xl p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-[#0B2416] dark:text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-rose-600" />
                <span>Laporkan {reportTarget.name}</span>
              </h4>
              <button type="button" onClick={() => setReportTarget(null)} className="cursor-pointer text-[#52705E]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportTarget.excerpt && (
              <p className="text-xs p-2.5 rounded-xl bg-[#F4F9F5] dark:bg-[#202C33] text-[#52705E] dark:text-[#AEBAC1] italic truncate">
                &ldquo;{reportTarget.excerpt}&rdquo;
              </p>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#2F4F3C] dark:text-[#AEBAC1]">
                Jenis Pelanggaran
              </label>
              <select
                value={reportCategory}
                onChange={(e) => setReportCategory(e.target.value as ReportCategory)}
                className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#202C33] border border-[#B9D8C2] dark:border-[#2A3942] text-sm text-[#0B2416] dark:text-white"
              >
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#2F4F3C] dark:text-[#AEBAC1]">
                Jelaskan Kejadian (Min. 5 karakter)
              </label>
              <textarea
                required
                minLength={5}
                maxLength={500}
                rows={3}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Contoh: Mengirim pesan berulang atau kata tidak sopan..."
                className="w-full p-3 rounded-xl bg-white dark:bg-[#202C33] border border-[#B9D8C2] dark:border-[#2A3942] text-sm text-[#0B2416] dark:text-white"
              />
            </div>

            <label className="flex items-center gap-2.5 text-xs text-[#2F4F3C] dark:text-[#AEBAC1] cursor-pointer">
              <input
                type="checkbox"
                checked={reportAlsoBlock}
                onChange={(e) => setReportAlsoBlock(e.target.checked)}
                className="w-4 h-4 accent-[#0B6B3A]"
              />
              <span>Blokir pengguna ini agar pesannya tidak muncul lagi</span>
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="min-h-[40px] px-4 rounded-xl text-xs font-semibold text-[#52705E] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={reportBusy}
                className="min-h-[40px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
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
