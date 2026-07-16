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
  Stack,
  Alert,
  Avatar,
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';

// ✅ Grid import แบบชัดเจน
import Grid from '@mui/material/Grid';

import {
  Edit as EditIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  Badge as BadgeIcon,
  Email as EmailIcon,
  Info as InfoIcon,
  PhotoCamera,
  AccountCircle as AccountCircleIcon,
} from '@mui/icons-material';

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';

import { UniversityUserProfile, parseStudentInfo, facultyMap, departmentMap } from '../../lib/firebaseAuth';
import { alpha, useTheme } from '@mui/material/styles';
import Autocomplete from '@mui/material/Autocomplete';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../utils/cropImage';

interface ProfileEditDialogProps {
  open: boolean;
  onClose: () => void;
  user: any;
  userData: UniversityUserProfile | null;
  onSave: (updatedData: Partial<UniversityUserProfile>) => Promise<void>;
  /** When true, user cannot close dialog — must complete profile first */
  isFirstTimeSetup?: boolean;
}

const ProfileEditDialog: React.FC<ProfileEditDialogProps> = ({
  open,
  onClose,
  user,
  userData,
  onSave,
  isFirstTimeSetup = false,
}) => {
  const theme = useTheme();

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    firstName: '',
    lastName: '',
    username: '',
    photoURL: '',
    department: '',
    faculty: '',
    studentId: '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Crop State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  useEffect(() => {
    if (!open || !user) return;

    const emailLocal = (user.email || '').split('@')[0] || '';
    const parsedInfo = parseStudentInfo(user.email || '');
    const rawDisplayName = userData?.displayName || user?.displayName || '';

    let derivedFirstName = userData?.firstName || '';
    let derivedLastName = userData?.lastName || '';

    // หากยังไม่มีชื่อ หรือนามสกุลมีวงเล็บติดมา ให้ดึงจากชื่อไทยในวงเล็บ
    if (
      !derivedFirstName ||
      derivedFirstName === 'ไม่ระบุ' ||
      derivedLastName.includes('(') ||
      derivedLastName.includes(')')
    ) {
      const thaiMatch = rawDisplayName.match(/\(([\u0E00-\u0E7F\s]+)\)/);
      if (thaiMatch?.[1]) {
        const nameParts = thaiMatch[1].trim().split(/\s+/);
        derivedFirstName = nameParts[0] || '';
        derivedLastName = nameParts.slice(1).join(' ') || '';
      } else if (rawDisplayName.trim()) {
        const nameParts = rawDisplayName.trim().split(/\s+/);
        derivedFirstName = nameParts[0] || '';
        derivedLastName = nameParts.slice(1).join(' ') || '';
      }
    }

    setFormData({
      displayName: userData?.displayName || rawDisplayName || emailLocal,
      firstName: derivedFirstName,
      lastName: derivedLastName,
      username: userData?.username || '',
      photoURL: userData?.photoURL || user?.photoURL || '',
      department:
        userData?.department && userData.department !== 'ไม่ระบุ'
          ? userData.department
          : parsedInfo.department !== 'ไม่ระบุ'
            ? parsedInfo.department
            : '',
      faculty:
        userData?.faculty && userData.faculty !== 'ไม่ระบุ'
          ? userData.faculty
          : parsedInfo.faculty !== 'ไม่ระบุ'
            ? parsedInfo.faculty
            : '',
      studentId: userData?.studentId || parsedInfo.studentId || emailLocal,
    });
    setError('');
    setValidationErrors({});
    setSaving(false);
    setUploadingImage(false);
  }, [open, userData, user]);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.firstName.trim()) errors.firstName = 'กรุณากรอกชื่อ';
    else if (formData.firstName.trim().length < 2) errors.firstName = 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร';

    if (!formData.lastName.trim()) errors.lastName = 'กรุณากรอกนามสกุล';
    else if (formData.lastName.trim().length < 2) errors.lastName = 'นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร';

    if (formData.photoURL && formData.photoURL.trim()) {
      try {
        new URL(formData.photoURL);
      } catch {
        errors.photoURL = 'รูปแบบ URL ไม่ถูกต้อง';
      }
    }

    if (formData.username.trim() && formData.username.trim().length < 3) {
      errors.username = 'Username ต้องมีอย่างน้อย 3 ตัวอักษร';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const currentFacultyCode = Object.keys(facultyMap).find((key) => facultyMap[key] === formData.faculty);
  const availableDepartments =
    currentFacultyCode && departmentMap[currentFacultyCode]
      ? Object.values(departmentMap[currentFacultyCode])
      : [];

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageToCrop(reader.result?.toString() || null);
      setCropModalOpen(true);
    });
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const onCropComplete = (_croppedArea: any, pixels: any) => {
    setCroppedAreaPixels(pixels);
  };

  const handleCropConfirm = async () => {
    if (!imageToCrop || !user?.uid) return;

    try {
      setUploadingImage(true);
      setError('');

      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      const storageRef = ref(storage, `profiles/${user.uid}_${Date.now()}`);

      await uploadBytes(storageRef, croppedBlob);
      const url = await getDownloadURL(storageRef);

      setFormData((prev) => ({ ...prev, photoURL: url }));
      setCropModalOpen(false);
      setImageToCrop(null);
    } catch (err: any) {
      setError('ไม่สามารถอัปโหลดรูปภาพได้: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
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

      if (!validateForm()) {
        setSaving(false);
        return;
      }

      const fullDisplayName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
      const updatedData = {
        ...formData,
        displayName: fullDisplayName,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        username: formData.username.trim() || formData.studentId.trim(),
        department: formData.department.trim() || 'ไม่ระบุ',
        faculty: formData.faculty.trim() || 'ไม่ระบุ',
        studentId: formData.studentId.trim(),
        photoURL: formData.photoURL.trim(),
        isVerified: true,
        isActive: true,
        updatedAt: new Date(),
      };

      await onSave(updatedData);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const getPreviewAvatar = () => formData.photoURL || null;
  const getPreviewAvatarLetter = () =>
    formData.username?.trim()?.charAt(0).toUpperCase() ||
    formData.firstName?.charAt(0).toUpperCase() ||
    'U';

  const isFormValid = () =>
    formData.firstName.trim().length >= 2 &&
    formData.lastName.trim().length >= 2 &&
    Object.keys(validationErrors).length === 0;

  return (
    <>
      <Dialog
        open={open}
        onClose={isFirstTimeSetup ? undefined : onClose}
        disableEscapeKeyDown={isFirstTimeSetup}
        maxWidth="md"
        fullWidth
        keepMounted={false}
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            border: `1px solid ${alpha(theme.palette.divider, 0.35)}`,
            boxShadow: `0 26px 80px ${alpha('#000', 0.28)}`,
            borderRadius: 3,
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: 'text.primary',
            py: 2,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
          }}
        >
          <EditIcon />
          <Box>
            <Typography variant="h6" component="div" fontWeight={700}>
              {isFirstTimeSetup ? 'ยินดีต้อนรับ! กรุณากรอกข้อมูลส่วนตัว' : 'กรอกข้อมูลส่วนตัว'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isFirstTimeSetup
                ? 'คุณต้องกรอกข้อมูลให้ครบถ้วนก่อนดำเนินการต่อ'
                : 'กรุณากรอกข้อมูลให้ครบถ้วนเพื่อใช้ในการลงทะเบียน'}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={3}>
            {isFirstTimeSetup && (
              <Alert severity="warning" sx={{ borderRadius: 2, mt: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  กรุณากรอกข้อมูลให้ครบถ้วนก่อนดำเนินการใดๆ
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ระบบจำเป็นต้องมีข้อมูลของคุณเพื่อใช้ในการลงทะเบียนกิจกรรม
                </Typography>
              </Alert>
            )}
            {error && <Alert severity="error">{error}</Alert>}

            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Avatar
                  src={getPreviewAvatar() || undefined}
                  sx={{
                    width: 100,
                    height: 100,
                    mx: 'auto',
                    mb: 2,
                    border: `4px solid ${alpha(theme.palette.common.white, 0.8)}`,
                    boxShadow: `0 14px 36px ${alpha('#000', 0.22)}`,
                    fontSize: '2rem',
                  }}
                >
                  {!getPreviewAvatar() && getPreviewAvatarLetter()}
                </Avatar>
                <IconButton
                  color="primary"
                  aria-label="upload picture"
                  component="label"
                  disabled={uploadingImage}
                  sx={{
                    position: 'absolute',
                    bottom: 12,
                    right: -8,
                    bgcolor: 'background.paper',
                    boxShadow: 2,
                    '&:hover': { bgcolor: 'grey.100' },
                  }}
                >
                  <input hidden accept="image/*" type="file" onChange={handleImageSelect} />
                  {uploadingImage ? <CircularProgress size={20} /> : <PhotoCamera fontSize="small" />}
                </IconButton>
              </Box>
              <Typography variant="body2" color="text.secondary">
                ชื่อที่แสดงในระบบคือ Username (ไม่ใช่ชื่อ-นามสกุล)
              </Typography>
            </Box>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="ชื่อ *"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  fullWidth
                  required
                  variant="outlined"
                  helperText={validationErrors.firstName || 'ชื่อจริงของคุณ'}
                  error={!!validationErrors.firstName}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="นามสกุล *"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  fullWidth
                  required
                  variant="outlined"
                  helperText={validationErrors.lastName || 'นามสกุลของคุณ'}
                  error={!!validationErrors.lastName}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Autocomplete
                  freeSolo
                  options={Array.from(new Set(Object.values(facultyMap)))}
                  value={formData.faculty}
                  onChange={(_, newValue) => {
                    handleInputChange('faculty', (newValue as string) || '');
                    handleInputChange('department', '');
                  }}
                  onInputChange={(_, newInputValue, reason) => {
                    if (reason === 'input' || reason === 'clear') {
                      handleInputChange('faculty', newInputValue);
                      if (reason === 'clear') handleInputChange('department', '');
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="คณะ"
                      variant="outlined"
                      placeholder="เช่น วิทยาศาสตร์"
                      helperText="คณะที่คุณศึกษาหรือทำงาน"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <InputAdornment position="start">
                              <SchoolIcon sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
                            {params.InputProps.startAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Autocomplete
                  freeSolo
                  options={availableDepartments}
                  value={formData.department}
                  onChange={(_, newValue) => handleInputChange('department', (newValue as string) || '')}
                  onInputChange={(_, newInputValue, reason) => {
                    if (reason === 'input' || reason === 'clear') {
                      handleInputChange('department', newInputValue);
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="สาขา/หน่วยงาน"
                      variant="outlined"
                      placeholder="เช่น วิทยาการคอมพิวเตอร์"
                      helperText="สาขาวิชาหรือหน่วยงานที่สังกัด"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <InputAdornment position="start">
                              <BadgeIcon sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
                            {params.InputProps.startAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="รหัสนักศึกษา/รหัสพนักงาน"
                  value={formData.studentId}
                  onChange={(e) => handleInputChange('studentId', e.target.value)}
                  fullWidth
                  variant="outlined"
                  helperText="รหัสประจำตัวของคุณ"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Username *"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  fullWidth
                  variant="outlined"
                  placeholder={formData.studentId || 'ตั้งชื่อผู้ใช้ของคุณ'}
                  helperText={
                    validationErrors.username ||
                    'ใช้แสดงใน Navbar และระบบ (เว้นว่างจะใช้รหัสนักศึกษา)'
                  }
                  error={!!validationErrors.username}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AccountCircleIcon sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  label="URL รูปโปรไฟล์"
                  value={formData.photoURL}
                  onChange={(e) => handleInputChange('photoURL', e.target.value)}
                  fullWidth
                  variant="outlined"
                  placeholder="https://example.com/photo.jpg"
                  helperText={validationErrors.photoURL || 'ลิงก์รูปภาพสำหรับโปรไฟล์ (ไม่บังคับ)'}
                  error={!!validationErrors.photoURL}
                />
              </Grid>
            </Grid>

            <Card variant="outlined" sx={{ bgcolor: alpha(theme.palette.background.paper, 0.6) }}>
              <CardContent>
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  color="text.secondary"
                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <EmailIcon fontSize="small" />
                  ข้อมูลจากระบบ (ไม่สามารถแก้ไขได้)
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Grid container spacing={1}>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>อีเมล:</strong> {user?.email}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>ชื่อที่แสดงในระบบ:</strong>{' '}
                      {formData.username.trim() || formData.studentId || 'ตั้ง Username เพื่อแสดงผล'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Alert severity="info" icon={<InfoIcon />}>
              <Typography variant="body2">
                <strong>หมายเหตุ:</strong> Username จะใช้แสดงในแถบนำทาง ส่วนชื่อ-นามสกุลใช้สำหรับลงทะเบียนกิจกรรม
              </Typography>
            </Alert>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 1, borderTop: `1px solid ${alpha(theme.palette.divider, 0.2)}` }}>
          {!isFirstTimeSetup && (
            <Button onClick={onClose} disabled={saving} size="large" variant="outlined">
              ยกเลิก
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !isFormValid()}
            size="large"
            sx={{
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.9)} 0%, ${alpha(
                theme.palette.primary.dark,
                0.9
              )} 100%)`,
              boxShadow: `0 14px 34px ${alpha(theme.palette.primary.main, 0.35)}`,
              px: 4,
              '&:disabled': {
                background: 'grey.300',
                color: 'grey.500',
              },
            }}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกและดำเนินการต่อ'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cropModalOpen} onClose={() => !uploadingImage && setCropModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>ปรับขนาดรูปโปรไฟล์</DialogTitle>
        <DialogContent sx={{ position: 'relative', height: 400, bgcolor: '#333', p: 0 }}>
          {imageToCrop && (
            <Cropper
              image={imageToCrop}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCropModalOpen(false)} disabled={uploadingImage} variant="outlined">
            ยกเลิก
          </Button>
          <Button
            onClick={handleCropConfirm}
            disabled={uploadingImage}
            variant="contained"
            startIcon={uploadingImage ? <CircularProgress size={16} /> : undefined}
          >
            {uploadingImage ? 'กำลังอัปโหลด...' : 'ยืนยันและอัปโหลด'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProfileEditDialog;
