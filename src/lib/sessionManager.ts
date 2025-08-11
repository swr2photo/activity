// lib/sessionManager.ts
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

interface LoginSession {
  userId: string;
  userEmail: string;
  ipAddress: string;
  loginTime: Timestamp;
  expiresAt: Timestamp;
  isActive: boolean;
  lastActivity: Timestamp;
}

const SESSION_DURATION_MINUTES = 30;

export class SessionManager {
  static async createSession(
    userId: string,
    userEmail: string,
    ipAddress: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_DURATION_MINUTES * 60 * 1000);

      const sessionData: LoginSession = {
        userId,
        userEmail,
        ipAddress,
        loginTime: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(expiresAt),
        isActive: true,
        lastActivity: Timestamp.fromDate(now),
      };

      await setDoc(doc(db, 'loginSessions', userId), sessionData);

      return { success: true };
    } catch (error) {
      console.error('Error creating session:', error);
      return { success: false, message: 'ไม่สามารถสร้างเซสชันได้' };
    }
  }

  static async validateSession(userId: string): Promise<{
    isValid: boolean;
    remainingTime?: number;
    message?: string;
  }> {
    try {
      const snap = await getDoc(doc(db, 'loginSessions', userId));

      if (!snap.exists()) {
        return { isValid: false, message: 'ไม่พบเซสชันการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่' };
      }

      const session = snap.data() as LoginSession;
      const now = new Date();
      const expiresAt = session.expiresAt.toDate();

      if (now > expiresAt) {
        // หมดอายุ → ลบ
        try {
          await this.destroySession(userId);
        } catch (e) {
          console.warn('destroy expired session failed:', e);
        }
        return { isValid: false, message: 'เซสชันหมดอายุแล้ว (30 นาที) กรุณาเข้าสู่ระบบใหม่' };
      }

      const remainingMs = expiresAt.getTime() - now.getTime();
      const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
      return { isValid: true, remainingTime: remainingMinutes };
    } catch (error) {
      console.error('Error validating session:', error);
      // หากอ่าน Firestore มีปัญหา ให้ถือว่ายัง valid ชั่วคราว (กันหลุดเพราะ network)
      return {
        isValid: true,
        remainingTime: 15,
        message: 'ไม่สามารถตรวจสอบเซสชันได้ แต่ยังคงใช้งานได้',
      };
    }
  }

  /** ต่ออายุเมื่อมี activity (เลื่อนหมดอายุอีก 30 นาที) */
  static async touch(
    userId: string,
    ipAddress?: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const snap = await getDoc(doc(db, 'loginSessions', userId));
      if (!snap.exists()) {
        return { success: false, message: 'ไม่พบเซสชัน' };
      }

      const now = new Date();
      const session = snap.data() as LoginSession;
      const currentExpiresAt = session.expiresAt.toDate();

      // ถ้าหมดอายุไปแล้ว ให้เคลียร์
      if (now > currentExpiresAt) {
        await this.destroySession(userId);
        return { success: false, message: 'เซสชันหมดอายุแล้ว' };
      }

      const newExpiresAt = new Date(now.getTime() + SESSION_DURATION_MINUTES * 60 * 1000);

      await setDoc(
        doc(db, 'loginSessions', userId),
        {
          ipAddress: ipAddress || session.ipAddress,
          lastActivity: serverTimestamp(),
          expiresAt: Timestamp.fromDate(newExpiresAt),
        },
        { merge: true }
      );

      return { success: true };
    } catch (error) {
      console.error('Error touching session:', error);
      return { success: false, message: 'ต่ออายุเซสชันไม่สำเร็จ' };
    }
  }

  static async destroySession(userId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'loginSessions', userId));
    } catch (error) {
      console.error('Error destroying session:', error);
      // เงียบได้ ไม่ต้อง throw
    }
  }

  // Utilities (ถ้าจะใช้)
  static formatRemainingTime(minutes: number): string {
    if (minutes <= 0) return '0 นาที';
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h} ชั่วโมง ${m} นาที`;
    }
    return `${minutes} นาที`;
  }

  static isSessionNearExpiry(remainingMinutes: number, warningThreshold = 5): boolean {
    return remainingMinutes > 0 && remainingMinutes <= warningThreshold;
  }
}
