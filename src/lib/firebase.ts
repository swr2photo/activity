// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore, 
  memoryLocalCache, // ✅ 1. เพิ่ม import memoryLocalCache
  connectFirestoreEmulator,
  getFirestore
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Singleton pattern for Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ✅ 2. แก้ไข: เปลี่ยนมาใช้ memoryLocalCache() 
// เพื่อแก้ปัญหา INTERNAL ASSERTION FAILED ระหว่างการพัฒนา
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
});

export const auth = getAuth(app);

// Fix Storage Bucket URL
const bucketId = firebaseConfig.storageBucket || ''; 
const bucketUrl = bucketId.startsWith('gs://') ? bucketId : `gs://${bucketId}`;
export const storage = getStorage(app, bucketUrl);

// ---- Emulators (Optional) ----
if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_EMULATOR === 'true') {
  try {
    if (!(db as any)._emulatorConfig) {
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
    if (!(auth as any).emulatorConfig) {
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    }
    if (!(storage as any)._emulatorConfig) {
        connectStorageEmulator(storage, 'localhost', 9199);
    }
  } catch (e) {
    console.warn('Emulator connection warning:', e);
  }
}