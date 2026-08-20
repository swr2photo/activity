"use client"
// hooks/useAdminAuth.ts
import { useState, useEffect } from 'react';
import { AdminProfile } from '../types/admin';

type UseAdminAuthOptions = {
  defer?: boolean;
};

/**
 * เช็กสถานะแอดมินจาก admin-app เท่านั้น
 * ถ้าไม่มี session แอดมิน จะไม่เรียก Firestore → ไม่เกิด 403 บนหน้านักศึกษา
 */
export const useAdminAuth = ({ defer = false }: UseAdminAuthOptions = {}) => {
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const checkAdminAuth = async () => {
    const { adminAuth } = await import('../lib/firebaseAdminClient');
    if (!adminAuth.currentUser) {
      setCurrentAdmin(null);
      setLoading(false);
      setError('');
      return;
    }
    try {
      setLoading(true);
      const { getCurrentAdmin } = await import('../lib/adminFirebase');
      const adminData = await getCurrentAdmin();
      setCurrentAdmin(adminData);
      setError('');
    } catch (err: any) {
      setCurrentAdmin(null);
      if (err?.message === 'ADMIN_DISABLED') {
        setError('บัญชีแอดมินถูกระงับ');
      } else {
        setError('');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const initialize = async () => {
      const [{ onAuthStateChanged }, { adminAuth }] = await Promise.all([
        import('firebase/auth'),
        import('../lib/firebaseAdminClient'),
      ]);
      if (cancelled) return;
      unsubscribe = onAuthStateChanged(adminAuth, () => {
        void checkAdminAuth();
      });
    };

    const windowWithIdleCallback = window as typeof window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let idleId: number | undefined;
    let timeoutId: number | undefined;
    if (defer && windowWithIdleCallback.requestIdleCallback) {
      idleId = windowWithIdleCallback.requestIdleCallback(
        () => void initialize(),
        { timeout: 2000 }
      );
    } else if (defer) {
      timeoutId = window.setTimeout(() => void initialize(), 1200);
    } else {
      void initialize();
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (idleId !== undefined) {
        windowWithIdleCallback.cancelIdleCallback?.(idleId);
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defer]);

  const login = async () => {
    try {
      setLoading(true);
      const { signInAdmin } = await import('../lib/adminFirebase');
      const adminData = await signInAdmin();
      setCurrentAdmin(adminData);
      return adminData;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const { signOutAdmin } = await import('../lib/adminFirebase');
      await signOutAdmin();
      setCurrentAdmin(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return {
    currentAdmin,
    loading,
    error,
    login,
    logout,
    refetch: checkAdminAuth
  };
};
