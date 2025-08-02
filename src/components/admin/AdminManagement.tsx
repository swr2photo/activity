// components/admin/AdminManagement.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Switch,
  FormControlLabel,
  Alert,
  Avatar,
  IconButton,
  Tooltip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  FormGroup,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { ResponsiveCard, ResponsiveContainer } from '../common/index';
import { AdminRoleGuard } from './AdminRoleGuard';
import { 
  AdminProfile, 
  AdminRole, 
  AdminDepartment, 
  AdminPermission,
  DEPARTMENT_LABELS,
  ROLE_LABELS,
  ROLE_PERMISSIONS
} from '../../types/admin';

interface AdminManagementProps {
  currentAdmin: AdminProfile;
}

// Mock API functions - replace with actual API calls
const getAdminsByDepartment = async (department?: AdminDepartment): Promise<AdminProfile[]> => {
  // Mock implementation - replace with actual API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          uid: '1',
          email: 'admin@example.com',
          firstName: 'John',
          lastName: 'Doe',
          displayName: 'John Doe',
          role: 'super_admin' as AdminRole,
          department: 'student_union' as AdminDepartment,
          permissions: ['manage_users', 'manage_activities', 'manage_admins'] as AdminPermission[],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'system'
        }
      ]);
    }, 1000);
  });
};

const updateAdmin = async (uid: string, data: Partial<AdminProfile>): Promise<void> => {
  // Mock implementation - replace with actual API call
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Updating admin:', uid, data);
      resolve();
    }, 1000);
  });
};

const createAdmin = async (data: Omit<AdminProfile, 'uid' | 'updatedAt'>): Promise<void> => {
  // Mock implementation - replace with actual API call
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Creating admin:', data);
      resolve();
    }, 1000);
  });
};

const deleteAdmin = async (uid: string): Promise<void> => {
  // Mock implementation - replace with actual API call
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Deleting admin:', uid);
      resolve();
    }, 1000);
  });
};

