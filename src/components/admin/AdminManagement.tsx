'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Container, Typography, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, Stack,
  MenuItem, Switch, FormControlLabel, Alert, Tooltip, Divider, Avatar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AdminPanelSettings as AdminIcon,
  Refresh as RefreshIcon,
  Shield as ShieldIcon
} from '@mui/icons-material';

import {
  AdminProfile,
  AdminDepartment,
  AdminRole,
  AdminPermission,
  DEPARTMENT_LABELS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
} from '../../types/admin';

import {
  getAllAdmins,
  getAdminsByDepartment,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
} from '../../lib/adminFirebase';

type Props = { currentAdmin: AdminProfile };

const PERMISSION_OPTIONS: AdminPermission[] = [
  'manage_users',
  'manage_activities',
  'view_reports',
  'export_data',
  'manage_admins',
  'system_settings',
  'moderate_content',
];

const AdminManagement: React.FC<Props> = ({ currentAdmin }) => {
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // filter (เฉพาะ super_admin แสดงตัวเลือกทุกสังกัด)
  const [deptFilter, setDeptFilter] = useState<AdminDepartment>(currentAdmin.department);

  // dialog state
  const [open, setOpen] = useState(false);
  const [editingUid, setEditingUid] = useState<string | null>(null);

  // form state
  const [form, setForm] = useState<Partial<AdminProfile>>({
    uid: '',
    email: '',
    firstName: '',
    lastName: '',
    displayName: '',
    role: 'department_admin',
    department: currentAdmin.department === 'all' ? 'student_union' : currentAdmin.department,
    permissions: [],
    isActive: true,
  });

  const canManageAll = currentAdmin.role === 'super_admin';
  const canManageAdmins = (currentAdmin.permissions || []).includes('manage_admins') || currentAdmin.role === 'super_admin';

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const data =
        canManageAll && deptFilter === 'all'
          ? await getAllAdmins()
          : await getAdminsByDepartment(deptFilter || currentAdmin.department);
      setAdmins(data);
    } catch (e: any) {
      setErr(e?.message || 'โหลดข้อมูลแอดมินไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [deptFilter]);

  const openCreate = () => {
    setEditingUid(null);
    setForm({
      uid: '',
      email: '',
      firstName: '',
      lastName: '',
      displayName: '',
      role: currentAdmin.role === 'super_admin' ? 'department_admin' : 'moderator',
      department: currentAdmin.department === 'all' ? 'student_union' : currentAdmin.department,
      permissions: [],
      isActive: true,
    });
    setOpen(true);
    setErr('');
  };

  const openEdit = (a: AdminProfile) => {
    setEditingUid(a.uid);
    setForm({
      uid: a.uid,
      email: a.email,
      firstName: a.firstName,
      lastName: a.lastName,
      displayName: a.displayName,
      role: a.role,
      department: a.department,
      permissions: a.permissions || [],
      isActive: a.isActive,
    });
    setOpen(true);
    setErr('');
  };

  const closeDialog = () => {
    setOpen(false);
  };

  const useRoleDefaults = () => {
    if (!form.role) return;
    setForm((p) => ({ ...p, permissions: ROLE_PERMISSIONS[form.role as AdminRole] || [] }));
  };

  const onChange = <K extends keyof AdminProfile>(k: K, v: AdminProfile[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  const onTogglePermission = (perm: AdminPermission) => {
    setForm((p) => {
      const list = new Set(p.permissions || []);
      if (list.has(perm)) list.delete(perm); else list.add(perm);
      return { ...p, permissions: Array.from(list) };
    });
  };

  const canDelete = (target: AdminProfile) => {
    if (currentAdmin.uid === target.uid) return false; // ห้ามลบตัวเอง
    if (currentAdmin.role === 'super_admin') return true;
    // dept admin ลบได้เฉพาะในสังกัดตัวเอง และลบเฉพาะ role ต่ำกว่า/เท่ากัน (ไม่ใช่ super_admin)
    return (
      currentAdmin.department !== 'all' &&
      target.department === currentAdmin.department &&
      target.role !== 'super_admin'
    );
  };

  const submit = async () => {
    setErr('');
    try {
      // ตรวจเบื้องต้น
      const required = ['uid', 'email', 'firstName', 'lastName', 'role', 'department'] as const;
      for (const k of required) {
        const v = (form as any)[k];
        if (!v || (typeof v === 'string' && !v.trim())) {
          setErr(`กรุณากรอก ${k}`);
          return;
        }
      }
      // จำกัดสิทธิ์: dept admin ห้ามตั้ง role เป็น super_admin และห้ามกำหนด department อื่น
      if (currentAdmin.role !== 'super_admin') {
        if (form.role === 'super_admin') {
          setErr('คุณไม่สามารถกำหนดบทบาทเป็นผู้ดูแลระบบสูงสุดได้');
          return;
        }
        if (form.department !== currentAdmin.department) {
          setErr('คุณไม่สามารถกำหนดสังกัดอื่นนอกเหนือจากของคุณได้');
          return;
        }
      }
      // บันทึก
      const payload: AdminProfile = {
        uid: String(form.uid),
        email: String(form.email),
        firstName: String(form.firstName),
        lastName: String(form.lastName),
        displayName: String(form.displayName || `${form.firstName} ${form.lastName}`),
        role: form.role as AdminRole,
        department: form.department as AdminDepartment,
        permissions: (form.permissions || []) as AdminPermission[],
        isActive: !!form.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentAdmin.uid,
        lastLoginAt: null,
        profileImage: (form as any).profileImage || '',
      };

      if (!editingUid) {
        await createAdminUser(payload);
      } else {
        await updateAdminUser(editingUid, payload);
      }
      setOpen(false);
      await load();
    } catch (e: any) {
      setErr(e?.message || 'บันทึกไม่สำเร็จ');
    }
  };

  const remove = async (a: AdminProfile) => {
    if (!canDelete(a)) return;
    const ok = window.confirm(`ต้องการลบสิทธิ์แอดมินของ ${a.firstName} ${a.lastName} ใช่หรือไม่?`);
    if (!ok) return;
    try {
      await deleteAdminUser(a.uid);
      await load();
    } catch (e) {
      alert('ลบไม่สำเร็จ');
    }
  };

  const visibleAdmins = useMemo(() => admins.sort((x, y) => (x.role > y.role ? -1 : 1)), [admins]);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Avatar sx={{ bgcolor: 'primary.main' }}><AdminIcon /></Avatar>
        <Box>
          <Typography variant="h4">จัดการแอดมิน</Typography>
          <Typography color="text.secondary">
            สังกัด: {DEPARTMENT_LABELS[currentAdmin.department] || currentAdmin.department}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={1}>
          {canManageAll && (
            <TextField
              select
              size="small"
              label="ตัวกรองสังกัด"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value as AdminDepartment)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="all">ทุกสังกัด</MenuItem>
              {Object.entries(DEPARTMENT_LABELS).map(([k, v]) => (
                k !== 'all' && <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </TextField>
          )}
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            รีเฟรช
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
            disabled={!canManageAdmins}
          >
            เพิ่มแอดมิน
          </Button>
        </Stack>
      </Box>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Grid container spacing={2}>
        {visibleAdmins.length === 0 ? (
          <Grid item xs={12}>
            <Card><CardContent><Typography textAlign="center" color="text.secondary">ไม่พบข้อมูลแอดมิน</Typography></CardContent></Card>
          </Grid>
        ) : (
          visibleAdmins.map((a) => (
            <Grid item xs={12} md={6} lg={4} key={a.uid}>
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar src={a.profileImage || ''}>{(a.firstName || 'A').charAt(0)}</Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={700}>{a.firstName} {a.lastName}</Typography>
                      <Typography variant="body2" color="text.secondary">{a.email}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: .5, flexWrap: 'wrap' }}>
                        <Chip size="small" label={ROLE_LABELS[a.role]} color={a.role === 'super_admin' ? 'error' : a.role === 'department_admin' ? 'primary' : 'default'} />
                        <Chip size="small" label={DEPARTMENT_LABELS[a.department] || a.department} variant="outlined" />
                        <Chip size="small" label={a.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'} color={a.isActive ? 'success' : 'default'} />
                      </Stack>
                    </Box>
                    <Tooltip title="แก้ไข">
                      <span>
                        <IconButton onClick={() => openEdit(a)} color="primary" disabled={!canManageAdmins}>
                          <EditIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={canDelete(a) ? 'ลบ' : 'ไม่สามารถลบได้'}>
                      <span>
                        <IconButton onClick={() => remove(a)} color="error" disabled={!canDelete(a)}>
                          <DeleteIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>

                  {/* permissions */}
                  {(a.permissions || []).length > 0 && (
                    <>
                      <Divider sx={{ my: 1.5 }} />
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {a.permissions!.map((p) => (
                          <Chip key={p} size="small" variant="outlined" icon={<ShieldIcon fontSize="small" />} label={p} />
                        ))}
                      </Stack>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingUid ? 'แก้ไขแอดมิน' : 'เพิ่มแอดมินใหม่'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            {/* UID ต้องตรงกับ Auth UID */}
            <Grid item xs={12} md={6}>
              <TextField
                label="UID (จาก Firebase Auth)*"
                fullWidth
                value={form.uid || ''}
                onChange={(e) => onChange('uid', e.target.value as any)}
                disabled={!!editingUid}
                helperText="ต้องใส่ UID ของผู้ใช้ที่มีอยู่ใน Authentication"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="อีเมล *" fullWidth value={form.email || ''} onChange={(e) => onChange('email', e.target.value as any)} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="ชื่อ *" fullWidth value={form.firstName || ''} onChange={(e) => onChange('firstName', e.target.value as any)} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="นามสกุล *" fullWidth value={form.lastName || ''} onChange={(e) => onChange('lastName', e.target.value as any)} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="ชื่อที่แสดง" fullWidth value={form.displayName || ''} onChange={(e) => onChange('displayName', e.target.value as any)} />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                select
                label="บทบาท *"
                fullWidth
                value={form.role || 'moderator'}
                onChange={(e) => onChange('role', e.target.value as AdminRole)}
              >
                {/* dept admin ห้ามตั้ง super_admin */}
                {Object.keys(ROLE_LABELS).map((r) => {
                  if (currentAdmin.role !== 'super_admin' && r === 'super_admin') return null;
                  return <MenuItem key={r} value={r}>{ROLE_LABELS[r as AdminRole]}</MenuItem>;
                })}
              </TextField>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                select
                label="สังกัด *"
                fullWidth
                value={form.department || (currentAdmin.department === 'all' ? 'student_union' : currentAdmin.department)}
                onChange={(e) => onChange('department', e.target.value as AdminDepartment)}
                disabled={currentAdmin.department !== 'all'}
              >
                {Object.entries(DEPARTMENT_LABELS).map(([k, v]) => (
                  k !== 'all' && <MenuItem key={k} value={k}>{v}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">สิทธิ์ (Permissions)</Typography>
                <Button size="small" variant="outlined" onClick={useRoleDefaults}>ใช้ชุดสิทธิ์ตามบทบาท</Button>
              </Stack>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {PERMISSION_OPTIONS.map((p) => {
                  const checked = (form.permissions || []).includes(p);
                  return (
                    <Chip
                      key={p}
                      label={p}
                      color={checked ? 'primary' : 'default'}
                      variant={checked ? 'filled' : 'outlined'}
                      onClick={() => onTogglePermission(p)}
                      sx={{ cursor: 'pointer' }}
                    />
                  );
                })}
              </Stack>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={!!form.isActive} onChange={(e) => onChange('isActive', e.target.checked as any)} />}
                label="เปิดใช้งาน"
              />
            </Grid>
          </Grid>
          {err && <Alert severity="error" sx={{ mt: 2 }}>{err}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>ยกเลิก</Button>
          <Button variant="contained" startIcon={<ShieldIcon />} onClick={submit}>
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export { AdminManagement };
export default AdminManagement;
