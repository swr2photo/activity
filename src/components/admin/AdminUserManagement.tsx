// src/components/admin/AdminUserManagement.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Tabs, Tab, Badge, TextField, InputAdornment, Button, ButtonGroup,
  Dialog, DialogTitle, DialogContent, DialogActions, Avatar, Chip, IconButton, Tooltip,
  Grid, Card, CardContent, Container, MenuItem, Stack, Alert
} from '@mui/material';
import {
  Search as SearchIcon, Refresh as RefreshIcon, Download as ExportIcon,
  Person as PersonIcon, CheckCircle as ApproveIcon, Block as SuspendIcon, Visibility as ViewIcon,
  AdminPanelSettings as MakeAdminIcon
} from '@mui/icons-material';

import {
  DEPARTMENT_LABELS,
  ROLE_PERMISSIONS,
  type AdminProfile,
  type AdminDepartment,
  type AdminRole,
  type AdminPermission,
} from '../../types/admin';

import {
  getAllUsers, getPendingUsers, getUsersByDepartment, getPendingUsersByDepartment,
  approveUser, suspendUser, type UnivUser, createAdminUser, logAdminEvent
} from '../../lib/adminFirebase';

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface Props {
  currentAdmin: AdminProfile;
}

// ——— bilingual permission meta (ใช้แสดงผล/tooltip) ———
const PERMISSION_META: Record<AdminPermission, {
  th: string; en: string; descTh: string; descEn: string; group: string;
}> = {
  manage_users: {
    th: 'จัดการผู้ใช้', en: 'Manage Users',
    descTh: 'อนุมัติ/ระงับ/แก้ไขโปรไฟล์ผู้ใช้',
    descEn: 'Approve/Suspend/Edit user profiles',
    group: 'Users'
  },
  manage_activities: {
    th: 'จัดการกิจกรรม', en: 'Manage Activities',
    descTh: 'สร้าง/แก้ไข/ปิดกิจกรรมและ QR',
    descEn: 'Create/Edit/Close activities & QR',
    group: 'Activities'
  },
  view_reports: {
    th: 'ดูรายงาน', en: 'View Reports',
    descTh: 'เข้าถึงหน้ารายงานและสถิติ',
    descEn: 'Access reports and analytics',
    group: 'Reports'
  },
  export_data: {
    th: 'ส่งออกข้อมูล', en: 'Export Data',
    descTh: 'ดาวน์โหลดข้อมูลเป็นไฟล์',
    descEn: 'Download data as files',
    group: 'Data'
  },
  manage_admins: {
    th: 'จัดการแอดมิน', en: 'Manage Admins',
    descTh: 'เพิ่ม/แก้ไข/ลบผู้ดูแล',
    descEn: 'Create/Update/Delete admins',
    group: 'Admins'
  },
  system_settings: {
    th: 'ตั้งค่าระบบ', en: 'System Settings',
    descTh: 'แก้ไขการตั้งค่าทั่วไปของระบบ',
    descEn: 'Modify global system settings',
    group: 'System'
  },
  moderate_content: {
    th: 'กลั่นกรองเนื้อหา', en: 'Moderate Content',
    descTh: 'จัดการเนื้อหาที่รายงาน/ไม่เหมาะสม',
    descEn: 'Handle flagged/inappropriate content',
    group: 'Moderation'
  },
};

