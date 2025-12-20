'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
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
  Snackbar,
  LinearProgress,
  InputAdornment,
  ButtonGroup,
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
  ListItemText,
  Avatar,
  MenuItem,
} from '@mui/material';

import Grid from '@mui/material/Grid';

import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Analytics as AnalyticsIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  GetApp as GetAppIcon,
  FilterAlt as FilterAltIcon,
  Event as EventIcon,
  People as PeopleIcon,
  Today as TodayIcon,
} from '@mui/icons-material';

import { collection, getDocs, query, orderBy, updateDoc, doc, deleteDoc, where, increment, limit } from 'firebase/firestore';

import { db } from '../lib/firebase';
import { AdminSettings, ActivityRecord } from '../types';
import QRCodeGenerator from './QRCodeGenerator';

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
      startTime: undefined,
    },
    adminCode: 'ADMIN123',
    isActive: true,
  });

  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info' | 'warning'>('success');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState<ActivityRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [loadingProgress, setLoadingProgress] = useState(0);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    activities: [],
    departments: [],
    faculties: [],
    dateRange: { start: null, end: null },
  });

  const showMessage = useCallback((msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setSnackbarOpen(true);
  }, []);

  const loadAdminSettings = useCallback(async () => {
    setLoadingProgress(20);
    try {
      const q = query(collection(db, 'adminSettings'), orderBy('createdAt', 'desc'), limit(1));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const settingsData = snapshot.docs[0].data() as AdminSettings;
        setAdminSettings({ ...settingsData, id: snapshot.docs[0].id });
      }
      setLoadingProgress(45);
    } catch (error) {
      console.error('Error loading admin settings:', error);
      showMessage('เกิดข้อผิดพลาดในการโหลดการตั้งค่า', 'error');
    }
  }, [showMessage]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setLoadingProgress(0);
    try {
      setLoadingProgress(25);
      const q = query(collection(db, 'activityRecords'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);

      setLoadingProgress(70);
      const recordsData = snapshot.docs.map((d) => {
        const raw = d.data() as any;
        const ts = raw.timestamp?.toDate?.() ? raw.timestamp.toDate() : raw.timestamp ? new Date(raw.timestamp) : new Date();
        return { id: d.id, ...raw, timestamp: ts };
      }) as ActivityRecord[];

      setRecords(recordsData);
      setLoadingProgress(100);
      showMessage(`โหลดข้อมูลสำเร็จ ${recordsData.length} รายการ`, 'success');
    } catch (error) {
      console.error('Error loading records:', error);
      showMessage('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
    } finally {
      setLoading(false);
      setTimeout(() => setLoadingProgress(0), 800);
    }
  }, [showMessage]);

  useEffect(() => {
    loadRecords();
    loadAdminSettings();
  }, [loadRecords, loadAdminSettings]);

  /** -------------------------
   * Derived data (performance)
   * ------------------------*/
  const availableActivities = useMemo(() => [...new Set(records.map((r) => r.activityCode).filter(Boolean))].sort(), [records]);
  const availableDepartments = useMemo(() => [...new Set(records.map((r) => r.department).filter(Boolean))].sort(), [records]);
  const availableFaculties = useMemo(() => [...new Set(records.map((r) => (((r as any).faculty || 'ไม่ระบุ') as string)))].sort(), [records]);

  const filteredRecords = useMemo(() => {
    let filtered = records;

    // Search
    const search = filters.search.trim().toLowerCase();
    if (search) {
      filtered = filtered.filter((record) => {
        const faculty = ((record as any).faculty || 'ไม่ระบุ') as string;
        return (
          (record.activityCode || '').toLowerCase().includes(search) ||
          (record.studentId || '').toLowerCase().includes(search) ||
          (record.firstName || '').toLowerCase().includes(search) ||
          (record.lastName || '').toLowerCase().includes(search) ||
          (record.department || '').toLowerCase().includes(search) ||
          faculty.toLowerCase().includes(search)
        );
      });
    }

    // Activities
    if (filters.activities.length > 0) {
      const set = new Set(filters.activities);
      filtered = filtered.filter((r) => set.has(r.activityCode));
    }

    // Departments
    if (filters.departments.length > 0) {
      const set = new Set(filters.departments);
      filtered = filtered.filter((r) => set.has(r.department));
    }

    // Faculties
    if (filters.faculties.length > 0) {
      const set = new Set(filters.faculties);
      filtered = filtered.filter((r) => set.has(((r as any).faculty || 'ไม่ระบุ') as string));
    }

    // Date range
    if (filters.dateRange.start || filters.dateRange.end) {
      const start = filters.dateRange.start ? new Date(filters.dateRange.start) : null;
      const end = filters.dateRange.end ? new Date(filters.dateRange.end) : null;

      filtered = filtered.filter((r) => {
        const d = new Date(r.timestamp);
        if (start && end) return d >= start && d <= end;
        if (start) return d >= start;
        if (end) return d <= end;
        return true;
      });
    }

    return filtered;
  }, [records, filters]);

  const stats = useMemo(() => {
    const uniqueStudents = new Set(filteredRecords.map((r) => r.studentId)).size;
    const uniqueActivities = new Set(filteredRecords.map((r) => r.activityCode)).size;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecords = filteredRecords.filter((r) => {
      const d = new Date(r.timestamp);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length;

    return { totalRecords: filteredRecords.length, uniqueStudents, uniqueActivities, todayRecords };
  }, [filteredRecords]);

  /** -------------------------
   * Actions
   * ------------------------*/
  const clearAllFilters = useCallback(() => {
    setFilters({ search: '', activities: [], departments: [], faculties: [], dateRange: { start: null, end: null } });
    setSelectedRecords([]);
  }, []);

  const handleSelectAll = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSelectedRecords(event.target.checked ? filteredRecords.map((r) => r.id) : []);
    },
    [filteredRecords]
  );

  const handleSelectRecord = useCallback((recordId: string) => {
    setSelectedRecords((prev) => (prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId]));
  }, []);

  const viewRecordDetails = useCallback((record: ActivityRecord) => {
    setSelectedRecord(record);
    setDialogOpen(true);
  }, []);

  const exportToCSV = useCallback(
    (selectedOnly: boolean = false) => {
      const dataToExport = selectedOnly ? filteredRecords.filter((r) => selectedRecords.includes(r.id)) : filteredRecords;

      if (selectedOnly && dataToExport.length === 0) {
        showMessage('กรุณาเลือกรายการที่ต้องการส่งออก', 'warning');
        return;
      }

      const headers = ['วันที่/เวลา', 'รหัสนักศึกษา', 'ชื่อ', 'นามสกุล', 'คณะ', 'สาขา', 'รหัสกิจกรรม'];
      const csvContent = [headers.join(',')]
        .concat(
          dataToExport.map((r) =>
            [
              new Date(r.timestamp).toLocaleString('th-TH'),
              r.studentId,
              r.firstName,
              r.lastName,
              (r as any).faculty || 'ไม่ระบุ',
              r.department,
              r.activityCode,
            ].join(',')
          )
        )
        .join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;

      const filename = selectedOnly
        ? `selected_records_${new Date().toISOString().split('T')[0]}.csv`
        : `activity_records_${new Date().toISOString().split('T')[0]}.csv`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      showMessage(`ส่งออกข้อมูล${selectedOnly ? 'ที่เลือก' : 'ทั้งหมด'} ${dataToExport.length} รายการสำเร็จ`, 'success');
    },
    [filteredRecords, selectedRecords, showMessage]
  );

  /**
   * ลด currentParticipants ให้ถูกคอลเลกชัน
   * - ถ้ามี activityDocId ใน record => activityQRCodes/{docId}
   * - fallback: query activityQRCodes ด้วย activityCode
   */
  const decrementParticipants = useCallback(async (record: ActivityRecord, by: number) => {
    const docId = (record as any).activityDocId as string | undefined;

    if (docId) {
      try {
        await updateDoc(doc(db, 'activityQRCodes', docId), { currentParticipants: increment(-by) });
        return;
      } catch (e) {
        console.error('decrementParticipants by docId failed', e);
      }
    }

    try {
      const qAct = query(collection(db, 'activityQRCodes'), where('activityCode', '==', record.activityCode), limit(1));
      const snap = await getDocs(qAct);
      if (!snap.empty) {
        await updateDoc(doc(db, 'activityQRCodes', snap.docs[0].id), { currentParticipants: increment(-by) });
      }
    } catch (e) {
      console.error('decrementParticipants fallback failed', e);
    }
  }, []);

  const deleteRecord = useCallback(
    async (recordId: string) => {
      const rec = records.find((r) => r.id === recordId);
      if (!rec) return;

      if (!window.confirm('คุณแน่ใจหรือไม่ที่จะลบรายการนี้?')) return;

      try {
        await decrementParticipants(rec, 1);
        await deleteDoc(doc(db, 'activityRecords', recordId));
        showMessage('ลบรายการสำเร็จและอัปเดตจำนวนผู้เข้าร่วมแล้ว', 'success');
        await loadRecords();
      } catch (error) {
        console.error('Error deleting record:', error);
        showMessage('เกิดข้อผิดพลาดในการลบ: ' + (error as Error).message, 'error');
      }
    },
    [records, decrementParticipants, showMessage, loadRecords]
  );

  const deleteSelectedRecords = useCallback(async () => {
    if (selectedRecords.length === 0) {
      showMessage('กรุณาเลือกรายการที่ต้องการลบ', 'warning');
      return;
    }
    if (!window.confirm(`คุณแน่ใจหรือไม่ที่จะลบรายการที่เลือก ${selectedRecords.length} รายการ?`)) return;

    try {
      setLoading(true);
      setLoadingProgress(10);

      const toDelete = records.filter((r) => selectedRecords.includes(r.id));

      // group by activityDocId / activityCode เพื่อ decrement แบบรวม
      const byKey = new Map<string, { record: ActivityRecord; count: number }>();
      for (const r of toDelete) {
        const key = (r as any).activityDocId ? `doc:${(r as any).activityDocId}` : `code:${r.activityCode}`;
        const existing = byKey.get(key);
        if (existing) existing.count += 1;
        else byKey.set(key, { record: r, count: 1 });
      }

      // decrement counters
      let idx = 0;
      for (const { record, count } of byKey.values()) {
        idx += 1;
        setLoadingProgress(10 + (idx / Math.max(1, byKey.size)) * 40);
        await decrementParticipants(record, count);
      }

      // delete records
      let deleted = 0;
      for (const r of toDelete) {
        try {
          await deleteDoc(doc(db, 'activityRecords', r.id));
          deleted += 1;
        } catch (e) {
          console.error('delete record failed', r.id, e);
        }
        setLoadingProgress(55 + (deleted / Math.max(1, toDelete.length)) * 40);
      }

      setSelectedRecords([]);
      showMessage(`ลบรายการ ${deleted} รายการสำเร็จและอัปเดตจำนวนผู้เข้าร่วมแล้ว`, 'success');

      setLoadingProgress(100);
      await loadRecords();
    } catch (error) {
      console.error('Error deleting selected records:', error);
      showMessage('เกิดข้อผิดพลาดในการลบรายการที่เลือก: ' + (error as Error).message, 'error');
    } finally {
      setLoading(false);
      setTimeout(() => setLoadingProgress(0), 800);
    }
  }, [selectedRecords, records, decrementParticipants, showMessage, loadRecords]);

  const StatCard = ({ title, value, icon, color, subtitle }: any) => (
    <Fade in timeout={500}>
      <Card
        sx={{
          height: '100%',
          background: `linear-gradient(135deg, ${color}08 0%, ${color}15 100%)`,
          border: `2px solid ${color}20`,
          borderRadius: 3,
          transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': { transform: 'translateY(-6px)', boxShadow: `0 18px 36px -14px ${color}30`, border: `2px solid ${color}40` },
        }}
      >
        <CardContent sx={{ textAlign: 'center', py: 4, px: 3, position: 'relative', overflow: 'hidden' }}>
          <Box
            sx={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 100,
              height: 100,
              background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
              borderRadius: '50%',
              zIndex: 0,
            }}
          />
          <Avatar
            sx={{
              bgcolor: color,
              width: 64,
              height: 64,
              mx: 'auto',
              mb: 3,
              boxShadow: `0 8px 32px ${color}40`,
              border: `3px solid ${color}20`,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {icon}
          </Avatar>

          <Typography variant="h2" sx={{ color, fontWeight: 800, mb: 1, fontSize: { xs: '2.5rem', sm: '3rem' }, position: 'relative', zIndex: 1 }}>
            {value}
          </Typography>

          <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 650, mb: 1, position: 'relative', zIndex: 1 }}>
            {title}
          </Typography>

          {subtitle && (
            <Typography variant="body2" sx={{ color: 'text.secondary', position: 'relative', zIndex: 1 }}>
              {subtitle}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Fade>
  );

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', position: 'relative' }}>
      {/* Background Pattern */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(120, 219, 255, 0.3) 0%, transparent 50%)
          `,
          zIndex: 0,
        }}
      />

      {/* App Bar */}
      <AppBar position="static" elevation={0} sx={{ background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255, 255, 255, 0.2)', position: 'relative', zIndex: 2 }}>
        <Toolbar sx={{ py: 1 }}>
          <Avatar sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', mr: 2, backdropFilter: 'blur(10px)' }}>
            <AnalyticsIcon sx={{ color: 'white' }} />
          </Avatar>
          <Typography variant="h4" component="div" sx={{ flexGrow: 1, fontWeight: 700, color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
            ระบบจัดการกิจกรรม
          </Typography>
          <Chip
            label={adminSettings.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
            icon={adminSettings.isActive ? <CheckCircleIcon /> : <WarningIcon />}
            sx={{
              bgcolor: adminSettings.isActive ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)',
              color: 'white',
              fontWeight: 600,
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
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
            '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)' },
          }}
        />
      )}

      <Container maxWidth="xl" sx={{ py: 4, position: 'relative', zIndex: 1 }}>
        {/* Statistics Cards */}
        <Grid container spacing={4} sx={{ mb: 5 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="รายการทั้งหมด" value={stats.totalRecords} icon={<EventIcon sx={{ fontSize: 32 }} />} color="#1976d2" subtitle="บันทึกการเข้าร่วม" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="นักศึกษา" value={stats.uniqueStudents} icon={<PeopleIcon sx={{ fontSize: 32 }} />} color="#9c27b0" subtitle="คนที่เข้าร่วม" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="กิจกรรม" value={stats.uniqueActivities} icon={<EventIcon sx={{ fontSize: 32 }} />} color="#2e7d32" subtitle="กิจกรรมทั้งหมด" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="วันนี้" value={stats.todayRecords} icon={<TodayIcon sx={{ fontSize: 32 }} />} color="#ed6c02" subtitle="เข้าร่วมวันนี้" />
          </Grid>
        </Grid>

        <Grid container spacing={4}>
          {/* QR Code Section */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <QRCodeGenerator baseUrl={typeof window !== 'undefined' ? window.location.origin : ''} />
          </Grid>

          {/* Filter Panel */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <Card sx={{ height: '100%', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(20px)', borderRadius: 3, border: '1px solid rgba(255, 255, 255, 0.3)', boxShadow: '0 20px 40px -12px rgba(0,0,0,0.15)' }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Avatar sx={{ bgcolor: 'secondary.main', mr: 2, width: 48, height: 48 }}>
                    <FilterAltIcon />
                  </Avatar>
                  <Typography variant="h5" fontWeight="bold" color="secondary">
                    ตัวกรองข้อมูล
                  </Typography>
                </Box>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="ค้นหา"
                      value={filters.search}
                      onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                      placeholder="รหัสกิจกรรม, นักศึกษา, ชื่อ, สาขา..."
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon color="action" />
                          </InputAdornment>
                        ),
                        endAdornment: filters.search && (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}>
                              <ClearIcon />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>กิจกรรม</InputLabel>
                      <Select
                        multiple
                        value={filters.activities}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            activities: typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]),
                          }))
                        }
                        input={<OutlinedInput label="กิจกรรม" />}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selected as string[]).map((value) => (
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

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>สาขา</InputLabel>
                      <Select
                        multiple
                        value={filters.departments}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            departments: typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]),
                          }))
                        }
                        input={<OutlinedInput label="สาขา" />}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selected as string[]).map((value) => (
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

                  <Grid size={{ xs: 12 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>คณะ</InputLabel>
                      <Select
                        multiple
                        value={filters.faculties}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            faculties: typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]),
                          }))
                        }
                        input={<OutlinedInput label="คณะ" />}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selected as string[]).map((value) => (
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

                  <Grid size={{ xs: 12 }}>
                    <Button fullWidth variant="outlined" color="secondary" startIcon={<ClearIcon />} onClick={clearAllFilters} sx={{ mt: 1 }}>
                      ล้างตัวกรองทั้งหมด
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Records Table */}
          <Grid size={{ xs: 12 }}>
            <Card sx={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(20px)', borderRadius: 3, border: '1px solid rgba(255, 255, 255, 0.3)', boxShadow: '0 20px 40px -12px rgba(0,0,0,0.15)' }}>
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

                    <Chip label={`${filteredRecords.length} รายการ`} color="primary" sx={{ ml: 3, fontWeight: 600 }} />
                    {selectedRecords.length > 0 && <Chip label={`เลือก ${selectedRecords.length} รายการ`} color="secondary" sx={{ ml: 1, fontWeight: 600 }} />}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <ButtonGroup variant="contained" sx={{ borderRadius: 2 }}>
                      <Tooltip title="รีเฟรช">
                        <span>
                          <Button onClick={loadRecords} disabled={loading} startIcon={<RefreshIcon />} sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
                            รีเฟรช
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title="ส่งออกทั้งหมด">
                        <Button onClick={() => exportToCSV(false)} startIcon={<DownloadIcon />} sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}>
                          ส่งออกทั้งหมด
                        </Button>
                      </Tooltip>
                      <Tooltip title="ส่งออกที่เลือก">
                        <span>
                          <Button onClick={() => exportToCSV(true)} disabled={selectedRecords.length === 0} startIcon={<GetAppIcon />} sx={{ bgcolor: 'info.main', '&:hover': { bgcolor: 'info.dark' } }}>
                            ส่งออกที่เลือก
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title="ลบที่เลือก">
                        <span>
                          <Button onClick={deleteSelectedRecords} disabled={selectedRecords.length === 0} startIcon={<DeleteIcon />} sx={{ bgcolor: 'error.main', '&:hover': { bgcolor: 'error.dark' } }}>
                            ลบที่เลือก
                          </Button>
                        </span>
                      </Tooltip>
                    </ButtonGroup>
                  </Box>
                </Box>

                <TableContainer component={Paper} sx={{ maxHeight: 600, borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)', '& .MuiTableHead-root': { bgcolor: 'grey.100' } }}>
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
                            {Array.from(new Array(8)).map((__, cellIndex) => (
                              <TableCell key={cellIndex}>
                                <Skeleton variant="text" height={40} />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        filteredRecords.map((record) => (
                          <TableRow
                            key={record.id}
                            hover
                            sx={{
                              '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.04)', transition: 'all 0.2s ease' },
                              bgcolor: selectedRecords.includes(record.id) ? 'rgba(25, 118, 210, 0.08)' : 'inherit',
                            }}
                          >
                            <TableCell>
                              <Checkbox checked={selectedRecords.includes(record.id)} onChange={() => handleSelectRecord(record.id)} />
                            </TableCell>

                            <TableCell>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {new Date(record.timestamp).toLocaleDateString('th-TH')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(record.timestamp).toLocaleTimeString('th-TH')}
                                </Typography>
                              </Box>
                            </TableCell>

                            <TableCell>
                              <Typography variant="body2" fontWeight={700} color="primary.main">
                                {record.studentId}
                              </Typography>
                            </TableCell>

                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {record.firstName} {record.lastName}
                              </Typography>
                            </TableCell>

                            <TableCell>
                              <Chip label={(record as any).faculty || 'ไม่ระบุ'} size="small" variant="outlined" color="info" sx={{ fontWeight: 500 }} />
                            </TableCell>

                            <TableCell>
                              <Chip label={record.department} size="small" variant="outlined" color="secondary" sx={{ fontWeight: 500 }} />
                            </TableCell>

                            <TableCell>
                              <Chip label={record.activityCode} color="primary" size="small" sx={{ fontWeight: 700, background: 'linear-gradient(45deg, #1976d2, #42a5f5)' }} />
                            </TableCell>

                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Tooltip title="ดูรายละเอียด">
                                  <IconButton size="small" onClick={() => viewRecordDetails(record)} sx={{ color: 'info.main', '&:hover': { bgcolor: 'info.light', color: 'white' } }}>
                                    <ViewIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="ลบ">
                                  <IconButton size="small" onClick={() => deleteRecord(record.id)} sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.light', color: 'white' } }}>
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

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
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

      {/* Details dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(20px)' } }}>
        {selectedRecord && (
          <>
            <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                <ViewIcon />
              </Avatar>
              รายละเอียดการลงทะเบียน
            </DialogTitle>

            <DialogContent sx={{ p: 4 }}>
              <Grid container spacing={4} sx={{ mt: 1 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    รหัสนักศึกษา
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    {selectedRecord.studentId}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    รหัสกิจกรรม
                  </Typography>
                  <Chip label={selectedRecord.activityCode} color="primary" sx={{ fontWeight: 'bold', fontSize: '1rem' }} />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    ชื่อ-นามสกุล
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {selectedRecord.firstName} {selectedRecord.lastName}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    คณะ
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {(selectedRecord as any).faculty || 'ไม่ระบุ'}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    สาขาวิชา
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {selectedRecord.department}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    วันที่ลงทะเบียน
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {new Date(selectedRecord.timestamp).toLocaleDateString('th-TH')}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    เวลาลงทะเบียน
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {new Date(selectedRecord.timestamp).toLocaleTimeString('th-TH')}
                  </Typography>
                </Grid>
              </Grid>
            </DialogContent>

            <DialogActions sx={{ p: 3, gap: 1 }}>
              <Button onClick={() => setDialogOpen(false)} variant="outlined" sx={{ borderRadius: 2 }}>
                ปิด
              </Button>
              <Button
                onClick={async () => {
                  const id = selectedRecord.id;
                  setDialogOpen(false);
                  await deleteRecord(id);
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

      {/* Snackbar */}
      <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={messageType} variant="filled" sx={{ minWidth: 350, borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', backdropFilter: 'blur(20px)' }}>
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminPanel;
