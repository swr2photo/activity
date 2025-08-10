// components/profile/ProfileEditDialog.tsx
'use client';
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Stack,
  Alert,
  Avatar,
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  Badge as BadgeIcon,
  Email as EmailIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { UniversityUserProfile } from '../../lib/firebaseAuth';
import { alpha, keyframes, useTheme } from '@mui/material/styles';

interface ProfileEditDialogProps {
  open: boolean;
  onClose: () => void;
  user: any;
  userData: UniversityUserProfile | null;
  onSave: (updatedData: Partial<UniversityUserProfile>) => Promise<void>;
}

const float = keyframes`
  0%   { transform: translateY(0px); }
  50%  { transform: translateY(-8px); }
  100% { transform: translateY(0px); }
`;

const ProfileEditDialog: React.FC<ProfileEditDialogProps> = ({ 
  open, 
  onClose, 
  user, 
  userData, 
  onSave 
}) => {
  const theme = useTheme();

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    firstName: '',
    lastName: '',
    photoURL: '',
    department: '',
    faculty: '',
    studentId: ''
  });
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const extractInfoFromEmail = (email: string) => {
    const username = email.split('@')[0];
    return { studentId: username, displayName: username };
  };

  useEffect(() => {
    if (open && user) {
      const emailInfo = extractInfoFromEmail(user.email || '');
      setFormData({
        displayName: userData?.displayName || user?.displayName || emailInfo.displayName,
        firstName: userData?.firstName || '',
        lastName: userData?.lastName || '',
        photoURL: userData?.photoURL || user?.photoURL || '',
        department: userData?.department || '',
        faculty: userData?.faculty || '',
        studentId: userData?.studentId || emailInfo.studentId
      });
      setError('');
      setValidationErrors({});
    }
  }, [open, userData, user]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.firstName.trim()) errors.firstName = 'กรุณากรอกชื่อ';
    else if (formData.firstName.trim().length < 2) errors.firstName = 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร';
    if (!formData.lastName.trim()) errors.lastName = 'กรุณากรอกนามสกุล';
    else if (formData.lastName.trim().length < 2) errors.lastName = 'นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร';
    if (formData.photoURL && formData.photoURL.trim()) {
      try { new URL(formData.photoURL); } catch { errors.photoURL = 'รูปแบบ URL ไม่ถูกต้อง'; }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const e = { ...prev };
        delete e[field];
        return e;
      });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      if (!validateForm()) { setSaving(false); return; }

      const fullDisplayName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
      const updatedData = {
        ...formData,
        displayName: fullDisplayName,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        department: formData.department.trim(),
        faculty: formData.faculty.trim(),
        studentId: formData.studentId.trim(),
        photoURL: formData.photoURL.trim(),
        isVerified: true,
        isActive: true,
        updatedAt: new Date()
      };

      await onSave(updatedData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const getPreviewAvatar = () => formData.photoURL || null;
  const getPreviewAvatarLetter = () =>
    formData.firstName ? formData.firstName.charAt(0).toUpperCase() :
    formData.displayName ? formData.displayName.charAt(0).toUpperCase() : 'U';

  const isFormValid = () =>
    formData.firstName.trim().length >= 2 &&
    formData.lastName.trim().length >= 2 &&
    Object.keys(validationErrors).length === 0;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: `linear-gradient(135deg,
            ${alpha(theme.palette.background.paper, 0.5)} 0%,
            ${alpha(theme.palette.background.paper, 0.3)} 100%)`,
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          border: `1px solid ${alpha(theme.palette.divider, 0.35)}`,
          boxShadow: `
            0 26px 80px ${alpha('#000', 0.28)},
            inset 0 1px 0 ${alpha('#fff', 0.18)}
          `,
          borderRadius: 3,
          overflow: 'hidden',
          position: 'relative',
          animation: `${float} 12s ease-in-out infinite`,
          // glossy blobs
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -120,
            left: -80,
            width: 260,
            height: 260,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${alpha('#fff', 0.35)}, transparent)`,
            filter: 'blur(20px)',
            pointerEvents: 'none'
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -140,
            right: -100,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${alpha(theme.palette.primary.main, 0.22)}, transparent)`,
            filter: 'blur(28px)',
            pointerEvents: 'none'
          }
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        background: 'transparent',
        color: 'text.primary',
        py: 2,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.2)}`
      }}>
        <EditIcon />
        <Box>
          <Typography variant="h6" component="div" fontWeight={700}>
            กรอกข้อมูลส่วนตัว
          </Typography>
          <Typography variant="caption" color="text.secondary">
            กรุณากรอกข้อมูลให้ครบถ้วนเพื่อใช้ในการลงทะเบียน
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 3, position: 'relative' }}>
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Avatar Preview */}
          <Box sx={{ textAlign: 'center' }}>
            <Avatar 
              src={getPreviewAvatar() || undefined}
              sx={{ 
                width: 100, 
                height: 100, 
                mx: 'auto', 
                mb: 2,
                border: `4px solid ${alpha(theme.palette.common.white, 0.8)}`,
                boxShadow: `
                  0 14px 36px ${alpha('#000', 0.22)},
                  inset 0 1px 0 ${alpha('#fff', 0.4)}
                `,
                fontSize: '2rem'
              }}
            >
              {!getPreviewAvatar() && getPreviewAvatarLetter()}
            </Avatar>
            <Typography variant="body2" color="text.secondary">
              รูปโปรไฟล์จะแสดงตัวอักษรแรกของชื่อหากไม่มีรูป
            </Typography>
          </Box>

          <Grid container spacing={2}>
            {/* ชื่อ - นามสกุล */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="ชื่อ *"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                fullWidth
                required
                variant="outlined"
                helperText={validationErrors.firstName || "ชื่อจริงของคุณ"}
                error={!!validationErrors.firstName}
                InputProps={{
                  startAdornment: <PersonIcon sx={{ color: 'text.secondary', mr: 1 }} />
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="นามสกุล *"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                fullWidth
                required
                variant="outlined"
                helperText={validationErrors.lastName || "นามสกุลของคุณ"}
                error={!!validationErrors.lastName}
                InputProps={{
                  startAdornment: <PersonIcon sx={{ color: 'text.secondary', mr: 1 }} />
                }}
              />
            </Grid>

            {/* คณะ - สาขา */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="คณะ"
                value={formData.faculty}
                onChange={(e) => handleInputChange('faculty', e.target.value)}
                fullWidth
                variant="outlined"
                placeholder="เช่น วิศวกรรมศาสตร์"
                helperText="คณะที่คุณศึกษาหรือทำงาน"
                InputProps={{
                  startAdornment: <SchoolIcon sx={{ color: 'text.secondary', mr: 1 }} />
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="สาขา/หน่วยงาน"
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                fullWidth
                variant="outlined"
                placeholder="เช่น วิศวกรรมคอมพิวเตอร์"
                helperText="สาขาวิชาหรือหน่วยงานที่สังกัด"
                InputProps={{
                  startAdornment: <BadgeIcon sx={{ color: 'text.secondary', mr: 1 }} />
                }}
              />
            </Grid>

            {/* รหัสนักศึกษา */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="รหัสนักศึกษา/รหัสพนักงาน"
                value={formData.studentId}
                onChange={(e) => handleInputChange('studentId', e.target.value)}
                fullWidth
                variant="outlined"
                helperText="รหัสประจำตัวของคุณ"
                InputProps={{
                  startAdornment: <PersonIcon sx={{ color: 'text.secondary', mr: 1 }} />
                }}
              />
            </Grid>

            {/* URL รูปโปรไฟล์ */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="URL รูปโปรไฟล์"
                value={formData.photoURL}
                onChange={(e) => handleInputChange('photoURL', e.target.value)}
                fullWidth
                variant="outlined"
                placeholder="https://example.com/photo.jpg"
                helperText={validationErrors.photoURL || "ลิงก์รูปภาพสำหรับโปรไฟล์ (ไม่บังคับ)"}
                error={!!validationErrors.photoURL}
              />
            </Grid>
          </Grid>

          <Card variant="outlined" sx={{ bgcolor: alpha(theme.palette.background.paper, 0.4), backdropFilter: 'blur(6px)' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmailIcon fontSize="small" />
                ข้อมูลจากระบบ (ไม่สามารถแก้ไขได้)
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Grid container spacing={1}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>อีเมล:</strong> {user?.email}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>ชื่อแสดงเต็ม:</strong> {formData.firstName && formData.lastName ? 
                      `${formData.firstName} ${formData.lastName}` : 'กรอกชื่อ-นามสกุลเพื่อแสดงผล'}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Alert severity="info" icon={<InfoIcon />}>
            <Typography variant="body2">
              <strong>หมายเหตุ:</strong> ข้อมูลที่กรอกจะใช้สำหรับการลงทะเบียนกิจกรรม 
              และการติดต่อสื่อสารจากระบบ กรุณากรอกข้อมูลให้ถูกต้องและครบถ้วน
            </Typography>
          </Alert>
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 3, gap: 1, borderTop: `1px solid ${alpha(theme.palette.divider, 0.2)}` }}>
        <Button 
          onClick={onClose} 
          disabled={saving} 
          size="large"
          variant="outlined"
        >
          ยกเลิก
        </Button>
        <Button 
          variant="contained" 
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || !isFormValid()}
          size="large"
          sx={{
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.9)} 0%, ${alpha(theme.palette.primary.dark, 0.9)} 100%)`,
            boxShadow: `0 14px 34px ${alpha(theme.palette.primary.main, 0.35)}`,
            '&:hover': {
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 1)} 0%, ${alpha(theme.palette.primary.dark, 1)} 100%)`,
              boxShadow: `0 18px 40px ${alpha(theme.palette.primary.main, 0.45)}`
            },
            px: 4,
            '&:disabled': {
              background: 'grey.300',
              color: 'grey.500'
            }
          }}
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึกและดำเนินการต่อ'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProfileEditDialog;
