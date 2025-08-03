// components/navigation/NavigationBar.tsx
'use client';
import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Select,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Snackbar
} from '@mui/material';
import {
  EventNote as EventIcon,
  Logout as LogoutIcon,
  AccountCircle as AccountIcon,
  Save as SaveIcon,
  AutoFixHigh as AutoFillIcon
} from '@mui/icons-material';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase'; // Adjust import path as needed
import { UniversityUserProfile } from '../../lib/firebaseAuth';

interface NavigationBarProps {
  user: any;
  userData: UniversityUserProfile | null;
  onLogout: () => void;
  onUserDataUpdate?: (userData: UniversityUserProfile) => void;
  onEditProfile?: () => void; // Add this line
}

// Thai university data with faculty codes for PSU
const PSU_FACULTIES = [
  { name: 'คณะวิศวกรรมศาสตร์', code: '01' },
  { name: 'คณะวิทยาศาสตร์', code: '02' },
  { name: 'คณะแพทยศาสตร์', code: '03' },
  { name: 'คณะทรัพยากรธรรมชาติ', code: '04' },
  { name: 'คณะศึกษาศาสตร์', code: '05' },
  { name: 'คณะมนุษยศาสตร์และสังคมศาสตร์', code: '06' },
  { name: 'คณะเศรษฐศาสตร์', code: '07' },
  { name: 'คณะบริหารธุรกิจ', code: '08' },
  { name: 'คณะศิลปกรรมศาสตร์', code: '09' },
  { name: 'คณะพยาบาลศาสตร์', code: '10' },
  { name: 'คณะเภสัชศาสตร์', code: '11' },
  { name: 'คณะทันตแพทยศาสตร์', code: '12' },
  { name: 'คณะสัตวแพทยศาสตร์', code: '13' }
];

// Degree levels
const DEGREE_LEVELS = [
  { name: 'ปริญญาตรี', code: '1' },
  { name: 'ปริญญาโท', code: '2' },
  { name: 'ปริญญาเอก', code: '3' }
];

