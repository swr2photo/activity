'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  Alert,
  CircularProgress,
  Stack,
  Divider,
  alpha,
  useTheme
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LogoutIcon from '@mui/icons-material/Logout';
import LockOpenIcon from '@mui/icons-material/LockOpen';

import { useSnackbar } from 'notistack';

import { auth, db } from '../lib/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  UserCredential,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc, Timestamp } from 'firebase/firestore';

// ✅ session helpers
import { startSession } from '../lib/useAdminSession';

// ---- Types ----
export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'super_admin';
  isActive: boolean;
  lastLogin: Date;
  createdAt: Date;
};

type Props = {
  onLoginSuccess: (adminUser: AdminUser) => void;
};

// โลโก้ Google แบบ SVG
const GoogleIcon = () => (
  <Box
    component="svg"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    sx={{ width: 22, height: 22, mr: 1 }}
  >
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.657 31.987 29.223 35 24 35 16.82 35 11 29.18 11 22S16.82 9 24 9c3.59 0 6.84 1.35 9.34 3.56l5.66-5.66C35.89 3.02 30.2 1 24 1 10.745 1 0 11.745 0 25s10.745 24 24 24 24-10.745 24-24c0-1.603-.166-3.169-.389-4.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.817C14.3 16.012 18.78 13 24 13c3.59 0 6.84 1.35 9.34 3.56l5.66-5.66C35.89 7.02 30.2 5 24 5 15.317 5 7.985 9.936 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 45c5.135 0 9.773-1.982 13.286-5.214l-6.131-5.182C28.827 35.517 26.518 36 24 36c-5.199 0-9.62-3.001-11.274-7.279l-6.56 5.056C7.793 39.985 15.124 45 24 45z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.368 3.254-4.713 7-11.303 7-5.199 0-9.62-3.001-11.274-7.279l-6.56 5.056C7.985 38.064 15.317 43 24 43c11.223 0 19-7.5 19-18 0-1.603-.166-3.169-.389-4.917z"/>
  </Box>
);

