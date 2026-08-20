import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { adminApp } from './firebaseAdminClient';

const configuredBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
const bucketUrl = configuredBucket.startsWith('gs://')
  ? configuredBucket
  : `gs://${configuredBucket}`;

export const adminStorage = getStorage(adminApp, bucketUrl);

if (
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_USE_EMULATOR === 'true'
) {
  try {
    if (!(adminStorage as any)._emulatorConfig) {
      connectStorageEmulator(adminStorage, 'localhost', 9199);
    }
  } catch (error) {
    console.warn('Admin storage emulator connection warning:', error);
  }
}