const AdminUserManagement: React.FC<Props> = ({ currentAdmin }) => {
  const [allUsers, setAllUsers] = useState<UnivUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UnivUser[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);

  // view dialog
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<UnivUser | null>(null);

  // promote-to-admin dialog
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteUser, setPromoteUser] = useState<UnivUser | null>(null);
  const [chosenRole, setChosenRole] = useState<AdminRole>('department_admin');
  const [chosenDept, setChosenDept] = useState<AdminDepartment>(
    (currentAdmin.department === 'all' ? 'student_union' : currentAdmin.department) as AdminDepartment
  );
  const [alreadyAdmin, setAlreadyAdmin] = useState(false);
  const [promoteBusy, setPromoteBusy] = useState(false);
  const [promoteErr, setPromoteErr] = useState('');

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

  const exportCSV = async () => {
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

    // log
    await logAdminEvent('EXPORT_USERS', {
      tab: tab === 0 ? 'pending' : 'all',
      filteredCount: filtered.length,
      query: search,
      department: currentAdmin.department
    }, { uid: currentAdmin.uid, email: currentAdmin.email });
  };

  // ——— promote helpers ———
  const openPromote = async (u: UnivUser) => {
    setPromoteErr('');
    setPromoteUser(u);
    setChosenRole(currentAdmin.role === 'super_admin' ? 'department_admin' : 'moderator');
    setChosenDept(
      (currentAdmin.department === 'all'
        ? (String(u.department || 'student_union') as AdminDepartment)
        : currentAdmin.department) as AdminDepartment
    );
    setPromoteOpen(true);

    // เช็กว่าเป็น admin อยู่แล้วหรือยัง
    const ref = doc(db, 'adminUsers', u.uid);
    const snap = await getDoc(ref);
    setAlreadyAdmin(snap.exists());
  };

  const doPromote = async () => {
    if (!promoteUser) return;
    setPromoteBusy(true);
    setPromoteErr('');

    try {
      if (alreadyAdmin) {
        setPromoteErr('ผู้ใช้นี้เป็นผู้ดูแลอยู่แล้ว');
        return;
      }

      // จำกัดสิทธิ์: ถ้าไม่ใช่ super_admin ห้ามตั้ง super_admin และห้ามเปลี่ยนสังกัด
      if (currentAdmin.role !== 'super_admin' && chosenRole === 'super_admin') {
        setPromoteErr('คุณไม่มีสิทธิ์ตั้งบทบาทเป็นผู้ดูแลสูงสุด');
        return;
      }

      const dept: AdminDepartment =
        (currentAdmin.department === 'all' ? chosenDept : currentAdmin.department) as AdminDepartment;

      await createAdminUser({
        uid: promoteUser.uid,
        email: promoteUser.email || '',
        displayName: promoteUser.displayName || `${promoteUser.firstName || ''} ${promoteUser.lastName || ''}`.trim(),
        firstName: promoteUser.firstName || promoteUser.displayName?.split(' ')[0] || '',
        lastName: promoteUser.lastName || promoteUser.displayName?.split(' ')[1] || '',
        role: chosenRole,
        department: dept,
        permissions: ROLE_PERMISSIONS[chosenRole] ?? [],
        isActive: true,
        createdBy: currentAdmin.uid,
        lastLoginAt: null,
        profileImage: promoteUser.photoURL || '',
      });

      await logAdminEvent('ADMIN_PROMOTE', {
        targetUid: promoteUser.uid,
        role: chosenRole,
        department: dept
      }, { uid: currentAdmin.uid, email: currentAdmin.email });

      setPromoteOpen(false);
    } catch (e: any) {
      setPromoteErr(e?.message || 'ไม่สามารถตั้งผู้ใช้เป็นแอดมินได้');
    } finally {
      setPromoteBusy(false);
    }
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
            <Button onClick={async () => { await load(); }} disabled={loading} startIcon={<RefreshIcon />}>รีเฟรช</Button>
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
                        {/* view */}
                        <Tooltip title="ดูรายละเอียด">
                          <IconButton
                            color="info"
                            onClick={async () => {
                              setSel(u); setOpen(true);
                              await logAdminEvent('VIEW_USER', { targetUid: u.uid }, { uid: currentAdmin.uid, email: currentAdmin.email });
                            }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>

                        {/* approve */}
                        {!u.isVerified && (
                          <Tooltip title="อนุมัติ">
                            <IconButton color="success" onClick={async () => {
                              await approveUser(u.uid);
                              await logAdminEvent('APPROVE_USER', { targetUid: u.uid }, { uid: currentAdmin.uid, email: currentAdmin.email });
                              await load();
                            }}>
                              <ApproveIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* suspend */}
                        {u.isActive && (
                          <Tooltip title="ระงับการใช้งาน">
                            <IconButton color="error" onClick={async () => {
                              await suspendUser(u.uid);
                              await logAdminEvent('SUSPEND_USER', { targetUid: u.uid }, { uid: currentAdmin.uid, email: currentAdmin.email });
                              await load();
                            }}>
                              <SuspendIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* promote to admin */}
                        <Tooltip title="ตั้งเป็นแอดมิน">
                          <IconButton color="primary" onClick={() => openPromote(u)}>
                            <MakeAdminIcon />
                          </IconButton>
                        </Tooltip>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* View Dialog */}
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
              {!sel.isVerified && <Button variant="contained" color="success" startIcon={<ApproveIcon />} onClick={async () => { await approveUser(sel.uid); await logAdminEvent('APPROVE_USER', { targetUid: sel.uid }, { uid: currentAdmin.uid, email: currentAdmin.email }); setOpen(false); await load(); }}>อนุมัติ</Button>}
              {sel.isActive && <Button variant="contained" color="error" startIcon={<SuspendIcon />} onClick={async () => { await suspendUser(sel.uid); await logAdminEvent('SUSPEND_USER', { targetUid: sel.uid }, { uid: currentAdmin.uid, email: currentAdmin.email }); setOpen(false); await load(); }}>ระงับ</Button>}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Promote-to-admin Dialog */}
      <Dialog open={promoteOpen} onClose={() => setPromoteOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MakeAdminIcon /> ตั้งผู้ใช้งานให้เป็น “แอดมิน”
        </DialogTitle>
        <DialogContent dividers>
          {promoteUser && (
            <Stack spacing={2}>
              {alreadyAdmin && <Alert severity="warning">ผู้ใช้นี้เป็นผู้ดูแลอยู่แล้ว</Alert>}
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar src={promoteUser.photoURL}>{(promoteUser.firstName || 'U').charAt(0)}</Avatar>
                <Box>
                  <Typography fontWeight={700}>{promoteUser.firstName} {promoteUser.lastName}</Typography>
                  <Typography variant="body2" color="text.secondary">{promoteUser.email}</Typography>
                </Box>
              </Stack>

              {/* role quick select */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>บทบาท</Typography>
                <ButtonGroup>
                  <Button
                    variant={chosenRole === 'moderator' ? 'contained' : 'outlined'}
                    onClick={() => setChosenRole('moderator')}
                  >
                    ผู้ช่วย (Moderator)
                  </Button>
                  <Button
                    variant={chosenRole === 'department_admin' ? 'contained' : 'outlined'}
                    onClick={() => setChosenRole('department_admin')}
                  >
                    แอดมินสังกัด (Dept Admin)
                  </Button>
                  {currentAdmin.role === 'super_admin' && (
                    <Button
                      variant={chosenRole === 'super_admin' ? 'contained' : 'outlined'}
                      color="error"
                      onClick={() => setChosenRole('super_admin')}
                    >
                      ผู้ดูแลสูงสุด (Super Admin)
                    </Button>
                  )}
                </ButtonGroup>
              </Box>

              {/* department (super admin เท่านั้นที่เปลี่ยนได้) */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>สังกัด</Typography>
                <TextField
                  select fullWidth disabled={currentAdmin.department !== 'all'}
                  value={chosenDept}
                  onChange={(e) => setChosenDept(e.target.value as AdminDepartment)}
                >
                  {Object.entries(DEPARTMENT_LABELS).map(([k, v]) =>
                    k !== 'all' ? <MenuItem key={k} value={k}>{v as any}</MenuItem> : null
                  )}
                </TextField>
                {currentAdmin.department !== 'all' && (
                  <Typography variant="caption" color="text.secondary">
                    * คุณไม่ได้เป็นผู้ดูแลสูงสุด จึงไม่สามารถเปลี่ยนสังกัดได้ (ระบบจะใช้สังกัดของคุณ)
                  </Typography>
                )}
              </Box>

              {/* permission preview bilingual */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  ชุดสิทธิ์ที่จะได้ (Permissions)
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {(ROLE_PERMISSIONS[chosenRole] ?? []).map((p) => (
                    <Tooltip
                      key={p}
                      title={
                        <Box>
                          <b>{PERMISSION_META[p]?.th} / {PERMISSION_META[p]?.en}</b><br />
                          <small>{PERMISSION_META[p]?.descTh}<br />{PERMISSION_META[p]?.descEn}</small>
                        </Box>
                      }
                    >
                      <Chip label={`${PERMISSION_META[p]?.th || p} / ${PERMISSION_META[p]?.en || p}`} />
                    </Tooltip>
                  ))}
                </Stack>
              </Box>

              {promoteErr && <Alert severity="error">{promoteErr}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromoteOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" startIcon={<MakeAdminIcon />} disabled={promoteBusy || alreadyAdmin} onClick={doPromote}>
            ตั้งเป็นแอดมิน
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminUserManagement;
