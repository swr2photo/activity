import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const ADMIN_APP_NAME = 'admin-app';
export const adminApp =
  getApps().find((candidate) => candidate.name === ADMIN_APP_NAME) ??
  initializeApp(firebaseConfig, ADMIN_APP_NAME);

export const adminDb = initializeFirestore(adminApp, {
  localCache: memoryLocalCache(),
});
export const adminAuth: Auth =
  typeof window === 'undefined' ? (null as unknown as Auth) : getAuth(adminApp);

if (
  typeof window !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_USE_EMULATOR === 'true'
) {
  try {
    if (!(adminDb as any)._emulatorConfig) {
      connectFirestoreEmulator(adminDb, 'localhost', 8080);
    }
    if (!(adminAuth as any).emulatorConfig) {
      connectAuthEmulator(adminAuth, 'http://localhost:9099', {
        disableWarnings: true,
      });
    }
  } catch (error) {
    console.warn('Admin emulator connection warning:', error);
  }
}
