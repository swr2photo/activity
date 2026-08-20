// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore, 
  memoryLocalCache,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Singleton pattern for Next.js
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ✅ 2. แก้ไข: เปลี่ยนมาใช้ memoryLocalCache() 
// เพื่อแก้ปัญหา INTERNAL ASSERTION FAILED ระหว่างการพัฒนา
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
});

// Auth depends on browser APIs and validates the public API key immediately.
// Keep server prerender/builds from eagerly creating it; client components use
// it only after hydration or from event handlers.
export const auth: Auth =
  typeof window === 'undefined' ? (null as unknown as Auth) : getAuth(app);

// ---- Emulators (Optional) ----
if (
  typeof window !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_USE_EMULATOR === 'true'
) {
  try {
    if (!(db as any)._emulatorConfig) {
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
    if (!(auth as any).emulatorConfig) {
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    }
  } catch (e) {
    console.warn('Emulator connection warning:', e);
  }
}
