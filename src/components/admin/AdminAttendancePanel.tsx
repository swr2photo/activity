// src/components/admin/AdminAttendancePanel.tsx
'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Alert, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Tooltip, Snackbar, LinearProgress, InputAdornment,
  ButtonGroup, AppBar, Toolbar, Container, Fade, Skeleton, Checkbox, FormControl, InputLabel,
  Select, OutlinedInput, MenuItem, ListItemText, Avatar, useMediaQuery, Badge, Menu, ListItemAvatar,
  Stack
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Download as DownloadIcon, Refresh as RefreshIcon, Delete as DeleteIcon, Visibility as ViewIcon,
  Search as SearchIcon, Clear as ClearIcon, GetApp as GetAppIcon, Event as EventIcon,
  People as PeopleIcon, Today as TodayIcon, Analytics as AnalyticsIcon, ContentCopy as CopyIcon,
  Notifications as NotificationsIcon, CloudDownload as CloudDownloadIcon
} from '@mui/icons-material';

import type { AdminProfile, AdminPermission } from '../../types/admin';
import { normalizeDepartment, deptEquals, getDepartmentLabel } from '../../types/admin';

import {
  deleteActivityRecord,
  adjustParticipantsByActivityCode,
  type ActivityRecord
} from '../../lib/adminFirebase';

import { db } from '../../lib/firebase';
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, Timestamp, QueryConstraint, startAfter
} from 'firebase/firestore';

// --- Helper & Types ---
type MsgType = 'success' | 'error' | 'info' | 'warning';

interface FilterState {
  search: string;
  activities: string[];
  faculties: string[];
  dateRange: { start: string; end: string; }; // เปลี่ยนเป็น string YYYY-MM-DD เพื่อใช้ง่ายกับ input type="date"
}

interface Props {
  currentAdmin: AdminProfile;
}

// ... (NotificationBell Component ยังคงเดิม หรือจะตัดออกก็ได้ถ้าไฟล์ยาวเกินไป แต่ผมจะคงไว้เพื่อให้ครบ) ...
type AdminNotif = {
  id: string;
  title?: string;
  message?: string;
  department?: string;
  departmentKey?: string;
  createdAt?: Date | Timestamp | null;
};

const NotificationBell: React.FC<{
  currentAdmin: AdminProfile;
  allowedDeptKey: string;
}> = ({ currentAdmin, allowedDeptKey }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<AdminNotif[]>([]);
  const open = Boolean(anchorEl);
  const LS_KEY = useMemo(() => `admin_last_seen_notif_${currentAdmin.uid}`, [currentAdmin.uid]);
  const [lastSeen, setLastSeen] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(LS_KEY);
    setLastSeen(raw ? Number(raw) : 0);
  }, [LS_KEY]);

  const markSeenNow = () => {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    window.localStorage.setItem(LS_KEY, String(now));
    setLastSeen(now);
  };

  const unseenCount = useMemo(() => {
    return items.filter(n => {
      const t = n.createdAt instanceof Date ? n.createdAt.getTime() : (n.createdAt as any)?.toMillis?.() ?? 0;
      return t > lastSeen;
    }).length;
  }, [items, lastSeen]);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    const watch = (colName: string) => {
      // Logic การดึง Notification แบบเดิม (ละไว้ในฐานที่เข้าใจ หรือใส่เต็มก็ได้)
      // เพื่อความกระชับ ขออนุญาตใช้ Logic แบบง่ายในตัวอย่างนี้
      const q = query(collection(db, colName), orderBy('createdAt', 'desc'), limit(20));
      const un = onSnapshot(q, snap => {
         const arr = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
         // Filter dept key
         const filtered = arr.filter(n => {
             if (allowedDeptKey === 'all') return true;
             const dep = n.departmentKey || n.department;
             return dep === 'all' || deptEquals(dep as any, allowedDeptKey as any);
         });
         setItems(prev => {
             const map = new Map();
             [...filtered, ...prev].forEach(x => map.set(x.id, x));
             return Array.from(map.values()).sort((a:any,b:any) => ((b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))).slice(0,50);
         });
      });
      unsubscribers.push(un);
    };
    watch('adminNotifications');
    return () => unsubscribers.forEach(u => u());
  }, [allowedDeptKey]);

  const openMenu = (e: React.MouseEvent<HTMLElement>) => { setAnchorEl(e.currentTarget); markSeenNow(); };
  const closeMenu = () => setAnchorEl(null);

  return (
    <>
      <IconButton onClick={openMenu} aria-label="notifications" sx={{ mr: 1 }}>
        <Badge color="error" badgeContent={unseenCount} max={99}><NotificationsIcon htmlColor="#fff" /></Badge>
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={closeMenu} PaperProps={{ sx: { width: 360, maxWidth: '90vw' } }}>
        {items.length === 0 ? <MenuItem disabled>ไม่มีแจ้งเตือน</MenuItem> : items.slice(0, 10).map(n => (
          <MenuItem key={n.id} sx={{ whiteSpace: 'normal', display: 'block' }}>
            <Typography variant="subtitle2" fontWeight="bold">{n.title}</Typography>
            <Typography variant="caption" color="text.secondary">{n.message}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

// --- Main Component ---

const AdminAttendancePanel: React.FC<Props> = ({ currentAdmin }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Data State
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null); // สำหรับ Pagination
  const [hasMore, setHasMore] = useState(true);
  
  // UI State
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<string>('');
  const [msgType, setMsgType] = useState<MsgType>('success');
  const [snack, setSnack] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ActivityRecord | null>(null);

  // Export State
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFilename, setExportFilename] = useState(`attendance_${new Date().toISOString().slice(0, 10)}.csv`);
  const [isExporting, setIsExporting] = useState(false);

  // Cache
  const [activityNameByCode, setActivityNameByCode] = useState<Record<string, string>>({});

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    activities: [],
    faculties: [],
    dateRange: { start: '', end: '' }
  });

  // Permission Logic
  const isSuperAdmin = currentAdmin.role === 'super_admin';
  const perms = (currentAdmin.permissions || []) as AdminPermission[];
  const canExport = isSuperAdmin || perms.includes('export_data') || perms.includes('view_reports');
  const allowedDeptKey = normalizeDepartment(currentAdmin.department as any);
  const isDeptScoped = allowedDeptKey !== 'all';

  // --- Helper Functions ---
  const alert = (text: string, type: MsgType = 'success') => {
    setMsg(text); setMsgType(type); setSnack(true);
  };

  // ✅ Optimized: Check cache first
  const loadActivityNames = async (codes: string[]) => {
    const uniq = Array.from(new Set(codes.filter(c => c && !activityNameByCode[c])));
    if (uniq.length === 0) return;

    const results: Record<string, string> = { ...activityNameByCode };
    // Fetch in batches if necessary, here simplistic
    await Promise.all(uniq.map(async (code) => {
      try {
        const s = await getDoc(doc(db, 'activities', code));
        if (s.exists()) {
           const d: any = s.data();
           results[code] = d?.nameTh || d?.name || code;
        } else {
            // Try query by 'code' field
            const qs = await getDocs(query(collection(db, 'activities'), where('code', '==', code), limit(1)));
            if (!qs.empty) {
                const d:any = qs.docs[0].data();
                results[code] = d?.nameTh || d?.name || code;
            } else {
                results[code] = code;
            }
        }
      } catch { results[code] = code; }
    }));
    setActivityNameByCode(results);
  };

  // ✅ Secure & Optimized Load Function
  const loadData = useCallback(async (isLoadMore = false) => {
    if (loading) return;
    setLoading(true);
    setProgress(30);

    try {
      const constraints: QueryConstraint[] = [];

      // 1. Security: Enforce Department Scope at Query Level
      if (isDeptScoped) {
        constraints.push(where('department', '==', allowedDeptKey));
      }

      // 2. Date Filter (Server-side)
      if (filters.dateRange.start) {
        constraints.push(where('timestamp', '>=', new Date(filters.dateRange.start).toISOString()));
      }
      if (filters.dateRange.end) {
        // End of day
        const e = new Date(filters.dateRange.end);
        e.setHours(23, 59, 59, 999);
        constraints.push(where('timestamp', '<=', e.toISOString()));
      }

      // 3. Sorting & Pagination
      constraints.push(orderBy('timestamp', 'desc'));
      
      if (isLoadMore && lastDoc) {
        constraints.push(startAfter(lastDoc));
      }
      
      constraints.push(limit(100)); // Load 100 at a time

      const q = query(collection(db, 'activityRecords'), ...constraints);
      const snap = await getDocs(q);
      
      setProgress(70);

      const newRecords = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now())
        } as ActivityRecord;
      });

      if (isLoadMore) {
        setRecords(prev => [...prev, ...newRecords]);
      } else {
        setRecords(newRecords);
      }

      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === 100);

      // Load activity names for new records
      loadActivityNames(newRecords.map(r => r.activityCode));

      setProgress(100);
    } catch (e: any) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + e.message, 'error');
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 500);
    }
  }, [allowedDeptKey, isDeptScoped, filters.dateRange, lastDoc, loading]);

  // Initial Load & Refresh
  useEffect(() => {
    loadData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedDeptKey, filters.dateRange.start, filters.dateRange.end]); 

  // Client-side Filter (Search & Chips)
  const filteredRecords = useMemo(() => {
    let list = records;
    const s = filters.search.trim().toLowerCase();
    
    if (s) {
      list = list.filter(r => {
        const actName = (activityNameByCode[r.activityCode] || '').toLowerCase();
        return (
          r.activityCode.toLowerCase().includes(s) ||
          actName.includes(s) ||
          r.studentId.toLowerCase().includes(s) ||
          (r.firstName || '').toLowerCase().includes(s) ||
          (r.lastName || '').toLowerCase().includes(s)
        );
      });
    }

    if (filters.activities.length) list = list.filter(r => filters.activities.includes(r.activityCode));
    if (filters.faculties.length) list = list.filter(r => filters.faculties.includes(String(r.faculty || 'ไม่ระบุ')));

    return list;
  }, [records, filters.search, filters.activities, filters.faculties, activityNameByCode]);

  // Available options for filter dropdowns (computed from loaded records)
  const availableActivities = useMemo(() => [...new Set(records.map(r => r.activityCode))].sort(), [records]);
  const availableFaculties = useMemo(() => [...new Set(records.map(r => String(r.faculty || 'ไม่ระบุ')))].sort(), [records]);

  // --- Actions ---

  const handleDelete = async (ids: string[]) => {
    if (!isSuperAdmin) return alert('ต้องเป็น Super Admin เท่านั้น', 'warning');
    if (!confirm(`ยืนยันลบ ${ids.length} รายการ?`)) return;

    setLoading(true);
    try {
       // Group by activity to adjust counts efficiently
       const recordsToDelete = records.filter(r => ids.includes(r.id));
       const countMap: Record<string, number> = {};
       recordsToDelete.forEach(r => countMap[r.activityCode] = (countMap[r.activityCode] || 0) + 1);

       // Execute Deletes
       await Promise.all(ids.map(id => deleteActivityRecord(id)));
       // Adjust Counts
       await Promise.all(Object.entries(countMap).map(([code, count]) => adjustParticipantsByActivityCode(code, -count)));

       // Update State
       setRecords(prev => prev.filter(r => !ids.includes(r.id)));
       setSelected([]);
       alert('ลบข้อมูลสำเร็จ', 'success');
    } catch (e: any) {
        alert('ลบข้อมูลไม่สำเร็จ: ' + e.message, 'error');
    } finally {
        setLoading(false);
    }
  };

  // ✅ Secure Export Function (Fetches ALL matching data from server)
  const handleExport = async () => {
    if (!canExport) return;
    setIsExporting(true);
    try {
        const constraints: QueryConstraint[] = [];
        if (isDeptScoped) constraints.push(where('department', '==', allowedDeptKey));
        // Use current date filters
        if (filters.dateRange.start) constraints.push(where('timestamp', '>=', new Date(filters.dateRange.start).toISOString()));
        if (filters.dateRange.end) {
             const e = new Date(filters.dateRange.end); e.setHours(23, 59, 59, 999);
             constraints.push(where('timestamp', '<=', e.toISOString()));
        }
        constraints.push(orderBy('timestamp', 'desc'));
        // NOTE: Export fetches everything (no limit), be careful with very large datasets
        
        const q = query(collection(db, 'activityRecords'), ...constraints);
        const snap = await getDocs(q);
        const allData = snap.docs.map(d => ({...d.data(), timestamp: d.data().timestamp?.toDate() } as ActivityRecord));
        
        // CSV Build
        const headers = ['วันที่', 'เวลา', 'รหัสนักศึกษา', 'ชื่อ', 'นามสกุล', 'คณะ', 'สาขา', 'ชื่อกิจกรรม', 'รหัสกิจกรรม'];
        const rows = allData.map(r => [
            r.timestamp.toLocaleDateString('th-TH'),
            r.timestamp.toLocaleTimeString('th-TH'),
            r.studentId, r.firstName, r.lastName,
            r.faculty || '', getDepartmentLabel(r.department as any),
            activityNameByCode[r.activityCode] || r.activityCode, r.activityCode
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        
        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportFilename;
        a.click();
        URL.revokeObjectURL(url);
        
        alert(`ส่งออกข้อมูล ${allData.length} รายการสำเร็จ`, 'success');
        setExportOpen(false);
    } catch(e:any) {
        alert('ส่งออกล้มเหลว: ' + e.message, 'error');
    } finally {
        setIsExporting(false);
    }
  };

  // --- Components ---

  const ActivityChip = ({ code }: { code: string }) => (
    <Tooltip title={code}><Chip size="small" color="primary" label={activityNameByCode[code] || code} /></Tooltip>
  );

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <AppBar position="static" elevation={0} sx={{ background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(20px)' }}>
        <Toolbar sx={{ py: 1 }}>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,.25)', mr: 2 }}><AnalyticsIcon sx={{ color: 'white' }} /></Avatar>
          <Typography variant="h5" sx={{ flexGrow: 1, fontWeight: 700, color: 'white' }}>
             จัดการข้อมูลการเข้าร่วม
          </Typography>
          <NotificationBell currentAdmin={currentAdmin} allowedDeptKey={allowedDeptKey} />
          <Chip
            label={isDeptScoped ? `สังกัด: ${getDepartmentLabel(currentAdmin.department)}` : 'Super Admin'}
            color={isDeptScoped ? 'info' : 'warning'} variant="filled" sx={{ mr: 2 }}
          />
        </Toolbar>
      </AppBar>

      {progress > 0 && <LinearProgress variant="determinate" value={progress} />}

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Filters */}
        <Card sx={{ mb: 3, borderRadius: 3 }}>
          <CardContent>
             {/* Using Box Grid System */}
             <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                
                {/* Search */}
                <TextField
                  size="small" label="ค้นหา (ในรายการที่โหลดมา)" value={filters.search}
                  onChange={(e) => setFilters(v => ({ ...v, search: e.target.value }))}
                  InputProps={{ startAdornment: <SearchIcon color="action" /> }}
                />

                {/* Date Start */}
                <TextField
                  size="small" type="date" label="ตั้งแต่วันที่" InputLabelProps={{ shrink: true }}
                  value={filters.dateRange.start}
                  onChange={(e) => setFilters(v => ({ ...v, dateRange: { ...v.dateRange, start: e.target.value } }))}
                />

                {/* Date End */}
                <TextField
                  size="small" type="date" label="ถึงวันที่" InputLabelProps={{ shrink: true }}
                  value={filters.dateRange.end}
                  onChange={(e) => setFilters(v => ({ ...v, dateRange: { ...v.dateRange, end: e.target.value } }))}
                />

                {/* Actions */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button 
                      fullWidth variant="contained" onClick={() => { setLastDoc(null); loadData(false); }} 
                      disabled={loading} startIcon={<RefreshIcon />}
                    >
                      โหลดข้อมูล
                    </Button>
                    {canExport && (
                      <Button 
                         variant="outlined" color="success" onClick={() => setExportOpen(true)}
                         startIcon={<CloudDownloadIcon />}
                      >
                         Export
                      </Button>
                    )}
                </Box>

                {/* Client-side Filters */}
                <FormControl size="small" fullWidth>
                    <InputLabel>กรองกิจกรรม</InputLabel>
                    <Select
                        multiple value={filters.activities}
                        onChange={(e) => setFilters(v => ({...v, activities: e.target.value as string[]}))}
                        input={<OutlinedInput label="กรองกิจกรรม" />}
                        renderValue={(selected) => selected.length + ' รายการ'}
                    >
                        {availableActivities.map(a => (
                            <MenuItem key={a} value={a}><Checkbox checked={filters.activities.includes(a)} /><ListItemText primary={activityNameByCode[a] || a} /></MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                    <InputLabel>กรองคณะ</InputLabel>
                    <Select
                        multiple value={filters.faculties}
                        onChange={(e) => setFilters(v => ({...v, faculties: e.target.value as string[]}))}
                        input={<OutlinedInput label="กรองคณะ" />}
                        renderValue={(selected) => selected.length + ' คณะ'}
                    >
                        {availableFaculties.map(f => (
                            <MenuItem key={f} value={f}><Checkbox checked={filters.faculties.includes(f)} /><ListItemText primary={f} /></MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Box sx={{ gridColumn: { md: 'span 2' }, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                        แสดง {filteredRecords.length} จากที่โหลดมา {records.length} รายการ
                    </Typography>
                    {selected.length > 0 && (
                        <Button 
                           color="error" variant="contained" size="small" startIcon={<DeleteIcon />}
                           onClick={() => handleDelete(selected)}
                           disabled={!isSuperAdmin}
                        >
                           ลบ {selected.length} รายการ
                        </Button>
                    )}
                </Box>

             </Box>
          </CardContent>
        </Card>

        {/* Table / List */}
        {!isMobile ? (
            <TableContainer component={Paper} sx={{ maxHeight: 600, borderRadius: 2 }}>
                <Table stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell padding="checkbox">
                                <Checkbox 
                                    indeterminate={selected.length > 0 && selected.length < filteredRecords.length}
                                    checked={filteredRecords.length > 0 && selected.length === filteredRecords.length}
                                    onChange={(e) => setSelected(e.target.checked ? filteredRecords.map(r => r.id) : [])}
                                />
                            </TableCell>
                            <TableCell>เวลา</TableCell>
                            <TableCell>รหัสนักศึกษา</TableCell>
                            <TableCell>ชื่อ-นามสกุล</TableCell>
                            <TableCell>คณะ</TableCell>
                            <TableCell>กิจกรรม</TableCell>
                            <TableCell align="right">Action</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredRecords.map((r) => (
                            <TableRow key={r.id} hover selected={selected.includes(r.id)}>
                                <TableCell padding="checkbox">
                                    <Checkbox 
                                       checked={selected.includes(r.id)} 
                                       onChange={() => setSelected(p => p.includes(r.id) ? p.filter(x => x !== r.id) : [...p, r.id])} 
                                    />
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">{r.timestamp.toLocaleDateString('th-TH')}</Typography>
                                    <Typography variant="caption" color="text.secondary">{r.timestamp.toLocaleTimeString('th-TH')}</Typography>
                                </TableCell>
                                <TableCell>{r.studentId}</TableCell>
                                <TableCell>{r.firstName} {r.lastName}</TableCell>
                                <TableCell>{String(r.faculty || '-')}</TableCell>
                                <TableCell><ActivityChip code={r.activityCode} /></TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => { setSelectedRecord(r); setDetailOpen(true); }}><ViewIcon /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && <TableRow><TableCell colSpan={7} align="center"><LinearProgress /></TableCell></TableRow>}
                        {!loading && hasMore && (
                            <TableRow>
                                <TableCell colSpan={7} align="center">
                                    <Button onClick={() => loadData(true)}>โหลดเพิ่ม (Load More)</Button>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        ) : (
            // Mobile View (Card List)
            <Stack spacing={2}>
                 {filteredRecords.map(r => (
                     <Card key={r.id} variant="outlined">
                         <CardContent sx={{ display: 'flex', gap: 2 }}>
                             <Box sx={{ flex: 1 }}>
                                 <Typography fontWeight="bold">{r.firstName} {r.lastName}</Typography>
                                 <Typography variant="body2" color="text.secondary">{r.studentId}</Typography>
                                 <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                     <ActivityChip code={r.activityCode} />
                                     <Chip size="small" label={r.timestamp.toLocaleDateString('th-TH')} />
                                 </Box>
                             </Box>
                             <IconButton onClick={() => { setSelectedRecord(r); setDetailOpen(true); }}><ViewIcon /></IconButton>
                         </CardContent>
                     </Card>
                 ))}
                 {hasMore && <Button variant="outlined" fullWidth onClick={() => loadData(true)}>โหลดเพิ่ม</Button>}
            </Stack>
        )}

      </Container>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)}>
        <DialogTitle>รายละเอียด</DialogTitle>
        <DialogContent>
            {selectedRecord && (
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField label="รหัสนักศึกษา" value={selectedRecord.studentId} fullWidth InputProps={{ readOnly: true }} />
                    <TextField label="ชื่อ" value={`${selectedRecord.firstName} ${selectedRecord.lastName}`} fullWidth InputProps={{ readOnly: true }} />
                    <TextField label="กิจกรรม" value={activityNameByCode[selectedRecord.activityCode] || selectedRecord.activityCode} fullWidth InputProps={{ readOnly: true }} />
                    <TextField label="เวลาเช็คชื่อ" value={selectedRecord.timestamp.toLocaleString('th-TH')} fullWidth InputProps={{ readOnly: true }} />
                </Stack>
            )}
        </DialogContent>
        <DialogActions>
            {isSuperAdmin && selectedRecord && (
                <Button color="error" onClick={() => { handleDelete([selectedRecord.id]); setDetailOpen(false); }}>ลบรายการนี้</Button>
            )}
            <Button onClick={() => setDetailOpen(false)}>ปิด</Button>
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)}>
         <DialogTitle>Export CSV</DialogTitle>
         <DialogContent>
             <Typography variant="body2" color="text.secondary" paragraph>
                ระบบจะทำการดึงข้อมูล "ทั้งหมด" จากฐานข้อมูลตามเงื่อนไขวันที่ที่คุณเลือก (ไม่จำกัดแค่ที่แสดงผลอยู่)
             </Typography>
             <TextField 
                autoFocus margin="dense" label="ชื่อไฟล์" fullWidth 
                value={exportFilename} onChange={(e) => setExportFilename(e.target.value)}
             />
         </DialogContent>
         <DialogActions>
             <Button onClick={() => setExportOpen(false)}>ยกเลิก</Button>
             <Button onClick={handleExport} variant="contained" disabled={isExporting}>
                {isExporting ? 'กำลังดึงข้อมูล...' : 'ดาวน์โหลด'}
             </Button>
         </DialogActions>
      </Dialog>

      <Snackbar open={snack} autoHideDuration={4000} onClose={() => setSnack(false)}>
        <Alert onClose={() => setSnack(false)} severity={msgType} sx={{ width: '100%' }}>{msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminAttendancePanel;