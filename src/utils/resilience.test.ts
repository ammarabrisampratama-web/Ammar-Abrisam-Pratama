import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyApplicationError,
  detectBrowserEnvironment,
  fetchWithTimeoutAndRetry,
  isTransientNetworkError,
  mapFirebaseAuthError,
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
  safeSessionStorageGet,
  safeSessionStorageRemove,
  safeSessionStorageSet,
  withRetry,
} from './resilience.ts';

test('safe storage helpers fall back cleanly when window is absent or throws', () => {
  safeLocalStorageSet('c6a_test_key', 'aktif');
  assert.equal(safeLocalStorageGet('c6a_test_key'), 'aktif');
  safeLocalStorageRemove('c6a_test_key');
  assert.equal(safeLocalStorageGet('c6a_test_key'), null);

  safeSessionStorageSet('c6a_sess_key', 'abc123');
  assert.equal(safeSessionStorageGet('c6a_sess_key'), 'abc123');
  safeSessionStorageRemove('c6a_sess_key');
  assert.equal(safeSessionStorageGet('c6a_sess_key'), null);
});

test('detectBrowserEnvironment recognizes Android in-app WebViews vs Chrome desktop', () => {
  const fbWebView = detectBrowserEnvironment(
    'Mozilla/5.0 (Linux; Android 13; SM-A145F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.144 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/445.0.0.34.118;]'
  );
  assert.equal(fbWebView.isAndroid, true);
  assert.equal(fbWebView.isInAppWebView, true);
  assert.equal(fbWebView.inAppAppName, 'Facebook');

  const waWebView = detectBrowserEnvironment(
    'Mozilla/5.0 (Linux; Android 12; Redmi Note 11; wv) AppleWebKit/537.36 WhatsApp/2.24.20 Mobile Safari/537.36'
  );
  assert.equal(waWebView.isAndroid, true);
  assert.equal(waWebView.isInAppWebView, true);
  assert.equal(waWebView.inAppAppName, 'WhatsApp');

  const genericAndroidWv = detectBrowserEnvironment(
    'Mozilla/5.0 (Linux; Android 11; CPH2185; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.74 Mobile Safari/537.36'
  );
  assert.equal(genericAndroidWv.isAndroid, true);
  assert.equal(genericAndroidWv.isInAppWebView, true);

  const desktopChrome = detectBrowserEnvironment(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  );
  assert.equal(desktopChrome.isAndroid, false);
  assert.equal(desktopChrome.isInAppWebView, false);
});

test('classifyApplicationError diagnoses raw Firestore JSON, storage blocks, chunks, and network timeouts', () => {
  const rawFirestoreJson = JSON.stringify({
    error: 'Missing or insufficient permissions.',
    operationType: 'get',
    path: 'users_public/uid-123',
  });
  const perm = classifyApplicationError(new Error(rawFirestoreJson));
  assert.equal(perm.category, 'permission');
  assert.equal(perm.code, 'PERMISSION_DENIED');
  assert.match(perm.message, /users_public\/uid-123/);

  const secErr = classifyApplicationError(
    new Error("Failed to read the 'localStorage' property from 'Window': Access is denied for this document.")
  );
  assert.equal(secErr.category, 'auth-storage');

  const missingInitial = classifyApplicationError(
    new Error('Unable to process request due to missing initial state. This may happen if browser sessionStorage is inaccessible.')
  );
  assert.equal(missingInitial.category, 'auth-storage');

  const chunkErr = classifyApplicationError(new Error('ChunkLoadError: Loading chunk 142 failed.'));
  assert.equal(chunkErr.category, 'chunk');

  const netErr = classifyApplicationError(new Error('Failed to get document because the client is offline.'));
  assert.equal(netErr.category, 'network');
  assert.equal(netErr.retryable, true);
});

test('mapFirebaseAuthError gives clear Indonesian explanations for auth/missing-initial-state and common Android errors', () => {
  const missing = mapFirebaseAuthError({
    code: 'auth/missing-initial-state',
    message: 'Unable to process request due to missing initial state.',
  });
  assert.equal(missing.suggestExternalBrowser, true);
  assert.match(missing.message, /sessionStorage|Google Chrome/i);

  const net = mapFirebaseAuthError({ code: 'auth/network-request-failed', message: 'Network error' });
  assert.equal(net.retryable, true);

  const domain = mapFirebaseAuthError({ code: 'auth/unauthorized-domain', message: 'Domain not allowed' });
  assert.match(domain.message, /Authorized domains/);
});

test('withRetry retries transient errors with backoff and aborts immediately on non-transient errors', async () => {
  let transientCalls = 0;
  const result = await withRetry(
    async () => {
      transientCalls += 1;
      if (transientCalls < 3) {
        throw Object.assign(new Error('Failed to get document because the client is offline.'), {
          code: 'unavailable',
        });
      }
      return 'berhasil';
    },
    { maxAttempts: 4, baseDelayMs: 50, maxDelayMs: 80 }
  );
  assert.equal(result, 'berhasil');
  assert.equal(transientCalls, 3);

  let nonRetryCalls = 0;
  await assert.rejects(
    () =>
      withRetry(
        async () => {
          nonRetryCalls += 1;
          throw new Error('Missing or insufficient permissions.');
        },
        { maxAttempts: 3, baseDelayMs: 50 }
      ),
    /Missing or insufficient permissions/
  );
  assert.equal(nonRetryCalls, 1);
  assert.equal(isTransientNetworkError(new Error('deadline-exceeded')), true);
  assert.equal(isTransientNetworkError(new Error('Missing or insufficient permissions')), false);
});

test('fetchWithTimeoutAndRetry retries HTTP 503 and returns subsequent HTTP 200', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ error: 'busy' }), { status: 503 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const res = await fetchWithTimeoutAndRetry(
      'http://localhost:3000/api/health',
      { method: 'GET' },
      { timeoutMs: 2000, maxRetries: 1, retryDelayMs: 100 }
    );
    assert.equal(res.status, 200);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
