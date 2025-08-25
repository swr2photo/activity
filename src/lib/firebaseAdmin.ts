// src/lib/firebaseAdmin.ts
import * as admin from 'firebase-admin';

type SA = { project_id?: string; client_email: string; private_key: string };

function parseServiceAccount(raw?: string): SA {
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY_JSON / GOOGLE_WORKSPACE_SA_JSON is missing');
  const s = raw.trim();
  const json = s.startsWith('{') ? s : Buffer.from(s, 'base64').toString('utf8');
  const parsed = JSON.parse(json);

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Invalid service account JSON');
  }

  const private_key =
    parsed.private_key.includes('\\n') && !parsed.private_key.includes('\n')
      ? parsed.private_key.replace(/\\n/g, '\n')
      : parsed.private_key;

  return { project_id: parsed.project_id, client_email: parsed.client_email, private_key };
}

let _initialized = false;

function ensureApp() {
  if (_initialized && admin.apps.length) return admin.app();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON || process.env.GOOGLE_WORKSPACE_SA_JSON;
  const sa = parseServiceAccount(raw);

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    sa.project_id;

  if (!projectId) {
    throw new Error(
      'Project Id is missing. Set FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID or include project_id in SA JSON.'
    );
  }

  // ถ้ามีแอปค้างไว้แต่ option ไม่ครบ ให้ลบทิ้งก่อน
  if (admin.apps.length) {
    try {
      const cur = admin.app();
      const opts: any = cur.options || {};
      if (!opts.projectId) {
        try { (cur as any).delete?.(); } catch {}
      }
    } catch {}
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail: sa.client_email,
        privateKey: sa.private_key,
      }),
      projectId,
    });
  }

  _initialized = true;
  return admin.app();
}

// ✅ export เป็นฟังก์ชัน — จะ init ก็ต่อเมื่อถูกเรียก “ตอนรันจริง” (ไม่ใช่ตอน build)
export function getAdminDb() {
  return ensureApp().firestore();
}
export function getAdminAuth() {
  return ensureApp().auth();
}

// helper exports
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
