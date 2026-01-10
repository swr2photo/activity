// src/components/admin/AdminProfileEditor.tsx
'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Stack,
  Button,
  Alert,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  LinearProgress,
  InputAdornment,
  Tooltip,
  Slider,
  useMediaQuery,
  useTheme,
  Avatar,
  Divider,
  CircularProgress, // ✅ เพิ่ม Import นี้
} from '@mui/material';
import {
  Upload as UploadIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  RestartAlt as ResetIcon,
  OpenWith as DragIcon,
  CenterFocusStrong as CenterIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

import { useSnackbar } from 'notistack';
import { updateProfile } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import type { AdminProfile } from '../../types/admin';
import { updateAdminUser, logAdminEvent } from '../../lib/adminFirebase';
import { auth, storage } from '../../lib/firebase';

type ImagePos = { x: number; y: number };

type Props = {
  currentAdmin: AdminProfile;
};

export default function AdminProfileEditor({ currentAdmin }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State
  const [displayName, setDisplayName] = useState(currentAdmin.displayName || '');
  const [firstName, setFirstName] = useState(currentAdmin.firstName || '');
  const [lastName, setLastName] = useState(currentAdmin.lastName || '');
  const [photoURL, setPhotoURL] = useState(currentAdmin.profileImage || '');
  
  const [imgPos, setImgPos] = useState<ImagePos>({
    x: currentAdmin.profileImagePosX ?? 50,
    y: currentAdmin.profileImagePosY ?? 50,
  });

  const [saving, setSaving] = useState(false);
  const [photoMode, setPhotoMode] = useState<'upload' | 'link'>('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const previewSize = isMobile ? 160 : 220;
  const hasImage = Boolean(photoURL);

  // --- Handlers ---

  const resetChanges = () => {
    setDisplayName(currentAdmin.displayName || '');
    setFirstName(currentAdmin.firstName || '');
    setLastName(currentAdmin.lastName || '');
    setPhotoURL(currentAdmin.profileImage || '');
    setImgPos({
      x: currentAdmin.profileImagePosX ?? 50,
      y: currentAdmin.profileImagePosY ?? 50,
    });
    setPhotoMode('upload');
    enqueueSnackbar('รีเซ็ตข้อมูลแล้ว', { variant: 'info' });
  };

  const clearPhoto = () => {
    setPhotoURL('');
    setImgPos({ x: 50, y: 50 });
    if (fileInputRef.current) fileInputRef.current.value = '';
    enqueueSnackbar('ลบรูปภาพแล้ว (กดบันทึกเพื่อยืนยัน)', { variant: 'warning' });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate File
    if (!file.type.startsWith('image/')) {
      enqueueSnackbar('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG)', { variant: 'error' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) { // Limit 2MB
      enqueueSnackbar('ขนาดไฟล์เกิน 2MB กรุณาลดขนาดไฟล์', { variant: 'error' });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(10);

      // Upload to Firebase Storage
      const storagePath = `admin-profiles/${currentAdmin.uid}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      
      const snapshot = await uploadBytes(storageRef, file);
      setUploadProgress(70);
      
      const downloadURL = await getDownloadURL(snapshot.ref);
      setPhotoURL(downloadURL);
      setUploadProgress(100);
      
      enqueueSnackbar('อัปโหลดรูปสำเร็จ', { variant: 'success' });
      setImgPos({ x: 50, y: 50 }); // Reset position for new image

    } catch (error: any) {
      console.error('Upload failed:', error);
      enqueueSnackbar(`อัปโหลดล้มเหลว: ${error.message}`, { variant: 'error' });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(null), 1000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      enqueueSnackbar('กรุณาระบุชื่อที่แสดง (Display Name)', { variant: 'warning' });
      return;
    }

    try {
      setSaving(true);

      const updates: Partial<AdminProfile> = {
        displayName: displayName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        profileImage: photoURL || undefined,
        profileImagePosX: photoURL ? Math.round(imgPos.x) : undefined,
        profileImagePosY: photoURL ? Math.round(imgPos.y) : undefined,
      };

      // 1. Update Firestore
      await updateAdminUser(currentAdmin.uid, updates);

      // 2. Update Auth Profile (if current user)
      if (auth.currentUser && auth.currentUser.uid === currentAdmin.uid) {
        await updateProfile(auth.currentUser, {
          displayName: updates.displayName,
          photoURL: updates.profileImage,
        });
      }

      // 3. Log Audit
      await logAdminEvent(
        'ADMIN_PROFILE_UPDATED',
        { changes: Object.keys(updates) },
        { uid: currentAdmin.uid, email: currentAdmin.email }
      );

      enqueueSnackbar('บันทึกข้อมูลเรียบร้อยแล้ว', { variant: 'success' });

    } catch (error: any) {
      console.error('Save failed:', error);
      enqueueSnackbar(`บันทึกไม่สำเร็จ: ${error.message}`, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // --- Image Drag Logic ---
  const handleDragStart = () => hasImage && setDragging(true);
  const handleDragEnd = () => setDragging(false);
  
  const handleDragMove = (clientX: number, clientY: number) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setImgPos({ x, y });
  };

  return (
    <Paper sx={{ p: { xs: 2, md: 4 }, maxWidth: 900, mx: 'auto' }}>
      <Stack spacing={4}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
            <PersonIcon fontSize="large" />
          </Avatar>
          <Typography variant="h4" fontWeight="bold">แก้ไขโปรไฟล์</Typography>
        </Box>

        <Divider />

        <GridContainer>
          {/* Left: Image Preview */}
          <Box>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">รูปโปรไฟล์ (1:1)</Typography>
            
            <Box
              ref={containerRef}
              onMouseDown={handleDragStart}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
              onTouchStart={handleDragStart}
              onTouchEnd={handleDragEnd}
              onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
              sx={{
                width: previewSize,
                height: previewSize,
                borderRadius: 4,
                bgcolor: 'grey.100',
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                position: 'relative',
                backgroundImage: hasImage ? `url("${photoURL}")` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: `${imgPos.x}% ${imgPos.y}%`,
                cursor: hasImage ? (dragging ? 'grabbing' : 'grab') : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: dragging ? 'none' : 'background-position 0.2s',
                touchAction: 'none'
              }}
            >
              {!hasImage && (
                <Stack alignItems="center" color="text.disabled" spacing={1}>
                  <ImageIcon fontSize="large" />
                  <Typography variant="caption">ไม่มีรูปภาพ</Typography>
                </Stack>
              )}
              
              {hasImage && !dragging && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 8,
                    bgcolor: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 10,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    pointerEvents: 'none'
                  }}
                >
                  <DragIcon sx={{ fontSize: 14 }} /> ลากเพื่อจัดตำแหน่ง
                </Box>
              )}
            </Box>

            {/* Position Sliders */}
            {hasImage && (
              <Box sx={{ mt: 2, width: previewSize }}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" sx={{ width: 20 }}>X</Typography>
                    <Slider 
                      size="small" 
                      value={imgPos.x} 
                      onChange={(_, v) => setImgPos(p => ({ ...p, x: v as number }))} 
                    />
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" sx={{ width: 20 }}>Y</Typography>
                    <Slider 
                      size="small" 
                      value={imgPos.y} 
                      onChange={(_, v) => setImgPos(p => ({ ...p, y: v as number }))} 
                    />
                  </Stack>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    startIcon={<CenterIcon />} 
                    onClick={() => setImgPos({ x: 50, y: 50 })}
                    fullWidth
                  >
                    จัดกึ่งกลาง
                  </Button>
                </Stack>
              </Box>
            )}
          </Box>

          {/* Right: Form & Actions */}
          <Box sx={{ flex: 1 }}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={3}>
                  {/* Photo Selection */}
                  <Box>
                    <Tabs value={photoMode} onChange={(_, v) => setPhotoMode(v)} sx={{ mb: 2, minHeight: 36 }}>
                      <Tab label="อัปโหลดไฟล์" value="upload" icon={<UploadIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 36 }} />
                      <Tab label="ใช้ลิงก์ URL" value="link" icon={<LinkIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 36 }} />
                    </Tabs>

                    {photoMode === 'upload' ? (
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Button
                          component="label"
                          variant="outlined"
                          startIcon={<UploadIcon />}
                          disabled={uploading}
                        >
                          เลือกรูปภาพ...
                          <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handleFileSelect} />
                        </Button>
                        {uploading && <CircularProgress size={24} />}
                        {hasImage && !uploading && (
                          <IconButton color="error" onClick={clearPhoto} size="small">
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </Stack>
                    ) : (
                      <TextField
                        fullWidth
                        size="small"
                        label="วางลิงก์รูปภาพ (URL)"
                        value={photoURL}
                        onChange={(e) => setPhotoURL(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        InputProps={{
                          endAdornment: hasImage && (
                            <InputAdornment position="end">
                              <IconButton onClick={clearPhoto} edge="end" size="small"><DeleteIcon /></IconButton>
                            </InputAdornment>
                          )
                        }}
                      />
                    )}
                    
                    {uploading && (
                        <Box sx={{ mt: 1 }}>
                            <LinearProgress variant="determinate" value={uploadProgress || 0} />
                            <Typography variant="caption" color="text.secondary" align="right" display="block">
                                กำลังอัปโหลด... {uploadProgress}%
                            </Typography>
                        </Box>
                    )}
                  </Box>

                  <Divider />

                  {/* Text Fields */}
                  <Stack spacing={2}>
                    <TextField
                      label="อีเมล (Email)"
                      value={currentAdmin.email}
                      disabled
                      fullWidth
                      helperText="ไม่สามารถเปลี่ยนอีเมลได้"
                    />
                    
                    <TextField
                      label="ชื่อที่แสดง (Display Name)"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      fullWidth
                      required
                      error={!displayName.trim()}
                      helperText={!displayName.trim() ? "กรุณาระบุชื่อ" : "ชื่อที่แสดงในระบบ"}
                    />

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <TextField
                        label="ชื่อจริง"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        fullWidth
                      />
                      <TextField
                        label="นามสกุล"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        fullWidth
                      />
                    </Stack>
                  </Stack>

                  {/* Actions */}
                  <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 2 }}>
                    <Button 
                        startIcon={<ResetIcon />} 
                        onClick={resetChanges} 
                        disabled={saving || uploading}
                    >
                        คืนค่าเดิม
                    </Button>
                    <Button 
                        variant="contained" 
                        startIcon={<SaveIcon />} 
                        onClick={handleSave} 
                        disabled={saving || uploading || !displayName.trim()}
                    >
                        {saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                    </Button>
                  </Stack>

                </Stack>
              </CardContent>
            </Card>
          </Box>
        </GridContainer>
      </Stack>
    </Paper>
  );
}

// Helper Component for Layout
const GridContainer = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ 
    display: 'grid', 
    gridTemplateColumns: { xs: '1fr', md: 'auto 1fr' }, 
    gap: 4,
    alignItems: 'start'
  }}>
    {children}
  </Box>
);