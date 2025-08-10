'use client';

import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

// default import ให้ตรงกับ default export
import AdminMain from '../../components/admin/AdminMain';
import AdminLogin from '../../components/AdminLogin';

import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { AdminProfile, AdminRole, AdminDepartment } from '../../types/admin';

const theme = createTheme({});

function App() {
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) await checkAndSetAdminUser(user);
      else setCurrentAdmin(null);
      setAuthChecked(true);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const checkAndSetAdminUser = async (user: User) => {
    try {
      const ref = doc(db, 'adminUsers', user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      const adminData = snap.data() as {
        email: string; displayName: string;
        firstName?: string; lastName?: string; department?: string;
        role: 'admin' | 'super_admin'; isActive: boolean;
        lastLogin?: Timestamp | Date; createdAt: Timestamp | Date;
      };
      if (!adminData.isActive) return;

      const { normalizeDepartment, ROLE_PERMISSIONS } = await import('../../types/admin');
      const roleMap = { super_admin: 'super_admin', admin: 'department_admin' } as const;
      const mappedRole = roleMap[adminData.role] as AdminRole;

      const adminProfile: AdminProfile = {
        uid: user.uid,
        email: adminData.email,
        displayName: adminData.displayName,
        firstName: adminData.firstName || adminData.displayName?.split(' ')[0] || 'Admin',
        lastName: adminData.lastName || adminData.displayName?.split(' ')[1] || 'User',
        department: normalizeDepartment(adminData.department),
        role: mappedRole,
        isActive: adminData.isActive,
        lastLoginAt: adminData.lastLogin instanceof Timestamp
          ? adminData.lastLogin.toDate()
          : (adminData.lastLogin as Date) ?? new Date(),
        createdAt: adminData.createdAt instanceof Timestamp
          ? adminData.createdAt.toDate()
          : (adminData.createdAt as Date),
        permissions: ROLE_PERMISSIONS[mappedRole],
        updatedAt: new Date(),
      };

      setCurrentAdmin(adminProfile);
    } catch (e) {
      console.error('Error checking admin user:', e);
    }
  };

  const handleLoginSuccess = (adminUser: {
    id: string; email: string; displayName: string;
    role: 'admin' | 'super_admin'; isActive: boolean;
    lastLogin: Date; createdAt: Date;
  }) => {
    (async () => {
      const { ROLE_PERMISSIONS } = await import('../../types/admin');
      const roleMap = { super_admin: 'super_admin', admin: 'department_admin' } as const;
      const mappedRole = roleMap[adminUser.role] as AdminRole;

      setCurrentAdmin({
        uid: adminUser.id,
        email: adminUser.email,
        displayName: adminUser.displayName,
        firstName: adminUser.displayName?.split(' ')[0] || 'Admin',
        lastName: adminUser.displayName?.split(' ')[1] || 'User',
        department: 'all' as AdminDepartment,
        role: mappedRole,
        isActive: adminUser.isActive,
        lastLoginAt: adminUser.lastLogin,
        createdAt: adminUser.createdAt,
        permissions: ROLE_PERMISSIONS[mappedRole],
        updatedAt: new Date(),
      });
    })();
  };

  const handleLogout = () => setCurrentAdmin(null);

  if (loading || !authChecked) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh',
                   background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)' }}>
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
          <AdminMain currentAdmin={currentAdmin} onLogout={handleLogout} />
        ) : (
          <AdminLogin onLoginSuccess={handleLoginSuccess} />
        )}
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;
