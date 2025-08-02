// App.tsx - Main Application Component
"use client";

import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { AdminMain } from '../../components/admin/AdminMain';
import AdminLogin from "../../components/AdminLogin";
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { AdminProfile, AdminRole, AdminDepartment, AdminPermission } from '../../types/admin';

// Define AdminUser interface to match the one in AdminLogin.tsx
interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'super_admin';
  isActive: boolean;
  lastLogin: Date;
  createdAt: Date;
}

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Kanit", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
  },
});

function App() {
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        // ตรวจสอบว่าผู้ใช้เป็นแอดมินหรือไม่
        await checkAndSetAdminUser(user);
      } else {
        setCurrentAdmin(null);
      }
      setAuthChecked(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const checkAndSetAdminUser = async (user: User) => {
    try {
      const adminQuery = query(
        collection(db, 'adminUsers'),
        where('email', '==', user.email)
      );
      const adminSnapshot = await getDocs(adminQuery);

      if (!adminSnapshot.empty) {
        const adminData = adminSnapshot.docs[0].data() as Omit<AdminUser, 'id' | 'lastLogin' | 'createdAt'> & {
          lastLogin?: Timestamp | Date;
          createdAt: Timestamp | Date;
          firstName?: string;
          lastName?: string;
          department?: string;
        };
        
        if (adminData.isActive) {
          // แปลง AdminUser เป็น AdminProfile
          const adminProfile: AdminProfile = {
            uid: user.uid,
            email: adminData.email,
            displayName: adminData.displayName,
            firstName: adminData.firstName || adminData.displayName?.split(' ')[0] || 'Admin',
            lastName: adminData.lastName || adminData.displayName?.split(' ')[1] || 'User',
            department: (adminData.department as AdminDepartment) || 'it' as AdminDepartment,
            role: adminData.role as AdminRole, // Type assertion for role conversion
            isActive: adminData.isActive,
            lastLoginAt: (() => {
              const loginTime = adminData.lastLogin;
              if (loginTime instanceof Timestamp) {
                return loginTime.toDate();
              } else if (loginTime instanceof Date) {
                return loginTime;
              } else {
                return new Date();
              }
            })(),
            createdAt: adminData.createdAt instanceof Timestamp ? 
              adminData.createdAt.toDate() : 
              adminData.createdAt instanceof Date ? 
              adminData.createdAt : 
              new Date(),
            permissions: getPermissionsForRole(adminData.role),
            updatedAt: new Date()
          };
          setCurrentAdmin(adminProfile);
        }
      }
    } catch (error) {
      console.error('Error checking admin user:', error);
    }
  };

  // Helper function to get permissions based on role
  const getPermissionsForRole = (role: 'admin' | 'super_admin'): AdminPermission[] => {
    // Use type assertion to work with strict typing
    if (role === 'super_admin') {
      return ['read', 'write', 'delete', 'manage_users', 'manage_activities', 'view_analytics'] as AdminPermission[];
    } else {
      return ['read', 'write', 'manage_activities'] as AdminPermission[];
    }
  };

  const handleLoginSuccess = (adminUser: AdminUser) => {
    // แปลง AdminUser เป็น AdminProfile
    const adminProfile: AdminProfile = {
      uid: adminUser.id, // ใช้ id เป็น uid
      email: adminUser.email,
      displayName: adminUser.displayName,
      firstName: adminUser.displayName?.split(' ')[0] || 'Admin',
      lastName: adminUser.displayName?.split(' ')[1] || 'User',
      department: 'it' as AdminDepartment, // Use lowercase to match AdminDepartment type
      role: adminUser.role as AdminRole, // Type assertion for role conversion
      isActive: adminUser.isActive,
      lastLoginAt: adminUser.lastLogin, // Use lastLogin from AdminUser
      createdAt: adminUser.createdAt,
      permissions: getPermissionsForRole(adminUser.role),
      updatedAt: new Date()
    };
    setCurrentAdmin(adminProfile);
  };

  const handleLogout = async () => {
    try {
      setCurrentAdmin(null);
      // AdminLogin component หรือ AdminMain จะจัดการ Firebase signOut จริง
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading || !authChecked) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}>
          <Box sx={{ textAlign: 'center', color: 'white' }}>
            <CircularProgress sx={{ color: 'white', mb: 2 }} size={60} />
            <Box sx={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
              กำลังโหลดระบบ...
            </Box>
          </Box>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        {currentAdmin ? (
          <AdminMain
            currentAdmin={currentAdmin}
            onLogout={handleLogout}
          />
        ) : (
          <AdminLogin onLoginSuccess={handleLoginSuccess} />
        )}
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;