'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Tabs, Tab, Badge, TextField, InputAdornment, Button, ButtonGroup,
  Dialog, DialogTitle, DialogContent, DialogActions, Avatar, Chip, IconButton, Tooltip,
  Grid, Card, CardContent, Container
} from '@mui/material';
import {
  Search as SearchIcon, Refresh as RefreshIcon, Download as ExportIcon,
  Person as PersonIcon, CheckCircle as ApproveIcon, Block as SuspendIcon, Visibility as ViewIcon
} from '@mui/icons-material';

// ✅ นำค่า (value) DEPARTMENT_LABELS แบบปกติ และ type แบบ type import
import { DEPARTMENT_LABELS, type AdminProfile, type AdminDepartment } from '../../types/admin';

import {
  getAllUsers, getPendingUsers, getUsersByDepartment, getPendingUsersByDepartment,
  approveUser, suspendUser, type UnivUser
} from '../../lib/adminFirebase';

interface Props {
  currentAdmin: AdminProfile;
}

const AdminUserManagement: React.FC<Props> = ({ currentAdmin }) => {
  const [allUsers, setAllUsers] = useState<UnivUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UnivUser[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<UnivUser | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      if (currentAdmin.department === 'all') {
        const [a, p] = await Promise.all([getAllUsers(), getPendingUsers()]);
        setAllUsers(a); setPendingUsers(p);
      } else {
        const [a, p] = await Promise.all([
          getUsersByDepartment(currentAdmin.department as AdminDepartment),
          getPendingUsersByDepartment(currentAdmin.department as AdminDepartment)
        ]);
        setAllUsers(a); setPendingUsers(p);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [currentAdmin.department]); // eslint-disable-line react-hooks/exhaustive-deps

  const source = tab === 0 ? pendingUsers : allUsers;
  const filtered = useMemo(() => {
    if (!search.trim()) return source;
    const s = search.trim().toLowerCase();
    return source.filter(u =>
      (u.displayName || '').toLowerCase().includes(s) ||
      (u.firstName || '').toLowerCase().includes(s) ||
      (u.lastName || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s) ||
      (u.studentId || '').toLowerCase().includes(s) ||
      (u.faculty || '').toLowerCase().includes(s) ||
      (String(u.department || '')).toLowerCase().includes(s)
    );
  }, [source, search]);

  const exportCSV = () => {
    const rows = filtered.map(u => [
      u.studentId || '', u.firstName || '', u.lastName || '', u.email || '',
      u.faculty || '', String(u.department || ''), u.degreeLevel || '',
      u.isVerified ? 'อนุมัติแล้ว' : 'รออนุมัติ',
      u.createdAt ? new Date(u.createdAt).toLocaleDateString('th-TH') : ''
    ]);
    const csv = [
      ['รหัสนักศึกษา','ชื่อ','นามสกุล','อีเมล','คณะ','สาขา','ระดับปริญญา','สถานะ','วันที่สร้าง'].join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `university_users_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">จัดการผู้ใช้มหาวิทยาลัย</Typography>
        <Typography color="text.secondary">
          สังกัด: {(DEPARTMENT_LABELS as any)[currentAdmin.department] || currentAdmin.department}
        </Typography>
      </Box>

      {/* Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}><PersonIcon /></Avatar>
            <Box><Typography variant="h5">{allUsers.length.toLocaleString()}</Typography><Typography>ผู้ใช้ทั้งหมด</Typography></Box>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'warning.main' }}><PersonIcon /></Avatar>
            <Box><Typography variant="h5">{pendingUsers.length.toLocaleString()}</Typography><Typography>รออนุมัติ</Typography></Box>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'success.main' }}><PersonIcon /></Avatar>
            <Box><Typography variant="h5">{allUsers.filter(u => u.isVerified).length.toLocaleString()}</Typography><Typography>อนุมัติแล้ว</Typography></Box>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'error.main' }}><PersonIcon /></Avatar>
            <Box><Typography variant="h5">{allUsers.filter(u => !u.isActive).length.toLocaleString()}</Typography><Typography>ถูกระงับ</Typography></Box>
          </CardContent></Card>
        </Grid>
      </Grid>

      {/* Controls */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small" label="ค้นหาผู้ใช้" value={search} onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            sx={{ minWidth: { xs: '100%', md: 360 } }}
          />
          <Box sx={{ flex: 1 }} />
          <ButtonGroup>
            <Button onClick={load} disabled={loading} startIcon={<RefreshIcon />}>รีเฟรช</Button>
            <Button color="success" onClick={exportCSV} startIcon={<ExportIcon />} disabled={filtered.length === 0}>ส่งออก</Button>
          </ButtonGroup>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardContent>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label={<Badge badgeContent={pendingUsers.length} color="warning">รออนุมัติ</Badge>} />
            <Tab label={`ผู้ใช้ทั้งหมด (${allUsers.length})`} />
          </Tabs>

          <Box sx={{ mt: 2 }}>
            {filtered.length === 0 ? (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
                {tab === 0 ? 'ไม่มีผู้ใช้ที่รออนุมัติ' : 'ไม่มีผู้ใช้ในระบบ'}
              </Typography>
            ) : (
              <Grid container spacing={1}>
                {filtered.map(u => (
                  <Grid item xs={12} key={u.uid}>
                    <Card variant="outlined">
                      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Avatar src={u.photoURL}>{(u.firstName || u.displayName || 'U').charAt(0)}</Avatar>
                        <Box sx={{ minWidth: 220 }}>
                          <Typography fontWeight={600}>{u.firstName} {u.lastName}</Typography>
                          <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                        </Box>
                        <Box sx={{ minWidth: 180 }}>
                          <Typography variant="body2">รหัส: <b>{u.studentId || '-'}</b></Typography>
                          <Typography variant="caption" color="text.secondary">{u.faculty} • {String(u.department || '')}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: .5 }}>
                          <Chip size="small" label={u.isVerified ? 'อนุมัติแล้ว' : 'รออนุมัติ'} color={u.isVerified ? 'success' : 'warning'} />
                          <Chip size="small" label={u.isActive ? 'ใช้งานได้' : 'ถูกระงับ'} color={u.isActive ? 'success' : 'error'} />
                        </Box>
                        <Box sx={{ flex: 1 }} />
                        <Tooltip title="ดูรายละเอียด"><IconButton color="info" onClick={() => { setSel(u); setOpen(true); }}><ViewIcon /></IconButton></Tooltip>
                        {!u.isVerified && (
                          <Tooltip title="อนุมัติ">
                            <IconButton color="success" onClick={async () => { await approveUser(u.uid); await load(); }}>
                              <ApproveIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        {u.isActive && (
                          <Tooltip title="ระงับการใช้งาน">
                            <IconButton color="error" onClick={async () => { await suspendUser(u.uid); await load(); }}>
                              <SuspendIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        {sel && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar src={sel.photoURL}>{(sel.firstName || 'U').charAt(0)}</Avatar>
              รายละเอียดผู้ใช้: {sel.firstName} {sel.lastName}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">อีเมล</Typography><Typography>{sel.email}</Typography></Grid>
                <Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">รหัสนักศึกษา</Typography><Typography>{sel.studentId || '-'}</Typography></Grid>
                <Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">คณะ</Typography><Typography>{sel.faculty || '-'}</Typography></Grid>
                <Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">สาขา</Typography><Typography>{String(sel.department || '-') }</Typography></Grid>
                <Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">ระดับปริญญา</Typography><Typography>{sel.degreeLevel || '-'}</Typography></Grid>
                <Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">สร้างเมื่อ</Typography><Typography>{sel.createdAt ? new Date(sel.createdAt).toLocaleDateString('th-TH') : '-'}</Typography></Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>ปิด</Button>
              {!sel.isVerified && <Button variant="contained" color="success" startIcon={<ApproveIcon />} onClick={async () => { await approveUser(sel.uid); setOpen(false); await load(); }}>อนุมัติ</Button>}
              {sel.isActive && <Button variant="contained" color="error" startIcon={<SuspendIcon />} onClick={async () => { await suspendUser(sel.uid); setOpen(false); await load(); }}>ระงับ</Button>}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default AdminUserManagement;
