import { initializeApp } from 'firebase/app';
import {
  type Auth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  inMemoryPersistence,
} from 'firebase/auth';
import {
  doc,
  type Firestore,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import { withRetry } from './utils/resilience';

function resolveConfiguredAuthDomain(): string {
  const proxyEnabled =
    typeof import.meta !== 'undefined' &&
    String(import.meta.env?.VITE_USE_AUTH_PROXY ?? '').trim().toLowerCase() === 'true';
  if (!proxyEnabled) {
    return firebaseConfig.authDomain;
  }

  const raw =
    typeof import.meta !== 'undefined' && typeof import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN === 'string'
      ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN.trim()
      : '';
  if (!raw) return firebaseConfig.authDomain;

  const currentHost =
    typeof window !== 'undefined' && typeof window.location?.hostname === 'string'
      ? window.location.hostname
      : '';

  if (raw.toLowerCase() === 'auto') {
    if (
      typeof window !== 'undefined' &&
      window.location?.protocol === 'https:' &&
      currentHost &&
      currentHost !== 'localhost' &&
      currentHost !== '127.0.0.1'
    ) {
      return currentHost;
    }
    return firebaseConfig.authDomain;
  }

  const allowed = raw
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
  if (allowed.length > 1 && currentHost && allowed.includes(currentHost)) {
    return currentHost;
  }
  return allowed[0] || firebaseConfig.authDomain;
}

const configuredAuthDomain = resolveConfiguredAuthDomain();

const app = initializeApp({
  ...firebaseConfig,
  authDomain: configuredAuthDomain,
});

function createResilientFirestore(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

function createResilientAuth(): Auth {
  try {
    return initializeAuth(app, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence,
      ],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(app);
  }
}

export const db = createResilientFirestore();
export const auth = createResilientAuth();
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const BOOTSTRAPPED_OWNER_EMAIL = 'ammarabrisampratama@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function verifyFirestoreServerHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    await withRetry(
      () => getDocFromServer(doc(db, 'settings', 'class_config')),
      { maxAttempts: 2, baseDelayMs: 350 }
    );
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return {
      ok: true,
      latencyMs: Math.round(now - start),
      message: 'Terhubung langsung ke server Cloud Firestore.',
    };
  } catch (error) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      return {
        ok: true,
        latencyMs: Math.round(now - start),
        message: 'Server Cloud Firestore aktif merespons (terproteksi Security Rules).',
      };
    }
    return {
      ok: false,
      latencyMs: Math.round(now - start),
      message: msg,
    };
  }
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();
