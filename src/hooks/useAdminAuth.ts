"use client"
// hooks/useAdminAuth.ts
import { useState, useEffect } from 'react';
import { AdminProfile } from '../types/admin';
// hooks/useAdminAuth.ts
import { getCurrentAdmin, signInAdmin, signOutAdmin } from '../lib/adminFirebase';


// Rest of your hook implementation
export const useAdminAuth = () => {
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    try {
      const adminData = await getCurrentAdmin();
      setCurrentAdmin(adminData);
      setError('');
    } catch (error: any) {
      setCurrentAdmin(null);
      if (error?.message === 'ADMIN_DISABLED') {
        setError('บัญชีแอดมินถูกระงับ');
      } else {
        setError('');
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      setLoading(true);
      const adminData = await signInAdmin();
      setCurrentAdmin(adminData);
      return adminData;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOutAdmin();
      setCurrentAdmin(null);
    } catch (error) {
      console.error('Logout error:', error);
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
