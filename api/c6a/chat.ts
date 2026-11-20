import { Buffer } from 'node:buffer';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createC6AChatSession,
  extractChunkText,
  getGeminiClient,
  mapGeminiError,
  MODEL_NAME,
  parseC6AChatBody,
} from '../../server/c6aAi';

interface VercelNodeRequest extends IncomingMessage {
  body?: unknown;
}

function sendJson(res: ServerResponse, status: number, payload: Record<string, unknown>): void {
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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Metode tidak diizinkan. Gunakan POST.' });
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 413, {
      error: err instanceof Error ? err.message : 'Permintaan tidak valid.',
    });
    return;
  }

  const parsed = parseC6AChatBody(body);
  if (!parsed.ok) {
    sendJson(res, parsed.status, { error: parsed.error });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    sendJson(res, 503, {
      error:
        'Layanan C6A AI belum aktif karena GEMINI_API_KEY belum ditambahkan di Environment Variables Vercel.',
    });
    return;
  }

  const chat = createC6AChatSession(ai, parsed.data);

  if (parsed.data.wantsStream) {
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
      const streamResponse = await chat.sendMessageStream({
        message: parsed.data.message,
      });
      let emittedChars = 0;

      for await (const chunk of streamResponse) {
        if (aborted) break;
        const delta = extractChunkText(chunk);
        if (delta) {
          emittedChars += delta.length;
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }
      }

      if (!aborted) {
        if (emittedChars === 0) {
          res.write(
            `data: ${JSON.stringify({
              error: 'C6A AI belum menerima teks jawaban dari model. Silakan coba ulangi pertanyaan.',
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
      message: parsed.data.message,
    });
    const replyText = (response.text ?? '').trim();
    if (!replyText) {
      sendJson(res, 502, {
        error: 'C6A AI belum menerima teks jawaban dari model. Silakan coba ulangi pertanyaan.',
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
}
