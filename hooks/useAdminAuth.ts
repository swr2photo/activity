"use client"
// hooks/useAdminAuth.ts
import { useState, useEffect } from 'react';
import { AdminProfile } from '../src/types/admin';
// hooks/useAdminAuth.ts
import { 
  getCurrentAdmin, 
  signInAdmin, 
  signOutAdmin
} from '../src/lib/adminFirebase'; // Import from your admin Firebase service

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
      // Check if user is authenticated and has admin privileges
      const adminData = await getCurrentAdmin();
      setCurrentAdmin(adminData);
    } catch (error) {
      setError('ไม่สามารถตรวจสอบสิทธิ์ได้');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const adminData = await signInAdmin(email, password);
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
