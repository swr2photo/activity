// src/lib/errorReporter.ts
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface ErrorReportPayload {
  message: string;
  stack?: string;
  digest?: string;
  path?: string;
  userId?: string | null;
  userEmail?: string | null;
  meta?: Record<string, unknown>;
}

/**
 * บันทึก error ลง Firestore ในคอลเลกชัน "errorReports"
 * คืนค่า document id (หรือ fallback id กรณีบันทึกไม่สำเร็จ)
 */
export async function reportError(payload: ErrorReportPayload): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'errorReports'), {
      ...payload,
      createdAt: serverTimestamp(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    });
    return docRef.id;
  } catch (e) {
    console.error('reportError failed:', e, payload);
    return `local-${Date.now().toString(36)}`;
  }
}

export default reportError;
