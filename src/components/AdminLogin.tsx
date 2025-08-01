'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Container,
  Avatar,
  Chip,
  Divider,
  Paper,
  Fade,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Google as GoogleIcon,
  Security as SecurityIcon,
  AdminPanelSettings as AdminIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import AdminPanel from './AdminPanel';

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


const AdminLogin: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminCodeDialog, setAdminCodeDialog] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await checkAdminAccess(user, {
          allowedAdminEmails: [], // TODO: Replace with your allowed admin emails
          adminCode: typeof adminCode !== 'undefined' ? adminCode : ''
        });
      } else {
        setAdminUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

const checkAdminAccess = async (user: User, config: { allowedAdminEmails: string[], adminCode: string }) => {
  try {
    const adminQuery = query(
      collection(db, 'adminUsers'),
      where('email', '==', user.email)
    );
    const adminSnapshot = await getDocs(adminQuery);

    if (!adminSnapshot.empty) {
      const adminData = adminSnapshot.docs[0].data() as AdminUser;
      if (adminData.isActive) {
        setAdminUser({
          ...adminData,
          id: adminSnapshot.docs[0].id
        });
      } else {
        setError('บัญชีแอดมินของคุณถูกปิดใช้งาน');
      }
    } else {
      if (config.allowedAdminEmails.includes(user.email || '')) {
        setPendingUser(user);
        setAdminCodeDialog(true);
      } else {
        setError('คุณไม่มีสิทธิ์เข้าถึงระบบแอดมิน');
      }
    }
  } catch (error) {
    console.error('Error checking admin access:', error);
    setError('เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์');
  }
};


  const handleGoogleLogin = async () => {
    setLoginLoading(true);
    setError('');
    
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      
      const result = await signInWithPopup(auth, provider);
      // checkAdminAccess จะถูกเรียกใน useEffect
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        setError('การเข้าสู่ระบบถูกยกเลิก');
      } else if (error.code === 'auth/popup-blocked') {
        setError('เบราว์เซอร์บล็อกป็อปอัพ กรุณาอนุญาตป็อปอัพและลองใหม่');
      } else {
        setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ' + error.message);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminCodeSubmit = async () => {
    if (adminCode !== adminCode) {
      setError('รหัสแอดมินไม่ถูกต้อง');
      return;
    }

    if (!pendingUser) {
      setError('ไม่พบข้อมูลผู้ใช้');
      return;
    }

    try {
      // สร้างบัญชีแอดมินใหม่
      const newAdminUser = {
        email: pendingUser.email,
        displayName: pendingUser.displayName,
        photoURL: pendingUser.photoURL,
        role: 'admin' as const,
        isActive: true,
        lastLogin: serverTimestamp(),
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'adminUsers'), newAdminUser);
      
      setAdminUser({
        ...newAdminUser,
        id: docRef.id,
        email: pendingUser.email ?? '',
        displayName: pendingUser.displayName ?? '',
        photoURL: pendingUser.photoURL ?? '',
        lastLogin: new Date(),
        createdAt: new Date()
      });

      setAdminCodeDialog(false);
      setAdminCode('');
      setPendingUser(null);
      setError('');
    } catch (error) {
      console.error('Error creating admin user:', error);
      setError('เกิดข้อผิดพลาดในการสร้างบัญชีแอดมิน');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAdminUser(null);
      setError('');
    } catch (error) {
      console.error('Logout error:', error);
      setError('เกิดข้อผิดพลาดในการออกจากระบบ');
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          bgcolor: 'grey.50'
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={60} thickness={4} />
          <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary' }}>
            กำลังโหลด...
          </Typography>
        </Box>
      </Box>
    );
  }

  // แสดง AdminPanel หากเข้าสู่ระบบสำเร็จ
  if (user && adminUser) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
        {/* Admin Header */}
        <AppBar position="static" elevation={1} sx={{ bgcolor: 'primary.main' }}>
          <Toolbar>
            <AdminIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              ระบบจัดการแอดมิน
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                avatar={<Avatar src={adminUser.photoURL} sx={{ width: 24, height: 24 }} />}
                label={adminUser.displayName}
                variant="outlined"
                sx={{ color: 'white', borderColor: 'white' }}
              />
              <Chip
                label={adminUser.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                color="secondary"
                size="small"
              />
              <IconButton color="inherit" onClick={handleLogout}>
                <LogoutIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Admin Panel Content */}
        <AdminPanel />
      </Box>
    );
  }

  // แสดงหน้าเข้าสู่ระบบ
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 4
      }}
    >
      <Container maxWidth="sm">
        <Fade in timeout={800}>
          <Card
            elevation={24}
            sx={{
              borderRadius: 4,
              overflow: 'hidden',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Box
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                p: 4,
                textAlign: 'center'
              }}
            >
              <Avatar
                sx={{
                  bgcolor: 'white',
                  color: 'primary.main',
                  width: 80,
                  height: 80,
                  mx: 'auto',
                  mb: 2,
                  fontSize: '2rem'
                }}
              >
                <SecurityIcon fontSize="large" />
              </Avatar>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                ระบบแอดมิน
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                เข้าสู่ระบบจัดการกิจกรรม
              </Typography>
            </Box>

            <CardContent sx={{ p: 4 }}>
              {error && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                  {error}
                </Alert>
              )}

              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom color="text.secondary">
                  เข้าสู่ระบบด้วย Google
                </Typography>
                
                <Button
                  variant="contained"
                  size="large"
                  startIcon={loginLoading ? <CircularProgress size={20} color="inherit" /> : <GoogleIcon />}
                  onClick={handleGoogleLogin}
                  disabled={loginLoading}
                  sx={{
                    mt: 2,
                    py: 1.5,
                    px: 4,
                    borderRadius: 3,
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    background: 'linear-gradient(45deg, #4285f4 30%, #34a853 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #3367d6 30%, #2d8f47 90%)',
                    }
                  }}
                  fullWidth
                >
                  {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}
                </Button>

                <Divider sx={{ my: 3 }} />

                <Typography variant="body2" color="text.secondary">
                  สำหรับแอดมินเท่านั้น
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  ติดต่อผู้ดูแลระบบหากต้องการสิทธิ์การเข้าถึง
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      </Container>

      {/* Admin Code Dialog */}
      <Dialog 
        open={adminCodeDialog} 
        onClose={() => setAdminCodeDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', textAlign: 'center' }}>
          <SecurityIcon sx={{ mr: 1 }} />
          ยืนยันรหัสแอดมิน
        </DialogTitle>
        <DialogContent sx={{ p: 4 }}>
          <Typography variant="body1" gutterBottom sx={{ mb: 3 }}>
            กรุณาใส่รหัสแอดมินเพื่อยืนยันการเข้าถึงระบบ
          </Typography>
          <TextField
            fullWidth
            label="รหัสแอดมิน"
            type="password"
            value={adminCode}
            onChange={(e) => setAdminCode(e.target.value)}
            placeholder="ใส่รหัสแอดมิน"
            sx={{ mb: 2 }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAdminCodeSubmit();
              }
            }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={() => {
              setAdminCodeDialog(false);
              setAdminCode('');
              setError('');
              handleLogout();
            }}
            color="inherit"
          >
            ยกเลิก
          </Button>
          <Button 
            onClick={handleAdminCodeSubmit}
            variant="contained"
            disabled={!adminCode}
          >
            ยืนยัน
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminLogin;