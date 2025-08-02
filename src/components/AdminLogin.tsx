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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useMediaQuery,
  useTheme,
  Slide,
  Zoom,
  Stack,
  IconButton
} from '@mui/material';
import {
  Google as GoogleIcon,
  Security as SecurityIcon,
  Logout as LogoutIcon,
  Shield as ShieldIcon,
  Lock as LockIcon,
  Person as PersonIcon
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
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// Add these constants at the top of the file after imports
const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE || 'default-admin-code';
const allowedAdminEmails = [
  // Add allowed admin emails here
  'doralaikon.th@gmail.com',
  '10035@swr2.ac.th'
];

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

interface AdminLoginProps {
  onLoginSuccess?: (adminUser: AdminUser) => void;
}

interface TransitionProps {
  children: React.ReactElement;
  direction?: 'up' | 'down' | 'left' | 'right';
}

const TransitionUp = React.forwardRef<any, TransitionProps>(
  ({ children, ...other }, ref) => (
    <Slide direction="up" ref={ref} {...other}>
      {children}
    </Slide>
  )
);

const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [user, setUser] = useState<User | null>(null);
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
        await checkAdminAccess(user);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const checkAdminAccess = async (user: User) => {
    try {
      const adminQuery = query(
        collection(db, 'adminUsers'),
        where('email', '==', user.email)
      );
      const adminSnapshot = await getDocs(adminQuery);

      if (!adminSnapshot.empty) {
        const adminData = adminSnapshot.docs[0].data() as Omit<AdminUser, 'id' | 'lastLogin' | 'createdAt'> & {
          lastLogin: Timestamp | Date;
          createdAt: Timestamp | Date;
        };
        
        if (adminData.isActive) {
          const adminUser: AdminUser = {
            ...adminData,
            id: adminSnapshot.docs[0].id,
            lastLogin: adminData.lastLogin instanceof Timestamp ? 
              adminData.lastLogin.toDate() : 
              adminData.lastLogin instanceof Date ? 
              adminData.lastLogin : 
              new Date(),
            createdAt: adminData.createdAt instanceof Timestamp ? 
              adminData.createdAt.toDate() : 
              adminData.createdAt instanceof Date ? 
              adminData.createdAt : 
              new Date()
          };
          
          // Call the success callback to notify parent component
          if (onLoginSuccess) {
            onLoginSuccess(adminUser);
          }
        } else {
          setError('บัญชีแอดมินของคุณถูกปิดใช้งาน');
        }
      } else {
        // Check if email is in allowed list
        if (allowedAdminEmails.includes(user.email || '')) {
          setPendingUser(user);
          setAdminCodeDialog(true);
        } else {
          setError('คุณไม่มีสิทธิ์เข้าถึงระบบแอดมิน');
          await signOut(auth);
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
      // checkAdminAccess will be called in useEffect
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
    if (adminCode !== ADMIN_CODE) {
      setError('รหัสแอดมินไม่ถูกต้อง');
      return;
    }

    if (!pendingUser) {
      setError('ไม่พบข้อมูลผู้ใช้');
      return;
    }

    try {
      // Create new admin user
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
      
      const adminUser: AdminUser = {
        ...newAdminUser,
        id: docRef.id,
        email: pendingUser.email ?? '',
        displayName: pendingUser.displayName ?? '',
        photoURL: pendingUser.photoURL ?? '',
        lastLogin: new Date(),
        createdAt: new Date()
      };

      setAdminCodeDialog(false);
      setAdminCode('');
      setPendingUser(null);
      setError('');
      
      // Call the success callback
      if (onLoginSuccess) {
        onLoginSuccess(adminUser);
      }
    } catch (error) {
      console.error('Error creating admin user:', error);
      setError('เกิดข้อผิดพลาดในการสร้างบัญชีแอดมิน');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
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
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          }
        }}
      >
        <Zoom in timeout={1000}>
          <Box sx={{ textAlign: 'center', zIndex: 1 }}>
            <Box
              sx={{
                position: 'relative',
                display: 'inline-block',
                mb: 3
              }}
            >
              <CircularProgress 
                size={isSmallMobile ? 50 : 70} 
                thickness={3} 
                sx={{ color: 'white' }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <SecurityIcon 
                  sx={{ 
                    color: 'white', 
                    fontSize: isSmallMobile ? 24 : 32 
                  }} 
                />
              </Box>
            </Box>
            <Typography 
              variant={isSmallMobile ? "h6" : "h5"} 
              sx={{ 
                color: 'white',
                fontWeight: 'bold',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              กำลังโหลดระบบแอดมิน...
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'rgba(255,255,255,0.8)',
                mt: 1
              }}
            >
              โปรดรอสักครู่
            </Typography>
          </Box>
        </Zoom>
      </Box>
    );
  }

  // Enhanced Login Screen
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
        px: { xs: 2, sm: 3 },
        py: { xs: 2, sm: 4 },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)
          `,
        }
      }}
    >
      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <Fade in timeout={800}>
          <Card
            elevation={24}
            sx={{
              borderRadius: { xs: 3, sm: 4 },
              overflow: 'hidden',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.2)',
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
              }
            }}
          >
            {/* Header Section */}
            <Box
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                p: { xs: 3, sm: 4 },
                textAlign: 'center',
                position: 'relative',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '1px',
                  background: 'rgba(255,255,255,0.2)'
                }
              }}
            >
              <Zoom in timeout={1200}>
                <Avatar
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.15)',
                    color: 'white',
                    width: { xs: 60, sm: 80 },
                    height: { xs: 60, sm: 80 },
                    mx: 'auto',
                    mb: 2,
                    fontSize: { xs: '1.5rem', sm: '2rem' },
                    border: '2px solid rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <ShieldIcon fontSize="large" />
                </Avatar>
              </Zoom>
              <Typography 
                variant={isSmallMobile ? "h5" : "h4"} 
                fontWeight="bold" 
                gutterBottom
                sx={{
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                ระบบแอดมิน
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  opacity: 0.9,
                  fontSize: { xs: '0.9rem', sm: '1rem' }
                }}
              >
                เข้าสู่ระบบจัดการกิจกรรม
              </Typography>
            </Box>

            {/* Content Section */}
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              {error && (
                <Fade in>
                  <Alert 
                    severity="error" 
                    sx={{ 
                      mb: 3, 
                      borderRadius: 2,
                      fontSize: { xs: '0.85rem', sm: '0.875rem' }
                    }}
                  >
                    {error}
                  </Alert>
                </Fade>
              )}

              <Stack spacing={3} alignItems="center">
                {/* Login Instructions */}
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                    <LockIcon sx={{ color: 'primary.main', mr: 1 }} />
                    <Typography 
                      variant="h6" 
                      color="text.primary"
                      sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}
                    >
                      เข้าสู่ระบบด้วย Google
                    </Typography>
                  </Box>
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                      maxWidth: 300, 
                      mx: 'auto',
                      fontSize: { xs: '0.8rem', sm: '0.875rem' }
                    }}
                  >
                    ระบบจะตรวจสอบสิทธิ์การเข้าถึงโดยอัตโนมัติ
                  </Typography>
                </Box>
                
                {/* Google Login Button */}
                <Button
                  variant="contained"
                  size="large"
                  startIcon={loginLoading ? 
                    <CircularProgress size={20} color="inherit" /> : 
                    <GoogleIcon />
                  }
                  onClick={handleGoogleLogin}
                  disabled={loginLoading}
                  sx={{
                    width: '100%',
                    py: { xs: 1.2, sm: 1.5 },
                    px: 4,
                    borderRadius: 3,
                    fontSize: { xs: '1rem', sm: '1.1rem' },
                    fontWeight: 'bold',
                    background: 'linear-gradient(45deg, #4285f4 30%, #34a853 90%)',
                    boxShadow: '0 4px 15px rgba(66, 133, 244, 0.3)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #3367d6 30%, #2d8f47 90%)',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 6px 20px rgba(66, 133, 244, 0.4)'
                    },
                    '&:disabled': {
                      background: 'linear-gradient(45deg, #9e9e9e 30%, #757575 90%)'
                    }
                  }}
                >
                  {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}
                </Button>

                <Divider sx={{ width: '100%', my: 2 }} >
                  <Chip 
                    label="ระบบรักษาความปลอดภัย" 
                    size="small" 
                    sx={{ 
                      bgcolor: 'primary.main', 
                      color: 'white',
                      fontSize: { xs: '0.7rem', sm: '0.75rem' }
                    }} 
                  />
                </Divider>

                {/* Security Info */}
                <Paper
                  sx={{
                    p: { xs: 2, sm: 3 },
                    bgcolor: 'grey.50',
                    borderRadius: 2,
                    width: '100%',
                    border: '1px solid',
                    borderColor: 'grey.200'
                  }}
                >
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PersonIcon sx={{ color: 'primary.main', mr: 1.5, fontSize: 20 }} />
                      <Typography 
                        variant="body2" 
                        color="text.primary"
                        sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                      >
                        <strong>สำหรับแอดมินเท่านั้น</strong>
                      </Typography>
                    </Box>
                    <Typography 
                      variant="caption" 
                      color="text.secondary" 
                      sx={{ 
                        display: 'block',
                        fontSize: { xs: '0.75rem', sm: '0.8rem' },
                        lineHeight: 1.4
                      }}
                    >
                      หากคุณต้องการสิทธิ์การเข้าถึง กรุณาติดต่อผู้ดูแลระบบ
                      เพื่อขอรหัสแอดมินและเพิ่มอีเมลของคุณในรายชื่อผู้ดูแล
                    </Typography>
                  </Stack>
                </Paper>
              </Stack>
            </CardContent>
          </Card>
        </Fade>
      </Container>

      {/* Enhanced Admin Code Dialog */}
      <Dialog 
        open={adminCodeDialog} 
        onClose={() => setAdminCodeDialog(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={TransitionUp}
        PaperProps={{
          sx: {
            borderRadius: { xs: 2, sm: 3 },
            m: { xs: 2, sm: 3 },
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)'
          }
        }}
      >
        <DialogTitle 
          sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white', 
            textAlign: 'center',
            py: { xs: 2, sm: 3 }
          }}
        >
          <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          <Typography 
            component="span" 
            variant={isSmallMobile ? "h6" : "h5"}
            sx={{ fontWeight: 'bold' }}
          >
            ยืนยันรหัสแอดมิน
          </Typography>
        </DialogTitle>
        
        <DialogContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Avatar
                sx={{
                  bgcolor: 'primary.main',
                  width: { xs: 50, sm: 60 },
                  height: { xs: 50, sm: 60 },
                  mx: 'auto',
                  mb: 2
                }}
              >
                <LockIcon />
              </Avatar>
              <Typography 
                variant="body1" 
                gutterBottom 
                sx={{ 
                  mb: 3,
                  fontSize: { xs: '0.9rem', sm: '1rem' }
                }}
              >
                กรุณาใส่รหัสแอดมินเพื่อยืนยันการเข้าถึงระบบ
              </Typography>
            </Box>
            
            <TextField
              fullWidth
              label="รหัสแอดมิน"
              type="password"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              placeholder="ใส่รหัสแอดมิน"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAdminCodeSubmit();
                }
              }}
            />
            
            {error && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {error}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        
        <DialogActions sx={{ p: { xs: 2, sm: 3 }, gap: 1 }}>
          <Button 
            onClick={() => {
              setAdminCodeDialog(false);
              setAdminCode('');
              setError('');
              handleLogout();
            }}
            color="inherit"
            sx={{ 
              borderRadius: 2,
              px: { xs: 2, sm: 3 }
            }}
          >
            ยกเลิก
          </Button>
          <Button 
            onClick={handleAdminCodeSubmit}
            variant="contained"
            disabled={!adminCode}
            sx={{ 
              borderRadius: 2,
              px: { xs: 2, sm: 3 }
            }}
          >
            ยืนยัน
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminLogin;