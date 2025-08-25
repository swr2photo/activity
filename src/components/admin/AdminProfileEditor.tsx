// src/components/admin/AdminProfileEditor.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from '@mui/icons-material';

import type { AdminProfile } from '../../types/admin';
import { updateAdminUser, logAdminEvent } from '../../lib/adminFirebase';
import { auth, storage } from '../../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useSnackbar } from 'notistack';

/** พิกัดของรูปสำหรับแสดงแบบ 1:1 ด้วย background-position เป็น % */
type ImagePos = { x: number; y: number };

type Props = {
  currentAdmin: AdminProfile;
};

export default function AdminProfileEditor({ currentAdmin }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // <= 600px

  // ====== state หลัก ======
  const [displayName, setDisplayName] = useState(currentAdmin.displayName || '');
  const [firstName, setFirstName] = useState(currentAdmin.firstName || '');
  const [lastName, setLastName] = useState(currentAdmin.lastName || '');

  const [photoURL, setPhotoURL] = useState(currentAdmin.profileImage || '');

  // โหลดตำแหน่งเดิม ไม่งั้น default 50/50 (กึ่งกลาง)
  const [imgPos, setImgPos] = useState<ImagePos>({
    x: (currentAdmin as any)?.profileImagePosX ?? 50,
    y: (currentAdmin as any)?.profileImagePosY ?? 50,
  });

  const [saving, setSaving] = useState(false);

  // แท็บเลือกระหว่าง “ลิงก์” กับ “อัปโหลดไฟล์”
  const [photoMode, setPhotoMode] = useState<'link' | 'upload'>('upload');

  // สถานะอัปโหลด
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ข้อมูลล็อก/แสดง
  const email = useMemo(() => currentAdmin.email || '', [currentAdmin.email]);
  const department = useMemo(() => currentAdmin.department || 'all', [currentAdmin.department]);

  const hasImage = Boolean(photoURL);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ขนาดพรีวิวตามอุปกรณ์
  const previewSize = isMobile ? 160 : 220;

  // ====== helpers ======
  const resetChanges = () => {
    setDisplayName(currentAdmin.displayName || '');
    setFirstName(currentAdmin.firstName || '');
    setLastName(currentAdmin.lastName || '');
    setPhotoURL(currentAdmin.profileImage || '');
    setImgPos({
      x: (currentAdmin as any)?.profileImagePosX ?? 50,
      y: (currentAdmin as any)?.profileImagePosY ?? 50,
    });
    setPhotoMode('upload');
    enqueueSnackbar('รีเซ็ตข้อมูลกลับเป็นค่าปัจจุบันแล้ว', { variant: 'info' });
  };

  const clearPhoto = () => {
    setPhotoURL('');
    enqueueSnackbar('ลบรูปโปรไฟล์จากฟอร์มแล้ว (ยังไม่บันทึก)', { variant: 'info' });
  };

  // ====== upload handler ======
  const onPickFile = () => fileInputRef.current?.click();

  const onFileSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      enqueueSnackbar('กรุณาเลือกไฟล์รูปภาพเท่านั้น', { variant: 'error' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      enqueueSnackbar('ขนาดไฟล์เกิน 5MB', { variant: 'error' });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(10);
      const path = `adminProfiles/${currentAdmin.uid}/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, path);
      const snap = await uploadBytes(storageRef, file);
      setUploadProgress(80);

      const url = await getDownloadURL(snap.ref);
      setPhotoURL(url);
      setUploadProgress(100);
      enqueueSnackbar('อัปโหลดรูปเรียบร้อย', { variant: 'success' });
      // รีเซ็นเตอร์ทุกครั้งที่เปลี่ยนรูป
      setImgPos({ x: 50, y: 50 });
    } catch (err: any) {
      console.error('upload error:', err);
      enqueueSnackbar(err?.message || 'อัปโหลดล้มเหลว', { variant: 'error' });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(null), 800);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ====== drag/touch to reposition ======
  const [dragging, setDragging] = useState(false);

  // เมาส์
  const startDrag: React.MouseEventHandler<HTMLDivElement> = () => {
    if (!hasImage) return;
    setDragging(true);
  };
  const stopDrag = () => setDragging(false);

  const onDrag: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * 100;
    const relY = ((e.clientY - rect.top) / rect.height) * 100;
    const x = Math.max(0, Math.min(100, relX));
    const y = Math.max(0, Math.min(100, relY));
    setImgPos({ x, y });
  };

  // ทัช (มือถือ/แท็บเล็ต)
  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = () => {
    if (!hasImage) return;
    setDragging(true);
  };
  const onTouchMove: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (!dragging || !containerRef.current) return;
    const t = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const relX = ((t.clientX - rect.left) / rect.width) * 100;
    const relY = ((t.clientY - rect.top) / rect.height) * 100;
    const x = Math.max(0, Math.min(100, relX));
    const y = Math.max(0, Math.min(100, relY));
    setImgPos({ x, y });
  };
  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => setDragging(false);

  const centerImage = () => setImgPos({ x: 50, y: 50 });

  // ====== save ======
  const onSave = async () => {
    try {
      setSaving(true);

      await updateAdminUser(currentAdmin.uid, {
        displayName: displayName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        profileImage: photoURL || undefined,
        profileImagePosX: photoURL ? Math.round(imgPos.x) : undefined,
        profileImagePosY: photoURL ? Math.round(imgPos.y) : undefined,
      } as any);

      // อัปเดต Firebase Auth (best effort)
      try {
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, {
            displayName: displayName.trim(),
            photoURL: photoURL || undefined,
          });
        }
      } catch {}

      await logAdminEvent(
        'ADMIN_PROFILE_UPDATED',
        {
          fields: ['displayName', 'firstName', 'lastName', 'profileImage', 'profileImagePosX', 'profileImagePosY'],
          source: 'AdminProfileEditor',
        },
        { uid: currentAdmin.uid, email: currentAdmin.email }
      );

      enqueueSnackbar('บันทึกโปรไฟล์เรียบร้อย', { variant: 'success' });
      // ✅ ไม่รีเซ็ต state เพื่อให้ “ข้อมูล/รูปคงอยู่”
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'บันทึกล้มเหลว', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ป้องกันลากแล้วปล่อยเมาส์/นิ้วนอกกรอบ
  useEffect(() => {
    const up = () => setDragging(false);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
  }, []);

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={3}>
        <Typography variant="h4" fontWeight={700}>
          แก้ไขโปรไฟล์แอดมิน
        </Typography>

        {/* Header: Avatar + actions */}
        <Card elevation={1} sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={{ xs: 2.5, md: 3 }}
              alignItems={{ md: 'flex-start' }}
            >
              {/* Square preview 1:1 พร้อมลากปรับตำแหน่ง */}
              <Box sx={{ minWidth: { xs: previewSize, md: previewSize } }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  พรีวิว (สัดส่วน 1:1)
                </Typography>

                <Box
                  ref={containerRef}
                  onMouseDown={startDrag}
                  onMouseMove={onDrag}
                  onMouseUp={stopDrag}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  role="img"
                  aria-label="ตัวอย่างรูปโปรไฟล์แบบสี่เหลี่ยมจัตุรัส"
                  sx={{
                    width: previewSize,
                    aspectRatio: '1 / 1', // ✅ คง 1:1 เสมอ
                    borderRadius: 3,
                    overflow: 'hidden',
                    bgcolor: 'grey.200',
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundImage: hasImage ? `url("${photoURL}")` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: `${imgPos.x}% ${imgPos.y}%`,
                    position: 'relative',
                    cursor: hasImage ? (dragging ? 'grabbing' : 'grab') : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    touchAction: 'none', // ป้องกันการ scroll ขณะลากบนมือถือ
                  }}
                >
                  {!hasImage && (
                    <Stack spacing={1} alignItems="center" color="text.disabled">
                      <ImageIcon />
                      <Typography variant="caption">ยังไม่มีรูปภาพ</Typography>
                    </Stack>
                  )}

                  {/* ไอคอนช่วยสื่อว่าลากได้ */}
                  {hasImage && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        bgcolor: 'rgba(0,0,0,.45)',
                        borderRadius: 2,
                        px: 1,
                        py: 0.5,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        fontSize: 12,
                      }}
                    >
                      <DragIcon fontSize="inherit" />
                      ลากเพื่อปรับตำแหน่ง
                    </Box>
                  )}
                </Box>

                {/* ปุ่มรีเซ็นเตอร์ + แถบเลื่อนปรับตำแหน่ง */}
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CenterIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      ตำแหน่ง (X / Y)
                    </Typography>
                  </Stack>
                  <Stack spacing={1.5}>
                    <Slider
                      size="small"
                      value={imgPos.x}
                      onChange={(_, v) => setImgPos((p) => ({ ...p, x: Number(v) }))}
                      min={0}
                      max={100}
                      valueLabelDisplay="auto"
                      aria-label="ตำแหน่งแนวนอน (X)"
                    />
                    <Slider
                      size="small"
                      value={imgPos.y}
                      onChange={(_, v) => setImgPos((p) => ({ ...p, y: Number(v) }))}
                      min={0}
                      max={100}
                      valueLabelDisplay="auto"
                      aria-label="ตำแหน่งแนวตั้ง (Y)"
                    />
                  </Stack>
                  <Button onClick={centerImage} size="small" variant="outlined" startIcon={<CenterIcon />}>
                    จัดกึ่งกลาง
                  </Button>
                </Stack>
              </Box>

              {/* Controls ฝั่งขวา */}
              <Stack spacing={1} flex={1} sx={{ width: '100%' }}>
                <Typography variant="subtitle1" color="text.secondary">
                  รูปโปรไฟล์
                </Typography>

                <Tabs
                  value={photoMode}
                  onChange={(_, v) => setPhotoMode(v)}
                  sx={{
                    minHeight: 36,
                    '& .MuiTab-root': { minHeight: 36, textTransform: 'none' },
                    '& .MuiTabs-flexContainer': { flexWrap: 'wrap' }, // กันล้นบนมือถือ
                  }}
                >
                  <Tab icon={<UploadIcon fontSize="small" />} iconPosition="start" value="upload" label="อัปโหลดไฟล์" />
                  <Tab icon={<LinkIcon fontSize="small" />} iconPosition="start" value="link" label="ใช้ลิงก์รูปภาพ" />
                </Tabs>

                {photoMode === 'upload' ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={onFileSelected}
                    />
                    <Button
                      variant="outlined"
                      startIcon={<UploadIcon />}
                      onClick={onPickFile}
                      disabled={uploading}
                      fullWidth={isMobile}
                    >
                      เลือกรูปภาพ…
                    </Button>

                    {photoURL && (
                      <Tooltip title="ลบรูปออกจากฟอร์ม (ยังไม่บันทึก)">
                        <IconButton onClick={clearPhoto} color="error" size="small">
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                ) : (
                  <TextField
                    label="ลิงก์รูปภาพ (URL)"
                    value={photoURL}
                    onChange={(e) => {
                      setPhotoURL(e.target.value);
                      setImgPos({ x: 50, y: 50 });
                    }}
                    placeholder="https://example.com/avatar.jpg"
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LinkIcon fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: photoURL ? (
                        <InputAdornment position="end">
                          <Tooltip title="ลบลิงก์">
                            <IconButton size="small" onClick={clearPhoto}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ) : undefined,
                    }}
                  />
                )}

                {uploading && (
                  <Box sx={{ pt: 1 }}>
                    <LinearProgress
                      variant={uploadProgress != null ? 'determinate' : 'indeterminate'}
                      value={uploadProgress ?? undefined}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {uploadProgress != null ? `กำลังอัปโหลด… ${uploadProgress}%` : 'กำลังอัปโหลด…'}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Info fields */}
        <Card elevation={1} sx={{ borderRadius: 3 }}>
          <CardHeader title="ข้อมูลบัญชี" />
          <CardContent>
            <Stack spacing={2}>
              <TextField label="อีเมล (ล็อกไว้)" value={email} fullWidth disabled />
              <TextField label="สังกัด/แผนก (ล็อกไว้)" value={String(department)} fullWidth disabled />

              <TextField
                label="ชื่อที่แสดง (displayName)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                fullWidth
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="ชื่อจริง (firstName)"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="นามสกุล (lastName)"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  fullWidth
                />
              </Stack>

              <Alert severity="info" sx={{ borderRadius: 2 }}>
                • ไม่สามารถแก้ “สังกัด” และ “อีเมล” ได้จากหน้านี้<br />
                • หากต้องการเปลี่ยนสังกัดหรืออีเมล โปรดติดต่อผู้ดูแลระบบระดับสูงกว่า
              </Alert>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  startIcon={<ResetIcon />}
                  onClick={resetChanges}
                  disabled={saving || uploading}
                >
                  รีเซ็ต
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={onSave}
                  disabled={saving || uploading}
                >
                  {saving ? 'กำลังบันทึก…' : 'บันทึกโปรไฟล์'}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Paper>
  );
}
