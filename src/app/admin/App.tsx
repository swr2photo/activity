// src/app/admin/App.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

// ✅ ตรวจสอบ path ให้ถูกต้อง (ถ้าไฟล์ AdminLogin อยู่ใน components/admin ให้แก้ path ตามจริง)
// import AdminLogin from '../../components/admin/AdminLogin'; 
import AdminLogin from '../../components/AdminLogin'; 
import AdminMain from '../../components/admin/AdminMain';

import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import type { AdminProfile, AdminRole, AdminDepartment } from '../../types/admin';
import { ROLE_PERMISSIONS, normalizeDepartment } from '../../types/admin';

import useAdminSession, { endSession, getSession } from '../../lib/useAdminSession';
import { useSnackbar } from 'notistack';

const theme = createTheme();

// ✅ รายการหน้าที่อนุญาต
const VALID_SECTIONS = [
  'dashboard',
  'activity-list',
  'qr-generator',
  'users',
  'admin-management',
  'reports',
  'settings',
  'profile',
] as const;
type InitialSection = typeof VALID_SECTIONS[number];

const clamp = (n?: number) =>
  typeof n === 'number' ? Math.max(0, Math.min(100, n)) : undefined;

const normalizeAdmin = (a: AdminProfile): AdminProfile => ({
  ...a,
  permissions: Array.isArray(a.permissions) ? a.permissions : [],
  firstName: a.firstName ?? '',
  lastName: a.lastName ?? '',
  displayName: a.displayName ?? `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim(),
  profileImage: a.profileImage,
  profileImagePosX: clamp(a.profileImagePosX) ?? 50,
  profileImagePosY: clamp(a.profileImagePosY) ?? 50,
});

function App() {
  const { enqueueSnackbar } = useSnackbar();

  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // ✅ อ่าน last section จาก localStorage
  const initialSection = useMemo<InitialSection | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    try {
      const raw = localStorage.getItem('admin:lastSection') ?? '';
      return (VALID_SECTIONS as readonly string[]).includes(raw) ? (raw as InitialSection) : undefined;
    } catch {
      return undefined;
    }
  }, []);

  const { end } = useAdminSession({
    minutes: 30,
    enabled: !!currentAdmin,
    onExpire: async () => {
      try { await signOut(auth); } catch {}
      endSession();
      setCurrentAdmin(null);
      enqueueSnackbar('เซสชันหมดเวลา • ออกจากระบบอัตโนมัติ', { variant: 'warning' });
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        await bootstrapAdminOnce(user);
        startLiveAdminSubscribe(user.uid);
      } else {
        setCurrentAdmin(null);
      }
      setAuthChecked(true);
      setLoading(false);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentAdmin && !auth.currentUser) {
      const s = getSession();
      if (s) endSession();
    }
  }, [currentAdmin]);

  const bootstrapAdminOnce = async (user: User) => {
    const ref = doc(db, 'adminUsers', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const d = snap.data() as any;
    if (d.isActive === false) return;

    // Map role เก่าถ้ามี (เผื่อไว้)
    const roleMap = { super_admin: 'super_admin', admin: 'department_admin' } as const;
    const rawRole = d.role as string;
    const mappedRole = (rawRole === 'admin' ? 'department_admin' : rawRole) as AdminRole;

    const profile: AdminProfile = {
      uid: user.uid,
      email: d.email ?? user.email ?? '',
      displayName: d.displayName ?? user.displayName ?? '',
      firstName: d.firstName ?? '',
      lastName: d.lastName ?? '',
      department: normalizeDepartment(d.department),
      role: mappedRole,
      isActive: d.isActive ?? true,
      lastLoginAt: d.lastLogin instanceof Timestamp ? d.lastLogin.toDate() : (d.lastLogin as Date) ?? new Date(),
      createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : (d.createdAt as Date) ?? new Date(),
      permissions: Array.isArray(d.permissions) ? d.permissions : (ROLE_PERMISSIONS[mappedRole] ?? []),
      updatedAt: new Date(),
      profileImage: d.profileImage,
      profileImagePosX: clamp(d.profileImagePosX) ?? 50,
      profileImagePosY: clamp(d.profileImagePosY) ?? 50,
    };
    setCurrentAdmin(normalizeAdmin(profile));
  };

  const startLiveAdminSubscribe = (uid: string) => {
    const ref = doc(db, 'adminUsers', uid);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as any;
      if (d.isActive === false) return;

      setCurrentAdmin((prev) => {
        if (!prev) return prev;
        
        // Map role เก่า
        const rawRole = d.role as string;
        const mappedRole = (rawRole === 'admin' ? 'department_admin' : rawRole) as AdminRole;

        const merged: AdminProfile = normalizeAdmin({
          ...prev,
          email: d.email ?? prev.email,
          displayName: d.displayName ?? prev.displayName,
          firstName: d.firstName ?? prev.firstName,
          lastName: d.lastName ?? prev.lastName,
          department: normalizeDepartment(d.department ?? prev.department),
          role: mappedRole,
          permissions: Array.isArray(d.permissions) ? d.permissions : prev.permissions,
          profileImage: d.profileImage ?? prev.profileImage,
          profileImagePosX: clamp(d.profileImagePosX) ?? prev.profileImagePosX,
          profileImagePosY: clamp(d.profileImagePosY) ?? prev.profileImagePosY,
          updatedAt: new Date(),
        } as AdminProfile);

        return merged;
      });
    });
  };

  // ✅ FIX: เปลี่ยน Type ให้รับ AdminProfile โดยตรง (ไม่ต้องแปลงซ้ำ)
  const handleLoginSuccess = (profile: AdminProfile) => {
    // AdminLogin ส่ง profile ที่สมบูรณ์มาแล้ว ใช้ได้เลย
    setCurrentAdmin(normalizeAdmin(profile));
  };

  const handleLogout = async () => {
    try { await signOut(auth); } catch {}
    end();
    endSession();
    setCurrentAdmin(null);
  };

  if (loading || !authChecked) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{
          display:'flex', justifyContent:'center', alignItems:'center',
          minHeight:'100vh',
          background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)'
        }}>
          <Box sx={{ textAlign:'center', color:'white' }}>
            <CircularProgress sx={{ color:'white', mb:2 }} size={60} />
            <Box sx={{ fontSize:'1.2rem', fontWeight:'bold' }}>กำลังโหลดระบบ...</Box>
          </Box>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        {currentAdmin ? (
          <AdminMain currentAdmin={currentAdmin} onLogout={handleLogout} initialSection={initialSection} />
        ) : (
          <AdminLogin onLoginSuccess={handleLoginSuccess} />
        )}
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;