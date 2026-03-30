import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

const unwrapWrappingQuotes = (value: string): string => {
  const trimmed = value.trim();
  const hasDoubleQuotes = trimmed.startsWith('"') && trimmed.endsWith('"');
  const hasSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'");
  if (hasDoubleQuotes || hasSingleQuotes) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const normalizePrivateKey = (value: string): string => {
  const normalized = unwrapWrappingQuotes(value)
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .trim();

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (
    lines.length >= 3 &&
    lines[0] === '-----BEGIN PRIVATE KEY-----' &&
    lines[lines.length - 1] === '-----END PRIVATE KEY-----'
  ) {
    return `${lines[0]}\n${lines.slice(1, -1).join('\n')}\n${lines[lines.length - 1]}\n`;
  }

  return normalized;
};

const getPrivateKey = () => {
  const raw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!raw) return null;
  return normalizePrivateKey(raw);
};

const initAdmin = (): void => {
  if (adminApp && adminDb && adminAuth) return;

  if (getApps().length > 0) {
    adminApp = getApps()[0]!;
    adminDb = getFirestore(adminApp);
    adminAuth = getAuth(adminApp);
    return;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin SDK is not configured. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY.'
    );
  }

  try {
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  } catch (error: any) {
    throw new Error(
      `Failed to initialize Firebase Admin SDK credentials. Check FIREBASE_ADMIN_PRIVATE_KEY format (no extra wrapping quotes and use \\n for line breaks). Original error: ${error?.message || error}`
    );
  }

  adminDb = getFirestore(adminApp);
  adminAuth = getAuth(adminApp);
};

export const getAdminDb = (): Firestore => {
  initAdmin();
  if (!adminDb) {
    throw new Error('Firebase Admin Firestore is not initialized.');
  }
  return adminDb;
};

export const getAdminAuth = (): Auth => {
  initAdmin();
  if (!adminAuth) {
    throw new Error('Firebase Admin Auth is not initialized.');
  }
  return adminAuth;
};
