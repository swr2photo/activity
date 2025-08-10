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
  Snackbar,
} from '@mui/material';
import {
  EventNote as EventIcon,
  Logout as LogoutIcon,
  AccountCircle as AccountIcon,
  Save as SaveIcon,
  AutoFixHigh as AutoFillIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase'; // ปรับ path ตามโปรเจ็กต์
import { UniversityUserProfile } from '../../lib/firebaseAuth';

// ----- ข้อมูลอ้างอิงคณะและระดับ -----
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
  { name: 'คณะสัตวแพทยศาสตร์', code: '13' },
];

const DEGREE_LEVELS = [
  { name: 'ปริญญาตรี', code: '1' },
  { name: 'ปริญญาโท', code: '2' },
  { name: 'ปริญญาเอก', code: '3' },
];

interface NavigationBarProps {
  user: any;
  userData: UniversityUserProfile | null;
  onLogout: () => void;
  onUserDataUpdate?: (userData: UniversityUserProfile) => void;
  onEditProfile?: () => void;
}

const NavigationBar: React.FC<NavigationBarProps> = ({
  user,
  userData,
  onLogout,
  onUserDataUpdate,
  onEditProfile,
}) => {
  // ---------- State (ตัวเดียวเท่านั้น ป้องกัน redeclare) ----------
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const [autoFillDialogOpen, setAutoFillDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  // ฟอร์มแก้ไขได้
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
    photoURL: '',
  });

  // ฟิลด์ที่ระบบเติมให้อ่านอย่างเดียว
  const [autoFilledData, setAutoFilledData] = useState({
    firstName: '',
    lastName: '',
    englishName: '',
    studentId: '',
    faculty: '',
    degree: '',
  });

  useEffect(() => {
    if (userData) {
      setFormData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        displayName: userData.displayName || '',
        studentId: userData.studentId || '',
        university: (userData as any)?.university || 'มหาวิทยาลัยสงขลานครินทร์',
        faculty: userData.faculty || '',
        department: userData.department || '',
        degree: (userData as any)?.degree || '',
        phoneNumber: (userData as any)?.phoneNumber || '',
        photoURL: userData.photoURL || '',
      });
    }
  }, [userData]);

  // ---------- Helpers ----------
  const extractMicrosoftUserInfo = (displayName: string) => {
    const result = {
      englishName: '',
      firstName: '',
      lastName: '',
      degree: '',
      department: '',
      faculty: '',
      university: 'มหาวิทยาลัยสงขลานครินทร์',
    };
    const englishNameMatch = displayName.match(/^([^(]+)/);
    if (englishNameMatch) result.englishName = englishNameMatch[1].trim();

    const thaiNameMatch = displayName.match(/\(([^)]+)\)/);
    if (thaiNameMatch) {
      const thaiFullName = thaiNameMatch[1].trim();
      const nameParts = thaiFullName.split(/\s+/);
      result.firstName = nameParts[0] || '';
      result.lastName = nameParts.slice(1).join(' ') || '';
    }

    const degreeMatch = displayName.match(/ปริญญา\w+/);
    if (degreeMatch) result.degree = degreeMatch[0];

    const departmentMatch = displayName.match(/สาขาวิชา([^\s]+(?:\s+[^\s]+)*?)(?:\s+คณะ|$)/);
    if (departmentMatch) result.department = departmentMatch[1].trim();

    const facultyMatch = displayName.match(/คณะ([^\s]+(?:\s+[^\s]+)*?)(?:\s|$)/);
    if (facultyMatch) result.faculty = `คณะ${facultyMatch[1].trim()}`;
    return result;
  };

  const generateStudentId = (faculty: string) => {
    const year = new Date().getFullYear().toString().slice(-2);
    const degreeLevel = '1';
    const facultyCode = PSU_FACULTIES.find((f) => f.name === faculty)?.code || '02';
    const majorCode = '1';
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${year}${degreeLevel}${facultyCode}${majorCode}${randomNum}`;
  };

  const detectInfoFromStudentId = (studentId: string): { faculty: string; degree: string } => {
    const result = { faculty: 'คณะวิทยาศาสตร์', degree: 'ปริญญาตรี' };
    if (studentId.length >= 5) {
      const degreeCode = studentId.substring(2, 3);
      const d = DEGREE_LEVELS.find((x) => x.code === degreeCode);
      if (d) result.degree = d.name;

      const facultyCode = studentId.substring(3, 5);
      const f = PSU_FACULTIES.find((x) => x.code === facultyCode);
      if (f) result.faculty = f.name;
    }
    return result;
  };

  const autoFillUserData = () => {
    const email = user?.email || '';
    const displayName = user?.displayName || '';

    const extracted = extractMicrosoftUserInfo(displayName);
    let studentId = '';
    let faculty = extracted.faculty || 'คณะวิทยาศาสตร์';
    let degree = 'ปริญญาตรี';

    const emailMatch = email.match(/^(\d{8,12})/);
    if (emailMatch) {
      studentId = emailMatch[1];
      const det = detectInfoFromStudentId(studentId);
      faculty = det.faculty;
      degree = det.degree;
    } else {
      studentId = generateStudentId(faculty);
    }

    setAutoFilledData({
      firstName: extracted.firstName || 'ไม่ระบุ',
      lastName: extracted.lastName || 'ไม่ระบุ',
      englishName: extracted.englishName || '',
      studentId,
      faculty,
      degree,
    });

    setFormData((prev) => ({
      ...prev,
      firstName: extracted.firstName || 'ไม่ระบุ',
      lastName: extracted.lastName || 'ไม่ระบุ',
      displayName:
        prev.displayName ||
        displayName ||
        `${extracted.firstName} ${extracted.lastName}`.trim() ||
        'ผู้ใช้งาน',
      studentId,
      university: 'มหาวิทยาลัยสงขลานครินทร์',
      faculty,
      department: extracted.department || 'วิศวกรรมคอมพิวเตอร์',
      degree,
      photoURL: user?.photoURL || '',
    }));

    setAutoFillDialogOpen(true);
  };

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
        createdAt: (userData as any)?.createdAt || new Date(),
      };
      await setDoc(userDocRef, userProfile, { merge: true });
      onUserDataUpdate?.(userProfile);
      setSnackbar({ open: true, message: 'บันทึกข้อมูลเรียบร้อยแล้ว', severity: 'success' });
      return true;
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', severity: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ---------- Menu handlers ----------
  const handleMenuClick = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleLogoutClick = () => {
    handleMenuClose();
    onLogout();
  };

  const handleAutoFillClick = () => {
    handleMenuClose();
    autoFillUserData();
  };

  const handleConfirmAutoFill = async () => {
    const ok = await saveUserData(formData);
    if (ok) setAutoFillDialogOpen(false);
  };

  const handleFormChange = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  // ---------- Display helpers ----------
  const getDisplayName = () => {
    if (userData?.displayName) return userData.displayName;
    if (userData?.firstName && userData?.lastName) return `${userData.firstName} ${userData.lastName}`;
    if (user?.displayName) {
      const e = extractMicrosoftUserInfo(user.displayName);
      return `${e.firstName} ${e.lastName}`.trim();
    }
    if (user?.email) return user.email.split('@')[0];
    return 'ผู้ใช้';
  };

  const getAvatarSrc = () => userData?.photoURL || user?.photoURL || null;

  const getAvatarLetter = () =>
    userData?.firstName?.charAt(0).toUpperCase() ||
    extractMicrosoftUserInfo(user?.displayName || '').firstName.charAt(0).toUpperCase() ||
    getDisplayName().charAt(0).toUpperCase();

  const getSubtitle = () => {
    if ((userData as any)?.faculty && (userData as any)?.department) {
      return `${(userData as any).faculty} - ${(userData as any).department}`;
    }
    if ((userData as any)?.department) return (userData as any).department;
    if ((userData as any)?.faculty) return (userData as any).faculty;
    return 'กรุณากรอกข้อมูลส่วนตัว';
  };

  const availableFaculties = PSU_FACULTIES;

  // ---------- Render ----------
  return (
    <>
      {/* แถบลอยแนว Liquid Glass */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: (t) => t.zIndex.appBar + 1 }}>
        <AppBar
          elevation={0}
          position="sticky"
          color="transparent"
          sx={{
            mt: 1.5,
            mx: 'auto',
            width: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 24px)' },
            borderRadius: 3,
            backdropFilter: 'blur(16px) saturate(180%)',
            backgroundColor: 'rgba(255,255,255,0.65)',
            border: '1px solid rgba(255,255,255,0.25)',
            boxShadow:
              '0 8px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(255,255,255,0.15)',
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 64, sm: 72 } }}>
            {/* โลโก้ + ชื่อระบบ */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EventIcon sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
              <Typography
                variant="h6"
                component="div"
                sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, fontWeight: 'bold' }}
              >
                ระบบลงทะเบียนกิจกรรม
              </Typography>
            </Box>

            {/* โปรไฟล์ */}
            {user ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 'auto' }}>
                {/* ซ่อนบนมือถือ */}
                <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.primary', fontWeight: 'medium', lineHeight: 1.2 }}
                  >
                    {getDisplayName()}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.1 }}>
                    {getSubtitle()}
                  </Typography>
                </Box>

                {/* Avatar */}
                <Tooltip title="จัดการบัญชี">
                  <IconButton onClick={handleMenuClick} sx={{ p: 0 }}>
                    <Avatar
                      src={getAvatarSrc() || undefined}
                      sx={{
                        width: { xs: 36, sm: 40 },
                        height: { xs: 36, sm: 40 },
                        border: '2px solid rgba(255,255,255,0.6)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        fontSize: { xs: '1rem', sm: '1.125rem' },
                      }}
                    >
                      {!getAvatarSrc() && getAvatarLetter()}
                    </Avatar>
                  </IconButton>
                </Tooltip>

                {/* เมนูโปรไฟล์ */}
                <Menu
                  anchorEl={anchorEl}
                  open={open}
                  onClose={handleMenuClose}
                  onClick={handleMenuClose}
                  PaperProps={{
                    elevation: 0,
                    sx: {
                      overflow: 'visible',
                      mt: 1.5,
                      minWidth: { xs: 260, sm: 300 },
                      borderRadius: 2,
                      backdropFilter: 'blur(16px) saturate(180%)',
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      border: '1px solid rgba(255,255,255,0.25)',
                      boxShadow:
                        '0 8px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(255,255,255,0.15)',
                      '&:before': {
                        content: '""',
                        display: 'block',
                        position: 'absolute',
                        top: 0,
                        right: 18,
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
                  {/* หัวเมนู */}
                  <Box sx={{ px: 2, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        src={getAvatarSrc() || undefined}
                        sx={{ width: 48, height: 48, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                      >
                        {!getAvatarSrc() && getAvatarLetter()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
                          {getDisplayName()}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontSize: '0.75rem', wordBreak: 'break-all', lineHeight: 1.1 }}
                        >
                          {user.email}
                        </Typography>
                        {(userData as any)?.faculty && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', mt: 0.5, lineHeight: 1.1 }}
                          >
                            {(userData as any).faculty}
                            {(userData as any).department && ` - ${(userData as any).department}`}
                          </Typography>
                        )}
                        {userData?.studentId && (
                          <Typography
                            variant="caption"
                            color="primary.main"
                            sx={{ display: 'block', fontFamily: 'monospace', mt: 0.5, fontWeight: 'bold' }}
                          >
                            รหัส: {userData.studentId}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>

                  {/* กรอกข้อมูลอัตโนมัติ (แสดงเมื่อยังไม่มีข้อมูล) */}
                  {(!userData || getSubtitle() === 'กรุณากรอกข้อมูลส่วนตัว') && (
                    <MenuItem onClick={handleAutoFillClick} sx={{ py: 1.25 }}>
                      <ListItemIcon>
                        <AutoFillIcon fontSize="small" color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary="กรอกข้อมูลอัตโนมัติ"
                        secondary="ช่วยดึงข้อมูลจากบัญชี Microsoft"
                        primaryTypographyProps={{
                          color: 'primary.main',
                          fontSize: '0.92rem',
                          fontWeight: 'medium',
                        }}
                        secondaryTypographyProps={{ fontSize: '0.75rem' }}
                      />
                    </MenuItem>
                  )}

                  {/* ปุ่มแก้ไขโปรไฟล์ (ถ้า parent ส่ง handler มา) */}
                  {onEditProfile && (
                    <MenuItem
                      onClick={() => {
                        onEditProfile();
                      }}
                      sx={{ py: 1.25 }}
                    >
                      <ListItemIcon>
                        <EditIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="แก้ไขโปรไฟล์"
                        primaryTypographyProps={{ fontSize: '0.92rem', fontWeight: 'medium' }}
                      />
                    </MenuItem>
                  )}

                  <Divider />

                  <MenuItem onClick={handleLogoutClick} sx={{ py: 1.25 }}>
                    <ListItemIcon>
                      <LogoutIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    <ListItemText
                      primary="ออกจากระบบ"
                      secondary="ออกจากบัญชีปัจจุบัน"
                      primaryTypographyProps={{ color: 'error.main', fontSize: '0.92rem', fontWeight: 'medium' }}
                      secondaryTypographyProps={{ fontSize: '0.75rem' }}
                    />
                  </MenuItem>
                </Menu>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
                <AccountIcon sx={{ color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  ยังไม่ได้เข้าสู่ระบบ
                </Typography>
              </Box>
            )}
          </Toolbar>
        </AppBar>
      </Box>

      {/* Dialog กรอกข้อมูลอัตโนมัติ (Apple-like Glass) */}
      <Dialog
        open={autoFillDialogOpen}
        onClose={() => setAutoFillDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            backdropFilter: 'blur(20px) saturate(180%)',
            backgroundColor: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(255,255,255,0.35)',
            boxShadow:
              '0 20px 60px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(255,255,255,0.25)',
          },
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoFillIcon color="primary" />
            กรอกข้อมูลอัตโนมัติ
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            ระบบดึงข้อมูลจากบัญชี Microsoft ของคุณมาให้แล้ว กรุณาตรวจสอบและปรับแก้ได้ตามต้องการ
          </Alert>

          <Box sx={{ display: 'grid', gap: 2, mt: 2 }}>
            {autoFilledData.englishName && (
              <TextField
                label="ชื่อภาษาอังกฤษ"
                value={autoFilledData.englishName}
                size="small"
                fullWidth
                disabled
                helperText="ข้อมูลจากบัญชี Microsoft (ไม่สามารถแก้ไขได้)"
                sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: 'rgba(0,0,0,0.7)' } }}
              />
            )}

            <TextField
              label="ชื่อ (ภาษาไทย)"
              value={autoFilledData.firstName}
              size="small"
              fullWidth
              disabled
              helperText="ชื่อภาษาไทยจากบัญชี Microsoft"
              sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: 'rgba(0,0,0,0.7)' } }}
            />
            <TextField
              label="นามสกุล (ภาษาไทย)"
              value={autoFilledData.lastName}
              size="small"
              fullWidth
              disabled
              helperText="นามสกุลภาษาไทยจากบัญชี Microsoft"
              sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: 'rgba(0,0,0,0.7)' } }}
            />

            <TextField
              label="รหัสนักศึกษา"
              value={autoFilledData.studentId}
              size="small"
              fullWidth
              disabled
              helperText="ระบบสร้างตามโครงสร้างรหัสของมหาวิทยาลัย"
              sx={{
                '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: 'rgba(0,0,0,0.7)' },
                '& .MuiInputBase-input': { fontFamily: 'monospace', fontWeight: 'bold' },
              }}
            />

            <TextField
              label="มหาวิทยาลัย"
              value="มหาวิทยาลัยสงขลานครินทร์"
              size="small"
              fullWidth
              disabled
              helperText="ระบบรองรับเฉพาะมหาวิทยาลัยสงขลานครินทร์"
              sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: 'rgba(0,0,0,0.7)' } }}
            />

            <FormControl size="small" fullWidth>
              <InputLabel>คณะ</InputLabel>
              <Select
                value={formData.faculty}
                onChange={(e) => handleFormChange('faculty', e.target.value)}
                label="คณะ"
              >
                {availableFaculties.map((f) => (
                  <MenuItem key={f.name} value={f.name}>
                    {f.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="สาขา/ภาควิชา"
              value={formData.department}
              onChange={(e) => handleFormChange('department', e.target.value)}
              size="small"
              fullWidth
              helperText="แก้ไขได้ตามจริง"
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

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
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
