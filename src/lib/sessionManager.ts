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
  static async createSession(userId: string, userEmail: string, ipAddress: string): Promise<void> {
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
        lastActivity: Timestamp.fromDate(now)
      };

      // สร้าง session document ด้วย userId เป็น document ID
      await setDoc(doc(db, 'loginSessions', userId), sessionData);
      
      console.log(`Session created for user ${userEmail}, expires at ${expiresAt.toLocaleString('th-TH')}`);
    } catch (error) {
      console.error('Error creating session:', error);
      throw new Error('ไม่สามารถสร้างเซสชันได้');
    }
  }

  static async validateSession(userId: string): Promise<{ isValid: boolean; remainingTime?: number; message?: string }> {
    try {
      const sessionDoc = await getDoc(doc(db, 'loginSessions', userId));
      
      if (!sessionDoc.exists()) {
        return {
          isValid: false,
          message: 'ไม่พบเซสชันการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่'
        };
      }

      const session = sessionDoc.data() as LoginSession;
      const now = new Date();
      const expiresAt = session.expiresAt.toDate();

      if (!session.isActive) {
        return {
          isValid: false,
          message: 'เซสชันถูกปิดใช้งาน กรุณาเข้าสู่ระบบใหม่'
        };
      }

      if (now > expiresAt) {
        // เซสชันหมดอายุ - ลบออกจากฐานข้อมูล
        try {
          await this.destroySession(userId);
        } catch (destroyError) {
          console.error('Error destroying expired session:', destroyError);
        }
        return {
          isValid: false,
          message: 'เซสชันหมดอายุแล้ว (30 นาที) กรุณาเข้าสู่ระบบใหม่'
        };
      }

      // คำนวณเวลาที่เหลือ
      const remainingMs = expiresAt.getTime() - now.getTime();
      const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));

      // อัพเดท lastActivity (แต่ไม่ throw error ถ้าล้มเหลว)
      try {
        await this.updateLastActivity(userId);
      } catch (updateError) {
        console.warn('Error updating last activity:', updateError);
        // ไม่ต้อง throw error เพราะ session ยังใช้ได้อยู่
      }

      return {
        isValid: true,
        remainingTime: remainingMinutes
      };
    } catch (error) {
      console.error('Error validating session:', error);
      // ถ้า error ในการเข้าถึง Firestore ให้ถือว่า session ใช้ได้
      // เพื่อไม่ให้ผู้ใช้ถูก logout เพราะปัญหาเครือข่าย
      return {
        isValid: true,
        remainingTime: 15, // ให้เวลา default 15 นาที
        message: 'ไม่สามารถตรวจสอบเซสชันได้ แต่ยังคงใช้งานได้'
      };
    }
  }

  static async updateLastActivity(userId: string): Promise<void> {
    try {
      const sessionDoc = doc(db, 'loginSessions', userId);
      await setDoc(sessionDoc, {
        lastActivity: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating last activity:', error);
      // ไม่ throw error เพราะไม่ใช่ operation ที่สำคัญมาก
    }
  }

  static async extendSession(userId: string): Promise<{ success: boolean; newExpiryTime?: Date; message?: string }> {
    try {
      const sessionDoc = await getDoc(doc(db, 'loginSessions', userId));
      
      if (!sessionDoc.exists()) {
        return {
          success: false,
          message: 'ไม่พบเซสชัน'
        };
      }

      const session = sessionDoc.data() as LoginSession;
      const now = new Date();
      const currentExpiresAt = session.expiresAt.toDate();

      // ตรวจสอบว่าเซสชันยังไม่หมดอายุ
      if (now > currentExpiresAt) {
        try {
          await this.destroySession(userId);
        } catch (destroyError) {
          console.error('Error destroying expired session during extend:', destroyError);
        }
        return {
          success: false,
          message: 'เซสชันหมดอายุแล้ว ไม่สามารถขยายเวลาได้'
        };
      }

      // ขยายเวลาอีก 30 นาที
      const newExpiresAt = new Date(now.getTime() + SESSION_DURATION_MINUTES * 60 * 1000);
      
      await setDoc(doc(db, 'loginSessions', userId), {
        expiresAt: Timestamp.fromDate(newExpiresAt),
        lastActivity: serverTimestamp()
      }, { merge: true });

      console.log(`Session extended for user ${userId} until ${newExpiresAt.toLocaleString('th-TH')}`);

      return {
        success: true,
        newExpiryTime: newExpiresAt
      };
    } catch (error) {
      console.error('Error extending session:', error);
      return {
        success: false,
        message: 'เกิดข้อผิดพลาดในการขยายเวลาเซสชัน'
      };
    }
  }

  static async destroySession(userId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'loginSessions', userId));
      console.log(`Session destroyed for user ${userId}`);
    } catch (error) {
      console.error('Error destroying session:', error);
      // ไม่ throw error เพราะอาจเป็นเพราะ session ไม่มีอยู่แล้ว
    }
  }

  static async getSessionInfo(userId: string): Promise<LoginSession | null> {
    try {
      const sessionDoc = await getDoc(doc(db, 'loginSessions', userId));
      return sessionDoc.exists() ? sessionDoc.data() as LoginSession : null;
    } catch (error) {
      console.error('Error getting session info:', error);
      return null;
    }
  }

  static async isSessionActive(userId: string): Promise<boolean> {
    try {
      const result = await this.validateSession(userId);
      return result.isValid;
    } catch (error) {
      console.error('Error checking session active status:', error);
      return false;
    }
  }

  static async refreshSession(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const sessionDoc = await getDoc(doc(db, 'loginSessions', userId));
      
      if (!sessionDoc.exists()) {
        return {
          success: false,
          message: 'ไม่พบเซสชัน'
        };
      }

      const session = sessionDoc.data() as LoginSession;
      const now = new Date();
      const currentExpiresAt = session.expiresAt.toDate();

      // ตรวจสอบว่าเซสชันยังไม่หมดอายุ
      if (now > currentExpiresAt) {
        await this.destroySession(userId);
        return {
          success: false,
          message: 'เซสชันหมดอายุแล้ว'
        };
      }

      // อัพเดท lastActivity โดยไม่เปลี่ยนเวลาหมดอายุ
      await setDoc(doc(db, 'loginSessions', userId), {
        lastActivity: serverTimestamp()
      }, { merge: true });

      return {
        success: true
      };
    } catch (error) {
      console.error('Error refreshing session:', error);
      return {
        success: false,
        message: 'เกิดข้อผิดพลาดในการรีเฟรชเซสชัน'
      };
    }
  }

  static async cleanupExpiredSessions(): Promise<void> {
    // ฟังก์ชันนี้ควรจะถูกเรียกใช้โดย Cloud Function หรือ scheduled task
    // เพื่อทำความสะอาดเซสชันที่หมดอายุแล้ว
    console.log('This should be implemented as a Cloud Function for automatic cleanup');
    
    // Implementation สำหรับ cleanup (ใช้ใน Cloud Function)
    /*
    try {
      const now = new Date();
      const sessionsRef = collection(db, 'loginSessions');
      const expiredQuery = query(sessionsRef, where('expiresAt', '<', Timestamp.fromDate(now)));
      
      const querySnapshot = await getDocs(expiredQuery);
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      
      await Promise.all(deletePromises);
      console.log(`Cleaned up ${querySnapshot.size} expired sessions`);
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
    */
  }

  // Helper method สำหรับการ format เวลา
  static formatRemainingTime(minutes: number): string {
    if (minutes <= 0) return '0 นาที';
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours} ชั่วโมง ${remainingMinutes} นาที`;
    }
    return `${minutes} นาที`;
  }

  // Helper method สำหรับการตรวจสอบว่าเซสชันใกล้หมดอายุหรือไม่
  static isSessionNearExpiry(remainingMinutes: number, warningThreshold: number = 5): boolean {
    return remainingMinutes > 0 && remainingMinutes <= warningThreshold;
  }
}