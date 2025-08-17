// src/lib/firebaseAdmin.ts
import * as admin from 'firebase-admin';

type SA = { project_id?: string; client_email: string; private_key: string };

function parseServiceAccount(raw?: string): SA {
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY_JSON / GOOGLE_WORKSPACE_SA_JSON is missing');
  const s = raw.trim();
  const json = s.startsWith('{') ? s : Buffer.from(s, 'base64').toString('utf8');
  const parsed = JSON.parse(json);
  if (!parsed.client_email || !parsed.private_key) throw new Error('Invalid service account JSON');

  const pk =
    parsed.private_key.includes('\\n') && !parsed.private_key.includes('\n')
      ? parsed.private_key.replace(/\\n/g, '\n')
      : parsed.private_key;

  return { project_id: parsed.project_id, client_email: parsed.client_email, private_key: pk };
}

const sa = parseServiceAccount(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON || process.env.GOOGLE_WORKSPACE_SA_JSON
);

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  sa.project_id;

if (!projectId) {
  throw new Error(
    'Project Id is missing. Set FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID or include project_id in SA JSON.'
  );
}

// --- Self-heal: ถ้ามีแอปที่ init ไว้แล้วแต่ไม่มี projectId ให้ลบทิ้ง ---
if (admin.apps.length) {
  try {
    const current = admin.app();
    const options: any = current.options || {};
    if (!options.projectId) {
      console.warn('[firebaseAdmin] Found admin app WITHOUT projectId. Deleting and reinitializing...');
      try { (current as any).delete?.(); } catch {}
    }
  } catch {}
}

// --- init ใหม่ถ้ายังไม่มีแอป ---
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
    }),
    projectId,
  });
  // จำไฟล์ไว้เพื่อ debug
  ;(global as any).__FIREBASE_ADMIN_INIT_FILE__ = __filename;
  console.log('[firebaseAdmin] initialized for project:', projectId, 'from:', __filename);
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
