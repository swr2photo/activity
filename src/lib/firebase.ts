import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage } from 'firebase/storage'; 


// Firebase configuration with fallback values
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:demo-app-id'
};

// แสดงคำเตือนเมื่อใช้ค่า demo
if (firebaseConfig.projectId === 'demo-project') {
  console.warn('⚠️ Warning: Using demo Firebase configuration. Please set proper environment variables for production.');
}

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log(`🔥 Firebase initialized successfully for project: ${firebaseConfig.projectId}`);
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error);
  throw error;
}

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);


// Emulator connection (เฉพาะใน development mode)
let emulatorsConnected = false;

if (
  typeof window !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_USE_FIRESTORE_EMULATOR === 'true' &&
  !emulatorsConnected
) {
  try {
    console.log('🔧 Connecting to Firebase emulators...');
    
    // Connect to Firestore emulator
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('✅ Connected to Firestore emulator on localhost:8080');
    
    // Connect to Auth emulator
    connectAuthEmulator(auth, 'http://localhost:9099');
    console.log('✅ Connected to Auth emulator on localhost:9099');
    
    emulatorsConnected = true;
  } catch (error) {
    console.error('❌ Failed to connect to emulators:', error);
    console.log('🔄 Continuing with production Firebase...');
  }
}

// Export configuration สำหรับการ debug
export const firebaseConfigInfo = {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  isEmulator: process.env.NEXT_PUBLIC_USE_FIRESTORE_EMULATOR === 'true',
  environment: process.env.NODE_ENV,
  isDemo: firebaseConfig.projectId === 'demo-project'
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

