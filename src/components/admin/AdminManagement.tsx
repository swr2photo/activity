// src/components/admin/AdminManagement.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Grid from '@mui/material/Grid';
import {
  Box,
  Card,
  CardContent,
  Container,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Stack,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Tooltip,
  Divider,
  Avatar,
  ButtonGroup,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AdminPanelSettings as AdminIcon,
  Refresh as RefreshIcon,
  Shield as ShieldIcon,
  PersonSearch as PersonSearchIcon,
  Mail as MailIcon,
  Cancel as CancelIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

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
  getAdminsByDepartment,
  updateAdminUser,
  deleteAdminUser,
  getAllUsers,
  getUsersByDepartment,
  type UnivUser,
  getAdminInvitesByDepartment,
  type AdminInvite,
  logAdminEvent,
} from '../../lib/adminFirebase';

/** props */
type Props = { currentAdmin: AdminProfile };

/** bilingual permission meta (สำหรับ tooltip) */
const PERMISSION_META: Record<
  AdminPermission,
  { th: string; en: string; descTh: string; descEn: string; group: string }
> = {
  manage_users: {
    th: 'จัดการผู้ใช้',
    en: 'Manage Users',
    descTh: 'อนุมัติ/ระงับ/แก้ไขโปรไฟล์ผู้ใช้',
    descEn: 'Approve/Suspend/Edit user profiles',
    group: 'Users',
  },
  manage_activities: {
    th: 'จัดการกิจกรรม',
    en: 'Manage Activities',
    descTh: 'สร้าง/แก้ไข/ปิดกิจกรรมและ QR',
    descEn: 'Create/Edit/Close activities & QR',
    group: 'Activities',
  },
  view_reports: {
    th: 'ดูรายงาน',
    en: 'View Reports',
    descTh: 'เข้าถึงหน้ารายงานและสถิติ',
    descEn: 'Access reports and analytics',
    group: 'Reports',
  },
  export_data: {
    th: 'ส่งออกข้อมูล',
    en: 'Export Data',
    descTh: 'ดาวน์โหลดข้อมูลเป็นไฟล์',
    descEn: 'Download data as files',
    group: 'Data',
  },
  manage_admins: {
    th: 'จัดการแอดมิน',
    en: 'Manage Admins',
    descTh: 'เพิ่ม/แก้ไข/ลบผู้ดูแล',
    descEn: 'Create/Update/Delete admins',
    group: 'Admins',
  },
  system_settings: {
    th: 'ตั้งค่าระบบ',
    en: 'System Settings',
    descTh: 'แก้ไขการตั้งค่าทั่วไปของระบบ',
    descEn: 'Modify global system settings',
    group: 'System',
  },
  moderate_content: {
    th: 'กลั่นกรองเนื้อหา',
    en: 'Moderate Content',
    descTh: 'จัดการเนื้อหาที่รายงาน/ไม่เหมาะสม',
    descEn: 'Handle flagged/inappropriate content',
    group: 'Moderation',
  },
};
const ALL_PERMS: AdminPermission[] = Object.keys(PERMISSION_META) as AdminPermission[];

/** Confirm dialog hook */
type ConfirmState = {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  onConfirm?: () => Promise<void> | void;
  busy?: boolean;
};
const useConfirm = () => {
  const [state, setState] = useState<ConfirmState>({ open: false });
  const open = (s: Omit<ConfirmState, 'busy' | 'open'>) => setState({ open: true, busy: false, ...s });
  const close = () => setState({ open: false });
  const setBusy = (busy: boolean) => setState((p) => ({ ...p, busy }));
  return { state, open, close, setBusy };
};

const roleRank = (role: AdminRole) => {
  switch (role) {
    case 'super_admin':
      return 3;
    case 'department_admin':
      return 2;
    case 'moderator':
      return 1;
    default:
      return 0;
  }
};

