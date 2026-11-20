import test from 'node:test';
import assert from 'node:assert/strict';
import type { GenerateContentResponse, GoogleGenAI } from '@google/genai';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  FALLBACK_MODEL_NAME,
  MODEL_NAME,
  isTransientOrModelError,
  mapGeminiError,
  parseC6AChatBody,
  resolveGeminiApiKey,
  sendC6AMessageWithFallback,
  startC6AStreamWithFallback,
} from './c6aAi';
import vercelHandler from '../api/c6a/chat';

function makeParsedRequest(fastMode = false, wantsStream = false) {
  const parsed = parseC6AChatBody({
    message: 'Halo',
    history: [],
    contextSummary: 'Kelas 6A MI Al-Hidayah',
    userLabel: 'Ammar',
    userRole: 'owner',
    stream: wantsStream,
    fastMode,
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error('Expected parsed.ok to be true');
  return parsed.data;
}

test('startC6AStreamWithFallback falls back immediately from gemini-4-hydrogen timeout/AbortError to gemini-3.1-flash-lite in 2 attempts', async () => {
  const attemptedModels: string[] = [];
  const fakeAi = {
    chats: {
      create: ({ model, config }: { model: string; config?: { abortSignal?: AbortSignal } }) => {
        attemptedModels.push(model);
        assert.ok(config?.abortSignal instanceof AbortSignal);
        return {
          sendMessageStream: async () => {
            if (model === MODEL_NAME) {
              const err = new Error('Request timeout after 4000ms');
              err.name = 'AbortError';
              throw err;
            }
            async function* gen() {
              yield { text: 'Waalaikumsalam! Ada yang bisa saya bantu?' };
            }
            return gen();
          },
        };
      },
    },
  } as unknown as GoogleGenAI;

  const result = await startC6AStreamWithFallback(fakeAi, makeParsedRequest(false, true));
  assert.deepEqual(attemptedModels, [MODEL_NAME, FALLBACK_MODEL_NAME]);
  assert.equal(result.modelUsed, FALLBACK_MODEL_NAME);

  let collected = '';
  for await (const chunk of result.stream) {
    collected += (chunk as GenerateContentResponse).text ?? '';
  }
  assert.match(collected, /Waalaikumsalam/);
});

test('startC6AStreamWithFallback uses gemini-3.1-flash-lite directly in 1 attempt when fastMode=true', async () => {
  const attemptedModels: string[] = [];
  const fakeAi = {
    chats: {
      create: ({ model }: { model: string }) => {
        attemptedModels.push(model);
        return {
          sendMessageStream: async () => {
            async function* gen() {
              yield { text: 'Respon cepat fastMode.' };
            }
            return gen();
          },
        };
      },
    },
  } as unknown as GoogleGenAI;

  const result = await startC6AStreamWithFallback(fakeAi, makeParsedRequest(true, true));
  assert.deepEqual(attemptedModels, [FALLBACK_MODEL_NAME]);
  assert.equal(result.modelUsed, FALLBACK_MODEL_NAME);
});

test('sendC6AMessageWithFallback stops immediately on HTTP 401 without fallback', async () => {
  const attemptedModels: string[] = [];
  const fakeAi = {
    chats: {
      create: ({ model }: { model: string }) => {
        attemptedModels.push(model);
        return {
          sendMessage: async () => {
            const err = Object.assign(new Error('UNAUTHENTICATED'), { status: 401 });
            throw err;
          },
        };
      },
    },
  } as unknown as GoogleGenAI;

  await assert.rejects(
    () => sendC6AMessageWithFallback(fakeAi, makeParsedRequest(false, false)),
    /UNAUTHENTICATED/
  );
  assert.deepEqual(attemptedModels, [MODEL_NAME]);
});

test('sendC6AMessageWithFallback skips primary in fastMode=true and succeeds in 1 attempt', async () => {
  const attemptedModels: string[] = [];
  const fakeAi = {
    chats: {
      create: ({ model, config }: { model: string; config?: { thinkingConfig?: unknown } }) => {
        attemptedModels.push(model);
        assert.equal(config?.thinkingConfig, undefined);
        return {
          sendMessage: async () => ({ text: 'Halo Ammar, saya C6A AI v1!' }) as GenerateContentResponse,
        };
      },
    },
  } as unknown as GoogleGenAI;

  const result = await sendC6AMessageWithFallback(fakeAi, makeParsedRequest(true, false));
  assert.deepEqual(attemptedModels, [FALLBACK_MODEL_NAME]);
  assert.equal(result.modelUsed, FALLBACK_MODEL_NAME);
  assert.equal(result.response.text, 'Halo Ammar, saya C6A AI v1!');
});

test('isTransientOrModelError treats AbortError/TimeoutError/404/504 as fallback-eligible and 401/403/429 as fatal', () => {
  const abortErr = new Error('Aborted');
  abortErr.name = 'AbortError';
  assert.equal(isTransientOrModelError(abortErr), true);
  assert.equal(isTransientOrModelError(Object.assign(new Error('Gateway timeout'), { status: 504 })), true);
  assert.equal(isTransientOrModelError(Object.assign(new Error('Not found'), { status: 404 })), true);
  assert.equal(isTransientOrModelError(Object.assign(new Error('Invalid key'), { status: 401 })), false);
  assert.equal(isTransientOrModelError(Object.assign(new Error('Quota'), { status: 429 })), false);
});

test('resolveGeminiApiKey strips prefixes/quotes and mapGeminiError redacts keys', () => {
  const prevKey = process.env.GEMINI_API_KEY;
  try {
    process.env.GEMINI_API_KEY = '  "GEMINI_API_KEY=AIzaSyTestKey1234567890"  ';
    assert.equal(resolveGeminiApiKey(), 'AIzaSyTestKey1234567890');

    process.env.GEMINI_API_KEY = 'MY_GEMINI_API_KEY';
    assert.equal(resolveGeminiApiKey(), null);

    const mapped = mapGeminiError(new Error('Failure with AIzaSyTestKey1234567890'));
    assert.equal(mapped.status, 500);
    assert.ok(!mapped.message.includes('AIzaSyTestKey'));
    assert.match(mapped.message, /\[REDACTED_KEY\]/);
  } finally {
    if (prevKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = prevKey;
    }
  }
});

test('Vercel handler /api/c6a/chat handles 405, 400, and missing GEMINI_API_KEY (503) cleanly as JSON', async () => {
  const prevGemini = process.env.GEMINI_API_KEY;
  const prevApi = process.env.API_KEY;

  const invokeHandler = async (method: string, body?: unknown) => {
    let statusCode = 200;
    const headers: Record<string, string> = {};
    let rawOut = '';
    const req = { method, body } as unknown as IncomingMessage & { body?: unknown };
    const mockRes = {
      writableEnded: false,
      set statusCode(code: number) {
        statusCode = code;
      },
      get statusCode() {
        return statusCode;
      },
      setHeader(name: string, val: string) {
        headers[name.toLowerCase()] = val;
      },
      end(chunk?: string) {
        if (chunk) rawOut += chunk;
        mockRes.writableEnded = true;
      },
    };
    const res = mockRes as unknown as ServerResponse;
    await vercelHandler(req, res);
    return { statusCode, headers, json: JSON.parse(rawOut) as Record<string, unknown> };
  };

  try {
    const methodRes = await invokeHandler('GET');
    assert.equal(methodRes.statusCode, 405);

    const badBodyRes = await invokeHandler('POST', { message: '   ', fastMode: true });
    assert.equal(badBodyRes.statusCode, 400);

    delete process.env.GEMINI_API_KEY;
    delete process.env.API_KEY;
    const missingKeyRes = await invokeHandler('POST', { message: 'Halo', fastMode: true });
    assert.equal(missingKeyRes.statusCode, 503);
    assert.match(String(missingKeyRes.json.error), /GEMINI_API_KEY/);
  } finally {
    if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevGemini;
    if (prevApi === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = prevApi;
  }
});
