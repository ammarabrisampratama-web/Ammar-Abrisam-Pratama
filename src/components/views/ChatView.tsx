import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Loader2, MessageSquare, Search, Send, Sparkles, Terminal, Trash2, X } from 'lucide-react';
import { deleteChatMessage, sendChatMessage } from '../../services/firestoreService';
import type { ChatMessage, UserPublic } from '../../types';
import {
  buildSanitizedC6AContextSummary,
  canUseC6ABot,
  type C6AClassContextData,
  extractChatBotQuery,
  runC6ABotCommand,
} from '../../utils/c6aBot';
import { formatTimeOnly, getRoleLabel, getUserDisplayLabel, isAdminOrOwnerRole } from '../../utils/validation';
import { ConfirmModal } from '../ConfirmModal';

interface ChatViewProps {
  profile: UserPublic;
  messages: ChatMessage[];
  botContext?: C6AClassContextData;
  onOpenC6AAssistant?: () => void;
}

interface EphemeralBotReply {
  id: string;
  source: 'bot' | 'ai';
  prompt: string;
  text: string;
  timeLabel: string;
  isError?: boolean;
}

export function ChatView({
  profile,
  messages,
  botContext,
  onOpenC6AAssistant,
}: ChatViewProps) {
  const [text, setText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [botReplies, setBotReplies] = useState<EphemeralBotReply[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSentMsRef = useRef<number>(0);

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) => m.text.toLowerCase().includes(q) || m.senderName.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, botReplies.length, botThinking, searchQuery]);

  const botAllowed = canUseC6ABot(profile.role);

  const handleBotTrigger = async (submittedText: string) => {
    if (!botContext) return;
    const extracted = extractChatBotQuery(submittedText, profile.role);
    if (!extracted.isBotTrigger) return;

    const nowLabel = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

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

      let res = await fetch('/api/c6a/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requestBody,
          stream: true,
        }),
      });

      if (res.status === 504 || res.status === 502) {
        res = await fetch('/api/c6a/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...requestBody,
            stream: false,
            fastMode: true,
          }),
        });
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
          const fallbackMsg =
            res.status === 504
              ? 'Server C6A AI v1 melebihi batas waktu respon (HTTP 504). Silakan coba kirim ulang pesan yang lebih singkat.'
              : res.status >= 500
                ? `Gagal menghubungi C6A AI v1 (HTTP ${res.status}). Pastikan endpoint /api/c6a/chat sudah terdeploy dan GEMINI_API_KEY sudah diisi di Variabel Lingkungan server.`
                : `Gagal menghubungi C6A AI v1 (HTTP ${res.status}).`;
          throw new Error(payload.error || fallbackMsg);
        }
        setBotReplies((prev) => [
          ...prev.slice(-4),
          {
            id: replyId,
            source: 'ai',
            prompt: submittedText,
            text: payload.reply!,
            timeLabel: nowLabel,
          },
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

          const evt = JSON.parse(jsonStr) as {
            delta?: string;
            error?: string;
            done?: boolean;
          };

          if (evt.error) {
            throw new Error(evt.error);
          }

          if (evt.delta) {
            fullReply += evt.delta;
            if (!inserted) {
              inserted = true;
              setBotThinking(false);
              setBotReplies((prev) => [
                ...prev.slice(-4),
                {
                  id: replyId,
                  source: 'ai',
                  prompt: submittedText,
                  text: fullReply,
                  timeLabel: nowLabel,
                },
              ]);
            } else {
              setBotReplies((prev) =>
                prev.map((r) => (r.id === replyId ? { ...r, text: fullReply } : r))
              );
            }
          }
        }
      }

      if (!inserted) {
        throw new Error('C6A AI v1 belum menerima teks jawaban dari model.');
      }
    } catch (err) {
      setBotReplies((prev) => [
        ...prev.slice(-4),
        {
          id: `c6a-err-${Date.now()}`,
          source: 'ai',
          prompt: submittedText,
          text:
            err instanceof Error
              ? err.message
              : 'Terjadi kendala saat meminta jawaban dari C6A AI.',
          timeLabel: nowLabel,
          isError: true,
        },
      ]);
    } finally {
      setBotThinking(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const submittedText = text.trim();
    if (!submittedText || sending) return;
    const now = Date.now();
    if (now - lastSentMsRef.current < 2000) {
      setErrorMsg('Tunggu 2 detik sebelum mengirim pesan berikutnya.');
      return;
    }

    setErrorMsg(null);
    setSending(true);
    try {
      await sendChatMessage(profile, submittedText);
      lastSentMsRef.current = Date.now();
      setText('');
      void handleBotTrigger(submittedText);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengirim pesan.');
    } finally {
      setSending(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteChatMessage(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] lg:h-[calc(100vh-8.5rem)] bg-white border border-[#D3E6D8] rounded-2xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 bg-[#F0F7F2] border-b border-[#E2EFE6] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="w-5 h-5 text-[#0B6B3A]" />
          <div>
            <h2 className="text-base font-bold text-[#0B2416]">Chat Kelas 6A</h2>
            <p className="text-xs text-[#52705E]">
              {botAllowed
                ? 'Diskusi kelas · Ketik /rekap, /jadwal, /tugas, atau @C6A untuk panggil asisten.'
                : 'Diskusi kelas · Ketik @C6A <pertanyaan> untuk tanya C6A AI v1.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenC6AAssistant && (
            <button
              type="button"
              onClick={onOpenC6AAssistant}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white hover:bg-[#E6F4EC] border border-[#96CCA9] text-xs font-semibold text-[#0B6B3A] flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{botAllowed ? 'Bot & AI C6A v1' : 'C6A AI v1'}</span>
            </button>
          )}

          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-[#52705E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari isi chat..."
              aria-label="Cari pesan chat kelas"
              className="w-full min-h-[38px] pl-9 pr-3 rounded-xl bg-white border border-[#B9D8C2] text-xs text-[#0B2416] placeholder:text-[#6E8B79] focus:outline-none focus:border-[#0B6B3A]"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#F8FCF9]">
        {filteredMessages.length === 0 && botReplies.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#52705E] space-y-1">
            <MessageSquare className="w-8 h-8 text-[#96CCA9]" />
            <p className="text-sm font-medium text-[#2F4F3C]">
              {searchQuery.trim() ? 'Tidak ada pesan yang cocok.' : 'Belum ada percakapan di ruang kelas.'}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMine = msg.senderId === profile.uid;
            const canDelete = isMine || isAdminOrOwnerRole(profile.role);

            return (
              <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 border ${
                    isMine
                      ? 'bg-[#0B6B3A] border-[#0B6B3A] text-white'
                      : 'bg-white border-[#D3E6D8] text-[#0B2416]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[11px] mb-1">
                    <span className={`font-semibold ${isMine ? 'text-emerald-100' : 'text-[#0B6B3A]'}`}>
                      {msg.senderName}
                      {msg.senderRole !== 'siswa' && (
                        <span className={`font-normal ${isMine ? 'text-amber-200' : 'text-amber-700'}`}>
                          {' '}· {getRoleLabel(msg.senderRole)}
                        </span>
                      )}
                    </span>
                    <span className={`font-mono-num ${isMine ? 'text-emerald-100/80' : 'text-[#52705E]'}`}>
                      {formatTimeOnly(msg.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(msg)}
                        aria-label="Hapus pesan"
                        className={`p-1 shrink-0 cursor-pointer ${
                          isMine
                            ? 'text-emerald-100 hover:text-white'
                            : 'text-[#52705E] hover:text-rose-600'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Inline C6A Bot & AI Responses */}
        {botReplies.map((reply) => (
          <div key={reply.id} className="flex flex-col items-start">
            <div
              className={`max-w-[90%] sm:max-w-[75%] rounded-2xl px-4 py-3 border ${
                reply.isError
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-[#EDF7F1] border-[#96CCA9] text-[#0B2416]'
              }`}
            >
              <div className="flex items-center justify-between gap-3 text-[11px] mb-1.5">
                <span className="font-semibold flex items-center gap-1.5">
                  {reply.source === 'bot' ? (
                    <>
                      <Terminal className="w-3.5 h-3.5 text-amber-700" />
                      <span className="text-amber-800">Bot C6A v1</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-[#0B6B3A]" />
                      <span className="text-[#0B6B3A]">C6A AI v1</span>
                    </>
                  )}
                  <span className="text-[#52705E] font-normal">· Respons untuk Anda</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono-num text-[#52705E]">{reply.timeLabel}</span>
                  <button
                    type="button"
                    onClick={() => setBotReplies((prev) => prev.filter((r) => r.id !== reply.id))}
                    aria-label="Tutup balasan C6A"
                    className="text-[#52705E] hover:text-[#0B2416] cursor-pointer"
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
            <div className="rounded-2xl px-4 py-2.5 bg-[#EDF7F1] border border-[#96CCA9] text-xs font-medium text-[#0B6B3A] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>C6A AI sedang menyiapkan jawaban...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 sm:p-4 border-t border-[#E2EFE6] bg-[#F0F7F2] shrink-0 space-y-2">
        {errorMsg && <p className="text-xs text-rose-700 px-1">{errorMsg}</p>}
        <div className="flex items-center gap-2.5">
          <input
            type="text"
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              botAllowed
                ? 'Tulis pesan, /rekap, /jadwal, /tugas, atau @C6A <pertanyaan>...'
                : 'Tulis pesan atau @C6A <pertanyaan> untuk tanya C6A AI v1...'
            }
            aria-label="Tulis pesan chat kelas"
            className="flex-1 min-h-[44px] px-4 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] placeholder:text-[#6E8B79] focus:outline-none focus:border-[#0B6B3A]"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            aria-label="Kirim pesan"
            className="min-h-[44px] px-4 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-50 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Kirim</span>
          </button>
        </div>
      </form>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Pesan Chat?"
        description="Yakin ingin menghapus pesan ini dari ruang chat kelas?"
        confirmLabel="Hapus Pesan"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={deleteBusy}
      />
    </div>
  );
}
