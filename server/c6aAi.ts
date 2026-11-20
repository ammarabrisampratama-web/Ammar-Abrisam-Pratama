import { type GenerateContentResponse, GoogleGenAI, ThinkingLevel } from '@google/genai';

export const MODEL_NAME = 'gemini-3.1-flash-lite';

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

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
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

export function mapGeminiError(error: unknown): { status: number; message: string } {
  const msg = error instanceof Error ? error.message : String(error);
  console.error('C6A AI Error:', msg);

  if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
    return {
      status: 403,
      message:
        'Kunci API Gemini tidak valid atau ditolak. Periksa pengaturan GEMINI_API_KEY di Environment Variables / Secrets.',
    };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return {
      status: 429,
      message:
        'Kuota permintaan C6A AI sedang penuh sementara. Tunggu beberapa saat lalu coba lagi.',
    };
  }
  if (msg.includes('NOT_FOUND') || msg.includes('404')) {
    return {
      status: 404,
      message: 'Model C6A AI tidak ditemukan atau belum tersedia.',
    };
  }
  return {
    status: 500,
    message: 'Terjadi gangguan saat menghubungi layanan C6A AI. Silakan coba kembali.',
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

export function parseC6AChatBody(rawBody: unknown): {
  ok: true;
  data: ParsedC6ARequest;
} | {
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
      error: 'Pesan untuk C6A AI harus diisi (maksimal 2.000 karakter).',
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
    'Kamu adalah C6A AI, asisten pintar resmi untuk portal digital Kelas 6A MI Al-Hidayah Sawotratap.',
    'Gunakan Bahasa Indonesia yang ramah, santun, ringkas, langsung ke inti jawaban, dan mudah dipahami siswa kelas 6 MI serta Wali Kelas/Admin.',
    'Aturan:',
    '1) Jawab pertanyaan seputar jadwal pelajaran, tugas sekolah, pengumuman, agenda, dan ringkasan kas berdasarkan konteks kelas yang diberikan.',
    '2) Bantu siswa memahami materi pelajaran kelas 6 MI dengan langkah singkat dan jelas.',
    '3) Jika data yang ditanyakan tidak ada dalam konteks kelas, sampaikan dengan jujur bahwa data belum tersedia dan jangan mengarang jadwal, jam, atau nominal.',
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

export function createC6AChatSession(ai: GoogleGenAI, parsed: ParsedC6ARequest) {
  return ai.chats.create({
    model: MODEL_NAME,
    history: parsed.history,
    config: {
      systemInstruction: parsed.systemInstruction,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.MINIMAL,
      },
    },
  });
}

export function extractChunkText(chunk: unknown): string {
  const c = chunk as GenerateContentResponse;
  return c.text ?? '';
}
