'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Grid,
  Paper,
  Stack,
  Badge // เพิ่ม Badge import
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Block as SuspendIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Download as ExportIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  Email as EmailIcon,
  Badge as BadgeIcon
} from '@mui/icons-material';
import {
  getAllUsers,
  getPendingUsers,
  approveUser,
  suspendUser,
  UniversityUserProfile
} from '../lib/firebaseAuth';

interface UserDetailDialogProps {
  user: UniversityUserProfile | null;
  open: boolean;
  onClose: () => void;
  onApprove?: (uid: string) => void;
  onSuspend?: (uid: string) => void;
}

const UserDetailDialog: React.FC<UserDetailDialogProps> = ({
  user,
  open,
  onClose,
  onApprove,
  onSuspend
}) => {
  const [actionLoading, setActionLoading] = useState(false);

  const handleApprove = async () => {
    if (!user || !onApprove) return;
    
    setActionLoading(true);
    try {
      await onApprove(user.uid);
      onClose();
    } catch (error) {
      console.error('Error approving user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!user || !onSuspend) return;
    
    setActionLoading(true);
    try {
      await onSuspend(user.uid);
      onClose();
    } catch (error) {
      console.error('Error suspending user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar src={user.photoURL} sx={{ width: 40, height: 40 }}>
          {user.firstName.charAt(0)}
        </Avatar>
        รายละเอียดผู้ใช้: {user.displayName}
      </DialogTitle>
      
      <DialogContent>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon />
                ข้อมูลส่วนตัว
              </Typography>
              <Stack spacing={1}>
                <Box>
                  <Typography variant="subtitle2">ชื่อ-นามสกุล (ไทย)</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.firstName} {user.lastName}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">ชื่อที่แสดง</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.displayName}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">อีเมล</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.email}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SchoolIcon />
                ข้อมูลการศึกษา
              </Typography>
              <Stack spacing={1}>
                <Box>
                  <Typography variant="subtitle2">รหัสนักศึกษา</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {user.studentId}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">ระดับปริญญา</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.degreeLevel}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">คณะ</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.faculty}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">สาขาวิชา</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.department}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BadgeIcon />
                สถานะบัญชี
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Chip 
                  label={user.isActive ? 'ใช้งานได้' : 'ถูกระงับ'} 
                  color={user.isActive ? 'success' : 'error'} 
                  size="small"
                />
                <Chip 
                  label={user.isVerified ? 'ได้รับการอนุมัติ' : 'รอการอนุมัติ'} 
                  color={user.isVerified ? 'success' : 'warning'} 
                  size="small"
                />
              </Stack>
              
              <Stack spacing={1}>
                <Box>
                  <Typography variant="subtitle2">วันที่สร้างบัญชี</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.createdAt?.toDate?.()?.toLocaleString('th-TH') || 'ไม่ระบุ'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">เข้าสู่ระบบครั้งล่าสุด</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.lastLoginAt?.toDate?.()?.toLocaleString('th-TH') || 'ไม่ระบุ'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">จำนวนครั้งที่เข้าสู่ระบบ</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.loginCount || 0} ครั้ง
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          ปิด
        </Button>
        {!user.isVerified && onApprove && (
          <Button
            variant="contained"
            color="success"
            startIcon={actionLoading ? <CircularProgress size={16} /> : <ApproveIcon />}
            onClick={handleApprove}
            disabled={actionLoading}
          >
            อนุมัติ
          </Button>
        )}
        {user.isActive && onSuspend && (
          <Button
            variant="contained"
            color="error"
            startIcon={actionLoading ? <CircularProgress size={16} /> : <SuspendIcon />}
            onClick={handleSuspend}
            disabled={actionLoading}
          >
            ระงับการใช้งาน
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

interface AdminUserManagementProps {
  onUserUpdate?: () => void;
}

const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ onUserUpdate }) => {
  const [allUsers, setAllUsers] = useState<UniversityUserProfile[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UniversityUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState<UniversityUserProfile | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [allUsersData, pendingUsersData] = await Promise.all([
        getAllUsers(),
        getPendingUsers()
      ]);
      
      setAllUsers(allUsersData.sort((a, b) => 
        (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)
      ));
      setPendingUsers(pendingUsersData.sort((a, b) => 
        (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)
      ));
    } catch (err) {
      console.error('Error loading users:', err);
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (uid: string) => {
    try {
      await approveUser(uid);
      await loadUsers();
      if (onUserUpdate) onUserUpdate();
    } catch (error) {
      console.error('Error approving user:', error);
      setError('เกิดข้อผิดพลาดในการอนุมัติผู้ใช้');
    }
  };

  const handleSuspendUser = async (uid: string) => {
    try {
      await suspendUser(uid);
      await loadUsers();
      if (onUserUpdate) onUserUpdate();
    } catch (error) {
      console.error('Error suspending user:', error);
      setError('เกิดข้อผิดพลาดในการระงับผู้ใช้');
    }
  };

  // ลบ function นี้ออก เพราะซ้ำกับด้านล่าง
  // const handleViewUser = (user: UniversityUserProfile) => {
  //   setSelectedUser(user);
  //   setShowUserDialog(true);
  // };

  const exportUsers = () => {
    const csvContent = [
      ['รหัสนักศึกษา', 'ชื่อ', 'นามสกุล', 'อีเมล', 'คณะ', 'สาขา', 'ระดับปริญญา', 'สถานะ', 'วันที่สร้าง'],
      ...allUsers.map(user => [
        user.studentId,
        user.firstName,
        user.lastName,
        user.email,
        user.faculty,
        user.department,
        user.degreeLevel,
        user.isVerified ? 'อนุมัติแล้ว' : 'รออนุมัติ',
        user.createdAt?.toDate?.()?.toLocaleDateString('th-TH') || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `university_users_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const filteredUsers = (users: UniversityUserProfile[]) => {
    if (!searchTerm) return users;
    
    return users.filter(user =>
      user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.studentId.includes(searchTerm) ||
      user.faculty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.department.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // ย้าย handleViewUser มาไว้ก่อน renderUserTable
  const handleViewUser = (user: UniversityUserProfile) => {
    setSelectedUser(user);
    setShowUserDialog(true);
  };

  const renderUserTable = (users: UniversityUserProfile[], showActions = true) => (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>ผู้ใช้</TableCell>
            <TableCell>รหัสนักศึกษา</TableCell>
            <TableCell>คณะ/สาขา</TableCell>
            <TableCell>สถานะ</TableCell>
            <TableCell>วันที่สร้าง</TableCell>
            {showActions && <TableCell align="center">การดำเนินการ</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredUsers(users).map((user) => (
            <TableRow key={user.uid} hover>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar src={user.photoURL} sx={{ width: 32, height: 32 }}>
                    {user.firstName.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {user.firstName} {user.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {user.email}
                    </Typography>
                  </Box>
                </Box>
              </TableCell>
              
              <TableCell>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {user.studentId}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user.degreeLevel}
                </Typography>
              </TableCell>
              
              <TableCell>
                <Typography variant="body2">
                  {user.faculty}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user.department}
                </Typography>
              </TableCell>
              
              <TableCell>
                <Stack direction="column" spacing={0.5}>
                  <Chip 
                    label={user.isVerified ? 'อนุมัติแล้ว' : 'รออนุมัติ'} 
                    color={user.isVerified ? 'success' : 'warning'} 
                    size="small"
                  />
                  <Chip 
                    label={user.isActive ? 'ใช้งานได้' : 'ถูกระงับ'} 
                    color={user.isActive ? 'success' : 'error'} 
                    size="small"
                  />
                </Stack>
              </TableCell>
              
              <TableCell>
                <Typography variant="body2">
                  {user.createdAt?.toDate?.()?.toLocaleDateString('th-TH') || 'ไม่ระบุ'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  เข้าสู่ระบบ: {user.loginCount || 0} ครั้ง
                </Typography>
              </TableCell>
              
              {showActions && (
                <TableCell align="center">
                  <Stack direction="row" spacing={0.5} justifyContent="center">
                    <Tooltip title="ดูรายละเอียด">
                      <IconButton 
                        size="small" 
                        onClick={() => handleViewUser(user)}
                        color="primary"
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    
                    {!user.isVerified && (
                      <Tooltip title="อนุมัติ">
                        <IconButton 
                          size="small" 
                          onClick={() => handleApproveUser(user.uid)}
                          color="success"
                        >
                          <ApproveIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    {user.isActive && (
                      <Tooltip title="ระงับการใช้งาน">
                        <IconButton 
                          size="small" 
                          onClick={() => handleSuspendUser(user.uid)}
                          color="error"
                        >
                          <SuspendIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>กำลังโหลดข้อมูลผู้ใช้...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">
              จัดการผู้ใช้มหาวิทยาลัย
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadUsers}
                disabled={loading}
              >
                รีเฟรช
              </Button>
              <Button
                variant="outlined"
                startIcon={<ExportIcon />}
                onClick={exportUsers}
                disabled={allUsers.length === 0}
              >
                ส่งออก CSV
              </Button>
            </Stack>
          </Box>

          {/* Search */}
          <TextField
            fullWidth
            variant="outlined"
            placeholder="ค้นหาผู้ใช้ (ชื่อ, อีเมล, รหัสนักศึกษา, คณะ, สาขา)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              {allUsers.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ผู้ใช้ทั้งหมด
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="warning.main">
              {pendingUsers.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              รออนุมัติ
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="success.main">
              {allUsers.filter(u => u.isVerified).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              อนุมัติแล้ว
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="error.main">
              {allUsers.filter(u => !u.isActive).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ถูกระงับ
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, newValue) => setTabValue(newValue)}
            sx={{ px: 2 }}
          >
            <Tab 
              label={`รออนุมัติ (${pendingUsers.length})`} 
              icon={
                <Badge badgeContent={pendingUsers.length} color="warning">
                  <PersonIcon />
                </Badge>
              }
              iconPosition="start"
            />
            <Tab 
              label={`ผู้ใช้ทั้งหมด (${allUsers.length})`}
              icon={<PersonIcon />}
              iconPosition="start"
            />
          </Tabs>
        </Box>

        <CardContent>
          {/* Pending Users Tab */}
          {tabValue === 0 && (
            <Box>
              {pendingUsers.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    ไม่มีผู้ใช้ที่รออนุมัติ
                  </Typography>
                </Box>
              ) : (
                renderUserTable(pendingUsers)
              )}
            </Box>
          )}

          {/* All Users Tab */}
          {tabValue === 1 && (
            <Box>
              {allUsers.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    ไม่มีผู้ใช้ในระบบ
                  </Typography>
                </Box>
              ) : (
                renderUserTable(allUsers)
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* User Detail Dialog */}
      <UserDetailDialog
        user={selectedUser}
        open={showUserDialog}
        onClose={() => {
          setShowUserDialog(false);
          setSelectedUser(null);
        }}
        onApprove={handleApproveUser}
        onSuspend={handleSuspendUser}
      />
    </Box>
  );
};

export default AdminUserManagement;