// src/lib/firebaseAdmin.ts
import * as admin from 'firebase-admin';

type SA = { project_id?: string; client_email: string; private_key: string };

function parseServiceAccount(raw?: string): SA {
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY_JSON is missing');
  
  // รองรับทั้งแบบ JSON String และ Base64
  const s = raw.trim();
  const json = s.startsWith('{') ? s : Buffer.from(s, 'base64').toString('utf8');
  const parsed = JSON.parse(json);

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Invalid service account JSON');
  }

  // แก้ไข \n ใน private key
  const private_key = parsed.private_key.replace(/\\n/g, '\n');

  return { project_id: parsed.project_id, client_email: parsed.client_email, private_key };
}

function ensureApp() {
  if (admin.apps.length) return admin.app();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON;
  const sa = parseServiceAccount(raw);

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    sa.project_id;

  if (!projectId) {
    throw new Error('Project Id is missing.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
    }),
    projectId,
  });

  return admin.app();
}

// Export functions to ensure initialization happens at runtime
export function getAdminDb() {
  return ensureApp().firestore();
}
export function getAdminAuth() {
  return ensureApp().auth();
}

export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;