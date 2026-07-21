'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, query, collection, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { adminDb as db, adminAuth } from '../../../../lib/firebase';
import QRCode from 'qrcode';
import { ArrowLeft, Maximize2, ScanLine } from 'lucide-react';
import { Activity } from '../../../../lib/adminFirebase';
import { DYNAMIC_QR_WINDOW_SECONDS } from '@/lib/dynamicQrConstants';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/* ============================= Liquid Glass styles ============================= */

const glassPillClass =
  'rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-all hover:bg-white/20 hover:-translate-y-px';

/** ฉากหลัง + แผงกระจกกลางจอ ใช้ร่วมกันทั้งหน้า QR และหน้าสถานะ/ข้อผิดพลาด */
const GlassShell: React.FC<{ bgUrl?: string; children: React.ReactNode }> = ({ bgUrl, children }) => (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070b18] p-4 md:p-8">
    {/* พื้นหลัง: รูปที่ตั้งไว้ หรือ gradient mesh */}
    <div
      className="absolute inset-0"
      style={
        bgUrl
          ? {
              backgroundImage: `url(${bgUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transform: 'scale(1.04)',
            }
          : {
              background:
                'radial-gradient(1200px 800px at 15% 10%, rgba(59,130,246,0.35), transparent 60%),' +
                'radial-gradient(1000px 700px at 85% 20%, rgba(168,85,247,0.28), transparent 60%),' +
                'radial-gradient(900px 900px at 50% 100%, rgba(14,165,233,0.22), transparent 55%),' +
                '#070b18',
            }
      }
    />
    {/* ม่านมืดให้กระจกอ่านง่าย */}
    <div
      className="absolute inset-0"
      style={{
        background:
          'linear-gradient(180deg, rgba(2,6,23,0.55) 0%, rgba(2,6,23,0.30) 45%, rgba(2,6,23,0.60) 100%)',
      }}
    />
    {/* แสงเลนส์จาง ๆ ด้านบน */}
    <div
      className="pointer-events-none absolute left-1/2 top-[-30%] h-[60vh] w-[80vw] -translate-x-1/2"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.10), transparent 65%)',
      }}
    />
    {children}
  </div>
);

export default function DynamicQrPage() {
  const { code } = useParams();
  const router = useRouter();

  // ใช้ auth ฝั่งแอดมิน (แยก instance จากฝั่งนักศึกษา)
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    const unsub = onAuthStateChanged(adminAuth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);
  
  const [activity, setActivity] = useState<Activity | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrSrc, setQrSrc] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState(DYNAMIC_QR_WINDOW_SECONDS);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const WINDOW_SECONDS = DYNAMIC_QR_WINDOW_SECONDS;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fetchingRef = useRef(false);
  const lastTokenRef = useRef<string>('');


  useEffect(() => {
    if (!code || !user) return;
    
    // 1. Resolve docId from activityCode
    const fetchDoc = async () => {
      try {
        const q = query(collection(db, 'activityQRCodes'), where('activityCode', '==', String(code)));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const id = snap.docs[0].id;
          setDocId(id);
        } else {
          // fallback to legacy
          const q2 = query(collection(db, 'activities'), where('activityCode', '==', String(code)));
          const snap2 = await getDocs(q2);
          if (!snap2.empty) setDocId(snap2.docs[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDoc();
  }, [code, user]);

  useEffect(() => {
    if (!docId) return;
    
    // Subscribe to activity changes (just to show name/status)
    const unsub = onSnapshot(doc(db, 'activityQRCodes', docId), (snap) => {
      if (snap.exists()) {
        setActivity({ id: snap.id, ...snap.data() } as Activity);
      }
    });
    
    return () => unsub();
  }, [docId]);

  // Sync activity ref to avoid stale closures
  const activityRef = useRef<Activity | null>(null);
  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  const fetchAndRenderToken = async () => {
    if (!activityRef.current || fetchingRef.current) return;
    const currentUser = adminAuth.currentUser;
    if (!currentUser) return;

    fetchingRef.current = true;
    try {
      const idToken = await currentUser.getIdToken();
      const activityCode = String(activityRef.current.activityCode || code || '');
      const res = await fetch(
        `/api/dynamic-qr/current?code=${encodeURIComponent(activityCode)}`,
        { headers: { Authorization: `Bearer ${idToken}` }, cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'โหลด Dynamic QR ไม่สำเร็จ');
      }

      const token = String(data.token || '');
      const shortCode = String(
        data.customCode || activityRef.current.customCode || code || ''
      );
      const url = `${window.location.origin}/r/${encodeURIComponent(shortCode)}?dt=${encodeURIComponent(token)}`;

      if (token !== lastTokenRef.current) {
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 600,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
        setQrSrc(qrDataUrl);
        lastTokenRef.current = token;
      }

      setTimeRemaining(Math.max(1, Number(data.expiresIn) || WINDOW_SECONDS));
      setTokenError(null);

      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      const waitMs = Math.max(1, Number(data.expiresIn) || WINDOW_SECONDS) * 1000 + 200;
      refreshTimerRef.current = setTimeout(() => {
        fetchAndRenderToken();
      }, waitMs);
    } catch (err: any) {
      console.error('Failed to fetch HMAC dynamic token', err);
      setTokenError(err?.message || 'โหลด Dynamic QR ไม่สำเร็จ');
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        fetchAndRenderToken();
      }, 5000);
    } finally {
      fetchingRef.current = false;
    }
  };

  // HMAC time-window: ดึง token จาก API (ไม่เขียน Firestore ทุกรอบ)
  useEffect(() => {
    if (!docId || !activity || !user) return;
    if (!activity.dynamicQREnabled) return;

    fetchAndRenderToken();

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          fetchAndRenderToken();
        }
        return next;
      });
    }, 1000);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [docId, activity?.dynamicQREnabled, activity?.customCode, user?.uid]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  if (loading || authLoading) {
    return (
      <GlassShell>
        <Spinner size="lg" className="h-10 w-10 text-white/85" />
      </GlassShell>
    );
  }

  const statusPanel = (title: string, subtitle: string | null, buttonLabel: string) => (
    <GlassShell>
      <div className="relative max-w-[560px] rounded-[32px] border border-white/20 bg-white/10 px-8 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_32px_64px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:px-16 md:py-14">
        <h2 className="text-xl font-bold text-white/95">{title}</h2>
        {subtitle && (
          <p className="mt-3 text-base text-white/65">{subtitle}</p>
        )}
        <Button
          className={cn(glassPillClass, 'mt-8 gap-2')}
          onClick={() => router.push('/admin')}
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
          {buttonLabel}
        </Button>
      </div>
    </GlassShell>
  );

  if (!user) {
    return statusPanel('คุณต้องเข้าสู่ระบบในฐานะผู้ดูแลระบบก่อน', null, 'กลับไปหน้าเข้าสู่ระบบ');
  }

  if (!activity) {
    return statusPanel('ไม่พบกิจกรรม หรือไม่มีสิทธิ์เข้าถึง', null, 'กลับไปหน้าจัดการ');
  }

  if (!activity.dynamicQREnabled) {
    return statusPanel(
      'กิจกรรมนี้ไม่ได้เปิดโหมด Dynamic QR',
      'โปรดเปิดใช้งาน "Dynamic QR (จอ Rolling QR)" ในหน้าต่างแก้ไขกิจกรรมก่อน',
      'กลับไปหน้าจัดการ'
    );
  }

  const bgUrl = (activity as any).dynamicQrBgUrl as string | undefined;
  const urgent = timeRemaining <= 8;
  const progressPct = (timeRemaining / WINDOW_SECONDS) * 100;

  return (
    <GlassShell bgUrl={bgUrl}>
      {/* ปุ่มควบคุมลอยมุมจอ */}
      <div className="absolute left-4 right-4 top-4 z-20 flex justify-between md:left-7 md:right-7 md:top-7">
        <Button className={cn(glassPillClass, 'gap-2')} onClick={() => router.push('/admin')}>
          <ArrowLeft className="h-[18px] w-[18px]" />
          กลับ
        </Button>
        <Button className={cn(glassPillClass, 'gap-2')} onClick={toggleFullScreen}>
          <Maximize2 className="h-[18px] w-[18px]" />
          เต็มจอ
        </Button>
      </div>

      {/* แผงกระจกหลัก */}
      <div
        className="relative z-10 w-full max-w-[640px] rounded-[32px] border border-white/25 bg-white/10 px-6 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_0_-1px_0_rgba(255,255,255,0.08),0_40px_80px_rgba(0,0,0,0.50)] backdrop-blur-[44px] md:rounded-[44px] md:px-12 md:py-10"
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.02) 35%, transparent 60%)',
          }}
        />

        {/* ชื่อกิจกรรม */}
        <h1
          className="relative text-[1.6rem] font-bold leading-tight tracking-tight text-white/97 md:text-[2.2rem]"
          style={{ textShadow: '0 2px 20px rgba(0,0,0,0.35)' }}
        >
          {activity.activityName}
        </h1>
        <p className="relative mt-2 font-mono text-xs font-medium tracking-widest text-white/55">
          {activity.activityCode}
        </p>

        {/* QR ในกรอบกระจกซ้อน */}
        <div className="relative mx-auto mt-6 w-[min(400px,78vw)] rounded-[28px] border border-white/90 bg-white/85 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_24px_48px_rgba(0,0,0,0.35)] md:mt-8 md:rounded-[36px] md:p-4">
          {qrSrc ? (
            <img
              src={qrSrc}
              alt="Dynamic QR"
              className="block aspect-square w-full rounded-[20px] bg-white md:rounded-[26px]"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-[20px] bg-white/60 md:rounded-[26px]">
              <Spinner size="lg" className="h-9 w-9" />
            </div>
          )}
        </div>

        {/* คำสั่งสแกน */}
        <div className="relative mt-6 flex items-center justify-center gap-3 md:mt-7">
          <ScanLine size={22} color="rgba(255,255,255,0.9)" />
          <p className="text-[1.05rem] font-semibold text-white/92 md:text-[1.25rem]">
            สแกนเพื่อเช็คอิน
          </p>
        </div>

        {/* ตัวนับถอยหลังแบบแคปซูลกระจก */}
        <div
          className={cn(
            'relative mx-auto mt-4 flex w-fit items-center justify-center gap-3 rounded-full border px-5 py-2 backdrop-blur-xl transition-all duration-400',
            urgent
              ? 'border-[rgba(255,69,58,0.45)] bg-[rgba(255,69,58,0.18)]'
              : 'border-white/20 bg-white/10'
          )}
        >
          <div className="relative inline-flex h-[34px] w-[34px] items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="3.5"
              />
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke={urgent ? '#ff453a' : 'rgba(255,255,255,0.9)'}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={`${(progressPct / 100) * 88} 88`}
                className="transition-[stroke-dasharray] duration-900 linear"
              />
            </svg>
            <span
              className={cn(
                'relative text-[0.72rem] font-bold',
                urgent ? 'text-[#ff6961]' : 'text-white/90'
              )}
            >
              {timeRemaining}
            </span>
          </div>
          <p className="text-[0.92rem] font-medium text-white/75">
            เปลี่ยน QR ใหม่ในอีก {timeRemaining} วินาที
          </p>
        </div>
        {tokenError && (
          <p className="relative mt-3 text-sm text-[#ff6961]">{tokenError}</p>
        )}
      </div>
    </GlassShell>
  );
}
