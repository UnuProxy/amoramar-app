import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;

const getPrivateKey = () => {
  const raw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!raw) return null;
  return raw.replace(/\\n/g, '\n');
};

const initAdmin = (): void => {
  if (adminApp && adminDb) return;

  if (getApps().length > 0) {
    adminApp = getApps()[0]!;
    adminDb = getFirestore(adminApp);
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

  adminApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
  });

  adminDb = getFirestore(adminApp);
};

export const getAdminDb = (): Firestore => {
  initAdmin();
  if (!adminDb) {
    throw new Error('Firebase Admin Firestore is not initialized.');
  }
  return adminDb;
};

