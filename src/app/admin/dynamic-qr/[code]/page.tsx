'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, query, collection, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { adminDb as db, adminAuth } from '../../../../lib/firebase';
import QRCode from 'qrcode';
import { Button, CircularProgress, Typography, Box, Stack } from '@mui/material';
import { ArrowLeft, Maximize2, ScanLine } from 'lucide-react';
import { Activity } from '../../../../lib/adminFirebase';
import { DYNAMIC_QR_WINDOW_SECONDS } from '@/lib/dynamicQrConstants';

/* ============================= Liquid Glass styles ============================= */

const glassPillSx = {
  color: 'rgba(255,255,255,0.92)',
  px: 2.5,
  py: 1,
  borderRadius: '999px',
  textTransform: 'none' as const,
  fontWeight: 600,
  fontSize: '0.9rem',
  bgcolor: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.22)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 8px 24px rgba(0,0,0,0.25)',
  transition: 'all .25s ease',
  '&:hover': {
    bgcolor: 'rgba(255,255,255,0.20)',
    transform: 'translateY(-1px)',
  },
} as const;

/** ฉากหลัง + แผงกระจกกลางจอ ใช้ร่วมกันทั้งหน้า QR และหน้าสถานะ/ข้อผิดพลาด */
const GlassShell: React.FC<{ bgUrl?: string; children: React.ReactNode }> = ({ bgUrl, children }) => (
  <Box
    sx={{
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: { xs: 2, md: 4 },
      bgcolor: '#070b18',
    }}
  >
    {/* พื้นหลัง: รูปที่ตั้งไว้ หรือ gradient mesh */}
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        ...(bgUrl
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
            }),
      }}
    />
    {/* ม่านมืดให้กระจกอ่านง่าย */}
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        background:
          'linear-gradient(180deg, rgba(2,6,23,0.55) 0%, rgba(2,6,23,0.30) 45%, rgba(2,6,23,0.60) 100%)',
      }}
    />
    {/* แสงเลนส์จาง ๆ ด้านบน */}
    <Box
      sx={{
        position: 'absolute',
        top: '-30%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '80vw',
        height: '60vh',
        background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.10), transparent 65%)',
        pointerEvents: 'none',
      }}
    />
    {children}
  </Box>
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
        <CircularProgress sx={{ color: 'rgba(255,255,255,0.85)' }} />
      </GlassShell>
    );
  }

  const statusPanel = (title: string, subtitle: string | null, buttonLabel: string) => (
    <GlassShell>
      <Box
        sx={{
          position: 'relative',
          textAlign: 'center',
          px: { xs: 4, md: 8 },
          py: { xs: 5, md: 7 },
          borderRadius: '32px',
          bgcolor: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.22)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 32px 64px rgba(0,0,0,0.45)',
          maxWidth: 560,
        }}
      >
        <Typography variant="h5" fontWeight={700} sx={{ color: 'rgba(255,255,255,0.95)' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body1" sx={{ mt: 1.5, color: 'rgba(255,255,255,0.65)' }}>
            {subtitle}
          </Typography>
        )}
        <Button startIcon={<ArrowLeft size={18} />} onClick={() => router.push('/admin')} sx={{ ...glassPillSx, mt: 4 }}>
          {buttonLabel}
        </Button>
      </Box>
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

  return (
    <GlassShell bgUrl={bgUrl}>
      {/* ปุ่มควบคุมลอยมุมจอ */}
      <Stack
        direction="row"
        justifyContent="space-between"
        sx={{ position: 'absolute', top: { xs: 16, md: 28 }, left: { xs: 16, md: 28 }, right: { xs: 16, md: 28 }, zIndex: 2 }}
      >
        <Button startIcon={<ArrowLeft size={18} />} onClick={() => router.push('/admin')} sx={glassPillSx}>
          กลับ
        </Button>
        <Button startIcon={<Maximize2 size={18} />} onClick={toggleFullScreen} sx={glassPillSx}>
          เต็มจอ
        </Button>
      </Stack>

      {/* แผงกระจกหลัก */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 640,
          textAlign: 'center',
          px: { xs: 3, md: 6 },
          py: { xs: 4, md: 5 },
          borderRadius: { xs: '32px', md: '44px' },
          bgcolor: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.24)',
          backdropFilter: 'blur(44px) saturate(180%)',
          WebkitBackdropFilter: 'blur(44px) saturate(180%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.40), inset 0 -1px 0 rgba(255,255,255,0.08), 0 40px 80px rgba(0,0,0,0.50)',
          // ประกายเหลือบบนขอบกระจก
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.02) 35%, transparent 60%)',
            pointerEvents: 'none',
          },
        }}
      >
        {/* ชื่อกิจกรรม */}
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: { xs: '1.6rem', md: '2.2rem' },
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            color: 'rgba(255,255,255,0.97)',
            textShadow: '0 2px 20px rgba(0,0,0,0.35)',
          }}
        >
          {activity.activityName}
        </Typography>
        <Typography
          sx={{
            mt: 1,
            fontSize: '0.8rem',
            fontWeight: 500,
            letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.55)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {activity.activityCode}
        </Typography>

        {/* QR ในกรอบกระจกซ้อน */}
        <Box
          sx={{
            mt: { xs: 3, md: 4 },
            mx: 'auto',
            width: 'min(400px, 78vw)',
            p: { xs: 1.5, md: 2 },
            borderRadius: { xs: '28px', md: '36px' },
            bgcolor: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 24px 48px rgba(0,0,0,0.35)',
          }}
        >
          {qrSrc ? (
            <Box
              component="img"
              src={qrSrc}
              alt="Dynamic QR"
              sx={{
                display: 'block',
                width: '100%',
                aspectRatio: '1 / 1',
                borderRadius: { xs: '20px', md: '26px' },
                bgcolor: '#fff',
              }}
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                aspectRatio: '1 / 1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: { xs: '20px', md: '26px' },
                bgcolor: 'rgba(255,255,255,0.6)',
              }}
            >
              <CircularProgress size={36} />
            </Box>
          )}
        </Box>

        {/* คำสั่งสแกน */}
        <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="center" sx={{ mt: { xs: 3, md: 3.5 } }}>
          <ScanLine size={22} color="rgba(255,255,255,0.9)" />
          <Typography sx={{ fontWeight: 600, fontSize: { xs: '1.05rem', md: '1.25rem' }, color: 'rgba(255,255,255,0.92)' }}>
            สแกนเพื่อเช็คอิน
          </Typography>
        </Stack>

        {/* ตัวนับถอยหลังแบบแคปซูลกระจก */}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          justifyContent="center"
          sx={{
            mt: 2,
            mx: 'auto',
            width: 'fit-content',
            px: 2.5,
            py: 1,
            borderRadius: '999px',
            bgcolor: urgent ? 'rgba(255,69,58,0.18)' : 'rgba(255,255,255,0.10)',
            border: `1px solid ${urgent ? 'rgba(255,69,58,0.45)' : 'rgba(255,255,255,0.20)'}`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            transition: 'all .4s ease',
          }}
        >
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress
              variant="determinate"
              value={(timeRemaining / WINDOW_SECONDS) * 100}
              size={34}
              thickness={4.5}
              sx={{
                color: urgent ? '#ff453a' : 'rgba(255,255,255,0.9)',
                '& .MuiCircularProgress-circle': { transition: 'stroke-dashoffset .9s linear' },
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: urgent ? '#ff6961' : 'rgba(255,255,255,0.9)' }}>
                {timeRemaining}
              </Typography>
            </Box>
          </Box>
          <Typography sx={{ fontSize: '0.92rem', fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>
            เปลี่ยน QR ใหม่ในอีก {timeRemaining} วินาที
          </Typography>
        </Stack>
        {tokenError && (
          <Typography sx={{ mt: 1.5, fontSize: '0.85rem', color: '#ff6961' }}>
            {tokenError}
          </Typography>
        )}
      </Box>
    </GlassShell>
  );
}
