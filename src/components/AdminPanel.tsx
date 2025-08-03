'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Fab,
  Collapse,
  Avatar,
  Badge,
  Divider,
  Snackbar,
  LinearProgress,
  InputAdornment,
  ButtonGroup,
  Menu,
  MenuItem,
  AppBar,
  Toolbar,
  Container,
  Fade,
  Skeleton,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  ListItemText
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Settings as SettingsIcon,
  QrCode2 as QrCodeIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  Event as EventIcon,
  Today as TodayIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  Analytics as AnalyticsIcon,
  Security as SecurityIcon,
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  GetApp as GetAppIcon,
  FilterAlt as FilterAltIcon
} from '@mui/icons-material';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  where,
  increment
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AdminSettings, ActivityRecord } from '../types';
import QRCodeGenerator from './QRCodeGenerator';
import { generateRandomCode } from '../utils/validation';
import 'leaflet/dist/leaflet.css';
import LocationPicker from './LocationPicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

interface FilterState {
  search: string;
  activities: string[];
  departments: string[];
  faculties: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

const AdminPanel: React.FC = () => {
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({
    id: '',
    allowedLocation: {
      latitude: 7.0103,
      longitude: 100.4925,
      radius: 500,
      endTime: undefined,
      startTime: undefined
    },
    adminCode: 'ADMIN123',
    isActive: true
  });

  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ActivityRecord[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info' | 'warning'>('success');
  const [selectedRecord, setSelectedRecord] = useState<ActivityRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);

  // Enhanced filtering state
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    activities: [],
    departments: [],
    faculties: [],
    dateRange: {
      start: null,
      end: null
    }
  });

  // Available filter options
  const [availableActivities, setAvailableActivities] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availableFaculties, setAvailableFaculties] = useState<string[]>([]);

  const [stats, setStats] = useState({
    totalRecords: 0,
    uniqueStudents: 0,
    uniqueActivities: 0,
    todayRecords: 0
  });

  useEffect(() => {
    loadRecords();
    loadAdminSettings();
  }, []);

  useEffect(() => {
    filterRecords();
    calculateStats();
    updateFilterOptions();
  }, [records, filters]);

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setSnackbarOpen(true);
  };

  const loadAdminSettings = async () => {
    setLoadingProgress(25);
    try {
      const q = query(collection(db, 'adminSettings'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const settingsData = snapshot.docs[0].data() as AdminSettings;
        setAdminSettings({
          ...settingsData,
          id: snapshot.docs[0].id
        });
      }
      setLoadingProgress(50);
    } catch (error) {
      console.error('Error loading admin settings:', error);
      showMessage('เกิดข้อผิดพลาดในการโหลดการตั้งค่า', 'error');
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    setLoadingProgress(0);
    try {
      setLoadingProgress(30);
      const q = query(
        collection(db, 'activityRecords'),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      setLoadingProgress(70);
      const recordsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      })) as ActivityRecord[];
      setRecords(recordsData);
      setLoadingProgress(100);
      showMessage(`โหลดข้อมูลสำเร็จ ${recordsData.length} รายการ`, 'success');
    } catch (error) {
      console.error('Error loading records:', error);
      showMessage('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
    }
    setLoading(false);
    setTimeout(() => setLoadingProgress(0), 1000);
  };

  const updateFilterOptions = () => {
    const activities = [...new Set(records.map(r => r.activityCode))].sort();
    const departments = [...new Set(records.map(r => r.department))].sort();
    const faculties = [...new Set(records.map(r => (r as any).faculty || 'ไม่ระบุ'))].sort();
    
    setAvailableActivities(activities);
    setAvailableDepartments(departments);
    setAvailableFaculties(faculties);
  };

  const filterRecords = () => {
    let filtered = records;

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(record => 
        record.activityCode.toLowerCase().includes(searchTerm) ||
        record.studentId.includes(searchTerm) ||
        record.firstName.toLowerCase().includes(searchTerm) ||
        record.lastName.toLowerCase().includes(searchTerm) ||
        record.department.toLowerCase().includes(searchTerm) ||
        ((record as any).faculty && (record as any).faculty.toLowerCase().includes(searchTerm))
      );
    }

    // Activity filter
    if (filters.activities.length > 0) {
      filtered = filtered.filter(record => 
        filters.activities.includes(record.activityCode)
      );
    }

    // Department filter
    if (filters.departments.length > 0) {
      filtered = filtered.filter(record => 
        filters.departments.includes(record.department)
      );
    }

    // Faculty filter
    if (filters.faculties.length > 0) {
      filtered = filtered.filter(record => 
        filters.faculties.includes((record as any).faculty || 'ไม่ระบุ')
      );
    }

    // Date range filter
    if (filters.dateRange.start || filters.dateRange.end) {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.timestamp);
        const start = filters.dateRange.start;
        const end = filters.dateRange.end;
        
        if (start && end) {
          return recordDate >= start && recordDate <= end;
        } else if (start) {
          return recordDate >= start;
        } else if (end) {
          return recordDate <= end;
        }
        return true;
      });
    }

    setFilteredRecords(filtered);
  };

  const calculateStats = () => {
    const uniqueStudents = new Set(filteredRecords.map(r => r.studentId)).size;
    const uniqueActivities = new Set(filteredRecords.map(r => r.activityCode)).size;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRecords = filteredRecords.filter(r => {
      const recordDate = new Date(r.timestamp);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate.getTime() === today.getTime();
    }).length;

    setStats({
      totalRecords: filteredRecords.length,
      uniqueStudents,
      uniqueActivities,
      todayRecords
    });
  };

  const exportToCSV = (selectedOnly: boolean = false) => {
    const dataToExport = selectedOnly 
      ? filteredRecords.filter(record => selectedRecords.includes(record.id))
      : filteredRecords;

    if (selectedOnly && dataToExport.length === 0) {
      showMessage('กรุณาเลือกรายการที่ต้องการส่งออก', 'warning');
      return;
    }

    const headers = ['วันที่/เวลา', 'รหัสนักศึกษา', 'ชื่อ', 'นามสกุล', 'คณะ', 'สาขา', 'รหัสกิจกรรม'];
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(record => [
        record.timestamp.toLocaleString('th-TH'),
        record.studentId,
        record.firstName,
        record.lastName,
        (record as any).faculty || 'ไม่ระบุ',
        record.department,
        record.activityCode
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const filename = selectedOnly 
      ? `selected_records_${new Date().toISOString().split('T')[0]}.csv`
      : `activity_records_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    const exportType = selectedOnly ? 'ที่เลือก' : 'ทั้งหมด';
    showMessage(`ส่งออกข้อมูล${exportType} ${dataToExport.length} รายการสำเร็จ 📊`, 'success');
  };

  const deleteRecord = async (recordId: string) => {
    if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบรายการนี้?')) {
      try {
        const recordToDelete = records.find(r => r.id === recordId);
        
        // Delete the record
        await deleteDoc(doc(db, 'activityRecords', recordId));
        
        // Update currentParticipants count for the activity
        if (recordToDelete) {
          const activityQuery = query(
            collection(db, 'activities'),
            where('code', '==', recordToDelete.activityCode)
          );
          const activitySnapshot = await getDocs(activityQuery);
          
          if (!activitySnapshot.empty) {
            const activityDoc = activitySnapshot.docs[0];
            await updateDoc(doc(db, 'activities', activityDoc.id), {
              currentParticipants: increment(-1)
            });
          }
        }
        
        showMessage('ลบรายการสำเร็จและอัปเดตจำนวนผู้เข้าร่วมแล้ว 🗑️', 'success');
        loadRecords();
      } catch (error) {
        console.error('Error deleting record:', error);
        showMessage('เกิดข้อผิดพลาดในการลบ', 'error');
      }
    }
  };

  const deleteSelectedRecords = async () => {
    if (selectedRecords.length === 0) {
      showMessage('กรุณาเลือกรายการที่ต้องการลบ', 'warning');
      return;
    }

    if (window.confirm(`คุณแน่ใจหรือไม่ที่จะลบรายการที่เลือก ${selectedRecords.length} รายการ?`)) {
      try {
        setLoading(true);
        
        // Group records by activity code for batch updating
        const activityCounts: { [key: string]: number } = {};
        
        for (const recordId of selectedRecords) {
          const recordToDelete = records.find(r => r.id === recordId);
          if (recordToDelete) {
            activityCounts[recordToDelete.activityCode] = 
              (activityCounts[recordToDelete.activityCode] || 0) + 1;
          }
          
          await deleteDoc(doc(db, 'activityRecords', recordId));
        }
        
        // Update currentParticipants for each affected activity
        for (const [activityCode, count] of Object.entries(activityCounts)) {
          const activityQuery = query(
            collection(db, 'activities'),
            where('code', '==', activityCode)
          );
          const activitySnapshot = await getDocs(activityQuery);
          
          if (!activitySnapshot.empty) {
            const activityDoc = activitySnapshot.docs[0];
            await updateDoc(doc(db, 'activities', activityDoc.id), {
              currentParticipants: increment(-count)
            });
          }
        }
        
        setSelectedRecords([]);
        showMessage(`ลบรายการ ${selectedRecords.length} รายการสำเร็จและอัปเดตจำนวนผู้เข้าร่วมแล้ว`, 'success');
        loadRecords();
      } catch (error) {
        console.error('Error deleting selected records:', error);
        showMessage('เกิดข้อผิดพลาดในการลบรายการที่เลือก', 'error');
      }
      setLoading(false);
    }
  };

  const viewRecordDetails = (record: ActivityRecord) => {
    setSelectedRecord(record);
    setDialogOpen(true);
  };

  const clearAllFilters = () => {
    setFilters({
      search: '',
      activities: [],
      departments: [],
      faculties: [],
      dateRange: {
        start: null,
        end: null
      }
    });
    setSelectedRecords([]);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedRecords(filteredRecords.map(record => record.id));
    } else {
      setSelectedRecords([]);
    }
  };

  const handleSelectRecord = (recordId: string) => {
    setSelectedRecords(prev => 
      prev.includes(recordId)
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  };

  const StatCard = ({ title, value, icon, color, subtitle }: any) => (
    <Fade in timeout={500}>
      <Card sx={{ 
        height: '100%',
        background: `linear-gradient(135deg, ${color}08 0%, ${color}15 100%)`,
        border: `2px solid ${color}20`,
        borderRadius: 3,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-8px) scale(1.02)',
          boxShadow: `0 20px 40px -12px ${color}30`,
          border: `2px solid ${color}40`
        }
      }}>
        <CardContent sx={{ 
          textAlign: 'center', 
          py: 4,
          px: 3,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <Box sx={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 100,
            height: 100,
            background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
            borderRadius: '50%',
            zIndex: 0
          }} />
          
          <Avatar sx={{ 
            bgcolor: color, 
            width: 64, 
            height: 64, 
            mx: 'auto', 
            mb: 3,
            boxShadow: `0 8px 32px ${color}40`,
            border: `3px solid ${color}20`,
            position: 'relative',
            zIndex: 1
          }}>
            {icon}
          </Avatar>
          
          <Typography 
            variant="h2" 
            sx={{
              color: color,
              fontWeight: 800,
              mb: 1,
              fontSize: { xs: '2.5rem', sm: '3rem' },
              textShadow: `0 2px 8px ${color}20`,
              position: 'relative',
              zIndex: 1
            }}
          >
            {value}
          </Typography>
          
          <Typography 
            variant="h6" 
            sx={{
              color: 'text.primary',
              fontWeight: 600,
              mb: 1,
              position: 'relative',
              zIndex: 1
            }}
          >
            {title}
          </Typography>
          
          {subtitle && (
            <Typography 
              variant="body2" 
              sx={{
                color: 'text.secondary',
                fontWeight: 400,
                position: 'relative',
                zIndex: 1
              }}
            >
              {subtitle}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Fade>
  );

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative'
    }}>
      {/* Background Pattern */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 40% 80%, rgba(120, 219, 255, 0.3) 0%, transparent 50%)
        `,
        zIndex: 0
      }} />

      {/* App Bar */}
      <AppBar 
        position="static" 
        elevation={0} 
        sx={{ 
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          position: 'relative',
          zIndex: 2
        }}
      >
        <Toolbar sx={{ py: 1 }}>
          <Avatar sx={{ 
            bgcolor: 'rgba(255, 255, 255, 0.2)', 
            mr: 2,
            backdropFilter: 'blur(10px)'
          }}>
            <AnalyticsIcon sx={{ color: 'white' }} />
          </Avatar>
          <Typography 
            variant="h4" 
            component="div" 
            sx={{ 
              flexGrow: 1, 
              fontWeight: 700,
              color: 'white',
              textShadow: '0 2px 10px rgba(0,0,0,0.3)'
            }}
          >
            ระบบจัดการกิจกรรม
          </Typography>
          <Chip 
            label={adminSettings.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"} 
            sx={{
              bgcolor: adminSettings.isActive ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)',
              color: 'white',
              fontWeight: 600,
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}
            icon={adminSettings.isActive ? <CheckCircleIcon /> : <WarningIcon />}
          />
        </Toolbar>
      </AppBar>

      {/* Loading Progress */}
      {loadingProgress > 0 && loadingProgress < 100 && (
        <LinearProgress 
          variant="determinate" 
          value={loadingProgress}
          sx={{
            height: 6,
            background: 'rgba(255, 255, 255, 0.1)',
            '& .MuiLinearProgress-bar': {
              background: 'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)'
            }
          }}
        />
      )}

      <Container maxWidth="xl" sx={{ py: 4, position: 'relative', zIndex: 1 }}>
        {/* Statistics Cards */}
        <Grid container spacing={4} sx={{ mb: 5 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="รายการทั้งหมด"
              value={stats.totalRecords}
              icon={<EventIcon sx={{ fontSize: 32 }} />}
              color="#1976d2"
              subtitle="บันทึกการเข้าร่วม"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="นักศึกษา"
              value={stats.uniqueStudents}
              icon={<PeopleIcon sx={{ fontSize: 32 }} />}
              color="#9c27b0"
              subtitle="คนที่เข้าร่วม"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="กิจกรรม"
              value={stats.uniqueActivities}
              icon={<EventIcon sx={{ fontSize: 32 }} />}
              color="#2e7d32"
              subtitle="กิจกรรมทั้งหมด"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="วันนี้"
              value={stats.todayRecords}
              icon={<TodayIcon sx={{ fontSize: 32 }} />}
              color="#ed6c02"
              subtitle="เข้าร่วมวันนี้"
            />
          </Grid>
        </Grid>

        <Grid container spacing={4}>
          {/* QR Code Section */}
          <Grid item xs={12} lg={6}>
            <QRCodeGenerator baseUrl={typeof window !== 'undefined' ? window.location.origin : ''} />
          </Grid>

          {/* Enhanced Filter Panel */}
          <Grid item xs={12} lg={6}>
            <Card sx={{ 
              height: '100%',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              borderRadius: 3,
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 20px 40px -12px rgba(0,0,0,0.15)'
            }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Avatar sx={{ 
                    bgcolor: 'secondary.main', 
                    mr: 2,
                    width: 48,
                    height: 48
                  }}>
                    <FilterAltIcon />
                  </Avatar>
                  <Typography variant="h5" fontWeight="bold" color="secondary">
                    ตัวกรองข้อมูล
                  </Typography>
                </Box>
                
                <Grid container spacing={2}>
                  {/* Search Filter */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="ค้นหา"
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      placeholder="รหัสกิจกรรม, นักศึกษา, ชื่อ, สาขา..."
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon color="action" />
                          </InputAdornment>
                        ),
                        endAdornment: filters.search && (
                          <InputAdornment position="end">
                            <IconButton 
                              size="small" 
                              onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                            >
                              <ClearIcon />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>

                  {/* Activity Filter */}
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>กิจกรรม</InputLabel>
                      <Select
                        multiple
                        value={filters.activities}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          activities: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value 
                        }))}
                        input={<OutlinedInput label="กิจกรรม" />}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => (
                              <Chip key={value} size="small" label={value} />
                            ))}
                          </Box>
                        )}
                      >
                        {availableActivities.map((activity) => (
                          <MenuItem key={activity} value={activity}>
                            <Checkbox checked={filters.activities.indexOf(activity) > -1} />
                            <ListItemText primary={activity} />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Department Filter */}
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>สาขา</InputLabel>
                      <Select
                        multiple
                        value={filters.departments}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          departments: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value 
                        }))}
                        input={<OutlinedInput label="สาขา" />}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => (
                              <Chip key={value} size="small" label={value} />
                            ))}
                          </Box>
                        )}
                      >
                        {availableDepartments.map((dept) => (
                          <MenuItem key={dept} value={dept}>
                            <Checkbox checked={filters.departments.indexOf(dept) > -1} />
                            <ListItemText primary={dept} />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Faculty Filter */}
                  <Grid item xs={12}>
                    <FormControl fullWidth size="small">
                      <InputLabel>คณะ</InputLabel>
                      <Select
                        multiple
                        value={filters.faculties}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          faculties: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value 
                        }))}
                        input={<OutlinedInput label="คณะ" />}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => (
                              <Chip key={value} size="small" label={value} />
                            ))}
                          </Box>
                        )}
                      >
                        {availableFaculties.map((faculty) => (
                          <MenuItem key={faculty} value={faculty}>
                            <Checkbox checked={filters.faculties.indexOf(faculty) > -1} />
                            <ListItemText primary={faculty} />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Clear Filters Button */}
                  <Grid item xs={12}>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="secondary"
                      startIcon={<ClearIcon />}
                      onClick={clearAllFilters}
                      sx={{ mt: 1 }}
                    >
                      ล้างตัวกรองทั้งหมด
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Records Table */}
          <Grid item xs={12}>
            <Card sx={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              borderRadius: 3,
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 20px 40px -12px rgba(0,0,0,0.15)'
            }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 48, height: 48 }}>
                      <EventIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h5" fontWeight="bold" color="primary">
                        รายการลงทะเบียน
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        จัดการข้อมูลการเข้าร่วมกิจกรรม
                      </Typography>
                    </Box>
                    <Chip 
                      label={`${filteredRecords.length} รายการ`} 
                      color="primary" 
                      sx={{ ml: 3, fontWeight: 600 }} 
                    />
                    {selectedRecords.length > 0 && (
                      <Chip 
                        label={`เลือก ${selectedRecords.length} รายการ`} 
                        color="secondary" 
                        sx={{ ml: 1, fontWeight: 600 }} 
                      />
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <ButtonGroup variant="contained" sx={{ borderRadius: 2 }}>
                      <Tooltip title="รีเฟรช">
                        <span>
                          <Button
                            onClick={loadRecords} 
                            disabled={loading}
                            startIcon={<RefreshIcon />}
                            sx={{ 
                              bgcolor: 'primary.main',
                              '&:hover': { bgcolor: 'primary.dark' }
                            }}
                          >
                            รีเฟรช
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title="ส่งออกทั้งหมด">
                        <Button 
                          onClick={() => exportToCSV(false)}
                          startIcon={<DownloadIcon />}
                          sx={{ 
                            bgcolor: 'success.main',
                            '&:hover': { bgcolor: 'success.dark' }
                          }}
                        >
                          ส่งออกทั้งหมด
                        </Button>
                      </Tooltip>
                      <Tooltip title="ส่งออกที่เลือก">
                        <span>
                          <Button 
                            onClick={() => exportToCSV(true)}
                            disabled={selectedRecords.length === 0}
                            startIcon={<GetAppIcon />}
                            sx={{ 
                              bgcolor: 'info.main',
                              '&:hover': { bgcolor: 'info.dark' }
                            }}
                          >
                            ส่งออกที่เลือก
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title="ลบที่เลือก">
                        <span>
                          <Button 
                            onClick={deleteSelectedRecords}
                            disabled={selectedRecords.length === 0}
                            startIcon={<DeleteIcon />}
                            sx={{ 
                              bgcolor: 'error.main',
                              '&:hover': { bgcolor: 'error.dark' }
                            }}
                          >
                            ลบที่เลือก
                          </Button>
                        </span>
                      </Tooltip>
                    </ButtonGroup>
                  </Box>
                </Box>
                
                <TableContainer 
                  component={Paper} 
                  sx={{ 
                    maxHeight: 600,
                    borderRadius: 2,
                    border: '1px solid rgba(0,0,0,0.08)',
                    '& .MuiTableHead-root': {
                      bgcolor: 'grey.100'
                    }
                  }}
                >
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                          <Checkbox
                            indeterminate={selectedRecords.length > 0 && selectedRecords.length < filteredRecords.length}
                            checked={filteredRecords.length > 0 && selectedRecords.length === filteredRecords.length}
                            onChange={handleSelectAll}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>วันที่/เวลา</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>รหัสนักศึกษา</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>ชื่อ-นามสกุล</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>คณะ</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>สาขา</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>รหัสกิจกรรม</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>การดำเนินการ</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        Array.from(new Array(5)).map((_, index) => (
                          <TableRow key={index}>
                            {Array.from(new Array(8)).map((_, cellIndex) => (
                              <TableCell key={cellIndex}>
                                <Skeleton variant="text" height={40} />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        filteredRecords.map((record, index) => (
                          <TableRow 
                            key={record.id} 
                            hover
                            sx={{
                              '&:hover': {
                                bgcolor: 'rgba(25, 118, 210, 0.04)',
                                transform: 'scale(1.001)',
                                transition: 'all 0.2s ease'
                              },
                              bgcolor: selectedRecords.includes(record.id) ? 'rgba(25, 118, 210, 0.08)' : 'inherit'
                            }}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedRecords.includes(record.id)}
                                onChange={() => handleSelectRecord(record.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {record.timestamp.toLocaleDateString('th-TH')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {record.timestamp.toLocaleTimeString('th-TH')}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight="600" color="primary.main">
                                {record.studentId}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {record.firstName} {record.lastName}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={(record as any).faculty || 'ไม่ระบุ'} 
                                size="small" 
                                variant="outlined"
                                color="info"
                                sx={{ fontWeight: 500 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={record.department} 
                                size="small" 
                                variant="outlined"
                                color="secondary"
                                sx={{ fontWeight: 500 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={record.activityCode} 
                                color="primary" 
                                size="small" 
                                sx={{ 
                                  fontWeight: 700,
                                  background: 'linear-gradient(45deg, #1976d2, #42a5f5)'
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Tooltip title="ดูรายละเอียด">
                                  <IconButton
                                    size="small"
                                    onClick={() => viewRecordDetails(record)}
                                    sx={{
                                      color: 'info.main',
                                      '&:hover': { 
                                        bgcolor: 'info.light',
                                        color: 'white',
                                        transform: 'scale(1.1)'
                                      }
                                    }}
                                  >
                                    <ViewIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="ลบ">
                                  <IconButton
                                    size="small"
                                    onClick={() => deleteRecord(record.id)}
                                    sx={{
                                      color: 'error.main',
                                      '&:hover': { 
                                        bgcolor: 'error.light',
                                        color: 'white',
                                        transform: 'scale(1.1)'
                                      }
                                    }}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Summary Row */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  mt: 3, 
                  p: 2, 
                  bgcolor: 'grey.50', 
                  borderRadius: 2 
                }}>
                  <Typography variant="body2" color="text.secondary">
                    แสดง {filteredRecords.length} รายการจากทั้งหมด {records.length} รายการ
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    เลือกแล้ว {selectedRecords.length} รายการ
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* Enhanced Record Details Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)'
          }
        }}
      >
        {selectedRecord && (
          <>
            <DialogTitle sx={{ 
              bgcolor: 'primary.main', 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}>
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                <ViewIcon />
              </Avatar>
              รายละเอียดการลงทะเบียน
            </DialogTitle>
            <DialogContent sx={{ p: 4 }}>
              <Grid container spacing={4} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    รหัสนักศึกษา
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    {selectedRecord.studentId}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    รหัสกิจกรรม
                  </Typography>
                  <Chip 
                    label={selectedRecord.activityCode} 
                    color="primary" 
                    sx={{ fontWeight: 'bold', fontSize: '1rem' }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    ชื่อ-นามสกุล
                  </Typography>
                  <Typography variant="h6" fontWeight="medium">
                    {selectedRecord.firstName} {selectedRecord.lastName}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    คณะ
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {(selectedRecord as any).faculty || 'ไม่ระบุ'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    สาขาวิชา
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedRecord.department}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    วันที่ลงทะเบียน
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedRecord.timestamp.toLocaleDateString('th-TH')}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    เวลาลงทะเบียน
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedRecord.timestamp.toLocaleTimeString('th-TH')}
                  </Typography>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1 }}>
              <Button 
                onClick={() => setDialogOpen(false)}
                variant="outlined"
                sx={{ borderRadius: 2 }}
              >
                ปิด
              </Button>
              <Button 
                onClick={() => {
                  deleteRecord(selectedRecord.id);
                  setDialogOpen(false);
                }}
                color="error"
                variant="contained"
                startIcon={<DeleteIcon />}
                sx={{ borderRadius: 2 }}
              >
                ลบรายการ
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Enhanced Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={messageType}
          variant="filled"
          sx={{ 
            minWidth: 350,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            backdropFilter: 'blur(20px)'
          }}
        >
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminPanel;