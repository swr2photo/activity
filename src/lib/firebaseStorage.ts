import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { app } from './firebase';

const configuredBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
const bucketUrl = configuredBucket.startsWith('gs://')
  ? configuredBucket
  : `gs://${configuredBucket}`;

export const storage = getStorage(app, bucketUrl);

if (
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_USE_EMULATOR === 'true'
) {
  try {
    if (!(storage as any)._emulatorConfig) {
      connectStorageEmulator(storage, 'localhost', 9199);
    }
  } catch (error) {
    console.warn('Storage emulator connection warning:', error);
  }
}
