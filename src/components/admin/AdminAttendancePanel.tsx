'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid, Alert, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Tooltip, Snackbar, LinearProgress, InputAdornment,
  ButtonGroup, AppBar, Toolbar, Container, Fade, Skeleton, Checkbox, FormControl, InputLabel,
  Select, OutlinedInput, MenuItem, ListItemText, Avatar
} from '@mui/material';
import {
  Download as DownloadIcon, Refresh as RefreshIcon, Delete as DeleteIcon, Visibility as ViewIcon,
  Search as SearchIcon, Clear as ClearIcon, GetApp as GetAppIcon, Event as EventIcon,
  People as PeopleIcon, Today as TodayIcon, Analytics as AnalyticsIcon
} from '@mui/icons-material';
import type { AdminProfile, AdminDepartment } from '../../types/admin';
import {
  getAllActivityRecords,
  getActivityRecordsByDepartment,
  deleteActivityRecord,
  adjustParticipantsByActivityCode,
  type ActivityRecord
} from '../../lib/adminFirebase';

type MsgType = 'success' | 'error' | 'info' | 'warning';

interface FilterState {
  search: string;
  activities: string[];
  departments: string[];
  faculties: string[];
  dateRange: { start: Date | null; end: Date | null; };
}

interface Props {
  currentAdmin: AdminProfile;
}

