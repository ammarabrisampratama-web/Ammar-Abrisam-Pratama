import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import {
  createC6AChatSession,
  extractChunkText,
  getGeminiClient,
  mapGeminiError,
  MODEL_NAME,
  parseC6AChatBody,
} from './server/c6aAi.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, assistant: 'C6A', model: MODEL_NAME });
  });

  app.post('/api/c6a/chat', async (req: Request, res: Response) => {
    const parsed = parseC6AChatBody(req.body);
    if (!parsed.ok) {
      res.status(parsed.status).json({ error: parsed.error });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Layanan C6A AI belum aktif karena GEMINI_API_KEY belum terkonfigurasi di Secrets server.',
      });
      return;
    }

    const chat = createC6AChatSession(ai, parsed.data);

    if (parsed.data.wantsStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

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
        res.status(502).json({
          error: 'C6A AI belum menerima teks jawaban dari model. Silakan coba ulangi pertanyaan.',
        });
        return;
      }

      res.json({
        reply: replyText,
        model: MODEL_NAME,
      });
    } catch (error) {
      const mapped = mapGeminiError(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  const distPath = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
  const isProduction =
    hasDist &&
    (process.env.NODE_ENV === 'production' ||
      process.env.npm_lifecycle_event === 'start' ||
      process.env.NODE_ENV !== 'development');

  if (isProduction) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server Kelas 6A (dengan C6A AI) berjalan di http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Gagal menjalankan server:', err);
  process.exit(1);
});
