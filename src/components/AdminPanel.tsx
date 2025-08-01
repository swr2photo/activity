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
  Skeleton
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
  Warning as WarningIcon
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
  where
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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info' | 'warning'>('success');
  const [selectedRecord, setSelectedRecord] = useState<ActivityRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterActivityCode, setFilterActivityCode] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

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
  }, [records, filterActivityCode]);

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

  const filterRecords = () => {
    if (!filterActivityCode) {
      setFilteredRecords(records);
    } else {
      setFilteredRecords(
        records.filter(record => 
          record.activityCode.toLowerCase().includes(filterActivityCode.toLowerCase()) ||
          record.studentId.includes(filterActivityCode) ||
          record.firstName.toLowerCase().includes(filterActivityCode.toLowerCase()) ||
          record.lastName.toLowerCase().includes(filterActivityCode.toLowerCase())
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
    showMessage(`ส่งออกข้อมูล ${filteredRecords.length} รายการสำเร็จ 📊`, 'success');
  };

  const deleteRecord = async (recordId: string) => {
    if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบรายการนี้?')) {
      try {
        await deleteDoc(doc(db, 'activityRecords', recordId));
        showMessage('ลบรายการสำเร็จ 🗑️', 'success');
        loadRecords();
      } catch (error) {
        console.error('Error deleting record:', error);
        showMessage('เกิดข้อผิดพลาดในการลบ', 'error');
      }
    }
  };

  const viewRecordDetails = (record: ActivityRecord) => {
    setSelectedRecord(record);
    setDialogOpen(true);
  };

  const clearFilter = () => {
    setFilterActivityCode('');
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
          {/* Background decoration */}
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

          {/* Additional Analytics Card */}
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
                    bgcolor: 'primary.main', 
                    mr: 2,
                    width: 48,
                    height: 48
                  }}>
                    <AnalyticsIcon />
                  </Avatar>
                  <Typography variant="h5" fontWeight="bold" color="primary">
                    สถิติด่วน
                  </Typography>
                </Box>
                
                <Grid container spacing={3}>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                      <Typography variant="h4" color="success.main" fontWeight="bold">
                        {stats.todayRecords}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        เข้าร่วมวันนี้
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                      <Typography variant="h4" color="info.main" fontWeight="bold">
                        {Math.round((stats.todayRecords / stats.totalRecords) * 100) || 0}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        สัดส่วนวันนี้
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
                
                <Divider sx={{ my: 3 }} />
                
                <Typography variant="body1" color="text.secondary" textAlign="center">
                  ข้อมูลการเข้าร่วมกิจกรรมแบบเรียลไทม์
                </Typography>
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
                  </Box>

                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                      size="small"
                      label="ค้นหา"
                      value={filterActivityCode}
                      onChange={(e) => setFilterActivityCode(e.target.value)}
                      placeholder="รหัสกิจกรรม, นักศึกษา, ชื่อ..."
                      sx={{ 
                        minWidth: 300,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          bgcolor: 'rgba(255, 255, 255, 0.8)'
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon color="action" />
                          </InputAdornment>
                        ),
                        endAdornment: filterActivityCode && (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={clearFilter}>
                              <ClearIcon />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                    
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
                      <Tooltip title="ส่งออก CSV">
                        <Button 
                          onClick={exportToCSV}
                          startIcon={<DownloadIcon />}
                          sx={{ 
                            bgcolor: 'success.main',
                            '&:hover': { bgcolor: 'success.dark' }
                          }}
                        >
                          ส่งออก
                        </Button>
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
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>วันที่/เวลา</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>รหัสนักศึกษา</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>ชื่อ-นามสกุล</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>สาขา</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>รหัสกิจกรรม</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>การดำเนินการ</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        Array.from(new Array(5)).map((_, index) => (
                          <TableRow key={index}>
                            {Array.from(new Array(6)).map((_, cellIndex) => (
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
                              }
                            }}
                          >
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
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* Enhanced Record Details Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
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
            <DialogContent sx={{ p: 3 }}>
              <Grid container spacing={3} sx={{ mt: 1 }}>
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
                    {selectedRecord.timestamp.toLocaleDateString('th-TH')} เวลา {selectedRecord.timestamp.toLocaleTimeString('th-TH')}
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
                onClick={() => deleteRecord(selectedRecord.id)}
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