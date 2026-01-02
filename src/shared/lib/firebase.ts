import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _secondaryAuth: Auth | null = null;

try {
  // Only initialize if we have valid config and we're not in SSR
  if (firebaseConfig.apiKey && 
      firebaseConfig.projectId && 
      firebaseConfig.apiKey !== 'undefined' && 
      firebaseConfig.projectId !== 'undefined') {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    _auth = getAuth(app);
    _db = getFirestore(app);
    _storage = getStorage(app);
  } else {
    // Firebase not configured - this is expected if .env.local is missing
    console.warn('Firebase not configured. Add Firebase config to .env.local to enable authentication and database features.');
  }
} catch (error: any) {
  // Firebase initialization failed - likely missing config
  if (error?.code !== 'auth/invalid-api-key') {
    console.warn('Firebase initialization error:', error?.message || error);
  }
}

// Export with type assertions - will be null if Firebase not configured
export const auth = _auth as Auth | null;
export const db = _db as Firestore | null;
export const storage = _storage as FirebaseStorage | null;
export const getSecondaryAuth = (): Auth | null => {
  if (_secondaryAuth) {
    return _secondaryAuth;
  }

  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.projectId ||
    firebaseConfig.apiKey === 'undefined' ||
    firebaseConfig.projectId === 'undefined'
  ) {
    console.warn('Firebase not configured. Add Firebase config to .env.local to enable authentication and database features.');
    return null;
  }

  try {
    const existing = getApps().find((existingApp) => existingApp.name === 'Secondary');
    const secondaryApp = existing ?? initializeApp(firebaseConfig, 'Secondary');
    _secondaryAuth = getAuth(secondaryApp);
  } catch (error: any) {
    console.warn('Failed to initialize secondary Firebase app:', error?.message || error);
    _secondaryAuth = null;
  }

  return _secondaryAuth;
};

export default app;
