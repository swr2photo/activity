// components/admin/EnhancedUserManagement.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Badge,
  useTheme,
  useMediaQuery,
  TextField,
  InputAdornment,
  Button,
  ButtonGroup,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Grid // เพิ่ม Grid import
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Download as ExportIcon,
  Person as PersonIcon,
  CheckCircle as ApproveIcon,
  Block as SuspendIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';

// สร้าง components ที่ขาดหายไป
const ResponsiveContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '100%' }}>
    {children}
  </Box>
);

const ResponsiveCard: React.FC<{ children: React.ReactNode; sx?: any }> = ({ children, sx }) => (
  <Box sx={{ 
    bgcolor: 'background.paper', 
    borderRadius: 2, 
    p: 3, 
    boxShadow: 1,
    ...sx 
  }}>
    {children}
  </Box>
);

const ResponsiveTable: React.FC<{
  columns: any[];
  data: any[];
  keyField: string;
  actions?: (row: any) => React.ReactNode;
  emptyMessage?: string;
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
              <Box 
                component="th" 
                key={col.id}
                sx={{ 
                  p: 2, 
                  textAlign: 'left', 
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  display: { xs: col.hideOnMobile ? 'none' : 'table-cell', md: 'table-cell' }
                }}
              >
                <Typography variant="subtitle2" fontWeight="bold">
                  {col.label}
                </Typography>
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
                <Box 
                  component="td" 
                  key={col.id}
                  sx={{ 
                    p: 2, 
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: { xs: col.hideOnMobile ? 'none' : 'table-cell', md: 'table-cell' }
                  }}
                >
                  {col.format ? col.format(row[col.id], row) : row[col.id]}
                </Box>
              ))}
              {actions && (
                <Box component="td" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  {actions(row)}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    )}
  </Box>
);

const StatsCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}> = ({ title, value, icon, color, subtitle }) => (
  <ResponsiveCard>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{ 
        bgcolor: color, 
        color: 'white', 
        p: 1.5, 
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="h4" fontWeight="bold" color={color}>
          {value.toLocaleString()}
        </Typography>
        <Typography variant="subtitle2" fontWeight="600">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  </ResponsiveCard>
);

// เพิ่ม type definitions
interface User {
  uid: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  studentId?: string;
  faculty?: string;
  department?: string;
  degreeLevel?: string;
  isVerified: boolean;
  isActive: boolean;
  photoURL?: string;
  createdAt?: {
    toDate: () => Date;
  };
}

interface AdminProfile {
  department: string;
  role: string;
  permissions: string[];
}

// เพิ่ม constants
const DEPARTMENT_LABELS: { [key: string]: string } = {
  'all': 'ทุกแผนก',
  'hr': 'ทรัพยากรบุคคล',
  'finance': 'การเงิน',
  'it': 'เทคโนโลยีสารสนเทศ',
  'marketing': 'การตลาด',
  'operations': 'ปฏิบัติการ'
};

// Mock API functions - แทนที่ด้วยการ import จริง
const getAllUsers = async (): Promise<User[]> => {
  // Replace with actual API call
  return [];
};

const getPendingUsers = async (): Promise<User[]> => {
  // Replace with actual API call
  return [];
};

const getUsersByDepartment = async (department: string): Promise<User[]> => {
  // Replace with actual API call
  return [];
};

const getPendingUsersByDepartment = async (department: string): Promise<User[]> => {
  // Replace with actual API call
  return [];
};

const approveUser = async (uid: string): Promise<void> => {
  // Replace with actual API call
  console.log('Approving user:', uid);
};

const suspendUser = async (uid: string): Promise<void> => {
  // Replace with actual API call
  console.log('Suspending user:', uid);
};

interface EnhancedUserManagementProps {
  currentAdmin: AdminProfile;
}

export const EnhancedUserManagement: React.FC<EnhancedUserManagementProps> = ({ currentAdmin }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [currentAdmin.department]);

  useEffect(() => {
    filterUsers();
  }, [allUsers, pendingUsers, searchTerm, tabValue]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      let usersData, pendingData;
      
      if (currentAdmin.department === 'all') {
        [usersData, pendingData] = await Promise.all([
          getAllUsers(),
          getPendingUsers()
        ]);
      } else {
        [usersData, pendingData] = await Promise.all([
          getUsersByDepartment(currentAdmin.department),
          getPendingUsersByDepartment(currentAdmin.department)
        ]);
      }
      
      setAllUsers(usersData);
      setPendingUsers(pendingData);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    const sourceUsers = tabValue === 0 ? pendingUsers : allUsers;
    
    if (!searchTerm) {
      setFilteredUsers(sourceUsers);
    } else {
      setFilteredUsers(
        sourceUsers.filter(user =>
          user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.studentId?.includes(searchTerm) ||
          user.faculty?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.department?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
  };

  const handleApproveUser = async (uid: string) => {
    try {
      await approveUser(uid);
      loadUsers();
    } catch (error) {
      console.error('Error approving user:', error);
    }
  };

  const handleSuspendUser = async (uid: string) => {
    try {
      await suspendUser(uid);
      loadUsers();
    } catch (error) {
      console.error('Error suspending user:', error);
    }
  };

  const exportUsers = () => {
    const csvContent = [
      ['รหัสนักศึกษา', 'ชื่อ', 'นามสกุล', 'อีเมล', 'คณะ', 'สาขา', 'ระดับปริญญา', 'สถานะ', 'วันที่สร้าง'],
      ...filteredUsers.map(user => [
        user.studentId || '',
        user.firstName || '',
        user.lastName || '',
        user.email || '',
        user.faculty || '',
        user.department || '',
        user.degreeLevel || '',
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

  const userTableColumns = [
    {
      id: 'user',
      label: 'ผู้ใช้',
      format: (value: any, row: User) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar src={row.photoURL} sx={{ width: 32, height: 32 }}>
            {row.firstName?.charAt(0)}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight="medium">
              {row.firstName} {row.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.email}
            </Typography>
          </Box>
        </Box>
      ),
      hideOnMobile: false
    },
    {
      id: 'studentId',
      label: 'รหัสนักศึกษา',
      format: (value: string) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {value}
        </Typography>
      ),
      hideOnMobile: false
    },
    {
      id: 'faculty',
      label: 'คณะ/สาขา',
      format: (value: any, row: User) => (
        <Box>
          <Typography variant="body2">{row.faculty}</Typography>
          <Typography variant="caption" color="text.secondary">{row.department}</Typography>
        </Box>
      ),
      hideOnMobile: true
    },
    {
      id: 'status',
      label: 'สถานะ',
      format: (value: any, row: User) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Chip 
            label={row.isVerified ? 'อนุมัติแล้ว' : 'รออนุมัติ'} 
            color={row.isVerified ? 'success' : 'warning'} 
            size="small"
          />
          <Chip 
            label={row.isActive ? 'ใช้งานได้' : 'ถูกระงับ'} 
            color={row.isActive ? 'success' : 'error'} 
            size="small"
          />
        </Box>
      ),
      hideOnMobile: false
    },
    {
      id: 'createdAt',
      label: 'วันที่สร้าง',
      format: (value: any) => (
        <Typography variant="body2">
          {value?.toDate?.()?.toLocaleDateString('th-TH') || 'ไม่ระบุ'}
        </Typography>
      ),
      hideOnMobile: true
    }
  ];

  const renderUserActions = (user: User) => (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: isMobile ? 'flex-start' : 'center' }}>
      <Tooltip title="ดูรายละเอียด">
        <IconButton 
          size="small" 
          color="info"
          onClick={() => {
            setSelectedUser(user);
            setUserDialogOpen(true);
          }}
        >
          <ViewIcon />
        </IconButton>
      </Tooltip>
      
      {!user.isVerified && (
        <Tooltip title="อนุมัติ">
          <IconButton 
            size="small" 
            color="success"
            onClick={() => handleApproveUser(user.uid)}
          >
            <ApproveIcon />
          </IconButton>
        </Tooltip>
      )}
      
      {user.isActive && (
        <Tooltip title="ระงับการใช้งาน">
          <IconButton 
            size="small" 
            color="error"
            onClick={() => handleSuspendUser(user.uid)}
          >
            <SuspendIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );

  return (
    <ResponsiveContainer>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          จัดการผู้ใช้มหาวิทยาลัย
        </Typography>
        <Typography variant="body1" color="text.secondary">
          จัดการบัญชีผู้ใช้ในสังกัด {DEPARTMENT_LABELS[currentAdmin.department] || currentAdmin.department}
        </Typography>
      </Box>

      {/* Statistics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="ผู้ใช้ทั้งหมด"
            value={allUsers.length}
            icon={<PersonIcon />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="รออนุมัติ"
            value={pendingUsers.length}
            icon={<PersonIcon />}
            color="#ed6c02"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="อนุมัติแล้ว"
            value={allUsers.filter(u => u.isVerified).length}
            icon={<PersonIcon />}
            color="#2e7d32"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="ถูกระงับ"
            value={allUsers.filter(u => !u.isActive).length}
            icon={<PersonIcon />}
            color="#d32f2f"
          />
        </Grid>
      </Grid>

      {/* Controls */}
      <ResponsiveCard sx={{ mb: 3 }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: { xs: 'stretch', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2 
        }}>
          {/* Search */}
          <TextField
            size="small"
            label="ค้นหาผู้ใช้"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ชื่อ, อีเมล, รหัสนักศึกษา, คณะ, สาขา"
            sx={{ minWidth: { xs: '100%', md: 350 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          {/* Action Buttons */}
          <ButtonGroup size={isMobile ? "medium" : "small"}>
            <Button
              onClick={loadUsers}
              disabled={loading}
              startIcon={<RefreshIcon />}
            >
              รีเฟรช
            </Button>
            <Button
              onClick={exportUsers}
              startIcon={<ExportIcon />}
              color="success"
              disabled={filteredUsers.length === 0}
            >
              ส่งออก
            </Button>
          </ButtonGroup>
        </Box>
      </ResponsiveCard>

      {/* User Management Tabs */}
      <ResponsiveCard>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, newValue) => setTabValue(newValue)}
            variant={isMobile ? "fullWidth" : "standard"}
          >
            <Tab 
              label={
                <Badge badgeContent={pendingUsers.length} color="warning">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon />
                    <span>รออนุมัติ</span>
                  </Box>
                </Badge>
              }
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon />
                  <span>ผู้ใช้ทั้งหมด ({allUsers.length})</span>
                </Box>
              }
            />
          </Tabs>
        </Box>

        <Box sx={{ p: { xs: 1, sm: 2 } }}>
          <ResponsiveTable
            columns={userTableColumns}
            data={filteredUsers}
            keyField="uid"
            actions={renderUserActions}
            emptyMessage={tabValue === 0 ? "ไม่มีผู้ใช้ที่รออนุมัติ" : "ไม่มีผู้ใช้ในระบบ"}
          />
        </Box>
      </ResponsiveCard>

      {/* User Detail Dialog */}
      <Dialog
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        {selectedUser && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar src={selectedUser.photoURL}>
                {selectedUser.firstName?.charAt(0)}
              </Avatar>
              รายละเอียดผู้ใช้: {selectedUser.displayName}
            </DialogTitle>
            
            <DialogContent>
              {/* User details content */}
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      ข้อมูลส่วนตัว
                    </Typography>
                    <Typography variant="body1">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      อีเมล
                    </Typography>
                    <Typography variant="body1">
                      {selectedUser.email}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      รหัสนักศึกษา
                    </Typography>
                    <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                      {selectedUser.studentId}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      คณะ
                    </Typography>
                    <Typography variant="body1">
                      {selectedUser.faculty}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      สาขาวิชา
                    </Typography>
                    <Typography variant="body1">
                      {selectedUser.department}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      ระดับปริญญา
                    </Typography>
                    <Typography variant="body1">
                      {selectedUser.degreeLevel}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            
            <DialogActions>
              <Button onClick={() => setUserDialogOpen(false)}>
                ปิด
              </Button>
              {!selectedUser.isVerified && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<ApproveIcon />}
                  onClick={() => {
                    handleApproveUser(selectedUser.uid);
                    setUserDialogOpen(false);
                  }}
                >
                  อนุมัติ
                </Button>
              )}
              {selectedUser.isActive && (
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<SuspendIcon />}
                  onClick={() => {
                    handleSuspendUser(selectedUser.uid);
                    setUserDialogOpen(false);
                  }}
                >
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