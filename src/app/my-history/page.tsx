// app/my-history/page.tsx
'use client';

import React, { useEffect, useMemo, useState, useDeferredValue, startTransition } from 'react';
import {
  Box,
  Container,
  Typography,
  Chip,
  Stack,
  TextField,
  InputAdornment,
  CircularProgress,
  Button,
  Skeleton,
  Avatar,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Search,
  History as HistoryIcon,
  EventAvailable,
  CalendarToday,
  LocationOn,
  School,
  LoginOutlined,
  InfoOutlined,
  AccessTime,
  CheckCircleOutline,
  ArrowBack,
  Assignment as SurveyIcon,
  Launch as LaunchIcon,
  ExpandMore as ExpandMoreIcon,
  Description as FileIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../../lib/firebaseAuth';
import { getSurveyWindowStatus, surveyStatusLabelTh } from '../../lib/surveyWindow';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useAlertDialog } from '@/components/providers/ConfirmDialogProvider';

type RegistrationRecord = {
  id: string;
  activityCode: string;
  activityName?: string;
  studentId: string;
  firstName: string;
  lastName: string;
  department: string;
  timestamp: Date;
  location?: string;
  bannerUrl?: string;
  surveyEnabled?: boolean;
  surveyCompleted?: boolean;
  surveyStatus?: 'disabled' | 'not_started' | 'open' | 'expired' | 'forced_open';
  surveyStatusLabel?: string;
  files?: any[];
  sessions?: any[];
};

type FilterKey = 'all' | 'survey' | 'files';

const formatDate = (d: Date) =>
  d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

const formatTime = (d: Date) =>
  d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

const formatShortDate = (d: Date) =>
  d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

function countFiles(r: RegistrationRecord) {
  const main = r.files?.length || 0;
  const sess = (r.sessions || []).reduce((n, s) => n + (s.files?.length || 0), 0);
  return main + sess;
}

