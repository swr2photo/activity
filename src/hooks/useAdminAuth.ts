"use client"
// hooks/useAdminAuth.ts
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { AdminProfile } from '../types/admin';
import { getCurrentAdmin, signInAdmin, signOutAdmin } from '../lib/adminFirebase';
import { adminAuth } from '../lib/firebase';

/**
 * เช็กสถานะแอดมินจาก admin-app เท่านั้น
 * ถ้าไม่มี session แอดมิน จะไม่เรียก Firestore → ไม่เกิด 403 บนหน้านักศึกษา
 */
export const useAdminAuth = () => {
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const checkAdminAuth = async () => {
    if (!adminAuth.currentUser) {
      setCurrentAdmin(null);
      setLoading(false);
      setError('');
      return;
    }
    try {
      setLoading(true);
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
    const unsub = onAuthStateChanged(adminAuth, () => {
      checkAdminAuth();
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async () => {
    try {
      setLoading(true);
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