const AdminLogin: React.FC<Props> = ({ onLoginSuccess }) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const gradientBg = useMemo(
    () =>
      `radial-gradient(1200px 600px at 10% -10%, ${alpha(
        theme.palette.primary.main,
        0.35
      )}, transparent 60%), radial-gradient(900px 500px at 110% 10%, ${alpha(
        theme.palette.secondary.main,
        0.25
      )}, transparent 55%), linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 70%)`,
    [theme]
  );

  const cardGlass = {
    backgroundColor: alpha(theme.palette.background.paper, 0.6),
    backdropFilter: 'blur(12px)',
    border: `1px solid ${alpha(theme.palette.common.white, 0.25)}`,
    boxShadow: `0 10px 35px ${alpha('#000', 0.25)}`,
  };

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
      const provider = new GoogleAuthProvider();
      const cred: UserCredential = await signInWithPopup(auth, provider);
      const { user } = cred;

      // ตรวจสอบสิทธิ์ admin ใน Firestore: adminUsers/{uid}
      const ref = doc(db, 'adminUsers', user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await signOut(auth);
        setErr('บัญชีนี้ยังไม่ได้รับอนุญาตให้เป็นผู้ดูแลระบบ');
        setLoading(false);
        enqueueSnackbar('บัญชีนี้ยังไม่ได้รับสิทธิ์ผู้ดูแล', { variant: 'error' });
        return;
      }

      const data = snap.data() as {
        email?: string;
        displayName?: string;
        role: 'admin' | 'super_admin';
        isActive: boolean;
        createdAt?: Timestamp | Date;
        lastLogin?: Timestamp | Date;
      };

      if (!data.isActive) {
        await signOut(auth);
        setErr('บัญชีผู้ดูแลระบบนี้ถูกปิดการใช้งาน');
        setLoading(false);
        enqueueSnackbar('บัญชีผู้ดูแลถูกปิดใช้งาน', { variant: 'error' });
        return;
      }

      // อัปเดต lastLogin เป็น serverTimestamp()
      try {
        await updateDoc(ref, { lastLogin: serverTimestamp() });
      } catch {
        // non-blocking
      }

      // ✅ เริ่ม session 30 นาที
      startSession(user.uid, 30);
      enqueueSnackbar('เข้าสู่ระบบสำเร็จ • เซสชันมีอายุ 30 นาที', { variant: 'success' });

      const adminUser: AdminUser = {
        id: user.uid,
        email: user.email ?? data.email ?? '',
        displayName: user.displayName ?? data.displayName ?? 'Admin User',
        role: data.role,
        isActive: data.isActive,
        lastLogin:
          data.lastLogin instanceof Timestamp
            ? data.lastLogin.toDate()
            : data.lastLogin instanceof Date
            ? data.lastLogin
            : new Date(),
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate()
            : (data.createdAt as Date) ?? new Date(),
      };

      onLoginSuccess(adminUser);
    } catch (e: any) {
      console.error(e);
      setErr(parseFirebaseError(e?.code, e?.message));
      enqueueSnackbar(parseFirebaseError(e?.code, e?.message), { variant: 'error' });
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
    } catch (e: any) {
      console.error(e);
      setErr('ออกจากระบบไม่สำเร็จ');
      enqueueSnackbar('ออกจากระบบไม่สำเร็จ', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: gradientBg,
        display: 'flex',
        alignItems: 'center',
        py: { xs: 6, md: 8 },
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} alignItems="stretch">
          {/* Visual / Copy side */}
          <Grid item xs={12} md={6} lg={7}>
            <Card sx={{ height: '100%', ...cardGlass, p: { xs: 2, md: 3 } }}>
              <CardContent sx={{ height: '100%' }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'common.white', color: 'primary.main', width: 56, height: 56 }}>
                    <AdminPanelSettingsIcon fontSize="large" />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={800} color="common.white">
                      กล่องควบคุมผู้ดูแลระบบ
                    </Typography>
                    <Typography variant="body2" sx={{ color: alpha('#fff', 0.85) }}>
                      เข้าสู่ระบบเพื่อจัดการกิจกรรม ผู้ใช้ และรายงานได้ในที่เดียว
                    </Typography>
                  </Box>
                </Stack>

                <Box
                  sx={{
                    mt: 3,
                    p: { xs: 2, md: 3 },
                    borderRadius: 3,
                    background: alpha('#000', 0.2),
                    color: 'common.white',
                  }}
                >
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    ไฮไลต์ความสามารถ
                  </Typography>
                  <Stack spacing={1.2}>
                    <Typography variant="body2">• สร้าง/แก้ไขกิจกรรม พร้อม QR Code อัตโนมัติ</Typography>
                    <Typography variant="body2">• เช็คอินตามพิกัด + กำหนดรัศมี</Typography>
                    <Typography variant="body2">• รายงานภาพรวมแบบเรียลไทม์</Typography>
                    <Typography variant="body2">• สิทธิ์การเข้าถึงตามบทบาท</Typography>
                  </Stack>
                </Box>

                <Typography variant="caption" sx={{ display: 'block', mt: 2, color: alpha('#fff', 0.8) }}>
                  * หากล็อกอินสำเร็จแต่ยังเข้าไม่ได้ ให้ติดต่อผู้ดูแลเพื่อเพิ่มสิทธิ์ในฐานข้อมูล
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Login side */}
          <Grid item xs={12} md={6} lg={5}>
            <Card
              sx={{
                height: '100%',
                ...cardGlass,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <CardContent sx={{ width: '100%', p: { xs: 3, md: 4 } }}>
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <Avatar
                    sx={{
                      width: 72,
                      height: 72,
                      mx: 'auto',
                      mb: 1.5,
                      bgcolor: 'common.white',
                      color: 'primary.main',
                      boxShadow: `0 6px 18px ${alpha('#000', 0.25)}`
                    }}
                  >
                    <LockOpenIcon fontSize="large" />
                  </Avatar>
                  <Typography variant="h5" fontWeight={800}>
                    เข้าสู่ระบบผู้ดูแล
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ใช้บัญชีที่ได้รับสิทธิ์ในระบบเท่านั้น
                  </Typography>
                </Box>

                {err && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                    {err}
                  </Alert>
                )}

                <Button
                  fullWidth
                  size="large"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <GoogleIcon />}
                  sx={{
                    borderRadius: 2,
                    py: 1.3,
                    fontWeight: 700,
                    backgroundColor: 'common.white',
                    color: 'text.primary',
                    boxShadow: `0 8px 20px ${alpha('#000', 0.22)}`,
                    '&:hover': { backgroundColor: alpha('#fff', 0.9) }
                  }}
                >
                  {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}
                </Button>

                <Stack direction="row" alignItems="center" spacing={2} sx={{ my: 2 }}>
                  <Divider sx={{ flex: 1, opacity: 0.6 }} />
                  <Typography variant="caption" color="text.secondary">
                    ตัวช่วย
                  </Typography>
                  <Divider sx={{ flex: 1, opacity: 0.6 }} />
                </Stack>

                <Button
                  fullWidth
                  size="small"
                  variant="outlined"
                  color="inherit"
                  onClick={handleSignOut}
                  startIcon={<LogoutIcon />}
                  sx={{ borderRadius: 2 }}
                >
                  ออกจากระบบ (เผื่อค้าง)
                </Button>

                <Typography
                  variant="caption"
                  sx={{ display: 'block', textAlign: 'center', mt: 2, color: alpha(theme.palette.text.primary, 0.7) }}
                >
                  v1.0 • Secure by Firebase Auth & Firestore
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default AdminLogin;
