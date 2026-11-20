import { type GenerateContentResponse, GoogleGenAI, ThinkingLevel } from '@google/genai';

export const MODEL_NAME = 'gemini-4-hydrogen';
export const FALLBACK_MODEL_NAME = 'gemini-3.1-flash-lite';
export const C6A_AI_VERSION = 'C6A AI v1';

export interface ChatTurnInput {
  role: 'user' | 'model';
  text: string;
}

export interface C6AChatRequestBody {
  message?: unknown;
  history?: unknown;
  contextSummary?: unknown;
  userLabel?: unknown;
  userRole?: unknown;
  stream?: unknown;
}

export interface ParsedC6ARequest {
  message: string;
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  systemInstruction: string;
  wantsStream: boolean;
}

let cachedClient: { apiKey: string; ai: GoogleGenAI } | null = null;

export function resolveGeminiApiKey(): string | null {
  const raw = (process.env.GEMINI_API_KEY ?? process.env.API_KEY ?? '').trim();
  const cleaned = raw
    .replace(/^GEMINI_API_KEY\s*=\s*/i, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
  if (!cleaned || cleaned === 'MY_GEMINI_API_KEY' || cleaned === 'YOUR_GEMINI_API_KEY') {
    return null;
  }
  return cleaned;
}

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) return null;
  if (cachedClient && cachedClient.apiKey === apiKey) {
    return cachedClient.ai;
  }
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  cachedClient = { apiKey, ai };
  return ai;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const num = Number((error as { status?: unknown }).status);
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
}

function sanitizeErrorDetail(error: unknown): string {
  const status = getErrorStatus(error);
  const rawMsg = error instanceof Error ? error.message : String(error);
  const causeCode =
    typeof error === 'object' &&
    error !== null &&
    'cause' in error &&
    typeof (error as { cause?: { code?: unknown } }).cause?.code === 'string'
      ? (error as { cause?: { code?: string } }).cause?.code
      : undefined;

  const redacted = rawMsg
    .replace(/AIza[A-Za-z0-9_-]{10,}/g, '[REDACTED_KEY]')
    .replace(/AQ\.[A-Za-z0-9_.-]{10,}/g, '[REDACTED_KEY]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);

  const parts = [
    status ? `HTTP ${status}` : undefined,
    causeCode ? `Code ${causeCode}` : undefined,
    redacted || undefined,
  ].filter(Boolean);

  return parts.join(' · ') || 'Unknown error';
}

export function isTransientOrModelError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const msg = (error instanceof Error ? error.message : String(error)).toUpperCase();
  if (status === 400 || status === 401 || status === 403 || status === 429) {
    return false;
  }
  if (
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API KEY NOT VALID') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('ACCESS_DENIED') ||
    msg.includes('RESOURCE_EXHAUSTED')
  ) {
    return false;
  }
  return (
    status === 404 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    msg.includes('NOT_FOUND') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('INTERNAL') ||
    msg.includes('OVERLOADED') ||
    msg.includes('FETCH FAILED')
  );
}

