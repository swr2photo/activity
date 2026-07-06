'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, query, collection, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import QRCode from 'qrcode';
import { Button, CircularProgress, Typography, Box, Stack, Card, CardContent } from '@mui/material';
import { MonitorPlay, ArrowLeft, Maximize2 } from 'lucide-react';
import { useAuth } from '../../../../lib/firebaseAuth';
import { Activity } from '../../../../lib/adminFirebase';
import { pageColors } from '../../../../lib/uiTheme';

export default function DynamicQrPage() {
  const { code } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [activity, setActivity] = useState<Activity | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrSrc, setQrSrc] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState(15);
  
  // Timer config
  const REFRESH_INTERVAL = 15;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshRef = useRef<NodeJS.Timeout | null>(null);

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

  const updateDynamicToken = async () => {
    if (!docId || !activity) return;
    
    const newToken = Math.random().toString(36).substring(2, 12);
    const prevToken = activity.dynamicToken || '';
    
    try {
      await updateDoc(doc(db, 'activityQRCodes', docId), {
        previousDynamicToken: prevToken,
        dynamicToken: newToken,
        updatedAt: serverTimestamp(),
      });
      
      // Generate QR
      const url = `${window.location.origin}/register?activity=${code}&dt=${newToken}`;
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 600,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      setQrSrc(qrDataUrl);
      setTimeRemaining(REFRESH_INTERVAL);
    } catch (err) {
      console.error('Failed to update dynamic token', err);
    }
  };

  // Run the interval
  useEffect(() => {
    if (!docId || !activity) return;
    if (!activity.dynamicQREnabled) return; // If disabled, don't run
    
    // Initial run
    updateDynamicToken();
    
    refreshRef.current = setInterval(() => {
      updateDynamicToken();
    }, REFRESH_INTERVAL * 1000);
    
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [docId, activity?.dynamicQREnabled]); // intentionally omits updateDynamicToken to avoid loop

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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box p={4} textAlign="center">
        <Typography variant="h5" color="error">คุณต้องเข้าสู่ระบบในฐานะผู้ดูแลระบบก่อน</Typography>
        <Button startIcon={<ArrowLeft />} onClick={() => router.push('/admin')} sx={{ mt: 2 }}>กลับไปหน้าเข้าสู่ระบบ</Button>
      </Box>
    );
  }

  if (!activity) {
    return (
      <Box p={4} textAlign="center">
        <Typography variant="h5" color="error">ไม่พบกิจกรรม หรือไม่มีสิทธิ์เข้าถึง</Typography>
        <Button startIcon={<ArrowLeft />} onClick={() => router.push('/admin')} sx={{ mt: 2 }}>กลับไปหน้าจัดการ</Button>
      </Box>
    );
  }

  if (!activity.dynamicQREnabled) {
    return (
      <Box p={4} textAlign="center">
        <Typography variant="h5" color="error">กิจกรรมนี้ไม่ได้เปิดโหมด Dynamic QR</Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>โปรดเปิดใช้งาน "Dynamic QR (จอ Rolling QR)" ในหน้าต่างแก้ไขกิจกรรมก่อน</Typography>
        <Button startIcon={<ArrowLeft />} onClick={() => router.push('/admin')} sx={{ mt: 2 }}>กลับไปหน้าจัดการ</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: pageColors.blueBackground, 
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      p: 4
    }}>
      <Card sx={{ 
        maxWidth: 800, 
        width: '100%', 
        p: 4, 
        borderRadius: 4,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        bgcolor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        textAlign: 'center'
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
          <Button startIcon={<ArrowLeft />} onClick={() => router.push('/admin')} color="inherit">
            กลับ
          </Button>
          <Button startIcon={<Maximize2 />} onClick={toggleFullScreen} color="inherit">
            เต็มจอ
          </Button>
        </Stack>
        
        <MonitorPlay className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        
        <Typography variant="h3" fontWeight={800} color="primary.main" gutterBottom>
          {activity.activityName}
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          รหัสกิจกรรม: {activity.activityCode}
        </Typography>

        <Box sx={{ my: 4, position: 'relative', display: 'inline-block' }}>
          {qrSrc ? (
            <img src={qrSrc} alt="Dynamic QR" style={{ width: '400px', height: '400px', borderRadius: '1rem', border: '8px solid white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
          ) : (
            <Box sx={{ width: 400, height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f1f5f9', borderRadius: '1rem' }}>
              <CircularProgress />
            </Box>
          )}
        </Box>

        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography variant="h5" fontWeight={600} color="error.main" gutterBottom>
            สแกนเพื่อเช็คอิน!
          </Typography>
          
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
            <CircularProgress 
              variant="determinate" 
              value={(timeRemaining / REFRESH_INTERVAL) * 100} 
              size={40}
              thickness={5}
              color={timeRemaining <= 5 ? 'error' : 'primary'}
            />
            <Typography variant="h6">
              เปลี่ยน QR ใหม่ในอีก {timeRemaining} วินาที
            </Typography>
          </Stack>
        </Box>
      </Card>
    </Box>
  );
}
