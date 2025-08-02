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

interface ProfileEditDialogProps {
  open: boolean;
  onClose: () => void;
  user: any;
  userData: UniversityUserProfile | null;
  onSave: (updatedData: Partial<UniversityUserProfile>) => Promise<void>;
}

const ProfileEditDialog: React.FC<ProfileEditDialogProps> = ({ 
  open, 
  onClose, 
  user, 
  userData, 
  onSave 
}) => {
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

  // ฟังก์ชันดึงข้อมูลจาก email
  const extractInfoFromEmail = (email: string) => {
    const username = email.split('@')[0];
    return {
      studentId: username,
      displayName: username
    };
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

  // Validation function
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      errors.firstName = 'กรุณากรอกชื่อ';
    } else if (formData.firstName.trim().length < 2) {
      errors.firstName = 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร';
    }
    
    if (!formData.lastName.trim()) {
      errors.lastName = 'กรุณากรอกนามสกุล';
    } else if (formData.lastName.trim().length < 2) {
      errors.lastName = 'นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร';
    }

    // Validate photo URL if provided
    if (formData.photoURL && formData.photoURL.trim()) {
      try {
        new URL(formData.photoURL);
      } catch {
        errors.photoURL = 'รูปแบบ URL ไม่ถูกต้อง';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle input changes with real-time validation
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear specific field error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      // Validate form
      if (!validateForm()) {
        setSaving(false);
        return;
      }

      // สร้างชื่อที่แสดงจากชื่อ + นามสกุล
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
        // Auto-approve user เมื่อกรอกข้อมูลครบ
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

  const getPreviewAvatar = () => {
    if (formData.photoURL) return formData.photoURL;
    return null;
  };

  const getPreviewAvatarLetter = () => {
    if (formData.firstName) return formData.firstName.charAt(0).toUpperCase();
    if (formData.displayName) return formData.displayName.charAt(0).toUpperCase();
    return 'U';
  };

  const isFormValid = () => {
    return formData.firstName.trim().length >= 2 && 
           formData.lastName.trim().length >= 2 && 
           Object.keys(validationErrors).length === 0;
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        py: 2
      }}>
        <EditIcon />
        <Box>
          <Typography variant="h6" component="div">
            กรอกข้อมูलส่วนตัว
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            กรุณากรอกข้อมูลให้ครบถ้วนเพื่อใช้ในการลงทะเบียน
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={3}>
          {error && (
            <Alert severity="error">{error}</Alert>
          )}

          {/* Avatar Preview */}
          <Box sx={{ textAlign: 'center' }}>
            <Avatar 
              src={getPreviewAvatar() || undefined}
              sx={{ 
                width: 100, 
                height: 100, 
                mx: 'auto', 
                mb: 2,
                border: '4px solid',
                borderColor: 'primary.main',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
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

          {/* Read-only Information */}
          <Card variant="outlined" sx={{ bgcolor: 'grey.50' }}>
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

          {/* Info Alert */}
          <Alert severity="info" icon={<InfoIcon />}>
            <Typography variant="body2">
              <strong>หมายเหตุ:</strong> ข้อมูลที่กรอกจะใช้สำหรับการลงทะเบียนกิจกรรม 
              และการติดต่อสื่อสารจากระบบ กรุณากรอกข้อมูลให้ถูกต้องและครบถ้วน
            </Typography>
          </Alert>
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 3, gap: 1 }}>
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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)'
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