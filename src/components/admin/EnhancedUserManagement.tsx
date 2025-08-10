// components/admin/EnhancedUserManagement.tsx
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Tabs, Tab, Badge, useTheme, useMediaQuery, TextField, InputAdornment,
  Button, ButtonGroup, Dialog, DialogTitle, DialogContent, DialogActions, Avatar, Chip, IconButton, Tooltip, Grid
} from '@mui/material';
import {
  Search as SearchIcon, Refresh as RefreshIcon, Download as ExportIcon,
  Person as PersonIcon, CheckCircle as ApproveIcon, Block as SuspendIcon, Visibility as ViewIcon
} from '@mui/icons-material';
import { AdminProfile, DEPARTMENT_LABELS } from '../../types/admin';
import {
  getAllUsers, getPendingUsers, getUsersByDepartment, getPendingUsersByDepartment,
  approveUser, suspendUser, UnivUser
} from '../../lib/adminFirebase';

const ResponsiveContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '100%' }}>{children}</Box>
);
const ResponsiveCard: React.FC<{ children: React.ReactNode; sx?: any }> = ({ children, sx }) => (
  <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 3, boxShadow: 1, ...sx }}>{children}</Box>
);
const ResponsiveTable: React.FC<{
  columns: any[]; data: any[]; keyField: string; actions?: (row: any) => React.ReactNode; emptyMessage?: string;
}> = ({ columns, data, keyField, actions, emptyMessage }) => (
  <Box sx={{ overflowX: 'auto' }}>
    {data.length === 0 ? (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
        {emptyMessage || 'ไม่มีข้อมูล'}
      </Typography>
    ) : (
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
        <Box component="thead">
          <Box component="tr">
            {columns.map((col) => (
              <Box component="th" key={col.id}
                sx={{ p: 2, textAlign: 'left', borderBottom: '1px solid', borderColor: 'divider',
                  display: { xs: col.hideOnMobile ? 'none' : 'table-cell', md: 'table-cell' }}}>
                <Typography variant="subtitle2" fontWeight="bold">{col.label}</Typography>
              </Box>
            ))}
            {actions && (
              <Box component="th" sx={{ p: 2, textAlign: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight="bold">การดำเนินการ</Typography>
              </Box>
            )}
          </Box>
        </Box>
        <Box component="tbody">
          {data.map((row) => (
            <Box component="tr" key={row[keyField]}>
              {columns.map((col) => (
                <Box component="td" key={col.id}
                  sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider',
                    display: { xs: col.hideOnMobile ? 'none' : 'table-cell', md: 'table-cell' }}}>
                  {col.format ? col.format(row[col.id], row) : row[col.id]}
                </Box>
              ))}
              {actions && <Box component="td" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>{actions(row)}</Box>}
            </Box>
          ))}
        </Box>
      </Box>
    )}
  </Box>
);

interface Props { currentAdmin: AdminProfile; }