const AdminAttendancePanel: React.FC<Props> = ({ currentAdmin }) => {
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ActivityRecord[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<string>('');
  const [msgType, setMsgType] = useState<MsgType>('success');
  const [snack, setSnack] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ActivityRecord | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    search: '', activities: [], departments: [], faculties: [],
    dateRange: { start: null, end: null }
  });

  const isSuperAdmin = currentAdmin.role === 'super_admin';

  const availableActivities = useMemo(
    () => [...new Set(records.map(r => r.activityCode))].sort(),
    [records]
  );
  const availableDepartments = useMemo(
    () => [...new Set(records.map(r => String(r.department || '')))].sort(),
    [records]
  );
  const availableFaculties = useMemo(
    () => [...new Set(records.map(r => String(r.faculty || 'ไม่ระบุ')))].sort(),
    [records]
  );

  const stats = useMemo(() => {
    const uniqueStudents = new Set(filteredRecords.map(r => r.studentId)).size;
    const uniqueActivities = new Set(filteredRecords.map(r => r.activityCode)).size;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayCount = filteredRecords.filter(r => {
      const rd = new Date(r.timestamp); rd.setHours(0, 0, 0, 0);
      return rd.getTime() === today.getTime();
    }).length;
    return {
      totalRecords: filteredRecords.length,
      uniqueStudents,
      uniqueActivities,
      todayRecords: todayCount
    };
  }, [filteredRecords]);

  const alert = (text: string, type: MsgType = 'success') => {
    setMsg(text); setMsgType(type); setSnack(true);
  };

  const load = async () => {
    setLoading(true);
    setProgress(20);
    try {
      const data = currentAdmin.department === 'all'
        ? await getAllActivityRecords()
        : await getActivityRecordsByDepartment(currentAdmin.department as AdminDepartment);

      setProgress(70);
      // ให้ทุกแถวมี Date จริง
      const normalized = data.map(d => ({
        ...d, timestamp: d.timestamp instanceof Date ? d.timestamp : new Date(d.timestamp)
      }));
      setRecords(normalized);
      setProgress(100);
      alert(`โหลดข้อมูลสำเร็จ ${normalized.length} รายการ`, 'success');
    } catch (e: any) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 600);
    }
  };

  useEffect(() => { load(); }, [currentAdmin.department]);

  useEffect(() => {
    let filtered = [...records];
    const s = filters.search.trim().toLowerCase();
    if (s) {
      filtered = filtered.filter(r =>
        r.activityCode.toLowerCase().includes(s) ||
        r.studentId.toLowerCase().includes(s) ||
        r.firstName.toLowerCase().includes(s) ||
        r.lastName.toLowerCase().includes(s) ||
        String(r.department || '').toLowerCase().includes(s) ||
        String(r.faculty || '').toLowerCase().includes(s)
      );
    }
    if (filters.activities.length) {
      filtered = filtered.filter(r => filters.activities.includes(r.activityCode));
    }
    if (filters.departments.length) {
      filtered = filtered.filter(r => filters.departments.includes(String(r.department || '')));
    }
    if (filters.faculties.length) {
      filtered = filtered.filter(r => filters.faculties.includes(String(r.faculty || 'ไม่ระบุ')));
    }
    const { start, end } = filters.dateRange;
    if (start || end) {
      filtered = filtered.filter(r => {
        const d = new Date(r.timestamp);
        if (start && end) return d >= start && d <= end;
        if (start) return d >= start;
        if (end) return d <= end;
        return true;
      });
    }
    setFilteredRecords(filtered);
  }, [records, filters]);

  const exportCSV = (selectedOnly = false) => {
    const rows = selectedOnly
      ? filteredRecords.filter(r => selected.includes(r.id))
      : filteredRecords;

    if (selectedOnly && rows.length === 0) return alert('กรุณาเลือกรายการที่ต้องการส่งออก', 'warning');

    const headers = ['วันที่/เวลา','รหัสนักศึกษา','ชื่อ','นามสกุล','คณะ','สาขา','รหัสกิจกรรม'];
    const csv = [
      headers.join(','),
      ...rows.map(r => [
        new Date(r.timestamp).toLocaleString('th-TH'),
        r.studentId, r.firstName, r.lastName,
        String(r.faculty || 'ไม่ระบุ'),
        String(r.department || ''),
        r.activityCode
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedOnly
      ? `selected_records_${new Date().toISOString().split('T')[0]}.csv`
      : `activity_records_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    alert(`ส่งออกข้อมูล${selectedOnly ? 'ที่เลือก' : 'ทั้งหมด'} ${rows.length} รายการสำเร็จ 📊`, 'success');
  };

  const handleDeleteOne = async (rec: ActivityRecord) => {
    if (!isSuperAdmin) return alert('ต้องเป็นผู้ดูแลระบบสูงสุดจึงจะลบได้', 'warning');
    if (!confirm('ยืนยันลบรายการนี้?')) return;

    try {
      // ลดยอดผู้เข้าร่วมของกิจกรรม (ถ้ามี)
      await adjustParticipantsByActivityCode(rec.activityCode, -1);
      // ลบ record
      await deleteActivityRecord(rec.id);
      alert('ลบรายการสำเร็จและอัปเดตจำนวนผู้เข้าร่วมแล้ว 🗑️', 'success');
      await load();
    } catch (e: any) {
      console.error(e);
      alert(`ลบไม่สำเร็จ: ${e.message || e}`, 'error');
    }
  };

  const handleDeleteSelected = async () => {
    if (!isSuperAdmin) return alert('ต้องเป็นผู้ดูแลระบบสูงสุดจึงจะลบได้', 'warning');
    if (selected.length === 0) return alert('กรุณาเลือกรายการที่ต้องการลบ', 'warning');
    if (!confirm(`ยืนยันลบ ${selected.length} รายการที่เลือก?`)) return;

    setLoading(true);
    try {
      // รวมจำนวนตาม activityCode
      const countByCode: Record<string, number> = {};
      const chosen = records.filter(r => selected.includes(r.id));
      chosen.forEach(r => { countByCode[r.activityCode] = (countByCode[r.activityCode] || 0) + 1; });

      // ลดยอดตามแต่ละกิจกรรม
      await Promise.all(
        Object.entries(countByCode).map(([code, cnt]) => adjustParticipantsByActivityCode(code, -cnt))
      );

      // ลบทีละ record
      for (const r of chosen) {
        await deleteActivityRecord(r.id);
      }

      setSelected([]);
      alert(`ลบรายการ ${chosen.length} รายการสำเร็จและอัปเดตจำนวนผู้เข้าร่วมแล้ว`, 'success');
      await load();
    } catch (e: any) {
      console.error(e);
      alert(`เกิดข้อผิดพลาดในการลบ: ${e.message || e}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '', activities: [], departments: [], faculties: [],
      dateRange: { start: null, end: null }
    });
    setSelected([]);
  };

  const StatCard = ({ title, value, icon, color, subtitle }: any) => (
    <Fade in timeout={500}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ textAlign: 'center', py: 3 }}>
          <Avatar sx={{ bgcolor: color, width: 56, height: 56, mx: 'auto', mb: 1 }}>{icon}</Avatar>
          <Typography variant="h4" sx={{ fontWeight: 800, color }}>{value}</Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </CardContent>
      </Card>
    </Fade>
  );

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <AppBar position="static" elevation={0} sx={{ background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(20px)' }}>
        <Toolbar sx={{ py: 1 }}>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,.25)', mr: 2 }}>
            <AnalyticsIcon sx={{ color: 'white' }} />
          </Avatar>
          <Typography variant="h5" sx={{ flexGrow: 1, fontWeight: 700, color: 'white' }}>
            จัดการข้อมูลการเข้าร่วมกิจกรรม
          </Typography>
          <Chip label={currentAdmin.isActive ? 'บัญชีแอดมินพร้อมใช้งาน' : 'บัญชีถูกปิด'} color={currentAdmin.isActive ? 'success' : 'default'} />
        </Toolbar>
      </AppBar>

      {progress > 0 && progress < 100 && (
        <LinearProgress variant="determinate" value={progress} />
      )}

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Stats */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="รายการทั้งหมด" value={stats.totalRecords} icon={<EventIcon />} color="#1976d2" subtitle="บันทึกการเข้าร่วม" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="นักศึกษา" value={stats.uniqueStudents} icon={<PeopleIcon />} color="#9c27b0" subtitle="คนที่เข้าร่วม" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="กิจกรรม" value={stats.uniqueActivities} icon={<EventIcon />} color="#2e7d32" subtitle="กิจกรรมทั้งหมด" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="วันนี้" value={stats.todayRecords} icon={<TodayIcon />} color="#ed6c02" subtitle="เข้าร่วมวันนี้" />
          </Grid>
        </Grid>

        {/* Filters + Actions */}
        <Card sx={{ mb: 3, borderRadius: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth size="small" label="ค้นหา"
                  value={filters.search}
                  onChange={(e) => setFilters(v => ({ ...v, search: e.target.value }))}
                  InputProps={{
                    startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>),
                    endAdornment: filters.search && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setFilters(v => ({ ...v, search: '' }))}><ClearIcon /></IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>กิจกรรม</InputLabel>
                  <Select
                    multiple value={filters.activities}
                    onChange={(e) => setFilters(v => ({ ...v, activities: (e.target.value as string[]) }))}
                    input={<OutlinedInput label="กิจกรรม" />}
                    renderValue={(selected) => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .5 }}>
                      {selected.map((v) => <Chip key={v} size="small" label={v} />)}
                    </Box>}
                  >
                    {availableActivities.map((a) => (
                      <MenuItem key={a} value={a}>
                        <Checkbox checked={filters.activities.includes(a)} />
                        <ListItemText primary={a} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>สาขา</InputLabel>
                  <Select
                    multiple value={filters.departments}
                    onChange={(e) => setFilters(v => ({ ...v, departments: (e.target.value as string[]) }))}
                    input={<OutlinedInput label="สาขา" />}
                    renderValue={(selected) => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .5 }}>
                      {selected.map((v) => <Chip key={v} size="small" label={v} />)}
                    </Box>}
                  >
                    {availableDepartments.map((d) => (
                      <MenuItem key={d} value={d}>
                        <Checkbox checked={filters.departments.includes(d)} />
                        <ListItemText primary={d} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={2} sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'stretch', md: 'flex-end' } }}>
                <Button variant="outlined" onClick={clearFilters} startIcon={<ClearIcon />}>ล้างตัวกรอง</Button>
                <ButtonGroup variant="contained">
                  <Button onClick={load} disabled={loading} startIcon={<RefreshIcon />}>รีเฟรช</Button>
                  <Button color="success" onClick={() => exportCSV(false)} startIcon={<DownloadIcon />}>ส่งออก</Button>
                </ButtonGroup>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Table */}
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main' }}><EventIcon /></Avatar>
              <Typography variant="h6" fontWeight="bold">รายการลงทะเบียน</Typography>
              <Chip label={`${filteredRecords.length} รายการ`} color="primary" />
              {selected.length > 0 && <Chip label={`เลือก ${selected.length}`} color="secondary" />}
              <Box sx={{ flex: 1 }} />
              <ButtonGroup variant="contained">
                <Button color="info" onClick={() => exportCSV(true)} startIcon={<GetAppIcon />} disabled={selected.length === 0}>
                  ส่งออกที่เลือก
                </Button>
                <Button color="error" onClick={handleDeleteSelected} startIcon={<DeleteIcon />} disabled={!isSuperAdmin || selected.length === 0}>
                  ลบที่เลือก
                </Button>
              </ButtonGroup>
            </Box>

            <TableContainer component={Paper} sx={{ maxHeight: 600, borderRadius: 2 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <Checkbox
                        indeterminate={selected.length > 0 && selected.length < filteredRecords.length}
                        checked={filteredRecords.length > 0 && selected.length === filteredRecords.length}
                        onChange={(e) => setSelected(e.target.checked ? filteredRecords.map(r => r.id) : [])}
                      />
                    </TableCell>
                    <TableCell>วันที่/เวลา</TableCell>
                    <TableCell>รหัสนักศึกษา</TableCell>
                    <TableCell>ชื่อ-นามสกุล</TableCell>
                    <TableCell>คณะ</TableCell>
                    <TableCell>สาขา</TableCell>
                    <TableCell>รหัสกิจกรรม</TableCell>
                    <TableCell>การดำเนินการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton height={40} /></TableCell>)}</TableRow>
                    ))
                  ) : (
                    filteredRecords.map((r) => (
                      <TableRow key={r.id} hover selected={selected.includes(r.id)}>
                        <TableCell>
                          <Checkbox
                            checked={selected.includes(r.id)}
                            onChange={() =>
                              setSelected(prev => prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id])
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{new Date(r.timestamp).toLocaleDateString('th-TH')}</Typography>
                          <Typography variant="caption" color="text.secondary">{new Date(r.timestamp).toLocaleTimeString('th-TH')}</Typography>
                        </TableCell>
                        <TableCell><Typography fontWeight={700} color="primary">{r.studentId}</Typography></TableCell>
                        <TableCell>{r.firstName} {r.lastName}</TableCell>
                        <TableCell><Chip size="small" label={String(r.faculty || 'ไม่ระบุ')} variant="outlined" color="info" /></TableCell>
                        <TableCell><Chip size="small" label={String(r.department || '')} variant="outlined" color="secondary" /></TableCell>
                        <TableCell><Chip size="small" color="primary" label={r.activityCode} /></TableCell>
                        <TableCell>
                          <Tooltip title="ดูรายละเอียด">
                            <IconButton color="info" size="small" onClick={() => { setSelectedRecord(r); setDetailOpen(true); }}>
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={isSuperAdmin ? 'ลบ' : 'ลบ (เฉพาะ Super Admin)'}>
                            <span>
                              <IconButton color="error" size="small" disabled={!isSuperAdmin} onClick={() => handleDeleteOne(r)}>
                                <DeleteIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Container>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        {selectedRecord && (
          <>
            <DialogTitle>รายละเอียดการลงทะเบียน</DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: .5 }}>
                <Grid item xs={12} sm={6}><Typography variant="body2" color="text.secondary">รหัสนักศึกษา</Typography><Typography variant="h6">{selectedRecord.studentId}</Typography></Grid>
                <Grid item xs={12} sm={6}><Typography variant="body2" color="text.secondary">รหัสกิจกรรม</Typography><Chip color="primary" label={selectedRecord.activityCode} /></Grid>
                <Grid item xs={12}><Typography variant="body2" color="text.secondary">ชื่อ-นามสกุล</Typography><Typography variant="h6">{selectedRecord.firstName} {selectedRecord.lastName}</Typography></Grid>
                <Grid item xs={12} sm={6}><Typography variant="body2" color="text.secondary">คณะ</Typography><Typography>{String(selectedRecord.faculty || 'ไม่ระบุ')}</Typography></Grid>
                <Grid item xs={12} sm={6}><Typography variant="body2" color="text.secondary">สาขาวิชา</Typography><Typography>{String(selectedRecord.department || '')}</Typography></Grid>
                <Grid item xs={12} sm={6}><Typography variant="body2" color="text.secondary">วันที่</Typography><Typography>{new Date(selectedRecord.timestamp).toLocaleDateString('th-TH')}</Typography></Grid>
                <Grid item xs={12} sm={6}><Typography variant="body2" color="text.secondary">เวลา</Typography><Typography>{new Date(selectedRecord.timestamp).toLocaleTimeString('th-TH')}</Typography></Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailOpen(false)}>ปิด</Button>
              <Button color="error" variant="contained" startIcon={<DeleteIcon />} disabled={!isSuperAdmin} onClick={() => { setDetailOpen(false); handleDeleteOne(selectedRecord); }}>
                ลบรายการ
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={snack} autoHideDuration={4000} onClose={() => setSnack(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={msgType} variant="filled" onClose={() => setSnack(false)}>{msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminAttendancePanel;
