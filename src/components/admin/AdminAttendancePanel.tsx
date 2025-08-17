// src/components/admin/AdminAttendancePanel.tsx
'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid, Alert, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Tooltip, Snackbar, LinearProgress, InputAdornment,
  ButtonGroup, AppBar, Toolbar, Container, Fade, Skeleton, Checkbox, FormControl, InputLabel,
  Select, OutlinedInput, MenuItem, ListItemText, Avatar, useMediaQuery, Badge, Menu, ListItemAvatar
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Download as DownloadIcon, Refresh as RefreshIcon, Delete as DeleteIcon, Visibility as ViewIcon,
  Search as SearchIcon, Clear as ClearIcon, GetApp as GetAppIcon, Event as EventIcon,
  People as PeopleIcon, Today as TodayIcon, Analytics as AnalyticsIcon, ContentCopy as CopyIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';

import type { AdminProfile, AdminPermission } from '../../types/admin';
import { normalizeDepartment, deptEquals, getDepartmentLabel } from '../../types/admin';

import {
  getAllActivityRecords,
  deleteActivityRecord,
  adjustParticipantsByActivityCode,
  type ActivityRecord
} from '../../lib/adminFirebase';

import { db } from '../../lib/firebase';
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, Timestamp
} from 'firebase/firestore';

type MsgType = 'success' | 'error' | 'info' | 'warning';

interface FilterState {
  search: string;
  activities: string[];
  faculties: string[];
  dateRange: { start: Date | null; end: Date | null; };
}

interface Props {
  currentAdmin: AdminProfile;
}

/** ==== กระดิ่งแจ้งเตือน: แสดงเฉพาะสังกัดตน + global ("all") ==== */
type AdminNotif = {
  id: string;
  title?: string;
  message?: string;
  department?: string;     // อาจเป็นชื่อไทยเก่า
  departmentKey?: string;  // คีย์ normalize เช่น science_faculty
  createdAt?: Date | Timestamp | null;
};

