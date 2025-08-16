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
} from '@mui/material';
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
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export default function SystemSettingsPanel({ currentAdmin }: Props) {
  const [settings, setSettings] = useState<SystemSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    try {
      setSaving(true);
      const patch: Partial<SystemSettings> = {
        maintenanceEnabled: !!settings.maintenanceEnabled,
        maintenanceMessage: settings.maintenanceMessage || '',
        maintenanceWhitelist: Array.isArray(settings.maintenanceWhitelist)
          ? settings.maintenanceWhitelist
          : [],
        bannerStandardWidth: Number(settings.bannerStandardWidth || 1600),
        bannerStandardHeight: Number(settings.bannerStandardHeight || 600),
        bannerFit: settings.bannerFit === 'contain' ? 'contain' : 'cover',
      };

      await updateSystemSettings(patch);
      await logAdminEvent(
        'SYSTEM_SETTINGS_UPDATED',
        { patch },
        { uid: currentAdmin.uid, email: currentAdmin.email }
      );
      setMsg({ type: 'success', text: 'บันทึกการตั้งค่าเรียบร้อย' });
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.message || 'บันทึกล้มเหลว' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography>กำลังโหลดการตั้งค่าระบบ…</Typography>
      </Paper>
    );
  }

  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Typography variant="h4">ตั้งค่าระบบ</Typography>

          <Box>
            <Typography variant="h6" gutterBottom>โหมดปิดปรับปรุง (Maintenance)</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={!!settings.maintenanceEnabled}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, maintenanceEnabled: e.target.checked }))
                  }
                />
              }
              label="เปิดโหมดปิดปรับปรุง"
            />
            <TextField
              sx={{ mt: 2 }}
              label="ข้อความแจ้งเตือน (maintenance message)"
              value={settings.maintenanceMessage || ''}
              onChange={(e) =>
                setSettings((s) => ({ ...s, maintenanceMessage: e.target.value }))
              }
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              sx={{ mt: 2 }}
              label="Whitelist (คั่นด้วย comma) — ใส่ email หรือ uid ที่ยังให้เข้าได้"
              value={whitelistText}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  maintenanceWhitelist: parseWhitelist(e.target.value),
                }))
              }
              fullWidth
            />
            {settings.maintenanceEnabled && (
              <Alert sx={{ mt: 2 }} severity="warning">
                ระบบจะอนุญาตเฉพาะ whitelist และผู้ดูแลที่ได้รับอนุญาตเท่านั้นในช่วงปิดปรับปรุง
              </Alert>
            )}
          </Box>

          <Divider />

          <Box>
            <Typography variant="h6" gutterBottom>มาตรฐานแบนเนอร์กิจกรรม</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="ความกว้างมาตรฐาน (px)"
                type="number"
                value={settings.bannerStandardWidth || 1600}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    bannerStandardWidth: Number(e.target.value || 1600),
                  }))
                }
                fullWidth
              />
              <TextField
                label="ความสูงมาตรฐาน (px)"
                type="number"
                value={settings.bannerStandardHeight || 600}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    bannerStandardHeight: Number(e.target.value || 600),
                  }))
                }
                fullWidth
              />
              <TextField
                select
                label="การแสดงผลรูป"
                value={settings.bannerFit || 'cover'}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    bannerFit: e.target.value === 'contain' ? 'contain' : 'cover',
                  }))
                }
                fullWidth
              >
                <MenuItem value="cover">cover</MenuItem>
                <MenuItem value="contain">contain</MenuItem>
              </TextField>
            </Stack>
            <Alert sx={{ mt: 2 }} severity="info">
              ค่านี้ช่วยให้แอดมินคนอื่นอัปโหลดแบนเนอร์ขนาดสม่ำเสมอ (ฝั่ง UI สามารถอ่านไปใช้ crop/focus ได้)
            </Alert>
          </Box>

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </Button>
          </Stack>
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
