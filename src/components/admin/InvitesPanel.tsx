// src/components/admin/InvitesPanel.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, InputAdornment, Grid,
  Chip, IconButton, Tooltip, Button, ButtonGroup, Stack
} from '@mui/material';
import {
  Search as SearchIcon, ContentCopy as CopyIcon, Delete as DeleteIcon, Block as CancelIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { listInvites, deleteInvite, cancelInvite, type AdminInvite } from '@/lib/invitesApi';

export default function InvitesPanel() {
  const { enqueueSnackbar } = useSnackbar();
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | AdminInvite['status']>('all');

  const load = async () => {
    setLoading(true);
    try {
      const data = await listInvites(200);
      setInvites(data);
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'โหลดประวัติคำเชิญล้มเหลว', { variant: 'error' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // once

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return invites.filter(x => {
      const okStatus = status === 'all' ? true : x.status === status;
      const okSearch =
        !s ||
        x.email.toLowerCase().includes(s) ||
        (x.role || '').toLowerCase().includes(s) ||
        (x.department || '').toLowerCase().includes(s);
      return okStatus && okSearch;
    });
  }, [invites, q, status]);

  const origin = process.env.NEXT_PUBLIC_SITE_URL || '';

  const copyLink = async (it: AdminInvite) => {
    if (!it.token || it.status !== 'pending') {
      enqueueSnackbar('คำเชิญนี้ไม่มีลิงก์หรือไม่ได้อยู่สถานะรอ', { variant: 'warning' });
      return;
    }
    const url = `${origin || window.location.origin}/api/invites/accept?token=${encodeURIComponent(it.token)}`;
    await navigator.clipboard.writeText(url);
    enqueueSnackbar('คัดลอกลิงก์ยืนยันแล้ว', { variant: 'success' });
  };

  const doCancel = async (it: AdminInvite) => {
    try {
      await cancelInvite(it.id);
      enqueueSnackbar('ยกเลิกคำเชิญแล้ว', { variant: 'success' });
      await load();
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'ยกเลิกไม่สำเร็จ', { variant: 'error' });
    }
  };

  const doDelete = async (it: AdminInvite) => {
    try {
      await deleteInvite(it.id);
      enqueueSnackbar('ลบประวัติคำเชิญแล้ว', { variant: 'success' });
      setInvites(prev => prev.filter(x => x.id !== it.id));
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'ลบไม่สำเร็จ', { variant: 'error' });
    }
  };

  const statusColor = (s: AdminInvite['status']) =>
    s === 'pending' ? 'warning'
    : s === 'accepted' ? 'success'
    : s === 'cancelled' ? 'default'
    : 'error';

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} flexWrap="wrap" rowGap={2}>
          <Typography variant="h6">ประวัติคำเชิญ</Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <TextField
              size="small"
              fullWidth
              placeholder="ค้นหาอีเมล/บทบาท/สังกัด"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
              sx={{ minWidth: { xs: '100%', sm: 280 } }}
            />
            <TextField
              size="small"
              select
              label="สถานะ"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              SelectProps={{ native: true }}
              sx={{ minWidth: 140 }}
            >
              <option value="all">ทั้งหมด</option>
              <option value="pending">รอ</option>
              <option value="accepted">ยืนยันแล้ว</option>
              <option value="expired">หมดอายุ</option>
              <option value="cancelled">ยกเลิก</option>
            </TextField>
            <ButtonGroup>
              <Button onClick={load} disabled={loading}>รีเฟรช</Button>
            </ButtonGroup>
          </Stack>
        </Stack>

        <Box sx={{ mt: 2 }}>
          {filtered.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
              {loading ? 'กำลังโหลด…' : 'ไม่มีประวัติคำเชิญ'}
            </Typography>
          ) : (
            <Grid container spacing={1}>
              {filtered.map(it => (
                <Grid item xs={12} key={it.id}>
                  <Card variant="outlined">
                    <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Box sx={{ minWidth: 240 }}>
                        <Typography fontWeight={700}>{it.email}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          บทบาท: {it.role} • สังกัด: {it.department}
                        </Typography>
                      </Box>
                      <Chip label={it.status} color={statusColor(it.status) as any} size="small" />
                      <Box sx={{ color: 'text.secondary', fontSize: 12 }}>
                        สร้างเมื่อ: {it.createdAt ? new Date(it.createdAt).toLocaleString('th-TH') : '-'}
                        {it.expiresAt ? ` • หมดอายุ: ${new Date(it.expiresAt).toLocaleString('th-TH')}` : ''}
                      </Box>
                      <Box sx={{ flex: 1 }} />
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="คัดลอกลิงก์ยืนยัน">
                          <span>
                            <IconButton size="small" onClick={() => copyLink(it)} disabled={it.status !== 'pending' || !it.token}>
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="ยกเลิกคำเชิญ (ทำให้ลิงก์ใช้ไม่ได้)">
                          <span>
                            <IconButton size="small" color="warning" onClick={() => doCancel(it)} disabled={it.status !== 'pending'}>
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="ลบประวัติคำเชิญ">
                          <IconButton size="small" color="error" onClick={() => doDelete(it)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