export function mapGeminiError(error: unknown): { status: number; message: string } {
  const status = getErrorStatus(error);
  const msg = error instanceof Error ? error.message : String(error);
  const upper = msg.toUpperCase();

  if (
    status === 401 ||
    upper.includes('UNAUTHENTICATED') ||
    upper.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API KEY NOT VALID')
  ) {
    console.warn(`C6A AI v1 Auth/Key Notice (HTTP ${status ?? 401}): API key invalid or unsupported.`);
    const isAqKey = resolveGeminiApiKey()?.startsWith('AQ.');
    return {
      status: 401,
      message: isAqKey
        ? 'Kunci API yang terpasang berawalan "AQ." dan ditolak oleh layanan Gemini (HTTP 401). Gunakan Gemini API Key dari Google AI Studio (aistudio.google.com/apikey) yang berawalan "AIza...", lalu pasang di Secrets AI Studio / Variabel Lingkungan Vercel dan muat ulang.'
        : 'Kunci API Gemini (GEMINI_API_KEY) belum valid atau ditolak (HTTP 401). Pastikan memakai Gemini API Key berawalan "AIza..." dari aistudio.google.com/apikey di Secrets (AI Studio) atau Variabel Lingkungan (Vercel), lalu muat ulang/Redeploy.',
    };
  }
  if (status === 400 || upper.includes('INVALID_ARGUMENT')) {
    console.warn(`C6A AI v1 Bad Request (HTTP 400): ${sanitizeErrorDetail(error)}`);
    return {
      status: 400,
      message:
        'Permintaan ke C6A AI v1 tidak valid (HTTP 400). Periksa kembali format pertanyaan atau konfigurasi GEMINI_API_KEY.',
    };
  }
  if (
    status === 403 ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('ACCESS_DENIED') ||
    upper.includes('403')
  ) {
    console.warn(`C6A AI v1 Permission Denied (HTTP ${status ?? 403}).`);
    return {
      status: 403,
      message:
        'Akses ke layanan Gemini ditolak (HTTP 403). Periksa GEMINI_API_KEY di Settings > Secrets atau Environment Variables Vercel lalu Redeploy.',
    };
  }
  if (status === 429 || upper.includes('RESOURCE_EXHAUSTED') || upper.includes('429')) {
    console.warn('C6A AI v1 Quota Exhausted (HTTP 429).');
    return {
      status: 429,
      message:
        'Kuota permintaan C6A AI v1 sedang penuh sementara (HTTP 429). Tunggu beberapa saat lalu coba lagi.',
    };
  }
  if (status === 404 || upper.includes('NOT_FOUND') || upper.includes('404')) {
    console.warn(`C6A AI v1 Model Not Found (HTTP 404): ${MODEL_NAME}.`);
    return {
      status: 404,
      message: `Model C6A AI v1 (${MODEL_NAME}) belum tersedia pada kunci API saat ini (HTTP 404).`,
    };
  }
  const detail = sanitizeErrorDetail(error);
  console.error('C6A AI v1 Unexpected Error:', detail);
  return {
    status: 500,
    message: `Terjadi gangguan saat menghubungi layanan C6A AI v1 (${detail}).`,
  };
}

export function sanitizeHistory(
  raw: unknown
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  if (!Array.isArray(raw)) return [];
  const cleaned: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  for (const item of raw.slice(-12)) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<ChatTurnInput>;
    if ((candidate.role === 'user' || candidate.role === 'model') && typeof candidate.text === 'string') {
      const text = candidate.text.trim().slice(0, 2000);
      if (text) {
        cleaned.push({ role: candidate.role, parts: [{ text }] });
      }
    }
  }
  return cleaned;
}