const safeSplitName = (displayName?: string) => {
  const raw = (displayName || '').trim();
  if (!raw) return { firstName: '', lastName: '' };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const getSiteOrigin = () => {
  const env = (process.env.NEXT_PUBLIC_SITE_URL || '').toString().replace(/\/$/, '');
  if (env) return env;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
};

const AdminManagement: React.FC<Props> = ({ currentAdmin }) => {
  const { enqueueSnackbar } = useSnackbar();
  const confirm = useConfirm();

  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit' | 'invite'>('create');
  const [editingUid, setEditingUid] = useState<string | null>(null);

  // create/edit form
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

  // invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AdminRole>(
    currentAdmin.role === 'super_admin' ? 'department_admin' : 'moderator'
  );
  const [inviteDept, setInviteDept] = useState<AdminDepartment>(
    currentAdmin.department === 'all' ? 'student_union' : currentAdmin.department
  );
  const [invitePerms, setInvitePerms] = useState<AdminPermission[]>([]);

  // เลือกผู้ใช้ตอนสร้าง
  const [userOptions, setUserOptions] = useState<UnivUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<UnivUser | null>(null);
  const [userSearch, setUserSearch] = useState('');

  const isSuper = currentAdmin.role === 'super_admin';
  const canManageAdmins = (currentAdmin.permissions ?? []).includes('manage_admins') || isSuper;

  const SITE_ORIGIN = useMemo(() => getSiteOrigin(), []);

  const safeLog = useCallback(
    async (event: string, payload: any) => {
      try {
        await logAdminEvent(event, payload, { uid: currentAdmin.uid, email: currentAdmin.email });
      } catch {
        // ignore logging failures
      }
    },
    [currentAdmin.email, currentAdmin.uid]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const dept: AdminDepartment = isSuper ? ('all' as any) : (currentAdmin.department as AdminDepartment);
      const [adminList, inviteList] = await Promise.all([
        getAdminsByDepartment(dept),
        getAdminInvitesByDepartment(dept),
      ]);
      setAdmins(adminList);
      setInvites(inviteList);
    } catch (e: any) {
      const m = e?.message || 'โหลดข้อมูลไม่สำเร็จ';
      setErr(m);
      enqueueSnackbar(m, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentAdmin.department, enqueueSnackbar, isSuper]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeDialog = () => setDialogOpen(false);

  const useRoleDefaults = useCallback(
    (target: 'form' | 'invite' = 'form') => {
      if (target === 'form') {
        if (!form.role) return;
        setForm((p) => ({ ...p, permissions: ROLE_PERMISSIONS[form.role as AdminRole] || [] }));
      } else {
        setInvitePerms(ROLE_PERMISSIONS[inviteRole] || []);
      }
    },
    [form.role, inviteRole]
  );

  const onChange = useCallback(<K extends keyof AdminProfile>(k: K, v: AdminProfile[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  }, []);

  const onTogglePermission = useCallback(
    (perm: AdminPermission, target: 'form' | 'invite' = 'form') => {
      if (target === 'form') {
        setForm((p) => {
          const list = new Set(p.permissions || []);
          if (list.has(perm)) list.delete(perm);
          else list.add(perm);
          return { ...p, permissions: Array.from(list) };
        });
      } else {
        setInvitePerms((prev) => {
          const set = new Set(prev);
          if (set.has(perm)) set.delete(perm);
          else set.add(perm);
          return Array.from(set);
        });
      }
    },
    []
  );

  const canDelete = useCallback(
    (target: AdminProfile) => {
      if (currentAdmin.uid === target.uid) return false;
      if (isSuper) return true;
      return target.department === currentAdmin.department && target.role !== 'super_admin';
    },
    [currentAdmin.department, currentAdmin.uid, isSuper]
  );

  // ===== Handlers =====
  const openCreate = useCallback(async () => {
    setMode('create');
    setEditingUid(null);
    setSelectedUser(null);
    setUserSearch('');
    setErr('');

    setForm({
      uid: '',
      email: '',
      firstName: '',
      lastName: '',
      displayName: '',
      role: isSuper ? 'department_admin' : 'moderator',
      department: (isSuper ? inviteDept : currentAdmin.department) as any,
      permissions: [],
      isActive: true,
    });

    try {
      const options = isSuper
        ? await getAllUsers()
        : await getUsersByDepartment(currentAdmin.department as AdminDepartment);
      setUserOptions(options);
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'โหลดผู้ใช้ไม่สำเร็จ', { variant: 'error' });
    }

    setDialogOpen(true);
  }, [currentAdmin.department, enqueueSnackbar, inviteDept, isSuper]);

  const openInvite = useCallback(() => {
    setMode('invite');
    setErr('');

    setInviteEmail('');
    setInviteRole(isSuper ? 'department_admin' : 'moderator');
    setInviteDept(isSuper ? 'student_union' : (currentAdmin.department as AdminDepartment));
    setInvitePerms([]);

    setDialogOpen(true);
  }, [currentAdmin.department, isSuper]);

  const openEdit = useCallback(
    (a: AdminProfile) => {
      if (!isSuper && a.department !== currentAdmin.department) return;

      setMode('edit');
      setEditingUid(a.uid);
      setSelectedUser(null);
      setUserSearch('');
      setErr('');

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
        profileImage: a.profileImage || '',
      });

      setDialogOpen(true);
    },
    [currentAdmin.department, isSuper]
  );

  const submit = useCallback(async () => {
    setErr('');
    try {
      if (mode === 'create') {
        if (!selectedUser) {
          const m = 'โปรดเลือกผู้ใช้ที่จะตั้งเป็นแอดมิน';
          setErr(m);
          enqueueSnackbar(m, { variant: 'warning' });
          return;
        }
        if (!isSuper && form.role === 'super_admin') {
          const m = 'คุณไม่มีสิทธิ์ตั้งบทบาทเป็นผู้ดูแลสูงสุด';
          setErr(m);
          enqueueSnackbar(m, { variant: 'error' });
          return;
        }

        const dept: AdminDepartment = (
          isSuper ? (form.department as AdminDepartment) : (currentAdmin.department as AdminDepartment)
        ) as AdminDepartment;

        const fallbackName = safeSplitName(selectedUser.displayName);
        const firstName = selectedUser.firstName || fallbackName.firstName || '';
        const lastName = selectedUser.lastName || fallbackName.lastName || '';

        const payload: AdminProfile = {
          uid: selectedUser.uid,
          email: selectedUser.email || '',
          firstName,
          lastName,
          displayName: selectedUser.displayName || `${firstName || ''} ${lastName || ''}`.trim(),
          role: (form.role || 'department_admin') as AdminRole,
          department: dept,
          permissions:
            form.permissions && form.permissions.length > 0
              ? (form.permissions as AdminPermission[])
              : ROLE_PERMISSIONS[(form.role || 'department_admin') as AdminRole] || [],
          isActive: form.isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: currentAdmin.uid,
          lastLoginAt: null,
          profileImage: selectedUser.photoURL || '',
        };

        await updateAdminUser(payload.uid, payload);
        await safeLog('ADMIN_CREATE', { targetUid: payload.uid, role: payload.role, department: payload.department });
        enqueueSnackbar('เพิ่มแอดมินเรียบร้อย', { variant: 'success' });
      }

      if (mode === 'edit') {
        if (!editingUid) return;

        if (!isSuper) {
          if (form.role === 'super_admin') {
            const m = 'คุณไม่มีสิทธิ์ตั้งบทบาทเป็นผู้ดูแลสูงสุด';
            setErr(m);
            enqueueSnackbar(m, { variant: 'error' });
            return;
          }
          if (form.department !== currentAdmin.department) {
            const m = 'ไม่สามารถเปลี่ยนสังกัดข้ามหน่วยได้';
            setErr(m);
            enqueueSnackbar(m, { variant: 'error' });
            return;
          }
        }

        await updateAdminUser(editingUid, {
          role: form.role as AdminRole,
          department: form.department as AdminDepartment,
          permissions: (form.permissions || []) as AdminPermission[],
          isActive: !!form.isActive,
          profileImage: (form as any).profileImage || '',
          updatedAt: new Date(),
        } as any);

        await safeLog('ADMIN_UPDATE', { targetUid: editingUid, role: form.role, department: form.department });
        enqueueSnackbar('อัปเดตข้อมูลแอดมินเรียบร้อย', { variant: 'success' });
      }

      if (mode === 'invite') {
        if (!inviteEmail.trim()) {
          const m = 'โปรดกรอกอีเมลผู้รับเชิญ';
          setErr(m);
          enqueueSnackbar(m, { variant: 'warning' });
          return;
        }
        if (!isSuper && inviteRole === 'super_admin') {
          const m = 'คุณไม่มีสิทธิ์เชิญบทบาทผู้ดูแลสูงสุด';
          setErr(m);
          enqueueSnackbar(m, { variant: 'error' });
          return;
        }

        const dept: AdminDepartment = isSuper ? inviteDept : (currentAdmin.department as AdminDepartment);

        const res = await fetch('/api/invites/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: inviteEmail.trim(),
            role: inviteRole,
            department: dept,
            permissions: invitePerms.length ? invitePerms : ROLE_PERMISSIONS[inviteRole] || [],
            invitedByUid: currentAdmin.uid,
            invitedByEmail: currentAdmin.email,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data?.ok) {
          const m = data?.error || 'ส่งคำเชิญไม่สำเร็จ';
          setErr(m);
          enqueueSnackbar(m, { variant: 'error' });
          return;
        }

        await safeLog('ADMIN_INVITE_CREATE', { email: inviteEmail.trim(), role: inviteRole, department: dept });
        enqueueSnackbar('ส่งคำเชิญทางอีเมลเรียบร้อย', { variant: 'success' });
      }

      setDialogOpen(false);
      await load();
    } catch (e: any) {
      const m = e?.message || 'บันทึกไม่สำเร็จ';
      setErr(m);
      enqueueSnackbar(m, { variant: 'error' });
    }
  }, [
    currentAdmin.department,
    currentAdmin.email,
    currentAdmin.uid,
    enqueueSnackbar,
    form,
    inviteDept,
    inviteEmail,
    invitePerms,
    inviteRole,
    isSuper,
    load,
    mode,
    editingUid,
    safeLog,
    selectedUser,
  ]);

  const removeAdmin = useCallback(
    (a: AdminProfile) => {
      if (!canDelete(a)) return;

      confirm.open({
        title: 'ยืนยันการลบแอดมิน',
        message: `ต้องการลบสิทธิ์แอดมินของ ${a.firstName} ${a.lastName} ใช่หรือไม่?`,
        confirmText: 'ลบ',
        onConfirm: async () => {
          confirm.setBusy(true);
          try {
            await deleteAdminUser(a.uid);
            await safeLog('ADMIN_DELETE', { targetUid: a.uid });
            enqueueSnackbar('ลบแอดมินเรียบร้อย', { variant: 'success' });
            await load();
          } catch (e: any) {
            enqueueSnackbar(e?.message || 'ลบไม่สำเร็จ', { variant: 'error' });
          } finally {
            confirm.setBusy(false);
            confirm.close();
          }
        },
      });
    },
    [canDelete, confirm, enqueueSnackbar, load, safeLog]
  );

  const cancelInvite = useCallback(
    (inv: AdminInvite) => {
      if (!isSuper && inv.department !== currentAdmin.department) return;

      confirm.open({
        title: 'ยืนยันยกเลิกคำเชิญ',
        message: `ยกเลิกคำเชิญสำหรับ ${inv.email}?`,
        confirmText: 'ยกเลิกคำเชิญ',
        onConfirm: async () => {
          confirm.setBusy(true);
          try {
            const res = await fetch('/api/invites/cancel', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ id: inv.id }),
            });
            const data = await res.json();
            if (!res.ok || !data?.ok) throw new Error(data?.error || 'ยกเลิกคำเชิญไม่สำเร็จ');
            await safeLog('ADMIN_INVITE_CANCEL', { inviteId: inv.id, email: inv.email });
            enqueueSnackbar('ยกเลิกคำเชิญแล้ว', { variant: 'info' });
            await load();
          } catch (e: any) {
            enqueueSnackbar(e?.message || 'ยกเลิกคำเชิญไม่สำเร็จ', { variant: 'error' });
          } finally {
            confirm.setBusy(false);
            confirm.close();
          }
        },
      });
    },
    [confirm, currentAdmin.department, enqueueSnackbar, isSuper, load, safeLog]
  );

  const deleteInvite = useCallback(
    (inv: AdminInvite) => {
      if (!isSuper && inv.department !== currentAdmin.department) return;

      confirm.open({
        title: 'ลบประวัติคำเชิญ',
        message: `ลบประวัติคำเชิญของ ${inv.email}? (การลบนี้ถาวร)`,
        confirmText: 'ลบประวัติ',
        onConfirm: async () => {
          confirm.setBusy(true);
          try {
            const res = await fetch('/api/invites/delete', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ id: inv.id }),
            });
            const data = await res.json();
            if (!res.ok || !data?.ok) throw new Error(data?.error || 'ลบประวัติคำเชิญไม่สำเร็จ');
            await safeLog('ADMIN_INVITE_DELETE', { inviteId: inv.id, email: inv.email });
            enqueueSnackbar('ลบประวัติคำเชิญแล้ว', { variant: 'success' });
            await load();
          } catch (e: any) {
            enqueueSnackbar(e?.message || 'ลบประวัติคำเชิญไม่สำเร็จ', { variant: 'error' });
          } finally {
            confirm.setBusy(false);
            confirm.close();
          }
        },
      });
    },
    [confirm, currentAdmin.department, enqueueSnackbar, isSuper, load, safeLog]
  );

  const copyInviteLink = useCallback(
    async (inv: AdminInvite) => {
      if (!inv?.token) return;
      if (!SITE_ORIGIN) {
        enqueueSnackbar('ไม่สามารถสร้างลิงก์ได้ (ไม่พบ site origin)', { variant: 'warning' });
        return;
      }
      if (!isSuper && inv.department !== currentAdmin.department) return;

      try {
        const link = `${SITE_ORIGIN}/admin/invite?token=${inv.token}`;
        await navigator.clipboard.writeText(link);
        enqueueSnackbar('คัดลอกลิงก์แล้ว', { variant: 'success' });
      } catch {
        enqueueSnackbar('คัดลอกลิงก์ไม่สำเร็จ', { variant: 'error' });
      }
    },
    [SITE_ORIGIN, currentAdmin.department, enqueueSnackbar, isSuper]
  );

  const visibleAdmins = useMemo(() => {
    return admins.slice().sort((a, b) => roleRank(b.role as AdminRole) - roleRank(a.role as AdminRole));
  }, [admins]);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Avatar sx={{ bgcolor: 'primary.main' }}>
          <AdminIcon />
        </Avatar>
        <Box>
          <Typography variant="h4">จัดการแอดมิน</Typography>
          <Typography color="text.secondary">
            สังกัด: {DEPARTMENT_LABELS[currentAdmin.department] || currentAdmin.department}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            รีเฟรช
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} disabled={!canManageAdmins}>
            เพิ่มแอดมิน (จากผู้ใช้)
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<MailIcon />}
            onClick={openInvite}
            disabled={!canManageAdmins}
          >
            เชิญทางอีเมล
          </Button>
        </Stack>
      </Box>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      {/* Invites */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>คำเชิญแอดมิน</Typography>
          {invites.length === 0 ? (
            <Typography color="text.secondary">ไม่มีคำเชิญ</Typography>
          ) : (
            <Grid container spacing={1}>
              {invites.map((inv) => {
                const statusColor =
                  inv.status === 'pending'
                    ? 'warning'
                    : inv.status === 'accepted'
                      ? 'success'
                      : inv.status === 'cancelled'
                        ? 'default'
                        : 'default';

                const canSeeInvite = isSuper || inv.department === currentAdmin.department;
                if (!canSeeInvite) return null;

                return (
                  <Grid key={inv.id} size={{ xs: 12 }}>
                    <Card variant="outlined">
                      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Avatar><MailIcon /></Avatar>
                        <Box sx={{ minWidth: 240 }}>
                          <Typography fontWeight={700}>{inv.email}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {ROLE_LABELS[inv.role]} • {DEPARTMENT_LABELS[inv.department] || inv.department}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          color={statusColor as any}
                          label={
                            inv.status === 'pending'
                              ? 'รอรับสิทธิ์'
                              : inv.status === 'accepted'
                                ? 'รับแล้ว'
                                : inv.status === 'cancelled'
                                  ? 'ยกเลิก'
                                  : inv.status
                          }
                        />
                        <Box sx={{ flex: 1 }} />

                        <Tooltip title={SITE_ORIGIN ? 'คัดลอกลิงก์ยืนยัน' : 'ไม่พบ site origin'}>
                          <span>
                            <IconButton
                              onClick={() => copyInviteLink(inv)}
                              disabled={!inv.token || !SITE_ORIGIN}
                              color="primary"
                            >
                              <CopyIcon />
                            </IconButton>
                          </span>
                        </Tooltip>

                        {inv.status === 'pending' && (
                          <Tooltip title="ยกเลิกคำเชิญ">
                            <span>
                              <IconButton onClick={() => cancelInvite(inv)} color="warning">
                                <CancelIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}

                        <Tooltip title="ลบประวัติคำเชิญ">
                          <span>
                            <IconButton onClick={() => deleteInvite(inv)} color="error">
                              <DeleteIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Admin list */}
      <Grid container spacing={2}>
        {visibleAdmins.length === 0 ? (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Typography textAlign="center" color="text.secondary">ไม่พบข้อมูลแอดมิน</Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          visibleAdmins.map((a) => (
            <Grid key={a.uid} size={{ xs: 12, md: 6, lg: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    <Avatar src={a.profileImage || ''}>{(a.firstName || 'A').charAt(0)}</Avatar>
                    <Box sx={{ flex: 1, minWidth: 220 }}>
                      <Typography fontWeight={700}>{a.firstName} {a.lastName}</Typography>
                      <Typography variant="body2" color="text.secondary">{a.email}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} useFlexGap flexWrap="wrap">
                        <Chip
                          size="small"
                          label={ROLE_LABELS[a.role]}
                          color={a.role === 'super_admin' ? 'error' : a.role === 'department_admin' ? 'primary' : 'default'}
                        />
                        <Chip size="small" label={DEPARTMENT_LABELS[a.department] || a.department} variant="outlined" />
                        <Chip size="small" label={a.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'} color={a.isActive ? 'success' : 'default'} />
                      </Stack>
                    </Box>

                    <Tooltip title={!isSuper && a.department !== currentAdmin.department ? 'ข้ามสังกัด - แก้ไขไม่ได้' : 'แก้ไข'}>
                      <span>
                        <IconButton
                          onClick={() => openEdit(a)}
                          color="primary"
                          disabled={!canManageAdmins || (!isSuper && a.department !== currentAdmin.department)}
                        >
                          <EditIcon />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title={canDelete(a) ? 'ลบ' : 'ไม่สามารถลบได้'}>
                      <span>
                        <IconButton onClick={() => removeAdmin(a)} color="error" disabled={!canDelete(a)}>
                          <DeleteIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>

                  {(a.permissions || []).length > 0 && (
                    <>
                      <Divider sx={{ my: 1.5 }} />
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {a.permissions!.map((p) => (
                          <Tooltip
                            key={p}
                            title={
                              <Box>
                                <b>{PERMISSION_META[p]?.th} / {PERMISSION_META[p]?.en}</b>
                                <br />
                                <small>
                                  {PERMISSION_META[p]?.descTh}
                                  <br />
                                  {PERMISSION_META[p]?.descEn}
                                </small>
                              </Box>
                            }
                          >
                            <Chip
                              size="small"
                              variant="outlined"
                              icon={<ShieldIcon fontSize="small" />}
                              label={`${PERMISSION_META[p]?.th || p} / ${PERMISSION_META[p]?.en || p}`}
                            />
                          </Tooltip>
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

      {/* Create/Edit/Invite Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {mode === 'create' && 'เพิ่มแอดมินจากผู้ใช้'}
          {mode === 'edit' && 'แก้ไขแอดมิน'}
          {mode === 'invite' && 'เชิญผู้ใช้ทางอีเมลให้เป็นแอดมิน'}
        </DialogTitle>

        <DialogContent dividers>
          <Grid container spacing={2}>
            {mode === 'create' && (
              <>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>เลือกผู้ใช้</Typography>
                  <Autocomplete
                    options={userOptions}
                    value={selectedUser}
                    onChange={(_, v) => setSelectedUser(v)}
                    getOptionLabel={(u) =>
                      u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || (u.displayName || '') : ''
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="พิมพ์ชื่อ/อีเมล/รหัสนักศึกษา เพื่อค้นหา"
                        onChange={(e) => setUserSearch(e.target.value)}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <Box sx={{ display: 'flex', alignItems: 'center', pl: 1 }}>
                              <PersonSearchIcon fontSize="small" />
                            </Box>
                          ),
                        }}
                      />
                    )}
                    filterOptions={(opts) => {
                      const s = userSearch.trim().toLowerCase();
                      if (!s) return opts.slice(0, 50);
                      return opts
                        .filter((u) =>
                          (u.firstName || '').toLowerCase().includes(s) ||
                          (u.lastName || '').toLowerCase().includes(s) ||
                          (u.displayName || '').toLowerCase().includes(s) ||
                          (u.email || '').toLowerCase().includes(s) ||
                          (u.studentId || '').toLowerCase().includes(s)
                        )
                        .slice(0, 50);
                    }}
                    renderOption={(props, u) => (
                      <li {...props} key={u.uid}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar src={u.photoURL} sx={{ width: 28, height: 28 }}>
                            {(u.firstName || u.displayName || 'U').charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography fontWeight={600} variant="body2">
                              {u.firstName} {u.lastName}
                              <Typography component="span" color="text.secondary">
                                {' '}• {u.studentId || '-'}
                              </Typography>
                            </Typography>
                            <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                          </Box>
                        </Stack>
                      </li>
                    )}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>บทบาท</Typography>
                  <ButtonGroup fullWidth>
                    <Button
                      variant={form.role === 'moderator' ? 'contained' : 'outlined'}
                      onClick={() => onChange('role', 'moderator' as any)}
                    >
                      ผู้ช่วย (Moderator)
                    </Button>
                    <Button
                      variant={form.role === 'department_admin' ? 'contained' : 'outlined'}
                      onClick={() => onChange('role', 'department_admin' as any)}
                    >
                      แอดมินสังกัด
                    </Button>
                    {isSuper && (
                      <Button
                        color="error"
                        variant={form.role === 'super_admin' ? 'contained' : 'outlined'}
                        onClick={() => onChange('role', 'super_admin' as any)}
                      >
                        ผู้ดูแลสูงสุด
                      </Button>
                    )}
                  </ButtonGroup>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    select
                    label="สังกัด *"
                    fullWidth
                    value={form.department || (isSuper ? inviteDept : currentAdmin.department)}
                    onChange={(e) => onChange('department', e.target.value as AdminDepartment)}
                    disabled={!isSuper}
                  >
                    {Object.entries(DEPARTMENT_LABELS).map(([k, v]) =>
                      k !== 'all' ? <MenuItem key={k} value={k}>{v}</MenuItem> : null
                    )}
                  </TextField>
                  {!isSuper && (
                    <Typography variant="caption" color="text.secondary">
                      * คุณสามารถเพิ่มได้เฉพาะสังกัดของตนเอง
                    </Typography>
                  )}
                </Grid>
              </>
            )}

            {mode === 'edit' && (
              <>
                <Grid size={{ xs: 12 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar src={(form as any).profileImage || ''}>{(form.firstName || 'A').charAt(0)}</Avatar>
                    <Box>
                      <Typography fontWeight={700}>{form.firstName} {form.lastName}</Typography>
                      <Typography variant="body2" color="text.secondary">{form.email}</Typography>
                    </Box>
                  </Stack>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    select
                    label="บทบาท *"
                    fullWidth
                    value={form.role || 'moderator'}
                    onChange={(e) => onChange('role', e.target.value as AdminRole)}
                  >
                    {Object.keys(ROLE_LABELS).map((r) => {
                      if (!isSuper && r === 'super_admin') return null;
                      return <MenuItem key={r} value={r}>{ROLE_LABELS[r as AdminRole]}</MenuItem>;
                    })}
                  </TextField>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    select
                    label="สังกัด *"
                    fullWidth
                    value={form.department || (isSuper ? 'student_union' : currentAdmin.department)}
                    onChange={(e) => onChange('department', e.target.value as AdminDepartment)}
                    disabled={!isSuper}
                  >
                    {Object.entries(DEPARTMENT_LABELS).map(([k, v]) =>
                      k !== 'all' ? <MenuItem key={k} value={k}>{v}</MenuItem> : null
                    )}
                  </TextField>
                </Grid>
              </>
            )}

            {mode === 'invite' && (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="อีเมลผู้รับเชิญ *"
                    fullWidth
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="name@example.com"
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    select
                    label="บทบาท *"
                    fullWidth
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as AdminRole)}
                  >
                    <MenuItem value="moderator">ผู้ช่วย (Moderator)</MenuItem>
                    <MenuItem value="department_admin">แอดมินสังกัด (Department Admin)</MenuItem>
                    {isSuper && <MenuItem value="super_admin">ผู้ดูแลสูงสุด (Super Admin)</MenuItem>}
                  </TextField>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    select
                    label="สังกัด *"
                    fullWidth
                    value={inviteDept}
                    onChange={(e) => setInviteDept(e.target.value as AdminDepartment)}
                    disabled={!isSuper}
                  >
                    {Object.entries(DEPARTMENT_LABELS).map(([k, v]) =>
                      k !== 'all' ? <MenuItem key={k} value={k}>{v}</MenuItem> : null
                    )}
                  </TextField>
                  {!isSuper && (
                    <Typography variant="caption" color="text.secondary">
                      * คุณสามารถเชิญได้เฉพาะสังกัดของตนเอง
                    </Typography>
                  )}
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2">สิทธิ์ (Permissions)</Typography>
                    <Button size="small" variant="outlined" onClick={() => useRoleDefaults('invite')}>
                      ใช้ชุดสิทธิ์ตามบทบาท
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {ALL_PERMS.map((p) => {
                      const checked = invitePerms.includes(p);
                      const label = `${PERMISSION_META[p]?.th || p} / ${PERMISSION_META[p]?.en || p}`;
                      return (
                        <Tooltip
                          key={p}
                          title={
                            <Box>
                              <b>{PERMISSION_META[p]?.th} / {PERMISSION_META[p]?.en}</b>
                              <br />
                              <small>
                                {PERMISSION_META[p]?.descTh}
                                <br />
                                {PERMISSION_META[p]?.descEn}
                              </small>
                            </Box>
                          }
                        >
                          <Chip
                            label={label}
                            color={checked ? 'primary' : 'default'}
                            variant={checked ? 'filled' : 'outlined'}
                            onClick={() => onTogglePermission(p, 'invite')}
                            sx={{ cursor: 'pointer' }}
                          />
                        </Tooltip>
                      );
                    })}
                  </Stack>
                </Grid>
              </>
            )}

            {(mode === 'create' || mode === 'edit') && (
              <Grid size={{ xs: 12 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2">สิทธิ์ (Permissions)</Typography>
                  <Button size="small" variant="outlined" onClick={() => useRoleDefaults('form')}>
                    ใช้ชุดสิทธิ์ตามบทบาท
                  </Button>
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {ALL_PERMS.map((p) => {
                    const checked = (form.permissions || []).includes(p);
                    const label = `${PERMISSION_META[p]?.th || p} / ${PERMISSION_META[p]?.en || p}`;
                    return (
                      <Tooltip
                        key={p}
                        title={
                          <Box>
                            <b>{PERMISSION_META[p]?.th} / {PERMISSION_META[p]?.en}</b>
                            <br />
                            <small>
                              {PERMISSION_META[p]?.descTh}
                              <br />
                              {PERMISSION_META[p]?.descEn}
                            </small>
                          </Box>
                        }
                      >
                        <Chip
                          label={label}
                          color={checked ? 'primary' : 'default'}
                          variant={checked ? 'filled' : 'outlined'}
                          onClick={() => onTogglePermission(p, 'form')}
                          sx={{ cursor: 'pointer' }}
                        />
                      </Tooltip>
                    );
                  })}
                </Stack>
              </Grid>
            )}

            {(mode === 'create' || mode === 'edit') && (
              <Grid size={{ xs: 12 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!form.isActive}
                      onChange={(e) => onChange('isActive', e.target.checked as any)}
                    />
                  }
                  label="เปิดใช้งาน"
                />
              </Grid>
            )}
          </Grid>

          {err && <Alert severity="error" sx={{ mt: 2 }}>{err}</Alert>}
        </DialogContent>

        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={closeDialog}>ยกเลิก</Button>
          <Button variant="contained" startIcon={<ShieldIcon />} onClick={submit} disabled={loading}>
            {mode === 'invite' ? 'ส่งคำเชิญ' : 'บันทึก'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={confirm.state.open} onClose={confirm.state.busy ? undefined : confirm.close} maxWidth="xs" fullWidth>
        <DialogTitle>{confirm.state.title || 'ยืนยันการทำรายการ'}</DialogTitle>
        <DialogContent>
          <Typography>{confirm.state.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={confirm.close} disabled={!!confirm.state.busy}>ยกเลิก</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => confirm.state.onConfirm?.()}
            disabled={!!confirm.state.busy}
            startIcon={confirm.state.busy ? <CircularProgress size={16} /> : undefined}
          >
            {confirm.state.confirmText || 'ยืนยัน'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export { AdminManagement };
export default AdminManagement;
