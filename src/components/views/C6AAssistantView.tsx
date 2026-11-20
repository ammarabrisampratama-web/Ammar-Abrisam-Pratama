import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Bot, Loader2, RotateCcw, Send, Sparkles, Terminal } from 'lucide-react';
import type { C6AConversationMessage, UserPublic } from '../../types';
import {
  buildSanitizedC6AContextSummary,
  canUseC6ABot,
  type C6AClassContextData,
  runC6ABotCommand,
} from '../../utils/c6aBot';
import { getUserDisplayLabel } from '../../utils/validation';

interface C6AAssistantViewProps {
  profile: UserPublic;
  classContext: C6AClassContextData;
}

const QUICK_BOT_COMMANDS = [
  { label: '/menu', cmd: '/menu' },
  { label: '/rekap', cmd: '/rekap' },
  { label: '/jadwal', cmd: '/jadwal' },
  { label: '/jadwal besok', cmd: '/jadwal besok' },
  { label: '/jadwal lengkap', cmd: '/jadwal lengkap' },
  { label: '/tugas', cmd: '/tugas' },
  { label: '/tugas terlambat', cmd: '/tugas terlambat' },
  { label: '/pengumuman', cmd: '/pengumuman' },
  { label: '/agenda', cmd: '/agenda' },
  { label: '/kas', cmd: '/kas' },
  { label: '/anggota', cmd: '/anggota' },
  { label: '/pesan', cmd: '/pesan' },
];

const AI_STARTER_PROMPTS = [
  'Ringkas jadwal hari ini & besok beserta tugas terdekat',
  'Jelaskan cara menghitung pecahan, desimal, dan persen kelas 6',
  'Buatkan 3 soal latihan IPAS kelas 6 beserta kunci dan pembahasannya',
];

function formatNowTimeLabel(): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

function createWelcomeMessage(nickname: string, botAllowed: boolean): C6AConversationMessage {
  return {
    id: 'c6a-welcome',
    role: 'model',
    source: botAllowed ? 'bot' : 'ai',
    createdAtLabel: formatNowTimeLabel(),
    text: botAllowed
      ? [
          `Halo ${nickname}! Selamat datang di Bot C6A v1 & C6A AI v1 resmi Kelas 6A MI Al-Hidayah Sawotratap.`,
          'Sebagai Admin/Owner, Anda dapat memakai perintah cepat Bot C6A v1 (/rekap, /jadwal besok, /tugas terlambat, /kas, /anggota, /pesan) maupun bertanya langsung ke C6A AI v1.',
        ].join('\n\n')
      : [
          `Halo ${nickname}! Saya C6A AI v1, asisten belajar pintar Kelas 6A MI Al-Hidayah Sawotratap.`,
          'Tulis pertanyaan apa saja seputar jadwal, tugas, agenda kelas, atau materi pelajaran kelas 6 untuk dibantu langsung oleh C6A AI v1.',
        ].join('\n\n'),
  };
}

