// src/components/AdminLogin.tsx
'use client';

import React, { useState } from 'react';
import { BarChart3, CalendarCheck2, Lock, QrCode, ShieldCheck } from 'lucide-react';
import { useSnackbar } from '@/lib/toast';

import { adminAuth as auth } from '@/lib/firebaseAdminClient';
import { signOut } from 'firebase/auth';
import { signInAdmin } from '@/lib/adminFirebase';
import { startSession } from '@/lib/useAdminSession';

import type { AdminProfile } from '@/types/admin';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ThemeToggle from '@/components/common/ThemeToggle';
import AuroraBackground from '@/components/graphics/AuroraBackground';
import ScienceOrbit from '@/components/graphics/ScienceOrbit';

type Props = {
  onLoginSuccess: (adminUser: AdminProfile) => void;
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5 shrink-0" aria-hidden>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const FEATURES = [
  { icon: CalendarCheck2, title: 'จัดการกิจกรรม', desc: 'สร้าง เปิด-ปิดรับ และตั้งค่ารอบได้ในที่เดียว' },
  { icon: QrCode, title: 'QR เช็กอิน', desc: 'Dynamic QR ป้องกันการส่งต่อลิงก์' },
  { icon: BarChart3, title: 'สถิติแบบเรียลไทม์', desc: 'ติดตามผู้เข้าร่วมและแบบประเมิน' },
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
    <div className="relative flex min-h-screen bg-slate-50 dark:bg-[hsl(var(--background))]">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle appearance="plain" />
      </div>

      {/* ฝั่งซ้าย: กราฟิกแบรนด์ (ซ่อนบนมือถือ) */}
      <section className="relative isolate hidden w-[48%] max-w-[720px] flex-col justify-between overflow-hidden bg-[#060b17] p-10 text-white lg:flex xl:p-14">
        <AuroraBackground variant="hero" />
        <ScienceOrbit
          tone="light"
          className="absolute -right-16 top-1/2 h-[420px] w-[420px] -translate-y-1/2 animate-float-slow opacity-70"
        />
        <div className="absolute -left-20 bottom-24 h-64 w-64 animate-spin-slower rounded-full border border-dashed border-white/15" />

        <div className="relative flex animate-fade-down items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient shadow-[0_10px_24px_-8px_rgba(6,182,212,0.8)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-tight">PSU REGISTER</p>
            <p className="text-xs text-white/60">Admin Console · Faculty of Science</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="animate-fade-up text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
            ศูนย์ควบคุม
            <br />
            <span className="text-gradient-brand animate-gradient-x">กิจกรรมของคุณ</span>
          </h2>
          <p className="mt-4 animate-fade-up text-base text-white/65 [animation-delay:120ms]">
            จัดการการลงทะเบียน ติดตามผู้เข้าร่วม และวิเคราะห์ผลได้ครบในที่เดียว
          </p>

          <ul className="stagger mt-8 space-y-3">
            {FEATURES.map((f, i) => (
              <li
                key={f.title}
                style={{ '--i': i + 3 } as React.CSSProperties}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <f.icon className="h-[18px] w-[18px] text-cyan-300" />
                </div>
                <div>
                  <p className="text-sm font-bold">{f.title}</p>
                  <p className="text-xs text-white/55">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} Prince of Songkla University</p>
      </section>

      {/* ฝั่งขวา: ฟอร์มล็อกอิน */}
      <section className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
        <AuroraBackground className="lg:opacity-60" />

        <div className="relative w-full max-w-md animate-scale-in">
          <div className="rounded-3xl border border-slate-200/80 bg-white/85 p-8 shadow-[0_30px_80px_-30px_rgba(10,107,207,0.35)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[hsl(var(--card)/0.85)] sm:p-10">
            <div className="mb-8 text-center">
              <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
                <span className="absolute inset-0 animate-pulse-ring rounded-3xl text-primary" />
                <div className="relative flex h-16 w-16 animate-float items-center justify-center rounded-2xl bg-brand-gradient shadow-[0_14px_30px_-10px_rgba(10,107,207,0.7)]">
                  <Lock className="h-7 w-7 text-white" />
                </div>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                เข้าสู่ระบบผู้ดูแล
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                ใช้บัญชีที่ได้รับสิทธิ์ในระบบเท่านั้น
              </p>
            </div>

            {err && (
              <Alert variant="destructive" className="mb-6 animate-[wiggle_0.5s_ease-in-out]">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            )}

            <Button
              className="shine h-12 w-full border border-slate-200 bg-white text-sm font-bold text-slate-700 shadow-sm hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900 hover:shadow-md dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                <>
                  <GoogleIcon />
                  เข้าสู่ระบบด้วย Google
                </>
              )}
            </Button>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              เซสชันหมดอายุอัตโนมัติเมื่อไม่ได้ใช้งาน 30 นาที
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminLogin;
