// src/components/AdminLogin.tsx
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, LogOut, Shield, Zap, MapPin, BarChart3, Users } from 'lucide-react';
import { useSnackbar } from 'notistack';

import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { signInAdmin } from '@/lib/adminFirebase';
import { startSession } from '@/lib/useAdminSession';

import type { AdminProfile } from '@/types/admin';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type Props = {
  onLoginSuccess: (adminUser: AdminProfile) => void;
};

const MicrosoftIcon = () => (
  <svg viewBox="0 0 21 21" className="w-5 h-5 mr-2 shrink-0">
    <path fill="#f25022" d="M1 1h9v9H1z"/>
    <path fill="#00a4ef" d="M1 11h9v9H1z"/>
    <path fill="#7fba00" d="M11 1h9v9h-9z"/>
    <path fill="#ffb900" d="M11 11h9v9h-9z"/>
  </svg>
);

const features = [
  { icon: Zap, label: 'สร้าง/แก้ไขกิจกรรม พร้อม QR Code อัตโนมัติ' },
  { icon: MapPin, label: 'เช็คอินตามพิกัด + กำหนดรัศมี' },
  { icon: BarChart3, label: 'รายงานภาพรวมแบบเรียลไทม์' },
  { icon: Users, label: 'สิทธิ์การเข้าถึงตามบทบาท' },
];

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

  const handleMicrosoftLogin = async () => {
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

  const handleSignOut = async () => {
    setErr(null);
    setLoading(true);
    try {
      await signOut(auth);
      enqueueSnackbar('ออกจากระบบแล้ว', { variant: 'info' });
    } catch {
      setErr('ออกจากระบบไม่สำเร็จ');
      enqueueSnackbar('ออกจากระบบไม่สำเร็จ', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center py-12 px-4 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="max-w-5xl mx-auto w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Left — Feature Card */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="h-full border-0 bg-white/70 backdrop-blur-xl shadow-xl shadow-indigo-500/5">
              <CardHeader className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-violet-500/10 border-b border-indigo-100/50">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/15 border border-primary/20">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">กล่องควบคุมผู้ดูแลระบบ</h2>
                    <p className="text-sm text-muted-foreground">จัดการกิจกรรม ผู้ใช้ และรายงานได้จากศูนย์กลาง</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="rounded-xl border border-slate-200/80 bg-white/60 p-5">
                  <h3 className="font-bold text-sm text-slate-800 mb-3">ไฮไลต์ความสามารถ</h3>
                  <div className="space-y-3">
                    {features.map((f, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                        className="flex items-center gap-3"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 shrink-0">
                          <f.icon className="h-4 w-4 text-indigo-600" />
                        </div>
                        <span className="text-sm text-slate-700">{f.label}</span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Badge variant="outline" className="text-xs">Role-based access</Badge>
                    <Badge variant="outline" className="text-xs">Realtime</Badge>
                    <Badge variant="outline" className="text-xs">Audit-friendly</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  หากล็อกอินสำเร็จแต่ยังเข้าไม่ได้ ให้ติดต่อผู้ดูแลเพื่อเพิ่มสิทธิ์ในคอลเลกชัน <strong>adminUsers</strong>
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Right — Login Card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="h-full border-0 bg-white/70 backdrop-blur-xl shadow-xl shadow-indigo-500/5 flex items-center">
              <CardContent className="w-full p-8">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/10 mb-4">
                    <Lock className="h-7 w-7 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">เข้าสู่ระบบผู้ดูแล</h2>
                  <p className="text-sm text-muted-foreground mt-1">ใช้บัญชีที่ได้รับสิทธิ์ในระบบเท่านั้น</p>
                </div>

                {err && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{err}</AlertDescription>
                  </Alert>
                )}

                <Button
                  className="w-full h-12 text-sm font-bold bg-white text-slate-800 border border-slate-200 shadow-lg hover:bg-slate-50 hover:shadow-xl transition-all duration-200"
                  onClick={handleMicrosoftLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                      กำลังเข้าสู่ระบบ...
                    </>
                  ) : (
                    <>
                      <MicrosoftIcon />
                      เข้าสู่ระบบด้วย Microsoft
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-3 my-5">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">ตัวช่วย</span>
                  <Separator className="flex-1" />
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSignOut}
                  disabled={loading}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  ออกจากระบบ (เผื่อค้าง)
                </Button>

                <p className="text-center text-xs text-muted-foreground mt-6 opacity-60">
                  v2.0 • Secure by Firebase Auth & Firestore
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;