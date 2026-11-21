import type { IncomingMessage, ServerResponse } from 'node:http';

const MODEL_NAME = 'gemini-4-hydrogen';

function hasValidEnvKey(): boolean {
  const raw = (process.env.GEMINI_API_KEY ?? process.env.API_KEY ?? '').trim();
  const cleaned = raw.replace(/^["']|["']$/g, '').trim();
  return Boolean(cleaned && cleaned !== 'MY_GEMINI_API_KEY' && cleaned !== 'YOUR_GEMINI_API_KEY');
}

function applyApiHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  applyApiHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'Metode tidak diizinkan.' }));
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(
    JSON.stringify({
      ok: true,
      assistant: 'C6A AI v1',
      model: MODEL_NAME,
      platform: 'vercel',
      firebaseProjectId: 'kelas-6a-43640',
      hasApiKey: hasValidEnvKey(),
      timestamp: new Date().toISOString(),
    })
  );
}

