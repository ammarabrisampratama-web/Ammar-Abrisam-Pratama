import { Buffer } from 'node:buffer';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { type GenerateContentResponse, GoogleGenAI, ThinkingLevel } from '@google/genai';

const MODEL_NAME = 'gemini-4-hydrogen';

interface VercelNodeRequest extends IncomingMessage {
  body?: unknown;
}

interface ChatTurnInput {
  role: 'user' | 'model';
  text: string;
}

interface C6AChatRequestBody {
  message?: unknown;
  history?: unknown;
  contextSummary?: unknown;
  userLabel?: unknown;
  userRole?: unknown;
  stream?: unknown;
}

let cachedClient: { apiKey: string; ai: GoogleGenAI } | null = null;

function resolveGeminiApiKey(): string | null {
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

function getGeminiClient(): GoogleGenAI | null {
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

function mapGeminiError(error: unknown): { status: number; message: string } {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
  const msg = error instanceof Error ? error.message : String(error);
  const upper = msg.toUpperCase();

  if (
    status === 401 ||
    upper.includes('UNAUTHENTICATED') ||
    upper.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API KEY NOT VALID')
  ) {
    console.warn(`Vercel C6A AI v1 Auth/Key Notice (HTTP ${status ?? 401}): API key invalid or unsupported.`);
    const isAqKey = resolveGeminiApiKey()?.startsWith('AQ.');
    return {
      status: 401,
      message: isAqKey
        ? 'Kunci API yang terpasang berawalan "AQ." dan ditolak oleh layanan Gemini (HTTP 401). Gunakan Gemini API Key dari Google AI Studio (aistudio.google.com/apikey) yang berawalan "AIza...", lalu pasang di Environment Variables Vercel dan Redeploy.'
        : 'Kunci API Gemini (GEMINI_API_KEY) belum valid atau ditolak (HTTP 401). Pastikan memakai Gemini API Key berawalan "AIza..." di Environment Variables Vercel lalu Redeploy.',
    };
  }
  if (status === 400 || upper.includes('INVALID_ARGUMENT')) {
    console.warn('Vercel C6A AI v1 Bad Request (HTTP 400).');
    return {
      status: 400,
      message:
        'Permintaan ke C6A AI v1 tidak valid (HTTP 400). Periksa kembali pertanyaan atau konfigurasi GEMINI_API_KEY di Vercel.',
    };
  }
  if (
    status === 403 ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('ACCESS_DENIED') ||
    upper.includes('403')
  ) {
    console.warn(`Vercel C6A AI v1 Permission Denied (HTTP ${status ?? 403}).`);
    return {
      status: 403,
      message:
        'Akses ke layanan Gemini ditolak (HTTP 403). Periksa GEMINI_API_KEY di Environment Variables Vercel lalu Redeploy.',
    };
  }
  if (status === 429 || upper.includes('RESOURCE_EXHAUSTED') || upper.includes('429')) {
    console.warn('Vercel C6A AI v1 Quota Exhausted (HTTP 429).');
    return {
      status: 429,
      message:
        'Kuota permintaan C6A AI v1 sedang penuh sementara (HTTP 429). Tunggu beberapa saat lalu coba lagi.',
    };
  }
  if (status === 404 || upper.includes('NOT_FOUND') || upper.includes('404')) {
    console.warn(`Vercel C6A AI v1 Model Not Found (HTTP 404): ${MODEL_NAME}.`);
    return {
      status: 404,
      message: `Model C6A AI v1 (${MODEL_NAME}) belum tersedia pada kunci API saat ini (HTTP 404).`,
    };
  }
  console.error('Vercel C6A AI v1 Error:', status ?? '', msg);
  return {
    status: 500,
    message:
      'Terjadi gangguan saat menghubungi layanan C6A AI v1. Pastikan GEMINI_API_KEY di Vercel valid lalu coba kembali.',
  };
}

function sanitizeHistory(
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

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>): void {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: VercelNodeRequest): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
    totalBytes += buf.length;
    if (totalBytes > 1024 * 1024) {
      throw new Error('Payload terlalu besar (maksimal 1MB).');
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default async function handler(req: VercelNodeRequest, res: ServerResponse): Promise<void> {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      sendJson(res, 405, { error: 'Metode tidak diizinkan. Gunakan POST.' });
      return;
    }

    let rawBody: unknown;
    try {
      rawBody = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 413, {
        error: err instanceof Error ? err.message : 'Permintaan tidak valid.',
      });
      return;
    }

    const body = (rawBody ?? {}) as C6AChatRequestBody;
    const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';
    if (!rawMessage || rawMessage.length > 2000) {
      sendJson(res, 400, {
        error: 'Pesan untuk C6A AI v1 harus diisi (maksimal 2.000 karakter).',
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      sendJson(res, 503, {
        error:
          'Layanan C6A AI v1 belum aktif karena GEMINI_API_KEY belum ditambahkan di Environment Variables Vercel (Settings → Variabel Lingkungan) lalu Redeploy.',
      });
      return;
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
    const wantsStream = body.stream === true;

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

    const chat = ai.chats.create({
      model: MODEL_NAME,
      history: sanitizeHistory(body.history),
      config: {
        systemInstruction,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    if (wantsStream) {
      let streamResponse: AsyncIterable<unknown>;
      try {
        streamResponse = await chat.sendMessageStream({
          message: rawMessage,
        });
      } catch (error) {
        const mapped = mapGeminiError(error);
        sendJson(res, mapped.status, { error: mapped.message });
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      let aborted = false;
      res.on('close', () => {
        if (!res.writableEnded) {
          aborted = true;
        }
      });

      try {
        let emittedChars = 0;

        for await (const chunk of streamResponse) {
          if (aborted) break;
          const c = chunk as GenerateContentResponse;
          const delta = c.text ?? '';
          if (delta) {
            emittedChars += delta.length;
            res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          }
        }

        if (!aborted) {
          if (emittedChars === 0) {
            res.write(
              `data: ${JSON.stringify({
                error:
                  'C6A AI v1 belum menerima teks jawaban dari model. Silakan coba ulangi pertanyaan.',
              })}\n\n`
            );
          } else {
            res.write(`data: ${JSON.stringify({ done: true, model: MODEL_NAME })}\n\n`);
          }
          res.end();
        }
      } catch (error) {
        if (!aborted) {
          const mapped = mapGeminiError(error);
          res.write(`data: ${JSON.stringify({ error: mapped.message })}\n\n`);
          res.end();
        }
      }
      return;
    }

    try {
      const response = await chat.sendMessage({
        message: rawMessage,
      });
      const replyText = (response.text ?? '').trim();
      if (!replyText) {
        sendJson(res, 502, {
          error:
            'C6A AI v1 belum menerima teks jawaban dari model. Silakan coba ulangi pertanyaan.',
        });
        return;
      }

      sendJson(res, 200, {
        reply: replyText,
        model: MODEL_NAME,
      });
    } catch (error) {
      const mapped = mapGeminiError(error);
      sendJson(res, mapped.status, { error: mapped.message });
    }
  } catch (fatalErr) {
    console.error('Vercel Fatal C6A Error:', fatalErr);
    sendJson(res, 500, {
      error:
        fatalErr instanceof Error
          ? `Server C6A AI v1 mengalami kendala: ${fatalErr.message}`
          : 'Server C6A AI v1 mengalami kendala tak terduga.',
    });
  }
}
