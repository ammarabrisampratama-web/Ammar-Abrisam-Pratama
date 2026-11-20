import type { IncomingMessage, ServerResponse } from 'node:http';
import { MODEL_NAME } from '../server/c6aAi';

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: true, assistant: 'C6A', model: MODEL_NAME, platform: 'vercel' }));
}
