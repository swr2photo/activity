'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Stack,
  Button,
  Alert,
  Snackbar,
} from '@mui/material';
import type { AdminProfile } from '../../types/admin';
import { updateAdminUser, logAdminEvent } from '../../lib/adminFirebase';
import { auth } from '../../lib/firebase';
import { updateProfile } from 'firebase/auth';

type Props = {
  currentAdmin: AdminProfile;
};

export default function AdminProfileEditor({ currentAdmin }: Props) {
  const [displayName, setDisplayName] = useState(currentAdmin.displayName || '');
  const [firstName, setFirstName] = useState(currentAdmin.firstName || '');
  const [lastName, setLastName] = useState(currentAdmin.lastName || '');
  const [photoURL, setPhotoURL] = useState(currentAdmin.profileImage || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const email = useMemo(() => currentAdmin.email || '', [currentAdmin.email]);
  const department = useMemo(() => currentAdmin.department || 'all', [currentAdmin.department]);

  const onSave = async () => {
    try {
      setSaving(true);
      await updateAdminUser(currentAdmin.uid, {
        displayName,
        firstName,
        lastName,
        profileImage: photoURL || undefined,
      });

      // อัปเดต displayName ใน Firebase Auth (ถ้าทำได้)
      try {
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { displayName, photoURL: photoURL || undefined });
        }
      } catch {
        /* optional */
      }

      await logAdminEvent(
        'ADMIN_PROFILE_UPDATED',
        { fields: ['displayName', 'firstName', 'lastName', 'profileImage'] },
        { uid: currentAdmin.uid, email: currentAdmin.email }
      );

      setMsg({ type: 'success', text: 'บันทึกโปรไฟล์เรียบร้อย' });
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.message || 'บันทึกล้มเหลว' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>แก้ไขโปรไฟล์แอดมิน</Typography>
        <Stack spacing={2}>
          <TextField
            label="อีเมล (ล็อกไว้)"
            value={email}
            fullWidth
            disabled
          />
          <TextField
            label="สังกัด/แผนก (ล็อกไว้)"
            value={String(department)}
            fullWidth
            disabled
          />
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
          <TextField
            label="รูปโปรไฟล์ (URL)"
            value={photoURL}
            onChange={(e) => setPhotoURL(e.target.value)}
            fullWidth
            placeholder="https://…"
          />
          <Alert severity="info">
            • ไม่สามารถแก้ “สังกัด” และ “อีเมล” ได้จากหน้านี้<br />
            • หากต้องการเปลี่ยนสังกัดหรืออีเมล โปรดติดต่อผู้ดูแลระบบระดับสูงกว่า
          </Alert>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={onSave} disabled={saving}>
              {saving ? 'กำลังบันทึก…' : 'บันทึกโปรไฟล์'}
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Snackbar
        open={!!msg}
        autoHideDuration={3500}
        onClose={() => setMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {msg ? <Alert severity={msg.type}>{msg.text}</Alert> : <span />}
      </Snackbar>
    </>
  );
}
