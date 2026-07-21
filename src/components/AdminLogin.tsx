// src/components/AdminLogin.tsx
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useSnackbar } from '@/lib/toast';

import { adminAuth as auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { signInAdmin } from '@/lib/adminFirebase';
import { startSession } from '@/lib/useAdminSession';

import type { AdminProfile } from '@/types/admin';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ThemeToggle from '@/components/common/ThemeToggle';

type Props = {
  onLoginSuccess: (adminUser: AdminProfile) => void;
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2 shrink-0">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const AdminLogin: React.FC<Props> = ({ onLoginSuccess }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const parseFirebaseError = (code?: string, message?: string) => {
    if (!code) return message || 'ไม่สามารถเข้าสู่ระบบได้';
    if (code.includes('popup-closed-by-user')) return 'คุณปิดหน้าต่างล็อกอินก่อนเสร็จสิ้น';
    if (code.includes('cancelled-popup-request')) return 'มีหน้าต่างล็อกอินกำลังทำงานอยู่';
    if (code.includes('network-request-failed')) return 'เครือข่ายมีปัญหา กรุณาลองใหม่';
    return message || 'ไม่สามารถเข้าสู่ระบบได้';
  };

  const handleGoogleLogin = async () => {
    setErr(null);
    setLoading(true);
    try {
      const data = await signInAdmin();
      startSession(data.uid, 30);
      enqueueSnackbar(`ยินดีต้อนรับ ${data.displayName} (${data.role})`, { variant: 'success' });
      onLoginSuccess(data);
    } catch (e: any) {
      console.error(e);
      let msg = 'ไม่สามารถเข้าสู่ระบบได้';
      if (e?.message === 'NOT_ADMIN') {
        msg = 'บัญชีนี้ยังไม่ได้รับอนุญาตให้เป็นผู้ดูแลระบบ';
      } else if (e?.message === 'ADMIN_DISABLED') {
        msg = 'บัญชีผู้ดูแลระบบนี้ถูกปิดการใช้งาน';
      } else {
        msg = parseFirebaseError(e?.code, e?.message);
      }
      setErr(msg);
      enqueueSnackbar(msg, { variant: 'error' });
      try { await signOut(auth); } catch {}
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-slate-50 dark:bg-slate-950 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle appearance="plain" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/40 dark:bg-slate-900">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 mb-5">
                <Lock className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">เข้าสู่ระบบผู้ดูแล</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">ใช้บัญชีที่ได้รับสิทธิ์ในระบบเท่านั้น</p>
            </div>

            {err && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full h-12 text-sm font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all duration-200"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                <>
                  <GoogleIcon />
                  เข้าสู่ระบบด้วย Google
                </>
              )}
            </Button>

          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default AdminLogin;