const NotificationBell: React.FC<{
  currentAdmin: AdminProfile;
  allowedDeptKey: string;          // normalize แล้ว
}> = ({ currentAdmin, allowedDeptKey }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<AdminNotif[]>([]);
  const open = Boolean(anchorEl);

  // ใช้ localStorage เก็บเวลาเห็นล่าสุด (นับ badge ได้เสถียร โดยไม่ต้องแก้ schema)
  const LS_KEY = `admin_last_seen_notif_${currentAdmin.uid}`;
  const lastSeen = useMemo<number>(() => {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? Number(raw) : 0;
  }, [LS_KEY]);

  const unseenCount = useMemo(() => {
    return items.filter(n => {
      const t = n.createdAt instanceof Date
        ? n.createdAt.getTime()
        : (n.createdAt as any)?.toMillis?.() ?? 0;
      return t > lastSeen;
    }).length;
  }, [items, lastSeen]);

  useEffect(() => {
    // เราพยายามใช้ collection "adminNotifications" ถ้าไม่มีจะ fallback เป็น "notifications"
    const unsubscribers: Array<() => void> = [];
    const watch = (colName: string) => {
      // super_admin: ดึงทั้งหมด
      if (allowedDeptKey === 'all') {
        const qAll = query(collection(db, colName), orderBy('createdAt', 'desc'), limit(50));
        const un = onSnapshot(qAll, snap => {
          const arr = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
          setItems(arr);
        });
        unsubscribers.push(un);
        return;
      }

      // dept scope: ดึงเฉพาะ departmentKey == allowedDeptKey และ departmentKey == 'all'
      // (บางโปรเจ็คไม่ได้เก็บ departmentKey — ด้านล่างจึงมี fallback)
      const hasDeptKey = query(
        collection(db, colName),
        where('departmentKey', '==', allowedDeptKey),
        orderBy('createdAt', 'desc'),
        limit(30)
      );
      const hasAll = query(
        collection(db, colName),
        where('departmentKey', '==', 'all'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const un1 = onSnapshot(hasDeptKey, depSnap => {
        const depDocs = depSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setItems(prev => {
          const map = new Map<string, AdminNotif>();
          [...depDocs, ...prev].forEach(x => map.set(x.id, x));
          return Array.from(map.values()).sort((a, b) => {
            const ta = (a.createdAt as any)?.toMillis?.() ?? new Date(a.createdAt as any || 0).getTime();
            const tb = (b.createdAt as any)?.toMillis?.() ?? new Date(b.createdAt as any || 0).getTime();
            return tb - ta;
          }).slice(0, 60);
        });
      });
      const un2 = onSnapshot(hasAll, allSnap => {
        const allDocs = allSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setItems(prev => {
          const map = new Map<string, AdminNotif>();
          [...allDocs, ...prev].forEach(x => map.set(x.id, x));
          return Array.from(map.values()).sort((a, b) => {
            const ta = (a.createdAt as any)?.toMillis?.() ?? new Date(a.createdAt as any || 0).getTime();
            const tb = (b.createdAt as any)?.toMillis?.() ?? new Date(b.createdAt as any || 0).getTime();
            return tb - ta;
          }).slice(0, 60);
        });
      });
      unsubscribers.push(un1, un2);

      // Fallback: ถ้าเอกสารไม่มี departmentKey ให้ดึงล่าสุดแล้วกรองฝั่ง client ด้วย deptEquals
      const qLatest = query(collection(db, colName), orderBy('createdAt', 'desc'), limit(60));
      const un3 = onSnapshot(qLatest, snap => {
        const mixed = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const scoped = mixed.filter(n => {
          if (String(n.departmentKey || '').trim()) {
            // มี departmentKey แล้ว — ปล่อยให้ watcher ด้านบนจัดการ
            return false;
          }
          if (allowedDeptKey === 'all') return true;
          const dep = n.departmentKey || n.department;
          return dep === 'all' || deptEquals(dep as any, allowedDeptKey as any);
        });
        if (scoped.length) {
          setItems(prev => {
            const map = new Map<string, AdminNotif>();
            [...scoped, ...prev].forEach(x => map.set(x.id, x));
            return Array.from(map.values()).sort((a, b) => {
              const ta = (a.createdAt as any)?.toMillis?.() ?? new Date(a.createdAt as any || 0).getTime();
              const tb = (b.createdAt as any)?.toMillis?.() ?? new Date(b.createdAt as any || 0).getTime();
              return tb - ta;
            }).slice(0, 60);
          });
        }
      });
      unsubscribers.push(un3);
    };

    // ลองดูสองชื่อคอลเลกชัน
    watch('adminNotifications');
    watch('notifications');

    return () => unsubscribers.forEach(u => u());
  }, [allowedDeptKey, currentAdmin.uid]);

  const openMenu = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    // mark seen ทันที (local)
    localStorage.setItem(LS_KEY, String(Date.now()));
  };
  const closeMenu = () => setAnchorEl(null);

  const fmtTime = (v?: any) => {
    if (!v) return '';
    const d = v instanceof Date ? v : (v?.toDate?.() ?? new Date(v));
    try { return d.toLocaleString('th-TH'); } catch { return String(d); }
  };

  return (
    <>
      <IconButton onClick={openMenu} aria-label="notifications" sx={{ mr: 1 }}>
        <Badge color="error" badgeContent={unseenCount} max={99}>
          <NotificationsIcon htmlColor="#fff" />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, maxWidth: '90vw' } }}
      >
        {items.length === 0 ? (
          <MenuItem disabled>ไม่มีแจ้งเตือนในสังกัดของคุณ</MenuItem>
        ) : (
          items.slice(0, 20).map(n => (
            <MenuItem key={n.id} sx={{ whiteSpace: 'normal', alignItems: 'flex-start' }}>
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <NotificationsIcon fontSize="small" />
                </Avatar>
              </ListItemAvatar>
              <Box>
                <Typography fontWeight={700}>{n.title || 'แจ้งเตือน'}</Typography>
                {n.message && <Typography variant="body2" color="text.secondary">{n.message}</Typography>}
                <Typography variant="caption" color="text.secondary">
                  {getDepartmentLabel(n.departmentKey || n.department || 'all')} • {fmtTime(n.createdAt)}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
};
/** ==== จบกระดิ่งแจ้งเตือน ==== */

const AdminAttendancePanel: React.FC<Props> = ({ currentAdmin }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  // export filename dialog
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSelectedOnly, setExportSelectedOnly] = useState(false);
  const [exportFilename, setExportFilename] = useState(
    `attendance_${new Date().toISOString().slice(0,10)}.csv`
  );

  // code -> name map
  const [activityNameByCode, setActivityNameByCode] = useState<Record<string, string>>({});

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    activities: [],
    faculties: [],
    dateRange: { start: null, end: null }
  });

  const isSuperAdmin = currentAdmin.role === 'super_admin';
  const perms = (currentAdmin.permissions || []) as AdminPermission[];
  const canExport = isSuperAdmin || perms.includes('export_data') || perms.includes('view_reports');

  // —— scope สังกัดผู้ใช้
  const allowedDeptKey = normalizeDepartment(currentAdmin.department as any);
  const isDeptScoped = allowedDeptKey !== 'all';

  const baseRecords = useMemo(() => {
    if (!isDeptScoped) return records;
    return records.filter(r => deptEquals(r.department as any, allowedDeptKey));
  }, [records, isDeptScoped, allowedDeptKey]);

  const availableActivities = useMemo(
    () => [...new Set(baseRecords.map(r => r.activityCode))].sort(),
    [baseRecords]
  );
  const availableFaculties = useMemo(
    () => [...new Set(baseRecords.map(r => String(r.faculty || 'ไม่ระบุ')))].sort(),
    [baseRecords]
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

  const loadActivityNames = async (codes: string[]) => {
    const uniq = Array.from(new Set(codes.filter(Boolean)));
    if (uniq.length === 0) return setActivityNameByCode({});
    const results: Record<string, string> = {};
    await Promise.all(uniq.map(async (code) => {
      try {
        const ref = doc(db, 'activities', code);
        const s = await getDoc(ref);
        if (s.exists()) {
          const d: any = s.data();
          results[code] = d?.nameTh || d?.name || d?.title || code;
          return;
        }
        const qs = await getDocs(query(collection(db, 'activities'), where('code', '==', code)));
        const first = qs.docs[0]?.data() as any;
        results[code] = first?.nameTh || first?.name || first?.title || code;
      } catch {
        results[code] = code;
      }
    }));
    setActivityNameByCode(results);
  };

  const load = async () => {
    setLoading(true);
    setProgress(20);
    try {
      const data = await getAllActivityRecords(); // โหลดทั้งหมดก่อน แล้ว scope ฝั่ง client ด้วย deptEquals

      setProgress(60);
      const normalized = data.map(d => ({
        ...d,
        timestamp: d.timestamp instanceof Date ? d.timestamp : new Date(d.timestamp)
      }));
      setRecords(normalized);

      await loadActivityNames(normalized.map(r => r.activityCode));

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

  useEffect(() => { load(); }, [allowedDeptKey]);

  useEffect(() => {
    if (isDeptScoped) {
      setFilters(f => ({
        ...f,
        activities: f.activities.filter(a => availableActivities.includes(a)),
        faculties: f.faculties.filter(x => availableFaculties.includes(x)),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDeptScoped, allowedDeptKey, availableActivities.join(','), availableFaculties.join(',')]);

  useEffect(() => {
    let list = [...baseRecords];
    const s = filters.search.trim().toLowerCase();
    if (s) {
      list = list.filter(r => {
        const activityName = (activityNameByCode[r.activityCode] || '').toLowerCase();
        return (
          r.activityCode.toLowerCase().includes(s) ||
          activityName.includes(s) ||
          r.studentId.toLowerCase().includes(s) ||
          (r.firstName || '').toLowerCase().includes(s) ||
          (r.lastName || '').toLowerCase().includes(s) ||
          String(r.faculty || '').toLowerCase().includes(s)
        );
      });
    }
    if (filters.activities.length) {
      list = list.filter(r => filters.activities.includes(r.activityCode));
    }
    if (filters.faculties.length) {
      list = list.filter(r => filters.faculties.includes(String(r.faculty || 'ไม่ระบุ')));
    }
    const { start, end } = filters.dateRange;
    if (start || end) {
      list = list.filter(r => {
        const d = new Date(r.timestamp);
        if (start && end) return d >= start && d <= end;
        if (start) return d >= start;
        if (end) return d <= end;
        return true;
      });
    }
    setFilteredRecords(list);
    setSelected(sels => sels.filter(id => list.some(r => r.id === id)));
  }, [baseRecords, filters, activityNameByCode]);

  const buildCsv = (rows: ActivityRecord[]) => {
    const headers = [
      'วันที่','เวลา','รหัสนักศึกษา','ชื่อ','นามสกุล',
      'คณะ','สาขา','ชื่อกิจกรรม','รหัสกิจกรรม'
    ];
    const lines = rows.map(r => {
      const d = new Date(r.timestamp);
      const name = activityNameByCode[r.activityCode] || r.activityCode;
      const cell = (x: any) => {
        const v = String(x ?? '').replace(/"/g, '""');
        return v.includes(',') ? `"${v}"` : v;
      };
      return [
        cell(d.toLocaleDateString('th-TH')),
        cell(d.toLocaleTimeString('th-TH')),
        cell(r.studentId),
        cell(r.firstName),
        cell(r.lastName),
        cell(String(r.faculty || 'ไม่ระบุ')),
        cell(getDepartmentLabel(r.department as any) || ''),
        cell(name),
        cell(r.activityCode),
      ].join(',');
    });
    return ['\uFEFF' + headers.join(','), ...lines].join('\n');
  };

  const doExport = (selectedOnly = false, filename?: string) => {
    if (!canExport) return alert('คุณไม่มีสิทธิ์ส่งออกข้อมูล', 'warning');
    const rows = selectedOnly
      ? filteredRecords.filter(r => selected.includes(r.id))
      : filteredRecords;
    if (selectedOnly && rows.length === 0) return alert('กรุณาเลือกรายการที่ต้องการส่งออก', 'warning');
    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (filename && filename.trim()) || (selectedOnly
      ? `selected_attendance_${new Date().toISOString().split('T')[0]}.csv`
      : `attendance_${new Date().toISOString().split('T')[0]}.csv`);
    a.click();
    URL.revokeObjectURL(url);
    alert(`ส่งออกข้อมูล${selectedOnly ? 'ที่เลือก' : 'ทั้งหมด'} ${rows.length} รายการสำเร็จ 📊`, 'success');
  };

  const openExportDialog = (selectedOnly = false) => {
    if (!canExport) return;
    setExportSelectedOnly(selectedOnly);
    setExportFilename(
      `${selectedOnly ? 'selected_' : ''}attendance_${new Date().toISOString().slice(0,10)}.csv`
    );
    setExportOpen(true);
  };

  const handleDeleteOne = async (rec: ActivityRecord) => {
    if (!isSuperAdmin) return alert('ต้องเป็นผู้ดูแลระบบสูงสุดจึงจะลบได้', 'warning');
    if (!confirm('ยืนยันลบรายการนี้?')) return;
    try {
      await adjustParticipantsByActivityCode(rec.activityCode, -1);
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
      const countByCode: Record<string, number> = {};
      const chosen = filteredRecords.filter(r => selected.includes(r.id));
      chosen.forEach(r => { countByCode[r.activityCode] = (countByCode[r.activityCode] || 0) + 1; });

      await Promise.all(
        Object.entries(countByCode).map(([code, cnt]) => adjustParticipantsByActivityCode(code, -cnt))
      );

      for (const r of chosen) await deleteActivityRecord(r.id);

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
      search: '',
      activities: [],
      faculties: [],
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

  const ActivityChip = ({ code }: { code: string }) => {
    const name = activityNameByCode[code] || code;
    return (
      <Tooltip title={`รหัสกิจกรรม: ${code}`}>
        <Chip size="small" color="primary" label={name} />
      </Tooltip>
    );
  };

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

          {/* 🔔 กระดิ่งแจ้งเตือน: แสดงเฉพาะแจ้งเตือนในสังกัด */}
          <NotificationBell currentAdmin={currentAdmin} allowedDeptKey={allowedDeptKey} />

          <Chip
            label={
              isDeptScoped
                ? `สังกัด: ${getDepartmentLabel(currentAdmin.department)}`
                : 'Super Admin (ทุกสังกัด)'
            }
            color={isDeptScoped ? 'info' : 'warning'}
            variant="filled"
            sx={{ mr: 2 }}
          />
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

              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>กิจกรรม</InputLabel>
                  <Select
                    multiple value={filters.activities}
                    onChange={(e) => setFilters(v => ({ ...v, activities: (e.target.value as string[]) }))}
                    input={<OutlinedInput label="กิจกรรม" />}
                    renderValue={(selected) => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .5 }}>
                      {selected.map((v) => <Chip key={v} size="small" label={activityNameByCode[v] || v} />)}
                    </Box>}
                  >
                    {availableActivities.map((a) => (
                      <MenuItem key={a} value={a}>
                        <Checkbox checked={filters.activities.includes(a)} />
                        <ListItemText primary={activityNameByCode[a] || a} secondary={a} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>คณะ</InputLabel>
                  <Select
                    multiple value={filters.faculties}
                    onChange={(e) => setFilters(v => ({ ...v, faculties: (e.target.value as string[]) }))}
                    input={<OutlinedInput label="คณะ" />}
                    renderValue={(selected) => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .5 }}>
                      {selected.map((v) => <Chip key={v} size="small" label={v} />)}
                    </Box>}
                  >
                    {availableFaculties.map((d) => (
                      <MenuItem key={d} value={d}>
                        <Checkbox checked={filters.faculties.includes(d)} />
                        <ListItemText primary={d} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'stretch', md: 'flex-end' } }}>
                <Button variant="outlined" onClick={clearFilters} startIcon={<ClearIcon />}>ล้างตัวกรอง</Button>
                <ButtonGroup variant="contained">
                  <Button onClick={load} disabled={loading} startIcon={<RefreshIcon />}>รีเฟรช</Button>
                  <Tooltip title={canExport ? 'ส่งออก CSV' : 'ต้องมีสิทธิ์ Export หรือ View Reports'}>
                    <span>
                      <Button color="success" onClick={() => openExportDialog(false)} startIcon={<DownloadIcon />} disabled={!canExport}>
                        ส่งออก
                      </Button>
                    </span>
                  </Tooltip>
                </ButtonGroup>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* List / Table */}
        {!isMobile ? (
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}><EventIcon /></Avatar>
                <Typography variant="h6" fontWeight="bold">รายการลงทะเบียน</Typography>
                <Chip label={`${filteredRecords.length} รายการ`} color="primary" />
                {selected.length > 0 && <Chip label={`เลือก ${selected.length}`} color="secondary" />}
                <Box sx={{ flex: 1 }} />
                <ButtonGroup variant="contained">
                  <Tooltip title={canExport ? 'ส่งออกเฉพาะที่เลือก' : 'ต้องมีสิทธิ์ Export หรือ View Reports'}>
                    <span>
                      <Button color="info" onClick={() => openExportDialog(true)} startIcon={<GetAppIcon />} disabled={!canExport || selected.length === 0}>
                        ส่งออกที่เลือก
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title={isSuperAdmin ? 'ลบที่เลือก' : 'ลบได้เฉพาะ Super Admin'}>
                    <span>
                      <Button color="error" onClick={handleDeleteSelected} startIcon={<DeleteIcon />} disabled={!isSuperAdmin || selected.length === 0}>
                        ลบที่เลือก
                      </Button>
                    </span>
                  </Tooltip>
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
                      <TableCell>กิจกรรม</TableCell>
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
                          <TableCell><Chip size="small" label={getDepartmentLabel(r.department as any)} variant="outlined" color="secondary" /></TableCell>
                          <TableCell><ActivityChip code={r.activityCode} /></TableCell>
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
        ) : (
          // Mobile cards
          <Grid container spacing={2}>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Grid item xs={12} key={i}><Skeleton variant="rounded" height={96} /></Grid>
              ))
            ) : filteredRecords.length === 0 ? (
              <Grid item xs={12}><Card><CardContent><Typography align="center" color="text.secondary">ไม่มีข้อมูล</Typography></CardContent></Card></Grid>
            ) : (
              filteredRecords.map((r) => {
                const d = new Date(r.timestamp);
                return (
                  <Grid item xs={12} key={r.id}>
                    <Card variant="outlined">
                      <CardContent sx={{ display: 'flex', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}><EventIcon /></Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography fontWeight={700}>{r.firstName} {r.lastName}</Typography>
                          <Typography variant="body2" color="text.secondary">{r.studentId}</Typography>
                          <Box sx={{ display: 'flex', gap: .5, flexWrap: 'wrap', mt: .5 }}>
                            <Chip size="small" label={String(r.faculty || 'ไม่ระบุ')} variant="outlined" color="info" />
                            <Chip size="small" label={getDepartmentLabel(r.department as any)} variant="outlined" color="secondary" />
                            <ActivityChip code={r.activityCode} />
                            <Chip size="small" label={d.toLocaleDateString('th-TH')} />
                            <Chip size="small" label={d.toLocaleTimeString('th-TH')} />
                          </Box>
                        </Box>
                        <Box>
                          <Checkbox
                            checked={selected.includes(r.id)}
                            onChange={() =>
                              setSelected(prev => prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id])
                            }
                          />
                          <Tooltip title="รายละเอียด">
                            <IconButton color="info" onClick={() => { setSelectedRecord(r); setDetailOpen(true); }}><ViewIcon /></IconButton>
                          </Tooltip>
                          <Tooltip title={isSuperAdmin ? 'ลบ' : 'ลบ (เฉพาะ Super Admin)'}>
                            <span>
                              <IconButton color="error" disabled={!isSuperAdmin} onClick={() => handleDeleteOne(r)}><DeleteIcon /></IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })
            )}
          </Grid>
        )}
      </Container>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        {selectedRecord && (
          <>
            <DialogTitle>รายละเอียดการลงทะเบียน</DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: .5 }}>
                <Grid item xs={12} sm={6}><Typography variant="body2" color="text.secondary">รหัสนักศึกษา</Typography><Typography variant="h6">{selectedRecord.studentId}</Typography></Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">กิจกรรม</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ActivityChip code={selectedRecord.activityCode} />
                    <Tooltip title="คัดลอกรหัสกิจกรรม">
                      <IconButton size="small" onClick={() => navigator.clipboard.writeText(selectedRecord.activityCode).catch(()=>{})}>
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Grid>
                <Grid item xs={12}><Typography variant="body2" color="text.secondary">ชื่อ-นามสกุล</Typography><Typography variant="h6">{selectedRecord.firstName} {selectedRecord.lastName}</Typography></Grid>
                <Grid item xs={12} sm={6}><Typography variant="body2" color="text.secondary">คณะ</Typography><Typography>{String(selectedRecord.faculty || 'ไม่ระบุ')}</Typography></Grid>
                <Grid item xs={12} sm={6}><Typography variant="body2" color="text.secondary">สาขาวิชา</Typography><Typography>{getDepartmentLabel(selectedRecord.department as any)}</Typography></Grid>
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

      {/* Export filename dialog */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>ส่งออก CSV (เปิดด้วย Excel)</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="ชื่อไฟล์"
            helperText="ตั้งชื่อไฟล์พร้อม .csv (รองรับภาษาไทย)"
            value={exportFilename}
            onChange={(e) => setExportFilename(e.target.value)}
            sx={{ mt: 1 }}
          />
          <Alert severity="info" sx={{ mt: 2 }}>
            รูปแบบคอลัมน์: วันที่, เวลา, รหัสนักศึกษา, ชื่อ, นามสกุล, คณะ, สาขา, <b>ชื่อกิจกรรม</b>, รหัสกิจกรรม
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => { setExportOpen(false); doExport(exportSelectedOnly, exportFilename); }}>
            ส่งออก
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack} autoHideDuration={4000} onClose={() => setSnack(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={msgType} variant="filled" onClose={() => setSnack(false)}>{msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminAttendancePanel;