export const AdminManagement: React.FC<AdminManagementProps> = ({ currentAdmin }) => {
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Partial<AdminProfile> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'viewer' as AdminRole,
    department: 'student_union' as AdminDepartment,
    permissions: [] as AdminPermission[]
  });

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      // Load admins based on current admin's permissions
      // Super admin can see all, department admin can see their department
      const adminsData = await getAdminsByDepartment(
        currentAdmin.role === 'super_admin' ? undefined : currentAdmin.department
      );
      setAdmins(adminsData);
    } catch (error) {
      setError('ไม่สามารถโหลดข้อมูลแอดมินได้');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = () => {
    setEditingAdmin(null);
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      role: 'viewer',
      department: currentAdmin.role === 'super_admin' ? 'student_union' : currentAdmin.department,
      permissions: ROLE_PERMISSIONS['viewer']
    });
    setDialogOpen(true);
  };

  const handleEditAdmin = (admin: AdminProfile) => {
    setEditingAdmin(admin);
    setFormData({
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      department: admin.department,
      permissions: admin.permissions
    });
    setDialogOpen(true);
  };

  const handleDeleteAdmin = async (uid: string) => {
    if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบแอดมินนี้?')) {
      try {
        setLoading(true);
        await deleteAdmin(uid);
        loadAdmins();
      } catch (error) {
        setError('ไม่สามารถลบแอดมินได้');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRoleChange = (newRole: AdminRole) => {
    setFormData(prev => ({
      ...prev,
      role: newRole,
      permissions: ROLE_PERMISSIONS[newRole]
    }));
  };

  const handlePermissionToggle = (permission: AdminPermission) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const handleSaveAdmin = async () => {
    try {
      setLoading(true);
      
      if (editingAdmin) {
        // Update existing admin
        await updateAdmin(editingAdmin.uid!, {
          ...formData,
          updatedAt: new Date()
        });
      } else {
        // Create new admin
        await createAdmin({
          ...formData,
          displayName: `${formData.firstName} ${formData.lastName}`,
          createdBy: currentAdmin.uid,
          createdAt: new Date(),
          isActive: true
        });
      }
      
      setDialogOpen(false);
      loadAdmins();
    } catch (error) {
      setError('ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminRoleGuard
      currentAdmin={currentAdmin}
      requiredPermission="manage_admins"
    >
      <ResponsiveContainer>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon />
            จัดการผู้ดูแลระบบ
          </Typography>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateAdmin}
            sx={{ borderRadius: 3 }}
          >
            เพิ่มแอดมิน
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Admin Statistics */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <ResponsiveCard>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" color="primary.main">
                  {admins.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  แอดมินทั้งหมด
                </Typography>
              </Box>
            </ResponsiveCard>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <ResponsiveCard>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" color="success.main">
                  {admins.filter(a => a.isActive).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ใช้งานได้
                </Typography>
              </Box>
            </ResponsiveCard>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <ResponsiveCard>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" color="info.main">
                  {new Set(admins.map(a => a.department)).size}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  แผนก
                </Typography>
              </Box>
            </ResponsiveCard>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <ResponsiveCard>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" color="warning.main">
                  {admins.filter(a => a.role === 'super_admin').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Super Admin
                </Typography>
              </Box>
            </ResponsiveCard>
          </Grid>
        </Grid>

        {/* Admins Table */}
        <ResponsiveCard>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ผู้ดูแล</TableCell>
                  <TableCell>บทบาท</TableCell>
                  <TableCell>แผนก</TableCell>
                  <TableCell>สถานะ</TableCell>
                  <TableCell>สร้างเมื่อ</TableCell>
                  <TableCell align="center">การดำเนินการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.uid} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={admin.profileImage}>
                          {admin.firstName.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {admin.displayName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {admin.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Chip
                        label={ROLE_LABELS[admin.role]}
                        color={
                          admin.role === 'super_admin' ? 'error' :
                          admin.role === 'department_admin' ? 'warning' :
                          admin.role === 'moderator' ? 'info' : 'default'
                        }
                        size="small"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        {DEPARTMENT_LABELS[admin.department]}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Chip
                        label={admin.isActive ? 'ใช้งานได้' : 'ระงับ'}
                        color={admin.isActive ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        {admin.createdAt instanceof Date 
                          ? admin.createdAt.toLocaleDateString('th-TH')
                          : admin.createdAt?.toDate?.()?.toLocaleDateString('th-TH') || 'N/A'
                        }
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Tooltip title="แก้ไข">
                        <IconButton
                          size="small"
                          onClick={() => handleEditAdmin(admin)}
                          disabled={admin.uid === currentAdmin.uid && admin.role === 'super_admin'}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      
                      {admin.uid !== currentAdmin.uid && (
                        <Tooltip title="ลบ">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteAdmin(admin.uid)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </ResponsiveCard>

        {/* Create/Edit Admin Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          maxWidth="md"
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle>
            {editingAdmin ? 'แก้ไขผู้ดูแล' : 'เพิ่มผู้ดูแลใหม่'}
          </DialogTitle>
          
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="ชื่อ"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="นามสกุล"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="อีเมล"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  disabled={!!editingAdmin}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>บทบาท</InputLabel>
                  <Select
                    value={formData.role}
                    onChange={(e) => handleRoleChange(e.target.value as AdminRole)}
                    disabled={currentAdmin.role !== 'super_admin'}
                  >
                    {Object.entries(ROLE_LABELS).map(([role, label]) => (
                      <MenuItem key={role} value={role}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>แผนก/สังกัด</InputLabel>
                  <Select
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value as AdminDepartment }))}
                    disabled={currentAdmin.role !== 'super_admin' && currentAdmin.department !== 'all'}
                  >
                    {Object.entries(DEPARTMENT_LABELS)
                      .filter(([dept]) => currentAdmin.role === 'super_admin' || dept === currentAdmin.department || dept === 'all')
                      .map(([dept, label]) => (
                        <MenuItem key={dept} value={dept}>
                          {label}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Permissions */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  สิทธิ์การใช้งาน
                </Typography>
                <FormGroup row>
                  {Object.entries({
                    manage_users: 'จัดการผู้ใช้',
                    manage_activities: 'จัดการกิจกรรม',
                    view_reports: 'ดูรายงาน',
                    export_data: 'ส่งออกข้อมูล',
                    manage_admins: 'จัดการแอดมิน',
                    system_settings: 'ตั้งค่าระบบ',
                    moderate_content: 'ดูแลเนื้อหา'
                  }).map(([permission, label]) => (
                    <FormControlLabel
                      key={permission}
                      control={
                        <Checkbox
                          checked={formData.permissions.includes(permission as AdminPermission)}
                          onChange={() => handlePermissionToggle(permission as AdminPermission)}
                          disabled={
                            (permission === 'manage_admins' && currentAdmin.role !== 'super_admin') ||
                            ROLE_PERMISSIONS[formData.role].includes(permission as AdminPermission)
                          }
                        />
                      }
                      label={label}
                    />
                  ))}
                </FormGroup>
              </Grid>
            </Grid>
          </DialogContent>
          
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleSaveAdmin}
              variant="contained"
              disabled={loading}
            >
              {editingAdmin ? 'บันทึก' : 'สร้าง'}
            </Button>
          </DialogActions>
        </Dialog>
      </ResponsiveContainer>
    </AdminRoleGuard>
  );
};