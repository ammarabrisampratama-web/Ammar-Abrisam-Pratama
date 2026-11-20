import type { IncomingMessage, ServerResponse } from 'node:http';

const MODEL_NAME = 'gemini-4-hydrogen';

function hasValidEnvKey(): boolean {
  const raw = (process.env.GEMINI_API_KEY ?? process.env.API_KEY ?? '').trim();
  const cleaned = raw.replace(/^["']|["']$/g, '').trim();
  return Boolean(cleaned && cleaned !== 'MY_GEMINI_API_KEY' && cleaned !== 'YOUR_GEMINI_API_KEY');
}

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(
    JSON.stringify({
      ok: true,
      assistant: 'C6A AI v1',
      model: MODEL_NAME,
      platform: 'vercel',
      hasApiKey: hasValidEnvKey(),
    })
  );
}
