import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// ตรวจสอบว่ามี environment variables ที่จำเป็นหรือไม่
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
];

// ตรวจสอบว่ามี environment variables ครบหรือไม่
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0 && process.env.NODE_ENV === 'production') {
  console.error('Missing required Firebase environment variables:', missingEnvVars);
  throw new Error(`Missing Firebase configuration: ${missingEnvVars.join(', ')}`);
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
};

// ตรวจสอบว่า Firebase config มีค่าที่ถูกต้องหรือไม่
if (!firebaseConfig.projectId || firebaseConfig.projectId === 'demo-project') {
  console.warn('Warning: Using demo Firebase configuration. Please set proper environment variables.');
}

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log(`Firebase initialized successfully for project: ${firebaseConfig.projectId}`);
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
  throw error;
}

export const db = getFirestore(app);
export const auth = getAuth(app);

// Emulator connection (เฉพาะใน development mode)
let emulatorsConnected = false;

if (
  typeof window !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_USE_FIRESTORE_EMULATOR === 'true' &&
  !emulatorsConnected
) {
  try {
    console.log('Connecting to Firebase emulators...');
    
    // Connect to Firestore emulator
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('✅ Connected to Firestore emulator on localhost:8080');
    
    // Connect to Auth emulator
    connectAuthEmulator(auth, 'http://localhost:9099');
    console.log('✅ Connected to Auth emulator on localhost:9099');
    
    emulatorsConnected = true;
  } catch (error) {
    console.error('Failed to connect to emulators:', error);
    console.log('Continuing with production Firebase...');
  }
}

// Export configuration สำหรับการ debug
export const firebaseConfigInfo = {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  isEmulator: process.env.NEXT_PUBLIC_USE_FIRESTORE_EMULATOR === 'true',
  environment: process.env.NODE_ENV
};

// Helper function สำหรับตรวจสอบสถานะการเชื่อมต่อ
export const checkFirebaseConnection = async () => {
  try {
    // ทดสอบการเชื่อมต่อ Firestore
    const { doc, getDoc } = await import('firebase/firestore');
    const testDoc = doc(db, 'test', 'connection');
    await getDoc(testDoc);
    
    return {
      status: 'connected',
      projectId: firebaseConfig.projectId,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Firebase connection test failed:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
};