const MyHistoryPage: React.FC = () => {
  const { user, userData, loading: authLoading, login: userLogin } = useAuth();
  const alertDialog = useAlertDialog();

  const [records, setRecords] = useState<RegistrationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [searchText, setSearchText] = useState('');
  const deferredSearch = useDeferredValue(searchText);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const handleAuthDownload = async (fileUrl: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        await alertDialog('ต้องเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนดาวน์โหลดไฟล์', 'warning');
        return;
      }
      const token = await currentUser.getIdToken();
      const encodedUrl = btoa(fileUrl);
      const res = await fetch(`/api/download?file=${encodedUrl}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        await alertDialog('ดาวน์โหลดไม่สำเร็จ', err?.error || 'ดาวน์โหลดไม่สำเร็จ', 'warning');
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e: any) {
      console.error('Download error:', e);
      await alertDialog('เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการดาวน์โหลด', 'warning');
    }
  };

  useEffect(() => {
    if (!userData?.studentId) return;

    let cancelled = false;

    const fetchRecords = async () => {
      setLoading(true);
      setEnriching(false);
      try {
        const q = query(
          collection(db, 'activityRecords'),
          where('studentId', '==', userData.studentId)
        );
        const snap = await getDocs(q);
        if (cancelled) return;

        const rawRecords: RegistrationRecord[] = snap.docs.map((d) => {
          const data: any = d.data();
          const ts: Date =
            data.timestamp?.toDate?.() ??
            (data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp || Date.now()));

          return {
            id: d.id,
            activityCode: data.activityCode || '',
            activityName: data.activityName || data.activityCode || '',
            studentId: data.studentId || '',
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            department: data.department || '',
            timestamp: ts,
          };
        });

        rawRecords.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setRecords(rawRecords);
        setLoading(false);

        // Enrich in background so list appears first
        setEnriching(true);
        let completedSurveyCodes = new Set<string>();
        if (user?.uid) {
          try {
            const surveyQ = query(collection(db, 'surveyResponses'), where('userId', '==', user.uid));
            const surveySnap = await getDocs(surveyQ);
            completedSurveyCodes = new Set(
              surveySnap.docs.map((d) => (d.data().activityCode || '').toUpperCase())
            );
          } catch (err) {
            console.error('Error fetching surveys:', err);
          }
        }

        const uniqueCodes = [...new Set(rawRecords.map((r) => r.activityCode))].filter(Boolean);
        const activityMap: Record<
          string,
          {
            activityName?: string;
            location?: string;
            bannerUrl?: string;
            surveyEnabled?: boolean;
            surveyStatus?: RegistrationRecord['surveyStatus'];
            surveyStatusLabel?: string;
            files?: any[];
            sessions?: any[];
          }
        > = {};

        if (uniqueCodes.length > 0) {
          const chunks: string[][] = [];
          for (let i = 0; i < uniqueCodes.length; i += 30) {
            chunks.push(uniqueCodes.slice(i, i + 30));
          }
          try {
            const actSnaps = await Promise.all(
              chunks.map((chunk) =>
                getDocs(query(collection(db, 'activityQRCodes'), where('activityCode', 'in', chunk)))
              )
            );
            actSnaps.forEach((actSnap) => {
              actSnap.forEach((d) => {
                const actData = d.data() as any;
                const code = actData.activityCode;
                if (code) {
                  const cfg = actData.surveyConfig || {};
                  const win = getSurveyWindowStatus({
                    enabled: cfg.enabled,
                    questionsLength: cfg.questions?.length ?? 0,
                    openAt: cfg.openAt,
                    closeAt: cfg.closeAt,
                    surveyOpenMinutes: cfg.surveyOpenMinutes,
                    forceOpenUntil: cfg.forceOpenUntil,
                    userForceOpenUntil: cfg.userForceOpenUntil,
                    userId: user?.uid,
                    endDateTime: actData.endDateTime,
                    sessions: actData.sessions || [],
                  });
                  activityMap[code] = {
                    activityName: actData.activityName || code,
                    location: actData.location,
                    bannerUrl: actData.bannerUrl,
                    surveyEnabled: Boolean(cfg.enabled),
                    surveyStatus: win.label,
                    surveyStatusLabel: surveyStatusLabelTh(win),
                    files: actData.files || [],
                    sessions: actData.sessions || [],
                  };
                }
              });
            });
          } catch (err) {
            console.error('Error batch fetching activities:', err);
          }
        }

        if (cancelled) return;

        const enriched = rawRecords.map((r) => ({
          ...r,
          activityName: activityMap[r.activityCode]?.activityName || r.activityName || r.activityCode,
          location: activityMap[r.activityCode]?.location,
          bannerUrl: activityMap[r.activityCode]?.bannerUrl,
          surveyEnabled: activityMap[r.activityCode]?.surveyEnabled || false,
          surveyCompleted: completedSurveyCodes.has((r.activityCode || '').toUpperCase()),
          surveyStatus: activityMap[r.activityCode]?.surveyStatus,
          surveyStatusLabel: activityMap[r.activityCode]?.surveyStatusLabel,
          files: activityMap[r.activityCode]?.files || [],
          sessions: activityMap[r.activityCode]?.sessions || [],
        }));

        setRecords(enriched);
      } catch (e) {
        console.error('Error fetching history:', e);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setEnriching(false);
        }
      }
    };

    fetchRecords();
    return () => {
      cancelled = true;
    };
  }, [userData?.studentId, user?.uid]);

  const surveyPendingCount = useMemo(
    () =>
      records.filter(
        (r) =>
          r.surveyEnabled &&
          !r.surveyCompleted &&
          (r.surveyStatus === 'open' || r.surveyStatus === 'forced_open')
      ).length,
    [records]
  );
  const withFilesCount = useMemo(() => records.filter((r) => countFiles(r) > 0).length, [records]);

  const filteredRecords = useMemo(() => {
    let list = records;
    if (filter === 'survey') {
      list = list.filter(
        (r) =>
          r.surveyEnabled &&
          !r.surveyCompleted &&
          (r.surveyStatus === 'open' || r.surveyStatus === 'forced_open' || r.surveyStatus === 'not_started')
      );
    } else if (filter === 'files') {
      list = list.filter((r) => countFiles(r) > 0);
    }
    const s = deferredSearch.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (r) =>
        r.activityCode.toLowerCase().includes(s) ||
        (r.activityName || '').toLowerCase().includes(s) ||
        (r.location || '').toLowerCase().includes(s) ||
        r.department.toLowerCase().includes(s)
    );
  }, [records, deferredSearch, filter]);

  const groupedByDate = useMemo(() => {
    const groups: { key: string; label: string; items: RegistrationRecord[] }[] = [];
    const map = new Map<string, RegistrationRecord[]>();
    filteredRecords.forEach((r) => {
      const dateKey = r.timestamp.toDateString();
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(r);
    });
    map.forEach((items, key) => {
      groups.push({ key, label: formatDate(items[0].timestamp), items });
    });
    return groups;
  }, [filteredRecords]);

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const pageShell = (children: React.ReactNode) => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'var(--page-bg)',
        color: 'var(--page-text)',
      }}
    >
      <Navbar />
      {children}
      <Footer />
    </Box>
  );

  if (authLoading) {
    return pageShell(
      <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 12 }}>
        <CircularProgress size={36} />
      </Box>
    );
  }

  if (!user) {
    return pageShell(
      <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, py: 10 }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Box
            sx={{
              maxWidth: 420,
              mx: 'auto',
              p: { xs: 3.5, sm: 4.5 },
              borderRadius: '24px',
              textAlign: 'center',
              bgcolor: 'var(--page-card-solid)',
              border: '1px solid var(--page-border)',
              boxShadow: 'var(--page-shadow)',
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '18px',
                background: 'linear-gradient(145deg, #0a6bcf 0%, #1aa35a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2.5,
              }}
            >
              <HistoryIcon sx={{ fontSize: 32, color: '#fff' }} />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ mb: 1, letterSpacing: '-0.02em' }}>
              ประวัติการลงทะเบียน
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--page-text-secondary)', mb: 3, lineHeight: 1.65 }}>
              เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย เพื่อดูกิจกรรมที่เคยลงทะเบียน เอกสาร และแบบประเมินที่ค้างอยู่
            </Typography>
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={userLogin}
              startIcon={<LoginOutlined />}
              sx={{
                borderRadius: '14px',
                py: 1.5,
                fontWeight: 700,
                textTransform: 'none',
                bgcolor: '#0a6bcf',
                boxShadow: '0 8px 20px rgba(10, 107, 207, 0.28)',
                '&:hover': { bgcolor: '#0858ad' },
              }}
            >
              เข้าสู่ระบบ
            </Button>
          </Box>
        </motion.div>
      </Box>
    );
  }

  return pageShell(
    <Box sx={{ flexGrow: 1, pb: { xs: 12, lg: 8 }, pt: { xs: 2, lg: 0 } }}>
      {/* Compact sticky toolbar — content above the fold */}
      <Box
        sx={{
          position: 'sticky',
          // มือถือ: navbar อยู่ล่าง → ติดบนจอ | เดสก์ท็อป: ติดใต้ navbar (~64px)
          top: { xs: 0, lg: 64 },
          zIndex: 20,
          pt: { xs: 1.5, lg: 1.25 },
          pb: 1.5,
          bgcolor: 'color-mix(in srgb, var(--page-bg) 88%, transparent)',
          backdropFilter: 'blur(16px) saturate(160%)',
          borderBottom: '1px solid var(--page-border)',
        }}
      >
        <Container maxWidth="md">
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }} spacing={1}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
              <Avatar
                src={userData?.photoURL || user?.photoURL || undefined}
                sx={{ width: 44, height: 44, border: '2px solid color-mix(in srgb, #0a6bcf 35%, transparent)', flexShrink: 0 }}
              >
                {(userData?.firstName?.charAt(0) || user?.displayName?.charAt(0) || '?').toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  component="h1"
                  noWrap
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: '1rem', sm: '1.15rem' },
                    letterSpacing: '-0.02em',
                    lineHeight: 1.25,
                  }}
                >
                  {userData?.username?.trim() ||
                    userData?.displayName ||
                    [userData?.firstName, userData?.lastName].filter(Boolean).join(' ') ||
                    user?.displayName ||
                    'ผู้ใช้'}
                </Typography>
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ color: 'var(--page-text-secondary)', fontWeight: 600, display: 'block' }}
                >
                  {userData?.department && userData.department !== 'ไม่ระบุ'
                    ? userData.department
                    : userData?.faculty && userData.faculty !== 'ไม่ระบุ'
                      ? userData.faculty
                      : '—'}
                </Typography>
              </Box>
            </Stack>
            <IconButton
              component={Link}
              href="/"
              aria-label="กลับหน้าแรก"
              size="small"
              sx={{
                border: '1px solid var(--page-border)',
                bgcolor: 'var(--page-card)',
                flexShrink: 0,
              }}
            >
              <ArrowBack fontSize="small" />
            </IconButton>
          </Stack>

          <TextField
            fullWidth
            size="small"
            placeholder="ค้นหาชื่อ รหัส หรือสถานที่…"
            value={searchText}
            onChange={(e) => startTransition(() => setSearchText(e.target.value))}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'var(--page-text-secondary)', fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: searchText ? (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label="ล้างคำค้น" onClick={() => setSearchText('')}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
              sx: {
                borderRadius: '14px',
                bgcolor: 'var(--page-card-solid)',
                '& fieldset': { borderColor: 'var(--page-border)' },
                '& input': { py: 1.15, fontSize: '0.95rem' },
              },
            }}
          />

          <Stack direction="row" spacing={1} sx={{ mt: 1.25, overflowX: 'auto', pb: 0.25, scrollbarWidth: 'none' }}>
            {(
              [
                { key: 'all' as FilterKey, label: 'ทั้งหมด', count: records.length },
                { key: 'survey' as FilterKey, label: 'ค้างแบบประเมิน', count: surveyPendingCount },
                { key: 'files' as FilterKey, label: 'มีเอกสาร', count: withFilesCount },
              ] as const
            ).map((f) => {
              const active = filter === f.key;
              return (
                <Chip
                  key={f.key}
                  clickable
                  onClick={() => setFilter(f.key)}
                  label={`${f.label}${f.count ? ` (${f.count})` : ''}`}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    height: 32,
                    borderRadius: '10px',
                    bgcolor: active ? '#0a6bcf' : 'var(--page-card-solid)',
                    color: active ? '#fff' : 'var(--page-text)',
                    border: active ? '1px solid #0a6bcf' : '1px solid var(--page-border)',
                    '&:hover': { bgcolor: active ? '#0858ad' : 'color-mix(in srgb, var(--page-card) 80%, #0a6bcf)' },
                  }}
                />
              );
            })}
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ mt: 2.5 }}>
        {loading ? (
          <Stack spacing={1.5}>
            {[1, 2, 3, 4].map((i) => (
              <Box
                key={i}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  bgcolor: 'var(--page-card-solid)',
                  border: '1px solid var(--page-border)',
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Skeleton variant="rounded" width={56} height={56} sx={{ borderRadius: '12px', flexShrink: 0 }} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Skeleton width="70%" height={22} sx={{ mb: 0.75 }} />
                    <Skeleton width="45%" height={16} />
                  </Box>
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : filteredRecords.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 10, px: 2 }}>
            <InfoOutlined sx={{ fontSize: 56, color: 'var(--page-text-secondary)', opacity: 0.45, mb: 1.5 }} />
            <Typography variant="h6" fontWeight={800} sx={{ mb: 0.75 }}>
              {records.length === 0
                ? 'ยังไม่มีประวัติ'
                : filter === 'survey'
                  ? 'ไม่มีแบบประเมินค้าง'
                  : filter === 'files'
                    ? 'ไม่พบเอกสารแนบ'
                    : 'ไม่พบผลลัพธ์'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--page-text-secondary)', mb: 2.5 }}>
              {records.length === 0
                ? 'เมื่อลงทะเบียนกิจกรรมแล้ว จะแสดงที่นี่ทันที'
                : 'ลองเปลี่ยนตัวกรองหรือคำค้นหา'}
            </Typography>
            {records.length === 0 ? (
              <Button
                component={Link}
                href="/"
                variant="contained"
                sx={{
                  borderRadius: '12px',
                  px: 3.5,
                  py: 1.2,
                  fontWeight: 700,
                  textTransform: 'none',
                  bgcolor: '#0a6bcf',
                }}
              >
                ดูกิจกรรมทั้งหมด
              </Button>
            ) : (
              <Button
                variant="outlined"
                onClick={() => {
                  setFilter('all');
                  setSearchText('');
                }}
                sx={{ borderRadius: '12px', fontWeight: 700, textTransform: 'none' }}
              >
                ล้างตัวกรอง
              </Button>
            )}
          </Box>
        ) : (
          <Stack spacing={3}>
            {groupedByDate.map((group) => (
              <Box key={group.key}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25, px: 0.5 }}>
                  <CalendarToday sx={{ fontSize: 15, color: 'var(--page-text-secondary)' }} />
                  <Typography variant="caption" fontWeight={800} sx={{ color: 'var(--page-text-secondary)' }}>
                    {group.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--page-text-secondary)', opacity: 0.7 }}>
                    · {group.items.length}
                  </Typography>
                </Stack>

                <Stack spacing={1.25}>
                  <AnimatePresence initial={false}>
                    {group.items.map((record, idx) => {
                      const fileCount = countFiles(record);
                      const surveyOpen =
                        record.surveyStatus === 'open' || record.surveyStatus === 'forced_open';
                      const needsSurvey = Boolean(
                        record.surveyEnabled && !record.surveyCompleted && surveyOpen
                      );
                      const surveyPendingLater = Boolean(
                        record.surveyEnabled &&
                          !record.surveyCompleted &&
                          (record.surveyStatus === 'not_started' || record.surveyStatus === 'expired')
                      );
                      const expanded = Boolean(expandedCards[record.id]);
                      const hasDetails = fileCount > 0 || (record.sessions && record.sessions.length > 0);

                      return (
                        <motion.div
                          key={record.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.28, delay: Math.min(idx * 0.03, 0.18) }}
                        >
                          <Box
                            sx={{
                              borderRadius: '16px',
                              bgcolor: 'var(--page-card-solid)',
                              border: needsSurvey
                                ? '1px solid color-mix(in srgb, #e8a317 55%, var(--page-border))'
                                : '1px solid var(--page-border)',
                              overflow: 'hidden',
                              transition: 'border-color 0.2s, box-shadow 0.2s',
                              '&:hover': {
                                boxShadow: '0 10px 28px rgba(0,0,0,0.06)',
                              },
                            }}
                          >
                            <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
                              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                {/* Thumb */}
                                <Box sx={{ flexShrink: 0 }}>
                                  {record.bannerUrl ? (
                                    <Box
                                      sx={{
                                        position: 'relative',
                                        width: { xs: 52, sm: 60 },
                                        height: { xs: 52, sm: 60 },
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                      }}
                                    >
                                      <Image
                                        src={record.bannerUrl}
                                        alt=""
                                        fill
                                        sizes="60px"
                                        style={{ objectFit: 'cover' }}
                                      />
                                    </Box>
                                  ) : (
                                    <Box
                                      sx={{
                                        width: { xs: 52, sm: 60 },
                                        height: { xs: 52, sm: 60 },
                                        borderRadius: '12px',
                                        background: 'linear-gradient(145deg, #0a6bcf 0%, #1aa35a 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <EventAvailable sx={{ fontSize: 26, color: '#fff' }} />
                                    </Box>
                                  )}
                                </Box>

                                {/* Meta */}
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                  <Typography
                                    fontWeight={800}
                                    sx={{
                                      fontSize: { xs: '0.95rem', sm: '1.02rem' },
                                      lineHeight: 1.3,
                                      letterSpacing: '-0.02em',
                                      mb: 0.35,
                                    }}
                                  >
                                    {record.activityName || record.activityCode}
                                  </Typography>

                                  <Stack
                                    direction="row"
                                    spacing={1.25}
                                    flexWrap="wrap"
                                    useFlexGap
                                    sx={{ color: 'var(--page-text-secondary)', rowGap: 0.25 }}
                                  >
                                    <Stack direction="row" spacing={0.35} alignItems="center">
                                      <AccessTime sx={{ fontSize: 13 }} />
                                      <Typography variant="caption" fontWeight={600}>
                                        {formatShortDate(record.timestamp)} · {formatTime(record.timestamp)}
                                      </Typography>
                                    </Stack>
                                    {record.location && (
                                      <Stack direction="row" spacing={0.35} alignItems="center">
                                        <LocationOn sx={{ fontSize: 13 }} />
                                        <Typography
                                          variant="caption"
                                          fontWeight={600}
                                          sx={{
                                            maxWidth: 160,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {record.location}
                                        </Typography>
                                      </Stack>
                                    )}
                                    {record.department && (
                                      <Stack direction="row" spacing={0.35} alignItems="center" sx={{ display: { xs: 'none', sm: 'flex' } }}>
                                        <School sx={{ fontSize: 13 }} />
                                        <Typography variant="caption" fontWeight={600}>
                                          {record.department}
                                        </Typography>
                                      </Stack>
                                    )}
                                  </Stack>

                                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                                    <Chip
                                      size="small"
                                      icon={<CheckCircleOutline sx={{ fontSize: '0.9rem !important' }} />}
                                      label="ลงทะเบียนแล้ว"
                                      sx={{
                                        height: 24,
                                        fontWeight: 700,
                                        fontSize: '0.7rem',
                                        bgcolor: 'rgba(26, 163, 90, 0.12)',
                                        color: '#1a7a45',
                                        borderRadius: '8px',
                                      }}
                                    />
                                    {fileCount > 0 && (
                                      <Chip
                                        size="small"
                                        icon={<FileIcon sx={{ fontSize: '0.85rem !important' }} />}
                                        label={`เอกสาร ${fileCount}`}
                                        onClick={() => toggleExpand(record.id)}
                                        sx={{
                                          height: 24,
                                          fontWeight: 700,
                                          fontSize: '0.7rem',
                                          bgcolor: 'rgba(10, 107, 207, 0.1)',
                                          color: '#0a6bcf',
                                          borderRadius: '8px',
                                          cursor: 'pointer',
                                        }}
                                      />
                                    )}
                                    {record.surveyEnabled && record.surveyCompleted && (
                                      <Chip
                                        size="small"
                                        icon={<SurveyIcon sx={{ fontSize: '0.85rem !important' }} />}
                                        label="ทำแบบประเมินแล้ว"
                                        sx={{
                                          height: 24,
                                          fontWeight: 700,
                                          fontSize: '0.7rem',
                                          borderRadius: '8px',
                                        }}
                                      />
                                    )}
                                  </Stack>
                                </Box>
                              </Stack>

                              {/* Primary actions — always visible */}
                              <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1}
                                sx={{ mt: 1.5 }}
                                alignItems={{ sm: 'center' }}
                              >
                                {needsSurvey && (
                                  <Button
                                    component={Link}
                                    href={`/register?activity=${record.activityCode}`}
                                    variant="contained"
                                    size="small"
                                    startIcon={<SurveyIcon />}
                                    sx={{
                                      flex: { sm: 1 },
                                      fontWeight: 800,
                                      fontSize: '0.8rem',
                                      borderRadius: '10px',
                                      textTransform: 'none',
                                      py: 0.85,
                                      bgcolor: '#e8a317',
                                      color: '#1d1d1f',
                                      boxShadow: 'none',
                                      '&:hover': { bgcolor: '#d4920f', boxShadow: 'none' },
                                    }}
                                  >
                                    {record.surveyStatus === 'forced_open'
                                      ? 'ทำแบบประเมิน (ขยายเวลา)'
                                      : 'ทำแบบประเมิน (เปิดอยู่)'}
                                  </Button>
                                )}
                                {surveyPendingLater && (
                                  <Button
                                    component={Link}
                                    href={`/register?activity=${record.activityCode}`}
                                    variant="outlined"
                                    size="small"
                                    startIcon={<SurveyIcon />}
                                    sx={{
                                      flex: { sm: 1 },
                                      fontWeight: 700,
                                      fontSize: '0.8rem',
                                      borderRadius: '10px',
                                      textTransform: 'none',
                                      py: 0.85,
                                    }}
                                  >
                                    {record.surveyStatus === 'not_started'
                                      ? 'แบบประเมินยังไม่เปิด'
                                      : 'หมดเวลาทำแบบประเมิน'}
                                  </Button>
                                )}
                                {hasDetails && (
                                  <Button
                                    size="small"
                                    variant={needsSurvey ? 'outlined' : 'contained'}
                                    endIcon={
                                      <ExpandMoreIcon
                                        sx={{
                                          transform: expanded ? 'rotate(180deg)' : 'none',
                                          transition: 'transform 0.2s',
                                        }}
                                      />
                                    }
                                    onClick={() => toggleExpand(record.id)}
                                    sx={{
                                      flex: { sm: needsSurvey ? undefined : 1 },
                                      fontWeight: 700,
                                      fontSize: '0.8rem',
                                      borderRadius: '10px',
                                      textTransform: 'none',
                                      py: 0.85,
                                      ...(needsSurvey
                                        ? {}
                                        : {
                                            bgcolor: '#0a6bcf',
                                            boxShadow: 'none',
                                            '&:hover': { bgcolor: '#0858ad', boxShadow: 'none' },
                                          }),
                                    }}
                                  >
                                    {expanded ? 'ซ่อนรายละเอียด' : fileCount > 0 ? `เอกสาร (${fileCount})` : 'รายละเอียด'}
                                  </Button>
                                )}
                              </Stack>
                            </Box>

                            <Collapse in={expanded} timeout={220} unmountOnExit>
                              <Box
                                sx={{
                                  px: { xs: 1.5, sm: 2 },
                                  pb: 2,
                                  pt: 0.5,
                                  bgcolor: 'color-mix(in srgb, var(--page-bg) 65%, transparent)',
                                  borderTop: '1px solid var(--page-border)',
                                }}
                              >
                                {record.files && record.files.length > 0 && (
                                  <Box sx={{ mt: 1.25 }}>
                                    <Typography
                                      variant="caption"
                                      fontWeight={800}
                                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}
                                    >
                                      <FileIcon sx={{ fontSize: 14, color: '#0a6bcf' }} />
                                      เอกสารกิจกรรม
                                    </Typography>
                                    <Stack spacing={0.75}>
                                      {record.files.map((file: any) => (
                                        <FileRow key={file.id} file={file} onDownload={handleAuthDownload} />
                                      ))}
                                    </Stack>
                                  </Box>
                                )}

                                {record.sessions && record.sessions.length > 0 && (
                                  <Box sx={{ mt: 1.75 }}>
                                    <Typography variant="caption" fontWeight={800} sx={{ mb: 0.75, display: 'block' }}>
                                      กิจกรรมย่อย / รอบ
                                    </Typography>
                                    <Stack spacing={1}>
                                      {record.sessions.map((sess: any) => (
                                        <Box
                                          key={sess.id}
                                          sx={{
                                            p: 1.25,
                                            borderRadius: '12px',
                                            bgcolor: 'var(--page-card-solid)',
                                            border: '1px solid var(--page-border)',
                                          }}
                                        >
                                          <Typography variant="body2" fontWeight={700}>
                                            {sess.name}
                                          </Typography>
                                          {sess.files && sess.files.length > 0 ? (
                                            <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                                              {sess.files.map((file: any) => (
                                                <FileRow key={file.id} file={file} onDownload={handleAuthDownload} dense />
                                              ))}
                                            </Stack>
                                          ) : (
                                            <Typography variant="caption" sx={{ color: 'var(--page-text-secondary)', mt: 0.35, display: 'block' }}>
                                              ไม่มีเอกสารแนบ
                                            </Typography>
                                          )}
                                        </Box>
                                      ))}
                                    </Stack>
                                  </Box>
                                )}

                                {(!record.files || record.files.length === 0) &&
                                  (!record.sessions || record.sessions.length === 0) && (
                                    <Typography
                                      variant="caption"
                                      sx={{ display: 'block', textAlign: 'center', py: 1.5, color: 'var(--page-text-secondary)' }}
                                    >
                                      ไม่มีเอกสารแนบหรือข้อมูลกิจกรรมย่อย
                                    </Typography>
                                  )}
                              </Box>
                            </Collapse>
                          </Box>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
};

function FileRow({
  file,
  onDownload,
  dense,
}: {
  file: any;
  onDownload: (url: string) => void;
  dense?: boolean;
}) {
  return (
    <Box
      sx={{
        p: dense ? 1 : 1.25,
        borderRadius: '12px',
        bgcolor: 'var(--page-card-solid)',
        border: '1px solid var(--page-border)',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant={dense ? 'caption' : 'body2'} fontWeight={700} noWrap>
            {file.name}
          </Typography>
          {file.description && (
            <Typography
              variant="caption"
              sx={{ color: 'var(--page-text-secondary)', display: 'block', mt: 0.15 }}
              noWrap
            >
              {file.description}
            </Typography>
          )}
        </Box>
        {file.type === 'text' ? (
          <Typography
            variant="caption"
            sx={{
              maxWidth: '45%',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--page-text-secondary)',
            }}
          >
            {file.url}
          </Typography>
        ) : (
          <Button
            size="small"
            variant="outlined"
            startIcon={<LaunchIcon />}
            {...(file.type === 'link'
              ? { href: file.url, target: '_blank', rel: 'noopener noreferrer', component: 'a' as const }
              : { onClick: () => onDownload(file.url) })}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: dense ? '0.72rem' : '0.8rem',
              flexShrink: 0,
              px: dense ? 1 : 1.5,
            }}
          >
            เปิด
          </Button>
        )}
      </Stack>
    </Box>
  );
}

export default MyHistoryPage;
