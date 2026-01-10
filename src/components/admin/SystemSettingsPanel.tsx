// src/components/admin/SystemSettingsPanel.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  Snackbar,
  MenuItem,
  Divider,
  InputAdornment,
  Grid,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import WarningIcon from '@mui/icons-material/Warning';

import type { AdminProfile } from '../../types/admin';
import {
  subscribeSystemSettings,
  updateSystemSettings,
  type SystemSettings,
  logAdminEvent,
} from '../../lib/adminFirebase';

type Props = {
  currentAdmin: AdminProfile;
};

// ค่าเริ่มต้นกรณีโหลดไม่มา
const defaults: SystemSettings = {
  maintenanceEnabled: false,
  maintenanceMessage: '',
  maintenanceWhitelist: [],
  bannerStandardWidth: 1600,
  bannerStandardHeight: 600,
  bannerFit: 'cover',
};

const toCSV = (arr: string[]) => arr.join(', ');

const parseWhitelist = (v: string) =>
  v
    .split(/,|\n/) // รองรับทั้ง comma และ newline
    .map((s) => s.trim())
    .filter(Boolean);

export default function SystemSettingsPanel({ currentAdmin }: Props) {
  const [settings, setSettings] = useState<SystemSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Realtime Sync
  useEffect(() => {
    const unsub = subscribeSystemSettings((s) => {
      setSettings((prev) => ({ ...prev, ...s }));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const whitelistText = useMemo(
    () => toCSV(settings.maintenanceWhitelist || []),
    [settings.maintenanceWhitelist]
  );

  const handleSave = async () => {
    // Validation
    if (Number(settings.bannerStandardWidth) < 100 || Number(settings.bannerStandardHeight) < 100) {
      setMsg({ type: 'error', text: 'ขนาดแบนเนอร์ต้องไม่ต่ำกว่า 100px' });
      return;
    }

    try {
      setSaving(true);
      const patch: Partial<SystemSettings> = {
        maintenanceEnabled: !!settings.maintenanceEnabled,
        maintenanceMessage: settings.maintenanceMessage || 'ระบบกำลังปิดปรับปรุงชั่วคราว',
        maintenanceWhitelist: Array.isArray(settings.maintenanceWhitelist)
          ? settings.maintenanceWhitelist
          : [],
        bannerStandardWidth: Number(settings.bannerStandardWidth || 1600),
        bannerStandardHeight: Number(settings.bannerStandardHeight || 600),
        bannerFit: settings.bannerFit === 'contain' ? 'contain' : 'cover',
      };

      await updateSystemSettings(patch);
      
      // Log Audit
      await logAdminEvent(
        'SYSTEM_SETTINGS_UPDATED',
        { patch },
        { uid: currentAdmin.uid, email: currentAdmin.email }
      );
      
      setMsg({ type: 'success', text: 'บันทึกการตั้งค่าเรียบร้อยแล้ว' });
    } catch (e: any) {
      console.error(e);
      setMsg({ type: 'error', text: e?.message || 'บันทึกล้มเหลว กรุณาลองใหม่' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography>กำลังโหลดการตั้งค่าระบบ...</Typography>
      </Paper>
    );
  }

  return (
    <>
      <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <Stack spacing={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SettingsIcon color="primary" fontSize="large" />
            <Typography variant="h4" fontWeight="bold">ตั้งค่าระบบ</Typography>
          </Box>

          <Divider />

          {/* Maintenance Mode Section */}
          <Box>
            <Typography variant="h6" color="error.main" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon /> โหมดปิดปรับปรุง (Maintenance Mode)
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              เมื่อเปิดใช้งาน ผู้ใช้ทั่วไปจะไม่สามารถเข้าสู่ระบบได้ ยกเว้นผู้ที่มีรายชื่อใน Whitelist
            </Typography>
            
            <Paper variant="outlined" sx={{ p: 2, bgcolor: settings.maintenanceEnabled ? 'error.lighter' : 'background.paper' }}>
              <FormControlLabel
                control={
                  <Switch
                    color="error"
                    checked={!!settings.maintenanceEnabled}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, maintenanceEnabled: e.target.checked }))
                    }
                  />
                }
                label={
                  <Typography fontWeight={settings.maintenanceEnabled ? 'bold' : 'normal'}>
                    {settings.maintenanceEnabled ? 'กำลังเปิดใช้งานโหมดปิดปรับปรุง' : 'ปิดใช้งาน (ปกติ)'}
                  </Typography>
                }
              />

              <Stack spacing={2} sx={{ mt: 2, opacity: settings.maintenanceEnabled ? 1 : 0.6 }}>
                <TextField
                  label="ข้อความแจ้งเตือน (Maintenance Message)"
                  placeholder="เช่น ระบบกำลังปิดปรับปรุงชั่วคราว คาดว่าจะเสร็จเวลา..."
                  value={settings.maintenanceMessage || ''}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, maintenanceMessage: e.target.value }))
                  }
                  fullWidth
                  multiline
                  minRows={2}
                  disabled={!settings.maintenanceEnabled}
                />
                
                <TextField
                  label="Whitelist (Email หรือ UID)"
                  placeholder="admin@psu.ac.th, 6410110xxx"
                  helperText="คั่นด้วยเครื่องหมายจุลภาค (,) รองรับทั้ง Email และ UID"
                  value={whitelistText}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      maintenanceWhitelist: parseWhitelist(e.target.value),
                    }))
                  }
                  fullWidth
                  multiline
                  disabled={!settings.maintenanceEnabled}
                />
              </Stack>
            </Paper>
          </Box>

          <Divider />

          {/* Banner Settings Section */}
          <Box>
            <Typography variant="h6" gutterBottom>มาตรฐานรูปภาพกิจกรรม (Banner)</Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              กำหนดขนาดมาตรฐานของรูปภาพหน้าปกกิจกรรม เพื่อให้การแสดงผลในหน้าเว็บสวยงามและสม่ำเสมอ
            </Typography>

            {/* ✅ FIX: Grid v2 syntax */}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="ความกว้าง (Width)"
                  type="number"
                  value={settings.bannerStandardWidth || 1600}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      bannerStandardWidth: Number(e.target.value),
                    }))
                  }
                  fullWidth
                  InputProps={{ endAdornment: <InputAdornment position="end">px</InputAdornment> }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="ความสูง (Height)"
                  type="number"
                  value={settings.bannerStandardHeight || 600}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      bannerStandardHeight: Number(e.target.value),
                    }))
                  }
                  fullWidth
                  InputProps={{ endAdornment: <InputAdornment position="end">px</InputAdornment> }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  select
                  label="รูปแบบการแสดงผล (Object Fit)"
                  value={settings.bannerFit || 'cover'}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      bannerFit: e.target.value === 'contain' ? 'contain' : 'cover',
                    }))
                  }
                  fullWidth
                >
                  <MenuItem value="cover">Cover (ตัดส่วนเกินให้เต็มกรอบ)</MenuItem>
                  <MenuItem value="contain">Contain (แสดงภาพครบ แต่อาจมีขอบขาว)</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Save Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              sx={{ minWidth: 150 }}
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </Button>
          </Box>
        </Stack>
      </Paper>

      {/* Feedback Snackbar */}
      <Snackbar
        open={!!msg}
        autoHideDuration={4000}
        onClose={() => setMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={msg?.type} variant="filled" onClose={() => setMsg(null)} sx={{ width: '100%' }}>
          {msg?.text}
        </Alert>
      </Snackbar>
    </>
  );
}