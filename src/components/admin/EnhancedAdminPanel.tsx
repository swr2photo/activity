// components/admin/EnhancedAdminPanel.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  TextField,
  Button,
  Alert,
  IconButton,
  Tooltip,
  InputAdornment,
  ButtonGroup,
  Fab,
  useTheme,
  useMediaQuery,
  Chip // เพิ่ม Chip import
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterListIcon,
  Event as EventIcon, // เพิ่ม icons ที่ขาดหายไป
  People as PeopleIcon,
  Today as TodayIcon
} from '@mui/icons-material';

// สร้าง components ที่ขาดหายไป หรือ import จากที่อื่น
// หากมี components เหล่านี้อยู่แล้ว ให้แก้ไข path ให้ถูกต้อง
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
interface ActivityRecord {
  id: string;
  timestamp: Date;
  studentId: string;
  firstName: string;
  lastName: string;
  department: string;
  activityCode: string;
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

// Mock functions - แทนที่ด้วยการ import จริงจาก services
const getAllActivityRecords = async (): Promise<ActivityRecord[]> => {
  // Replace with actual API call
  return [];
};

const getActivityRecordsByDepartment = async (department: string): Promise<ActivityRecord[]> => {
  // Replace with actual API call
  return [];
};

import { AdminProfile } from '../../types/admin';

interface EnhancedAdminPanelProps {
  currentAdmin: AdminProfile;
}

export const EnhancedAdminPanel: React.FC<EnhancedAdminPanelProps> = ({ currentAdmin }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [stats, setStats] = useState({
    totalRecords: 0,
    uniqueStudents: 0,
    uniqueActivities: 0,
    todayRecords: 0
  });

  useEffect(() => {
    loadRecords();
  }, [currentAdmin.department]);

  useEffect(() => {
    filterRecords();
    calculateStats();
  }, [records, filterText]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      // Load records based on admin's department permissions
      let recordsData;
      if (currentAdmin.department === 'all') {
        recordsData = await getAllActivityRecords();
      } else {
        recordsData = await getActivityRecordsByDepartment(currentAdmin.department);
      }
      setRecords(recordsData);
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterRecords = () => {
    if (!filterText) {
      setFilteredRecords(records);
    } else {
      setFilteredRecords(
        records.filter(record => 
          record.activityCode.toLowerCase().includes(filterText.toLowerCase()) ||
          record.studentId.includes(filterText) ||
          record.firstName.toLowerCase().includes(filterText.toLowerCase()) ||
          record.lastName.toLowerCase().includes(filterText.toLowerCase())
        )
      );
    }
  };

  const calculateStats = () => {
    const uniqueStudents = new Set(records.map(r => r.studentId)).size;
    const uniqueActivities = new Set(records.map(r => r.activityCode)).size;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRecords = records.filter(r => {
      const recordDate = new Date(r.timestamp);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate.getTime() === today.getTime();
    }).length;

    setStats({
      totalRecords: records.length,
      uniqueStudents,
      uniqueActivities,
      todayRecords
    });
  };

  const exportToCSV = () => {
    const headers = ['วันที่/เวลา', 'รหัสนักศึกษา', 'ชื่อ', 'นามสกุล', 'สาขา', 'รหัสกิจกรรม'];
    const csvContent = [
      headers.join(','),
      ...filteredRecords.map(record => [
        record.timestamp.toLocaleString('th-TH'),
        record.studentId,
        record.firstName,
        record.lastName,
        record.department,
        record.activityCode
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `activity_records_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tableColumns = [
    {
      id: 'timestamp',
      label: 'วันที่/เวลา',
      format: (value: Date) => (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {value.toLocaleDateString('th-TH')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {value.toLocaleTimeString('th-TH')}
          </Typography>
        </Box>
      ),
      hideOnMobile: false
    },
    {
      id: 'studentId',
      label: 'รหัสนักศึกษา',
      format: (value: string) => (
        <Typography variant="body2" fontWeight="600" color="primary.main" sx={{ fontFamily: 'monospace' }}>
          {value}
        </Typography>
      ),
      hideOnMobile: false
    },
    {
      id: 'fullName',
      label: 'ชื่อ-นามสกุล',
      format: (value: any, row: any) => (
        <Typography variant="body2" fontWeight="medium">
          {row.firstName} {row.lastName}
        </Typography>
      ),
      hideOnMobile: false
    },
    {
      id: 'department',
      label: 'สาขา',
      format: (value: string) => (
        <Chip label={value} size="small" variant="outlined" color="secondary" />
      ),
      hideOnMobile: true
    },
    {
      id: 'activityCode',
      label: 'รหัสกิจกรรม',
      format: (value: string) => (
        <Chip 
          label={value} 
          color="primary" 
          size="small" 
          sx={{ fontWeight: 700 }}
        />
      ),
      hideOnMobile: false
    }
  ];

  const renderActions = (record: any) => (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: isMobile ? 'flex-start' : 'center' }}>
      <Tooltip title="ดูรายละเอียด">
        <IconButton size="small" color="info">
          <ViewIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="ลบ">
        <IconButton size="small" color="error">
          <DeleteIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );

  return (
    <ResponsiveContainer>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          จัดการข้อมูลการเข้าร่วมกิจกรรม
        </Typography>
        <Typography variant="body1" color="text.secondary">
          ดูและจัดการข้อมูลการลงทะเบียนเข้าร่วมกิจกรรมในสังกัด {DEPARTMENT_LABELS[currentAdmin.department] || currentAdmin.department}
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="รายการทั้งหมด"
            value={stats.totalRecords}
            icon={<EventIcon />}
            color="#1976d2"
            subtitle="บันทึกการเข้าร่วม"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="นักศึกษา"
            value={stats.uniqueStudents}
            icon={<PeopleIcon />}
            color="#9c27b0"
            subtitle="คนที่เข้าร่วม"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="กิจกรรม"
            value={stats.uniqueActivities}
            icon={<EventIcon />}
            color="#2e7d32"
            subtitle="กิจกรรมทั้งหมด"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="วันนี้"
            value={stats.todayRecords}
            icon={<TodayIcon />}
            color="#ed6c02"
            subtitle="เข้าร่วมวันนี้"
          />
        </Grid>
      </Grid>

      {/* Filters and Actions */}
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
            label="ค้นหา"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="รหัสกิจกรรม, นักศึกษา, ชื่อ..."
            sx={{ minWidth: { xs: '100%', md: 300 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: filterText && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setFilterText('')}>
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          
          {/* Action Buttons */}
          <ButtonGroup 
            variant="contained" 
            size={isMobile ? "medium" : "small"}
            orientation={isMobile ? "horizontal" : "horizontal"}
            sx={{ flexShrink: 0 }}
          >
            <Button
              onClick={loadRecords}
              disabled={loading}
              startIcon={<RefreshIcon />}
            >
              รีเฟรช
            </Button>
            <Button
              onClick={exportToCSV}
              startIcon={<DownloadIcon />}
              color="success"
            >
              ส่งออก
            </Button>
          </ButtonGroup>
        </Box>
      </ResponsiveCard>

      {/* Records Table */}
      <ResponsiveCard>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventIcon />
            รายการลงทะเบียน
            <Chip 
              label={`${filteredRecords.length} รายการ`} 
              color="primary" 
              size="small" 
            />
          </Typography>
        </Box>

        <ResponsiveTable
          columns={tableColumns}
          data={filteredRecords.map(record => ({
            ...record,
            fullName: `${record.firstName} ${record.lastName}`
          }))}
          keyField="id"
          actions={renderActions}
          emptyMessage="ไม่มีข้อมูลการลงทะเบียน"
        />
      </ResponsiveCard>

      {/* Floating Action Button for Mobile */}
      {isMobile && (
        <Fab
          color="primary"
          onClick={loadRecords}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1000
          }}
        >
          <RefreshIcon />
        </Fab>
      )}
    </ResponsiveContainer>
  );
};