export function C6AAssistantView({ profile, classContext }: C6AAssistantViewProps) {
  const nickname = getUserDisplayLabel(profile);
  const botAllowed = canUseC6ABot(profile.role);

  const [messages, setMessages] = useState<C6AConversationMessage[]>(() => [
    createWelcomeMessage(nickname, botAllowed),
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  const contextSummary = useMemo(
    () => buildSanitizedC6AContextSummary(classContext),
    [classContext]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, busy]);

  const submitQuery = async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed || busy) return;

    setErrorMsg(null);
    const userMsg: C6AConversationMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      source: 'user',
      text: trimmed,
      createdAtLabel: formatNowTimeLabel(),
    };

    if (trimmed.startsWith('/')) {
      const botRes = runC6ABotCommand(trimmed, classContext, profile.role);
      const botMsg: C6AConversationMessage = {
        id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'model',
        source: botAllowed ? 'bot' : 'ai',
        text: botRes.reply,
        createdAtLabel: formatNowTimeLabel(),
      };
      setMessages((prev) => [...prev, userMsg, botMsg]);
      setInput('');
      return;
    }

    const historyForServer = messages
      .filter((m) => m.id !== 'c6a-welcome')
      .slice(-10)
      .map((m) => ({ role: m.role, text: m.text }));

    const aiMsgId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const aiTimeLabel = formatNowTimeLabel();

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setBusy(true);
    setStreamingMsgId(null);

    try {
      const requestBody = {
        message: trimmed,
        history: historyForServer,
        contextSummary,
        userLabel: nickname,
        userRole: profile.role,
      };

      let res = await fetch('/api/c6a/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...requestBody,
          stream: true,
        }),
      });

      if (res.status === 504 || res.status === 502) {
        res = await fetch('/api/c6a/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
        setMessages((prev) => [
          ...prev,
          {
            id: aiMsgId,
            role: 'model',
            source: 'ai',
            text: payload.reply!,
            createdAtLabel: aiTimeLabel,
          },
        ]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullReply = '';
      let insertedBubble = false;

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
            if (!insertedBubble) {
              insertedBubble = true;
              setStreamingMsgId(aiMsgId);
              setMessages((prev) => [
                ...prev,
                {
                  id: aiMsgId,
                  role: 'model',
                  source: 'ai',
                  text: fullReply,
                  createdAtLabel: aiTimeLabel,
                },
              ]);
            } else {
              setMessages((prev) =>
                prev.map((m) => (m.id === aiMsgId ? { ...m, text: fullReply } : m))
              );
            }
          }
        }
      }

      if (!insertedBubble) {
        throw new Error('C6A AI belum menerima teks jawaban dari model.');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Terjadi gangguan saat menghubungi C6A AI.'
      );
    } finally {
      setBusy(false);
      setStreamingMsgId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitQuery(input);
  };

  const handleReset = () => {
    setErrorMsg(null);
    setStreamingMsgId(null);
    setMessages([createWelcomeMessage(nickname, botAllowed)]);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)] min-h-[440px] lg:h-[calc(100vh-8.5rem)] bg-white border border-[#D3E6D8] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-3.5 sm:px-5 py-3 bg-[#F0F7F2] border-b border-[#E2EFE6] flex items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#0B6B3A] flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[#0B2416] flex items-center gap-1.5 flex-wrap">
              <span>{botAllowed ? 'Bot & AI C6A v1' : 'C6A AI v1'}</span>
              <span className="text-[11px] font-semibold text-amber-700">Kelas 6A</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-[#52705E] truncate">
              {botAllowed
                ? 'Bot C6A v1 (Admin/Owner) & C6A AI v1.'
                : 'Asisten tanya jawab materi & info Kelas 6A (v1).'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          disabled={busy}
          aria-label="Bersihkan Chat"
          className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-[#E6F4EC] border border-[#C6E0CE] text-xs font-semibold text-[#0B2416] flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#0B6B3A]" />
          <span className="hidden sm:inline">Bersihkan Chat</span>
          <span className="sm:hidden">Reset</span>
        </button>
      </div>

      {/* Quick Commands Bar */}
      <div className="px-4 sm:px-5 py-2.5 border-b border-[#E6F2EA] bg-[#F8FCF9] shrink-0 space-y-2">
        {botAllowed && (
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="text-[11px] font-semibold text-[#52705E] flex items-center gap-1 shrink-0">
              <Terminal className="w-3.5 h-3.5 text-[#0B6B3A]" />
              <span>Bot v1:</span>
            </span>
            {QUICK_BOT_COMMANDS.map((item) => (
              <button
                key={item.cmd}
                type="button"
                disabled={busy}
                onClick={() => void submitQuery(item.cmd)}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-white hover:bg-[#E6F4EC] border border-[#C6E0CE] text-xs font-mono-num font-medium text-[#0B6B3A] whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="text-[11px] font-semibold text-[#52705E] flex items-center gap-1 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>AI v1:</span>
          </span>
          {AI_STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={busy}
              onClick={() => void submitQuery(prompt)}
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-white hover:bg-[#E6F4EC] border border-[#D3E6D8] text-xs text-[#2F4F3C] whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation Timeline */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-[#F8FCF9]">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isStreamingThis = streamingMsgId === msg.id;
          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[90%] sm:max-w-[78%] rounded-2xl px-4 py-3 border ${
                  isUser
                    ? 'bg-[#0B6B3A] border-[#0B6B3A] text-white'
                    : 'bg-white border-[#D3E6D8] text-[#0B2416]'
                }`}
              >
                <div className="flex items-center justify-between gap-4 text-[11px] mb-1.5">
                  <span className="font-semibold flex items-center gap-1.5">
                    {isUser ? (
                      <span className="text-emerald-100">{nickname}</span>
                    ) : msg.source === 'bot' ? (
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
                  </span>
                  <span className={`font-mono-num ${isUser ? 'text-emerald-100/80' : 'text-[#52705E]'}`}>
                    {isStreamingThis ? 'mengetik...' : msg.createdAtLabel}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {msg.text}
                </p>
              </div>
            </div>
          );
        })}

        {busy && !streamingMsgId && (
          <div className="flex items-start">
            <div className="rounded-2xl px-4 py-3 bg-[#EDF7F1] border border-[#96CCA9] text-xs font-medium text-[#0B6B3A] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>C6A AI sedang menyiapkan jawaban...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div
          role="alert"
          className="mx-4 mb-2 px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 shrink-0"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-3 sm:p-4 border-t border-[#E2EFE6] bg-[#F0F7F2] shrink-0"
      >
        <div className="flex items-center gap-2.5">
          <input
            type="text"
            maxLength={2000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              botAllowed
                ? 'Ketik /rekap, /jadwal, /tugas, /kas atau tanya C6A AI v1...'
                : 'Tulis pertanyaan pelajaran atau info Kelas 6A untuk C6A AI v1...'
            }
            aria-label="Tulis perintah atau pertanyaan untuk C6A"
            disabled={busy}
            className="flex-1 min-h-[44px] px-4 rounded-xl bg-white border border-[#B9D8C2] text-sm text-[#0B2416] placeholder:text-[#6E8B79] focus:outline-none focus:border-[#0B6B3A] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Kirim ke C6A"
            className="min-h-[44px] px-4 rounded-xl bg-[#0B6B3A] hover:bg-[#09562E] disabled:opacity-50 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer shrink-0"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline">Kirim</span>
          </button>
        </div>
      </form>
    </div>
  );
}