export const EnhancedUserManagement: React.FC<Props> = ({ currentAdmin }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [allUsers, setAllUsers] = useState<UnivUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UnivUser[]>([]);
  const [filtered, setFiltered] = useState<UnivUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UnivUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => { load(); }, [currentAdmin.department]);
  useEffect(() => { applyFilter(); }, [allUsers, pendingUsers, search, tabValue]);

  const load = async () => {
    setLoading(true);
    try {
      let usersData: UnivUser[], pendingData: UnivUser[];
      if (currentAdmin.department === 'all') {
        [usersData, pendingData] = await Promise.all([getAllUsers(), getPendingUsers()]);
      } else {
        [usersData, pendingData] = await Promise.all([
          getUsersByDepartment(currentAdmin.department),
          getPendingUsersByDepartment(currentAdmin.department),
        ]);
      }
      setAllUsers(usersData);
      setPendingUsers(pendingData);
    } finally { setLoading(false); }
  };

  const applyFilter = () => {
    const source = tabValue === 0 ? pendingUsers : allUsers;
    if (!search) { setFiltered(source); return; }
    const q = search.toLowerCase();
    setFiltered(source.filter(u =>
      u.displayName?.toLowerCase().includes(q) ||
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.studentId?.includes(search) ||
      u.faculty?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q)
    ));
  };

  const exportUsers = () => {
    const rows = [
      ['รหัสนักศึกษา','ชื่อ','นามสกุล','อีเมล','คณะ','สาขา','ระดับปริญญา','สถานะ','วันที่สร้าง'],
      ...filtered.map(u => [
        u.studentId || '', u.firstName || '', u.lastName || '', u.email || '',
        u.faculty || '', u.department || '', u.degreeLevel || '',
        u.isVerified ? 'อนุมัติแล้ว' : 'รออนุมัติ',
        u.createdAt?.toLocaleDateString('th-TH') || ''
      ])
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + rows], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `university_users_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const columns = [
    { id: 'user', label: 'ผู้ใช้', format: (_: any, row: UnivUser) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar src={row.photoURL} sx={{ width: 32, height: 32 }}>{row.firstName?.charAt(0)}</Avatar>
        <Box>
          <Typography variant="body2" fontWeight="medium">{row.firstName} {row.lastName}</Typography>
          <Typography variant="caption" color="text.secondary">{row.email}</Typography>
        </Box>
      </Box>
    )},
    { id: 'studentId', label: 'รหัสนักศึกษา', format: (v: string) => (<Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{v}</Typography>) },
    { id: 'faculty', label: 'คณะ/สาขา', format: (_: any, row: UnivUser) => (<Box><Typography variant="body2">{row.faculty}</Typography><Typography variant="caption" color="text.secondary">{row.department}</Typography></Box>), hideOnMobile: true },
    { id: 'status', label: 'สถานะ', format: (_: any, row: UnivUser) => (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Chip label={row.isVerified ? 'อนุมัติแล้ว' : 'รออนุมัติ'} color={row.isVerified ? 'success' : 'warning'} size="small" />
        <Chip label={row.isActive ? 'ใช้งานได้' : 'ถูกระงับ'} color={row.isActive ? 'success' : 'error'} size="small" />
      </Box>
    )},
    { id: 'createdAt', label: 'วันที่สร้าง', format: (v: Date | undefined) => (<Typography variant="body2">{v?.toLocaleDateString('th-TH') || 'ไม่ระบุ'}</Typography>), hideOnMobile: true },
  ];

  const actions = (u: UnivUser) => (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: isMobile ? 'flex-start' : 'center' }}>
      <Tooltip title="ดูรายละเอียด">
        <IconButton size="small" color="info" onClick={() => { setSelectedUser(u); setDialogOpen(true); }}>
          <ViewIcon />
        </IconButton>
      </Tooltip>
      {!u.isVerified && (
        <Tooltip title="อนุมัติ">
          <IconButton size="small" color="success" onClick={async () => { await approveUser(u.uid); load(); }}>
            <ApproveIcon />
          </IconButton>
        </Tooltip>
      )}
      {u.isActive && (
        <Tooltip title="ระงับการใช้งาน">
          <IconButton size="small" color="error" onClick={async () => { await suspendUser(u.uid); load(); }}>
            <SuspendIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );

  return (
    <ResponsiveContainer>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>จัดการผู้ใช้มหาวิทยาลัย</Typography>
        <Typography variant="body1" color="text.secondary">
          จัดการบัญชีผู้ใช้ในสังกัด {DEPARTMENT_LABELS[currentAdmin.department] || currentAdmin.department}
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}><ResponsiveCard><Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box sx={{ bgcolor: '#1976d2', color: 'white', p: 1.5, borderRadius: 2 }}><PersonIcon /></Box>
          <Box><Typography variant="h4" color="#1976d2">{allUsers.length}</Typography><Typography variant="subtitle2">ผู้ใช้ทั้งหมด</Typography></Box>
        </Box></ResponsiveCard></Grid>
        <Grid item xs={12} sm={6} md={3}><ResponsiveCard><Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box sx={{ bgcolor: '#ed6c02', color: 'white', p: 1.5, borderRadius: 2 }}><PersonIcon /></Box>
          <Box><Typography variant="h4" color="#ed6c02">{pendingUsers.length}</Typography><Typography variant="subtitle2">รออนุมัติ</Typography></Box>
        </Box></ResponsiveCard></Grid>
        <Grid item xs={12} sm={6} md={3}><ResponsiveCard><Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box sx={{ bgcolor: '#2e7d32', color: 'white', p: 1.5, borderRadius: 2 }}><PersonIcon /></Box>
          <Box><Typography variant="h4" color="#2e7d32">{allUsers.filter(u => u.isVerified).length}</Typography><Typography variant="subtitle2">อนุมัติแล้ว</Typography></Box>
        </Box></ResponsiveCard></Grid>
        <Grid item xs={12} sm={6} md={3}><ResponsiveCard><Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box sx={{ bgcolor: '#d32f2f', color: 'white', p: 1.5, borderRadius: 2 }}><PersonIcon /></Box>
          <Box><Typography variant="h4" color="#d32f2f">{allUsers.filter(u => !u.isActive).length}</Typography><Typography variant="subtitle2">ถูกระงับ</Typography></Box>
        </Box></ResponsiveCard></Grid>
      </Grid>

      <ResponsiveCard sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
          <TextField
            size="small" label="ค้นหาผู้ใช้" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="ชื่อ, อีเมล, รหัสนักศึกษา, คณะ, สาขา" sx={{ minWidth: { xs: '100%', md: 350 } }}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
          />
          <ButtonGroup size={isMobile ? 'medium' : 'small'}>
            <Button onClick={load} disabled={loading} startIcon={<RefreshIcon />}>รีเฟรช</Button>
            <Button onClick={exportUsers} startIcon={<ExportIcon />} color="success" disabled={filtered.length === 0}>ส่งออก</Button>
          </ButtonGroup>
        </Box>
      </ResponsiveCard>

      <ResponsiveCard>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant={isMobile ? 'fullWidth' : 'standard'}>
            <Tab label={<Badge badgeContent={pendingUsers.length} color="warning">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><PersonIcon /><span>รออนุมัติ</span></Box>
            </Badge>} />
            <Tab label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><PersonIcon /><span>ผู้ใช้ทั้งหมด ({allUsers.length})</span></Box>} />
          </Tabs>
        </Box>

        <Box sx={{ p: { xs: 1, sm: 2 } }}>
          <ResponsiveTable
            columns={columns}
            data={filtered}
            keyField="uid"
            actions={actions}
            emptyMessage={tabValue === 0 ? 'ไม่มีผู้ใช้ที่รออนุมัติ' : 'ไม่มีผู้ใช้ในระบบ'}
          />
        </Box>
      </ResponsiveCard>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        {selectedUser && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar src={selectedUser.photoURL}>{selectedUser.firstName?.charAt(0)}</Avatar>
              รายละเอียดผู้ใช้: {selectedUser.displayName || `${selectedUser.firstName ?? ''} ${selectedUser.lastName ?? ''}`}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}><Typography variant="subtitle2" color="text.secondary">ข้อมูลส่วนตัว</Typography>
                    <Typography variant="body1">{selectedUser.firstName} {selectedUser.lastName}</Typography></Box>
                  <Box sx={{ mb: 2 }}><Typography variant="subtitle2" color="text.secondary">อีเมล</Typography>
                    <Typography variant="body1">{selectedUser.email}</Typography></Box>
                  <Box sx={{ mb: 2 }}><Typography variant="subtitle2" color="text.secondary">รหัสนักศึกษา</Typography>
                    <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>{selectedUser.studentId}</Typography></Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}><Typography variant="subtitle2" color="text.secondary">คณะ</Typography>
                    <Typography variant="body1">{selectedUser.faculty}</Typography></Box>
                  <Box sx={{ mb: 2 }}><Typography variant="subtitle2" color="text.secondary">สาขาวิชา</Typography>
                    <Typography variant="body1">{selectedUser.department}</Typography></Box>
                  <Box sx={{ mb: 2 }}><Typography variant="subtitle2" color="text.secondary">ระดับปริญญา</Typography>
                    <Typography variant="body1">{selectedUser.degreeLevel}</Typography></Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)}>ปิด</Button>
              {!selectedUser.isVerified && (
                <Button variant="contained" color="success" startIcon={<ApproveIcon />}
                        onClick={async () => { await approveUser(selectedUser.uid); setDialogOpen(false); load(); }}>
                  อนุมัติ
                </Button>
              )}
              {selectedUser.isActive && (
                <Button variant="contained" color="error" startIcon={<SuspendIcon />}
                        onClick={async () => { await suspendUser(selectedUser.uid); setDialogOpen(false); load(); }}>
                  ระงับ
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </ResponsiveContainer>
  );
};