export function parseC6AChatBody(rawBody: unknown):
  | {
      ok: true;
      data: ParsedC6ARequest;
    }
  | {
      ok: false;
      status: number;
      error: string;
    } {
  const body = (rawBody ?? {}) as C6AChatRequestBody;
  const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';

  if (!rawMessage || rawMessage.length > 2000) {
    return {
      ok: false,
      status: 400,
      error: 'Pesan untuk C6A AI v1 harus diisi (maksimal 2.000 karakter).',
    };
  }

  const userLabel =
    typeof body.userLabel === 'string' && body.userLabel.trim()
      ? body.userLabel.trim().slice(0, 60)
      : 'Anggota Kelas 6A';
  const userRole =
    body.userRole === 'owner' || body.userRole === 'admin' || body.userRole === 'siswa'
      ? body.userRole
      : 'siswa';
  const contextSummary =
    typeof body.contextSummary === 'string'
      ? body.contextSummary.trim().slice(0, 4000)
      : '';

  const systemInstruction = [
    'Kamu adalah C6A AI v1, asisten pintar resmi Portal Digital Kelas 6A MI Al-Hidayah Sawotratap (Berilmu, Berakhlak, Berprestasi).',
    'Gunakan Bahasa Indonesia yang ramah, santun, terstruktur, ringkas, dan mudah dipahami siswa kelas 6 MI serta Wali Kelas/Admin.',
    'Kemampuan & Aturan:',
    '1) Ringkas dan jawab pertanyaan seputar jadwal pelajaran (Senin–Sabtu), tugas sekolah, pengumuman, agenda, dan rekap kas berdasarkan konteks kelas yang tersedia.',
    '2) Bantu siswa memahami pelajaran kelas 6 MI (Matematika, IPAS, Bahasa Indonesia, Bahasa Inggris, Bahasa Jawa, Bahasa Arab, Pancasila, PJOK, TIK, Seni Budaya, Al-Qur\'an Hadis, Akidah, Fikih, SKI, BTQ, Aswaja) dengan langkah singkat, contoh sederhana, dan soal latihan bila diminta.',
    '3) Jika data kelas (seperti jam pelajaran yang masih "Belum diatur") tidak tersedia di konteks, sampaikan jujur dan jangan pernah mengarang jadwal, jam, atau nominal.',
    '4) Jangan pernah meminta atau menampilkan kata sandi, PIN, atau email pribadi pengguna.',
    `Pengguna saat ini: "${userLabel}" (peran: "${userRole}").`,
    contextSummary ? `\nKonteks Kelas 6A terkini:\n${contextSummary}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    ok: true,
    data: {
      message: rawMessage,
      history: sanitizeHistory(body.history),
      systemInstruction,
      wantsStream: body.stream === true,
    },
  };
}

export function createC6AChatSession(
  ai: GoogleGenAI,
  parsed: ParsedC6ARequest,
  modelName: string = MODEL_NAME
) {
  return ai.chats.create({
    model: modelName,
    history: parsed.history,
    config: {
      systemInstruction: parsed.systemInstruction,
      ...(modelName === MODEL_NAME
        ? {
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
            },
          }
        : {}),
    },
  });
}

async function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startC6AStreamWithFallback(
  ai: GoogleGenAI,
  parsed: ParsedC6ARequest
): Promise<{ stream: AsyncIterable<unknown>; modelUsed: string }> {
  const attempts: Array<{ model: string; waitBeforeMs: number }> = [
    { model: MODEL_NAME, waitBeforeMs: 0 },
    { model: MODEL_NAME, waitBeforeMs: 350 },
    { model: FALLBACK_MODEL_NAME, waitBeforeMs: 0 },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    if (attempt.waitBeforeMs > 0) {
      await delayMs(attempt.waitBeforeMs);
    }
    try {
      const chat = createC6AChatSession(ai, parsed, attempt.model);
      const stream = await chat.sendMessageStream({ message: parsed.message });
      return { stream, modelUsed: attempt.model };
    } catch (err) {
      lastError = err;
      if (!isTransientOrModelError(err)) {
        throw err;
      }
    }
  }
  throw lastError;
}

export async function sendC6AMessageWithFallback(
  ai: GoogleGenAI,
  parsed: ParsedC6ARequest
): Promise<{ response: GenerateContentResponse; modelUsed: string }> {
  const attempts: Array<{ model: string; waitBeforeMs: number }> = [
    { model: MODEL_NAME, waitBeforeMs: 0 },
    { model: MODEL_NAME, waitBeforeMs: 350 },
    { model: FALLBACK_MODEL_NAME, waitBeforeMs: 0 },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    if (attempt.waitBeforeMs > 0) {
      await delayMs(attempt.waitBeforeMs);
    }
    try {
      const chat = createC6AChatSession(ai, parsed, attempt.model);
      const response = await chat.sendMessage({ message: parsed.message });
      return { response, modelUsed: attempt.model };
    } catch (err) {
      lastError = err;
      if (!isTransientOrModelError(err)) {
        throw err;
      }
    }
  }
  throw lastError;
}

export function extractChunkText(chunk: unknown): string {
  const c = chunk as GenerateContentResponse;
  return c.text ?? '';
}