const NavigationBar: React.FC<NavigationBarProps> = ({ 
  user, 
  userData, 
  onLogout, 
  onUserDataUpdate,
  onEditProfile // Add this parameter
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [autoFillDialogOpen, setAutoFillDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  // Form states
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    studentId: '',
    university: '',
    faculty: '',
    department: '',
    degree: '',
    phoneNumber: '',
    photoURL: ''
  });

  // Auto-filled data that cannot be edited
  const [autoFilledData, setAutoFilledData] = useState({
    firstName: '',
    lastName: '',
    englishName: '',
    studentId: '', // เพิ่ม studentId เข้าไปใน autoFilledData
    faculty: '',   // เพิ่ม faculty
    degree: ''     // เพิ่ม degree
  });

  const open = Boolean(anchorEl);

  // Initialize form data when userData changes
  useEffect(() => {
    if (userData) {
      setFormData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        displayName: userData.displayName || '',
        studentId: userData.studentId || '',
        university: (userData as any)?.university || '',
        faculty: userData.faculty || '',
        department: userData.department || '',
        degree: (userData as any)?.degree || '', // Fix: Added missing degree property
        phoneNumber: (userData as any)?.phoneNumber || '',
        photoURL: userData.photoURL || ''
      });
    }
  }, [userData]);

  // Enhanced function to extract information from Microsoft display name
  const extractMicrosoftUserInfo = (displayName: string) => {
    // Pattern for: "Werachart Kaewkham (วีรชาติ แก้วขำ) ปริญญาตรี สาขาวิชาวิทยาศาสตร์การคำนวณ คณะวิทยาศาสตร์"
    const result = {
      englishName: '',
      firstName: '',
      lastName: '',
      degree: '',
      department: '',
      faculty: '',
      university: 'มหาวิทยาลัยสงขลานครินทร์' // Default
    };

    // Extract English name (before parentheses)
    const englishNameMatch = displayName.match(/^([^(]+)/);
    if (englishNameMatch) {
      result.englishName = englishNameMatch[1].trim();
    }

    // Extract Thai name from parentheses
    const thaiNameMatch = displayName.match(/\(([^)]+)\)/);
    if (thaiNameMatch) {
      const thaiFullName = thaiNameMatch[1].trim();
      const nameParts = thaiFullName.split(/\s+/);
      if (nameParts.length >= 2) {
        result.firstName = nameParts[0];
        result.lastName = nameParts.slice(1).join(' ');
      } else {
        result.firstName = thaiFullName;
        result.lastName = '';
      }
    }

    // Extract degree information
    const degreeMatch = displayName.match(/ปริญญา\w+/);
    if (degreeMatch) {
      result.degree = degreeMatch[0];
    }

    // Extract department/major (สาขาวิชา...)
    const departmentMatch = displayName.match(/สาขาวิชา([^\s]+(?:\s+[^\s]+)*?)(?:\s+คณะ|$)/);
    if (departmentMatch) {
      result.department = departmentMatch[1].trim();
    }

    // Extract faculty (คณะ...)
    const facultyMatch = displayName.match(/คณะ([^\s]+(?:\s+[^\s]+)*?)(?:\s|$)/);
    if (facultyMatch) {
      const facultyName = `คณะ${facultyMatch[1].trim()}`;
      result.faculty = facultyName;
    }

    // If we found a faculty, try to match it with PSU data
    if (result.faculty) {
      const facultyExists = PSU_FACULTIES.some(f => f.name === result.faculty);
      if (facultyExists) {
        result.university = 'มหาวิทยาลัยสงขลานครินทร์';
      }
    }

    return result;
  };

  // Generate student ID based on PSU structure: 67 1 02 1 0317
  const generateStudentId = (faculty: string) => {
    // Current year (last 2 digits)
    const year = new Date().getFullYear().toString().slice(-2);
    
    // Degree level (1 = ปริญญาตรี)
    const degreeLevel = '1';
    
    // Faculty code
    let facultyCode = '02'; // Default to คณะวิทยาศาสตร์
    const facultyData = PSU_FACULTIES.find(f => f.name === faculty);
    if (facultyData) {
      facultyCode = facultyData.code;
    }
    
    // Major code (1 = first major in faculty)
    const majorCode = '1';
    
    // Random 4-digit sequential number
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    return `${year}${degreeLevel}${facultyCode}${majorCode}${randomNum}`;
  };

  // Function to detect faculty and degree from student ID
  const detectInfoFromStudentId = (studentId: string): { faculty: string, degree: string } => {
    const result = { faculty: 'คณะวิทยาศาสตร์', degree: 'ปริญญาตรี' };
    
    if (studentId.length >= 5) {
      // Detect degree (position 3)
      const degreeCode = studentId.substring(2, 3);
      const degree = DEGREE_LEVELS.find(d => d.code === degreeCode);
      if (degree) {
        result.degree = degree.name;
      }
      
      // Detect faculty (positions 4-5)
      const facultyCode = studentId.substring(3, 5);
      const faculty = PSU_FACULTIES.find(f => f.code === facultyCode);
      if (faculty) {
        result.faculty = faculty.name;
      }
    }
    
    return result;
  };

  // Auto-detect and populate user data
  const autoFillUserData = () => {
    const email = user?.email || '';
    const displayName = user?.displayName || '';
    
    // Extract information from Microsoft display name
    const extractedInfo = extractMicrosoftUserInfo(displayName);
    
    // Set university to PSU only
    const university = 'มหาวิทยาลัยสงขลานครินทร์';
    
    // Try to extract student ID from email first
    let studentId = '';
    let detectedFaculty = extractedInfo.faculty || 'คณะวิทยาศาสตร์';
    let detectedDegree = 'ปริญญาตรี'; // Default degree
    
    const emailMatch = email.match(/^(\d{8,12})/);
    if (emailMatch) {
      studentId = emailMatch[1];
      // If we have a student ID, try to detect faculty and degree from it
      const detectedInfo = detectInfoFromStudentId(studentId);
      detectedFaculty = detectedInfo.faculty;
      detectedDegree = detectedInfo.degree;
    } else {
      // Generate student ID based on detected or default faculty
      studentId = generateStudentId(detectedFaculty);
    }
    
    // Set auto-filled data (non-editable)
    setAutoFilledData({
      firstName: extractedInfo.firstName || 'ไม่ระบุ',
      lastName: extractedInfo.lastName || 'ไม่ระบุ',
      englishName: extractedInfo.englishName || '',
      studentId: studentId, // รหัสนักศึกษาไม่สามารถแก้ไขได้
      faculty: detectedFaculty, // คณะไม่สามารถแก้ไขได้
      degree: detectedDegree    // ระดับปริญญาไม่สามารถแก้ไขได้
    });

    // Set form data (editable fields)
    const autoFilledFormData = {
      firstName: extractedInfo.firstName || 'ไม่ระบุ',
      lastName: extractedInfo.lastName || 'ไม่ระบุ',
      displayName: displayName || `${extractedInfo.firstName} ${extractedInfo.lastName}`.trim() || 'ผู้ใช้งาน',
      studentId: studentId, // ใช้เพื่อแสดงใน form แต่จะไม่สามารถแก้ไขได้
      university: university,
      faculty: detectedFaculty,
      department: extractedInfo.department || 'วิศวกรรมคอมพิวเตอร์',
      degree: detectedDegree,
      phoneNumber: '',
      photoURL: user?.photoURL || ''
    };
    
    setFormData(autoFilledFormData);
    setAutoFillDialogOpen(true);
  };

  // Save user data to Firebase
  const saveUserData = async (dataToSave: any) => {
    if (!user?.uid) return false;
    
    setLoading(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userProfile: UniversityUserProfile = {
        uid: user.uid,
        email: user.email,
        ...dataToSave,
        lastUpdated: new Date(),
        createdAt: userData?.createdAt || new Date()
      };
      
      await setDoc(userDocRef, userProfile, { merge: true });
      
      // Update parent component
      if (onUserDataUpdate) {
        onUserDataUpdate(userProfile);
      }
      
      setSnackbar({
        open: true,
        message: 'บันทึกข้อมูลเรียบร้อยแล้ว',
        severity: 'success'
      });
      
      return true;
    } catch (error) {
      console.error('Error saving user data:', error);
      setSnackbar({
        open: true,
        message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
        severity: 'error'
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    onLogout();
  };

  const handleAutoFill = () => {
    handleMenuClose();
    autoFillUserData();
  };

  const handleConfirmAutoFill = async () => {
    const success = await saveUserData(formData);
    if (success) {
      setAutoFillDialogOpen(false);
    }
  };

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Helper functions
  const getDisplayName = () => {
    if (userData?.displayName) return userData.displayName;
    if (userData?.firstName && userData?.lastName) return `${userData.firstName} ${userData.lastName}`;
    if (user?.displayName) {
      const extractedInfo = extractMicrosoftUserInfo(user.displayName);
      return `${extractedInfo.firstName} ${extractedInfo.lastName}`.trim();
    }
    if (user?.email) return user.email.split('@')[0];
    return 'ผู้ใช้';
  };

  const getAvatarSrc = () => {
    if (userData?.photoURL) return userData.photoURL;
    if (user?.photoURL) return user.photoURL;
    return null;
  };

  const getAvatarLetter = () => {
    if (userData?.firstName) return userData.firstName.charAt(0).toUpperCase();
    if (user?.displayName) {
      const extractedInfo = extractMicrosoftUserInfo(user.displayName);
      return extractedInfo.firstName.charAt(0).toUpperCase();
    }
    return getDisplayName().charAt(0).toUpperCase();
  };

  const getSubtitle = () => {
    if ((userData as any)?.faculty && (userData as any)?.department) {
      return `${(userData as any).faculty} - ${(userData as any).department}`;
    }
    if ((userData as any)?.department) return (userData as any).department;
    if ((userData as any)?.faculty) return (userData as any).faculty;
    return 'กรุณากรอกข้อมูลส่วนตัว';
  };

  const availableFaculties = PSU_FACULTIES;

  return (
    <>
      <AppBar 
        position="static" 
        sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          mb: 3,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, sm: 72 } }}>
          {/* Logo and Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventIcon sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                flexGrow: 1,
                fontSize: { xs: '1rem', sm: '1.25rem' },
                fontWeight: 'bold'
              }}
            >
              ระบบลงทะเบียนกิจกรรม
            </Typography>
          </Box>
          
          {/* User Profile Section */}
          {user ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 'auto' }}>
              {/* User Info - Hidden on mobile */}
              <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'rgba(255,255,255,0.9)', 
                    fontWeight: 'medium',
                    lineHeight: 1.2
                  }}
                >
                  {getDisplayName()}
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'rgba(255,255,255,0.7)',
                    lineHeight: 1.1
                  }}
                >
                  {getSubtitle()}
                </Typography>
              </Box>
              
              {/* Profile Avatar */}
              <Tooltip title="จัดการบัญชี">
                <IconButton
                  onClick={handleMenuClick}
                  sx={{ p: 0 }}
                >
                  <Avatar 
                    src={getAvatarSrc() || undefined}
                    sx={{ 
                      width: { xs: 36, sm: 40 }, 
                      height: { xs: 36, sm: 40 }, 
                      border: '2px solid rgba(255,255,255,0.5)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      fontSize: { xs: '1rem', sm: '1.125rem' }
                    }}
                  >
                    {!getAvatarSrc() && getAvatarLetter()}
                  </Avatar>
                </IconButton>
              </Tooltip>

              {/* Profile Menu */}
              <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleMenuClose}
                onClick={handleMenuClose}
                PaperProps={{
                  elevation: 0,
                  sx: {
                    overflow: 'visible',
                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                    mt: 1.5,
                    minWidth: { xs: 260, sm: 300 },
                    '&:before': {
                      content: '""',
                      display: 'block',
                      position: 'absolute',
                      top: 0,
                      right: 14,
                      width: 10,
                      height: 10,
                      bgcolor: 'background.paper',
                      transform: 'translateY(-50%) rotate(45deg)',
                      zIndex: 0,
                    },
                  },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                {/* Profile Header */}
                <Box sx={{ px: 2, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar 
                      src={getAvatarSrc() || undefined} 
                      sx={{ 
                        width: 48, 
                        height: 48,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    >
                      {!getAvatarSrc() && getAvatarLetter()}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography 
                        variant="subtitle1" 
                        fontWeight="bold"
                        sx={{ 
                          wordBreak: 'break-word',
                          lineHeight: 1.2
                        }}
                      >
                        {getDisplayName()}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          fontSize: '0.75rem',
                          wordBreak: 'break-all',
                          lineHeight: 1.1
                        }}
                      >
                        {user.email}
                      </Typography>
                      {(userData as any)?.faculty && (
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ 
                            display: 'block',
                            mt: 0.5,
                            lineHeight: 1.1
                          }}
                        >
                          {(userData as any).faculty}
                          {(userData as any).department && ` - ${(userData as any).department}`}
                          {(userData as any).degree && (
                            <Typography 
                              component="span" 
                              variant="caption" 
                              sx={{ 
                                display: 'block',
                                color: 'primary.main',
                                fontWeight: 'medium'
                              }}
                            >
                              {(userData as any).degree}
                            </Typography>
                          )}
                        </Typography>
                      )}
                      {userData?.studentId && (
                        <Typography 
                          variant="caption" 
                          color="primary.main" 
                          sx={{ 
                            display: 'block', 
                            fontFamily: 'monospace',
                            mt: 0.5,
                            fontWeight: 'bold'
                          }}
                        >
                          รหัส: {userData.studentId}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>

                {/* Menu Items */}
                {(!userData || getSubtitle() === 'กรุณากรอกข้อมูลส่วนตัว') && (
                  <MenuItem onClick={handleAutoFill} sx={{ py: 1.5 }}>
                    <ListItemIcon>
                      <AutoFillIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="กรอกข้อมูลอัตโนมัติ"
                      secondary="ระบบจะช่วยกรอกข้อมูลจากบัญชี Microsoft ของคุณ"
                      primaryTypographyProps={{ 
                        color: 'primary.main',
                        fontSize: '0.9rem',
                        fontWeight: 'medium'
                      }}
                      secondaryTypographyProps={{ 
                        fontSize: '0.75rem'
                      }}
                    />
                  </MenuItem>
                )}

                <Divider />

                <MenuItem onClick={handleLogout} sx={{ py: 1.5 }}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" color="error" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="ออกจากระบบ"
                    secondary="ออกจากบัญชีปัจจุบัน"
                    primaryTypographyProps={{ 
                      color: 'error.main',
                      fontSize: '0.9rem',
                      fontWeight: 'medium'
                    }}
                    secondaryTypographyProps={{ 
                      fontSize: '0.75rem'
                    }}
                  />
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            // Not logged in state
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
              <AccountIcon sx={{ color: 'rgba(255,255,255,0.7)' }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                ยังไม่ได้เข้าสู่ระบบ
              </Typography>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Auto-fill Confirmation Dialog */}
      <Dialog 
        open={autoFillDialogOpen} 
        onClose={() => setAutoFillDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoFillIcon color="primary" />
            กรอกข้อมูลอัตโนมัติ
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            ระบบได้ตรวจพบและกรอกข้อมูลจากบัญชี Microsoft ของคุณแล้ว กรุณาตรวจสอบและแก้ไขหากจำเป็น
          </Alert>
          
          <Box sx={{ display: 'grid', gap: 2, mt: 2 }}>
            {/* Display English name (read-only) */}
            {autoFilledData.englishName && (
              <TextField
                label="ชื่อภาษาอังกฤษ"
                value={autoFilledData.englishName}
                size="small"
                fullWidth
                disabled
                helperText="ข้อมูลจากบัญชี Microsoft (ไม่สามารถแก้ไขได้)"
                sx={{
                  '& .MuiInputBase-input.Mui-disabled': {
                    WebkitTextFillColor: 'rgba(0, 0, 0, 0.7)',
                  },
                }}
              />
            )}
            
            {/* Thai name fields (read-only) */}
            <TextField
              label="ชื่อ (ภาษาไทย)"
              value={autoFilledData.firstName}
              size="small"
              fullWidth
              disabled
              helperText="ชื่อภาษาไทยที่ดึงมาจากบัญชี Microsoft (ไม่สามารถแก้ไขได้)"
              sx={{
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: 'rgba(0, 0, 0, 0.7)',
                },
              }}
            />
            <TextField
              label="นามสกุล (ภาษาไทย)"
              value={autoFilledData.lastName}
              size="small"
              fullWidth
              disabled
              helperText="นามสกุลภาษาไทยที่ดึงมาจากบัญชี Microsoft (ไม่สามารถแก้ไขได้)"
              sx={{
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: 'rgba(0, 0, 0, 0.7)',
                },
              }}
            />
            
            {/* Student ID (read-only) */}
            <TextField
              label="รหัสนักศึกษา"
              value={autoFilledData.studentId}
              size="small"
              fullWidth
              disabled
              helperText="รหัสนักศึกษาที่สร้างตามโครงสร้างของมหาวิทยาลัย (ไม่สามารถแก้ไขได้)"
              sx={{
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: 'rgba(0, 0, 0, 0.7)',
                },
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                },
              }}
            />
            
            {/* University field (fixed to PSU) */}
            <TextField
              label="มหาวิทยาลัย"
              value="มหาวิทยาลัยสงขลานครินทร์"
              size="small"
              fullWidth
              disabled
              helperText="ระบบรองรับเฉพาะมหาวิทยาลัยสงขลานครินทร์"
              sx={{
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: 'rgba(0, 0, 0, 0.7)',
                },
              }}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>คณะ</InputLabel>
              <Select
                value={formData.faculty}
                onChange={(e) => handleFormChange('faculty', e.target.value)}
                label="คณะ"
              >
                {availableFaculties.map((faculty) => (
                  <MenuItem key={faculty.name} value={faculty.name}>{faculty.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="สาขา/ภาควิชา"
              value={formData.department}
              onChange={(e) => handleFormChange('department', e.target.value)}
              size="small"
              fullWidth
              helperText="ข้อมูลที่ดึงมาจากบัญชี Microsoft หรือสามารถแก้ไขได้"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoFillDialogOpen(false)} disabled={loading}>
            ยกเลิก
          </Button>
          <Button 
            onClick={handleConfirmAutoFill} 
            variant="contained" 
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
          >
            บันทึกข้อมูล
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default NavigationBar;