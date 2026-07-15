// app/my-history/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  InputAdornment,
  CircularProgress,
  Button,
  Grid,
  Skeleton,
  Avatar,
  Divider,
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
  ExpandLess as ExpandLessIcon,
  Description as FileIcon,
} from '@mui/icons-material';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/firebaseAuth';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

// Types
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
  files?: any[];
  sessions?: any[];
};

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

const formatDate = (d: Date) =>
  d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const formatTime = (d: Date) =>
  d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

const MyHistoryPage: React.FC = () => {
  const { user, userData, loading: authLoading, login: userLogin } = useAuth();

  const [records, setRecords] = useState<RegistrationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Fetch registration records for this user
  useEffect(() => {
    if (!userData?.studentId) return;

    const fetchRecords = async () => {
      setLoading(true);
      try {
        // Query activityRecords by studentId
        const q = query(
          collection(db, 'activityRecords'),
          where('studentId', '==', userData.studentId)
        );
        const snap = await getDocs(q);

        const rawRecords: RegistrationRecord[] = snap.docs.map((d) => {
          const data: any = d.data();
          const ts: Date =
            data.timestamp?.toDate?.() ??
            (data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp || Date.now()));

          return {
            id: d.id,
            activityCode: data.activityCode || '',
            studentId: data.studentId || '',
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            department: data.department || '',
            timestamp: ts,
          };
        });

        // Fetch survey responses to check completion
        let completedSurveyCodes = new Set<string>();
        if (user?.uid) {
          const surveyQ = query(
            collection(db, 'surveyResponses'),
            where('userId', '==', user.uid)
          );
          const surveySnap = await getDocs(surveyQ);
          completedSurveyCodes = new Set(surveySnap.docs.map(d => (d.data().activityCode || '').toUpperCase()));
        }

        // Enrich with activity info (name, location, banner, surveyConfig, files, sessions) from activityQRCodes
        const uniqueCodes = [...new Set(rawRecords.map((r) => r.activityCode))].filter(Boolean);
        const activityMap: Record<string, { activityName?: string; location?: string; bannerUrl?: string; surveyEnabled?: boolean; files?: any[]; sessions?: any[] }> = {};

        if (uniqueCodes.length > 0) {
          // Batch fetch up to 30 at a time using 'in' query
          const chunks: string[][] = [];
          for (let i = 0; i < uniqueCodes.length; i += 30) {
            chunks.push(uniqueCodes.slice(i, i + 30));
          }

          try {
            const actPromises = chunks.map(async (chunk) => {
              const actQ = query(
                collection(db, 'activityQRCodes'),
                where('activityCode', 'in', chunk)
              );
              return getDocs(actQ);
            });

            const actSnaps = await Promise.all(actPromises);
            actSnaps.forEach((actSnap) => {
              actSnap.forEach((d) => {
                const actData = d.data() as any;
                const code = actData.activityCode;
                if (code) {
                  activityMap[code] = {
                    activityName: actData.activityName || code,
                    location: actData.location,
                    bannerUrl: actData.bannerUrl,
                    surveyEnabled: actData.surveyConfig?.enabled || false,
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

        // Merge
        const enriched = rawRecords.map((r) => ({
          ...r,
          activityName: activityMap[r.activityCode]?.activityName || r.activityCode,
          location: activityMap[r.activityCode]?.location,
          bannerUrl: activityMap[r.activityCode]?.bannerUrl,
          surveyEnabled: activityMap[r.activityCode]?.surveyEnabled || false,
          surveyCompleted: completedSurveyCodes.has(r.activityCode.toUpperCase()),
          files: activityMap[r.activityCode]?.files || [],
          sessions: activityMap[r.activityCode]?.sessions || [],
        }));

        // Sort by timestamp desc
        enriched.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        setRecords(enriched);
      } catch (e) {
        console.error('Error fetching history:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [userData?.studentId, user?.uid]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    if (!searchText.trim()) return records;
    const s = searchText.toLowerCase();
    return records.filter(
      (r) =>
        r.activityCode.toLowerCase().includes(s) ||
        (r.activityName || '').toLowerCase().includes(s) ||
        (r.location || '').toLowerCase().includes(s) ||
        r.department.toLowerCase().includes(s)
    );
  }, [records, searchText]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, RegistrationRecord[]> = {};
    filteredRecords.forEach((r) => {
      const dateKey = r.timestamp.toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(r);
    });
    return groups;
  }, [filteredRecords]);

  // If still loading auth
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#000000' }}>
        <Navbar />
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress sx={{ color: '#fff' }} />
        </Box>
        <Footer />
      </Box>
    );
  }

  // If not logged in
  if (!user) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#000000' }}>
        <Navbar />
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 12 }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card
              sx={{
                maxWidth: 480,
                mx: 'auto',
                p: { xs: 4, md: 6 },
                borderRadius: '32px',
                textAlign: 'center',
                bgcolor: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(40px)',
                boxShadow: '0 32px 64px rgba(0,0,0,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
              }}
            >
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, #0071e3 0%, #34c759 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3,
                  boxShadow: '0 12px 24px rgba(0, 113, 227, 0.3)',
                }}
              >
                <HistoryIcon sx={{ fontSize: 40, color: '#fff' }} />
              </Box>
              <Typography variant="h5" fontWeight={800} sx={{ mb: 1, color: '#1d1d1f' }}>
                ประวัติการลงทะเบียน
              </Typography>
              <Typography variant="body1" sx={{ color: '#86868b', mb: 4, lineHeight: 1.6 }}>
                กรุณาเข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย เพื่อดูประวัติกิจกรรมที่คุณเคยลงทะเบียน
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={userLogin}
                startIcon={<LoginOutlined />}
                sx={{
                  borderRadius: '16px',
                  px: 5,
                  py: 1.8,
                  fontWeight: 700,
                  fontSize: '1rem',
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #0071e3 0%, #0077ed 100%)',
                  boxShadow: '0 8px 24px rgba(0, 113, 227, 0.35)',
                  transition: 'all 0.3s',
                  '&:hover': {
                    boxShadow: '0 12px 32px rgba(0, 113, 227, 0.5)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย
              </Button>
            </Card>
          </motion.div>
        </Box>
        <Footer />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#000000' }}>
      <Navbar />

      {/* Hero Header */}
      <Box
        sx={{
          position: 'relative',
          bgcolor: '#000000',
          color: 'white',
          pt: { xs: 14, md: 18 },
          pb: { xs: 16, md: 22 },
          textAlign: 'center',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {/* Gradient Background */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'radial-gradient(ellipse at 50% 20%, rgba(0, 113, 227, 0.15) 0%, transparent 70%)',
            zIndex: -1,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '50%',
            background: 'linear-gradient(to top, #000000 0%, transparent 100%)',
            zIndex: -1,
          }}
        />

        <Container maxWidth="md">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <Typography
              variant="h1"
              fontWeight={800}
              sx={{
                fontSize: { xs: '2.5rem', md: '4rem' },
                mb: 2,
                letterSpacing: '-0.04em',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                background: 'linear-gradient(135deg, #ffffff 30%, #a1a1a6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ประวัติกิจกรรมของคุณ.
            </Typography>
            <Typography
              variant="h6"
              sx={{
                color: '#a1a1a6',
                fontWeight: 500,
                mb: 1,
                fontSize: { xs: '1rem', md: '1.2rem' },
                letterSpacing: '-0.01em',
              }}
            >
              ตรวจสอบกิจกรรมทั้งหมดที่คุณเคยลงทะเบียนเข้าร่วม
            </Typography>
          </motion.div>
        </Container>
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          bgcolor: '#f5f5f7',
          flexGrow: 1,
          borderTopLeftRadius: '40px',
          borderTopRightRadius: '40px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <Container maxWidth="lg" sx={{ mt: -8, mb: 10 }}>
          {/* User Info + Search Card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            <Card
              sx={{
                p: { xs: 2.5, md: 3.5 },
                borderRadius: '24px',
                boxShadow: '0 24px 48px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                backdropFilter: 'blur(40px)',
                bgcolor: 'rgba(255, 255, 255, 0.75)',
                mb: 4,
              }}
            >
              <Grid container spacing={2} alignItems="center">
                {/* User Info */}
                <Grid size={{ xs: 12, md: 5 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      src={userData?.photoURL || user?.photoURL || undefined}
                      sx={{
                        width: 52,
                        height: 52,
                        border: '3px solid rgba(0, 113, 227, 0.2)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    >
                      {(userData?.firstName?.charAt(0) || user?.displayName?.charAt(0) || '?').toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#1d1d1f', lineHeight: 1.2 }}>
                        {userData?.firstName} {userData?.lastName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#86868b', display: 'block' }}>
                        {userData?.studentId && `รหัส ${userData.studentId}`}
                        {userData?.faculty && ` • ${userData.faculty}`}
                      </Typography>
                      <Chip
                        icon={<EventAvailable sx={{ fontSize: '0.9rem !important' }} />}
                        label={`ลงทะเบียนแล้ว ${records.length} กิจกรรม`}
                        size="small"
                        sx={{
                          mt: 0.5,
                          bgcolor: 'rgba(52, 199, 89, 0.12)',
                          color: '#248a3d',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          border: '1px solid rgba(52, 199, 89, 0.2)',
                        }}
                      />
                    </Box>
                  </Stack>
                </Grid>

                {/* Search */}
                <Grid size={{ xs: 12, md: 5 }}>
                  <TextField
                    fullWidth
                    placeholder="ค้นหาชื่อกิจกรรม รหัส หรือสถานที่..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search sx={{ color: '#86868b' }} />
                        </InputAdornment>
                      ),
                      sx: {
                        borderRadius: '16px',
                        bgcolor: '#ffffff',
                        border: '1px solid rgba(0,0,0,0.04)',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.02) inset',
                        '& fieldset': { border: 'none' },
                        '& input': { py: 1.5, fontSize: '0.95rem', color: '#1d1d1f' },
                        transition: 'all 0.3s ease',
                        '&.Mui-focused': { boxShadow: '0 0 0 4px rgba(0, 113, 227, 0.15)' },
                      },
                    }}
                  />
                </Grid>

                {/* Back */}
                <Grid size={{ xs: 12, md: 2 }}>
                  <Button
                    component={Link}
                    href="/"
                    variant="outlined"
                    startIcon={<ArrowBack />}
                    fullWidth
                    sx={{
                      borderRadius: '14px',
                      py: 1.3,
                      fontWeight: 700,
                      borderColor: 'rgba(0,0,0,0.1)',
                      color: '#1d1d1f',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.03)' },
                    }}
                  >
                    กลับ
                  </Button>
                </Grid>
              </Grid>
            </Card>
          </motion.div>

          {/* Records List */}
          {loading ? (
            <Stack spacing={3}>
              {[1, 2, 3].map((i) => (
                <Card key={i} sx={{ borderRadius: '24px', p: 3 }}>
                  <Stack direction="row" spacing={3} alignItems="center">
                    <Skeleton variant="rounded" width={80} height={80} sx={{ borderRadius: '16px' }} />
                    <Box sx={{ flexGrow: 1 }}>
                      <Skeleton width="60%" height={28} sx={{ mb: 1 }} />
                      <Skeleton width="40%" height={20} sx={{ mb: 0.5 }} />
                      <Skeleton width="30%" height={20} />
                    </Box>
                  </Stack>
                </Card>
              ))}
            </Stack>
          ) : filteredRecords.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Box sx={{ textAlign: 'center', py: 14 }}>
                <InfoOutlined sx={{ fontSize: 90, color: '#d2d2d7', mb: 3 }} />
                <Typography variant="h5" fontWeight={700} color="#1d1d1f" mb={1}>
                  {records.length === 0
                    ? 'ยังไม่มีประวัติการลงทะเบียน'
                    : 'ไม่พบกิจกรรมที่คุณมองหา'}
                </Typography>
                <Typography variant="body1" color="#86868b" mb={3}>
                  {records.length === 0
                    ? 'เมื่อคุณลงทะเบียนกิจกรรมแล้ว ประวัติจะแสดงที่นี่'
                    : 'ลองปรับคำค้นหาใหม่'}
                </Typography>
                {records.length === 0 && (
                  <Button
                    component={Link}
                    href="/"
                    variant="contained"
                    sx={{
                      borderRadius: '14px',
                      px: 5,
                      py: 1.5,
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #0071e3 0%, #0077ed 100%)',
                      boxShadow: '0 8px 24px rgba(0, 113, 227, 0.3)',
                    }}
                  >
                    ดูกิจกรรมทั้งหมด
                  </Button>
                )}
              </Box>
            </motion.div>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="show">
              {Object.entries(groupedByDate).map(([dateKey, dateRecords]) => (
                <Box key={dateKey} sx={{ mb: 4 }}>
                  {/* Date Header */}
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2, px: 1 }}>
                    <CalendarToday sx={{ fontSize: 18, color: '#86868b' }} />
                    <Typography
                      variant="subtitle2"
                      fontWeight={700}
                      sx={{ color: '#86868b', letterSpacing: '-0.01em' }}
                    >
                      {formatDate(dateRecords[0].timestamp)}
                    </Typography>
                    <Chip
                      label={`${dateRecords.length} กิจกรรม`}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(0, 113, 227, 0.08)',
                        color: '#0071e3',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        height: 24,
                      }}
                    />
                  </Stack>

                  {/* Activity Cards for this date */}
                  <Stack spacing={2}>
                    <AnimatePresence>
                      {dateRecords.map((record) => (
                        <motion.div key={record.id} variants={itemVariants} layout>
                          <Card
                            elevation={0}
                            sx={{
                              borderRadius: '20px',
                              border: '1px solid rgba(0,0,0,0.06)',
                              bgcolor: '#ffffff',
                              overflow: 'hidden',
                              transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                              '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
                                borderColor: 'rgba(0, 113, 227, 0.15)',
                              },
                            }}
                          >
                            <CardContent sx={{ p: { xs: 2, md: 3 }, '&:last-child': { pb: { xs: 2, md: 3 } } }}>
                              <Grid container spacing={2} alignItems="center">
                                {/* Activity Banner/Icon */}
                                <Grid size={{ xs: 'auto' }}>
                                  {record.bannerUrl ? (
                                    <Box
                                      sx={{
                                        position: 'relative',
                                        width: { xs: 64, md: 80 },
                                        height: { xs: 64, md: 80 },
                                        borderRadius: '16px',
                                        overflow: 'hidden',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                      }}
                                    >
                                      <Image
                                        src={record.bannerUrl}
                                        alt={record.activityName || ''}
                                        fill
                                        sizes="(max-width: 768px) 64px, 80px"
                                        style={{ objectFit: 'cover' }}
                                      />
                                    </Box>
                                  ) : (
                                    <Box
                                      sx={{
                                        width: { xs: 64, md: 80 },
                                        height: { xs: 64, md: 80 },
                                        borderRadius: '16px',
                                        background: 'linear-gradient(135deg, #0071e3 0%, #34c759 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 4px 12px rgba(0, 113, 227, 0.25)',
                                      }}
                                    >
                                      <EventAvailable sx={{ fontSize: 32, color: '#fff' }} />
                                    </Box>
                                  )}
                                </Grid>

                                {/* Activity Info */}
                                <Grid size="grow">
                                  <Typography
                                    variant="subtitle1"
                                    fontWeight={800}
                                    sx={{
                                      color: '#1d1d1f',
                                      lineHeight: 1.3,
                                      mb: 0.5,
                                      fontSize: { xs: '0.95rem', md: '1.05rem' },
                                    }}
                                  >
                                    {record.activityName}
                                  </Typography>

                                  <Stack
                                    direction="row"
                                    spacing={2}
                                    flexWrap="wrap"
                                    sx={{ rowGap: 0.5 }}
                                  >
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                      <AccessTime sx={{ fontSize: 14, color: '#86868b' }} />
                                      <Typography variant="caption" sx={{ color: '#86868b', fontWeight: 600 }}>
                                        {formatTime(record.timestamp)}
                                      </Typography>
                                    </Stack>
                                    {record.location && (
                                      <Stack direction="row" spacing={0.5} alignItems="center">
                                        <LocationOn sx={{ fontSize: 14, color: '#86868b' }} />
                                        <Typography variant="caption" sx={{ color: '#86868b', fontWeight: 600 }}>
                                          {record.location}
                                        </Typography>
                                      </Stack>
                                    )}
                                    {record.department && (
                                      <Stack direction="row" spacing={0.5} alignItems="center">
                                        <School sx={{ fontSize: 14, color: '#86868b' }} />
                                        <Typography variant="caption" sx={{ color: '#86868b', fontWeight: 600 }}>
                                          {record.department}
                                        </Typography>
                                      </Stack>
                                    )}
                                  </Stack>
                                </Grid>

                                 {/* Status Badge */}
                                 <Grid size={{ xs: 12, md: 'auto' }} sx={{ display: 'flex', flexDirection: { xs: 'row', md: 'column' }, gap: 1, alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'center' } }}>
                                   <Chip
                                     icon={<CheckCircleOutline sx={{ fontSize: '1rem !important' }} />}
                                     label="ลงทะเบียนแล้ว"
                                     size="small"
                                     sx={{
                                       bgcolor: 'rgba(52, 199, 89, 0.12)',
                                       color: '#248a3d',
                                       fontWeight: 700,
                                       fontSize: '0.78rem',
                                       border: '1px solid rgba(52, 199, 89, 0.2)',
                                       borderRadius: '10px',
                                       px: 0.5,
                                     }}
                                   />
                                   
                                   {record.surveyEnabled && (
                                     record.surveyCompleted ? (
                                       <Chip
                                         icon={<SurveyIcon sx={{ fontSize: '0.9rem !important' }} />}
                                         label="ทำแบบประเมินแล้ว"
                                         size="small"
                                         color="success"
                                         sx={{
                                           fontWeight: 700,
                                           fontSize: '0.78rem',
                                           borderRadius: '10px',
                                           px: 0.5,
                                         }}
                                       />
                                     ) : (
                                       <Button
                                         component={Link}
                                         href={`/register?activity=${record.activityCode}`}
                                         variant="contained"
                                         color="warning"
                                         size="small"
                                         startIcon={<SurveyIcon />}
                                         sx={{
                                           fontWeight: 700,
                                           fontSize: '0.75rem',
                                           borderRadius: '10px',
                                           py: 0.4,
                                           px: 1.5,
                                           textTransform: 'none',
                                           boxShadow: 'none',
                                           '&:hover': { boxShadow: 'none', bgcolor: 'warning.dark' }
                                         }}
                                       >
                                         ทำแบบประเมิน
                                       </Button>
                                     )
                                   )}
                                 </Grid>
                               </Grid>

                               {/* Expand Toggle Button Row */}
                               <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, pt: 1, borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                                 <Button
                                   size="small"
                                   variant="text"
                                   startIcon={expandedCards[record.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                   onClick={() => setExpandedCards(prev => ({ ...prev, [record.id]: !prev[record.id] }))}
                                   sx={{ fontSize: '0.8rem', color: '#86868b', textTransform: 'none', fontWeight: 600 }}
                                 >
                                   {expandedCards[record.id] ? 'ซ่อนเอกสารและรายละเอียด' : 'ดูเอกสารและรายละเอียด'}
                                 </Button>
                               </Box>
                             </CardContent>

                             {/* Expanded Content Box (Files and Session Info) */}
                             <AnimatePresence>
                               {expandedCards[record.id] && (
                                 <motion.div
                                   initial={{ height: 0, opacity: 0 }}
                                   animate={{ height: 'auto', opacity: 1 }}
                                   exit={{ height: 0, opacity: 0 }}
                                   transition={{ duration: 0.25 }}
                                   style={{ overflow: 'hidden' }}
                                 >
                                   <Box sx={{ p: { xs: 2, md: 3 }, pt: 0, bgcolor: 'rgba(0,0,0,0.015)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                     {/* Main Activity Files */}
                                     {record.files && record.files.length > 0 && (
                                       <Box sx={{ mt: 2 }}>
                                         <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#1d1d1f', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                           <FileIcon sx={{ fontSize: '1rem', color: '#0071e3' }} /> เอกสารและข้อมูลประกอบกิจกรรมหลัก
                                         </Typography>
                                         <Stack spacing={1} sx={{ pl: 1 }}>
                                           {record.files.map((file: any) => (
                                             <Box key={file.id} sx={{ p: 1.5, border: '1px solid rgba(0,0,0,0.05)', borderRadius: '12px', bgcolor: '#ffffff' }}>
                                               <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                                                 <Box sx={{ flexGrow: 1 }}>
                                                   <Typography variant="body2" fontWeight={700} color="#1d1d1f">{file.name}</Typography>
                                                   {file.description && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>{file.description}</Typography>}
                                                 </Box>
                                                 {file.type === 'text' ? (
                                                   <Box sx={{ bgcolor: 'grey.50', p: 1, borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)', maxWidth: '60%', minWidth: '150px' }}>
                                                     <Typography variant="caption" color="text.primary" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block' }}>
                                                       {file.url}
                                                     </Typography>
                                                   </Box>
                                                 ) : (
                                                   <Button
                                                     size="small"
                                                     variant="outlined"
                                                     startIcon={<LaunchIcon />}
                                                     href={file.url}
                                                     target="_blank"
                                                     rel="noopener noreferrer"
                                                     sx={{ borderRadius: '8px', textTransform: 'none', px: 2 }}
                                                   >
                                                     เปิดดู
                                                   </Button>
                                                 )}
                                               </Stack>
                                             </Box>
                                           ))}
                                         </Stack>
                                       </Box>
                                     )}

                                     {/* Sub-activities (Sessions) Files */}
                                     {record.sessions && record.sessions.length > 0 && (
                                       <Box sx={{ mt: 2.5 }}>
                                         <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#1d1d1f', mb: 1.2 }}>
                                           กิจกรรมย่อย / รอบกิจกรรม
                                         </Typography>
                                         <Stack spacing={1.5} sx={{ pl: 1 }}>
                                           {record.sessions.map((sess: any) => (
                                             <Box key={sess.id} sx={{ p: 1.5, border: '1px solid rgba(0,0,0,0.05)', borderRadius: '12px', bgcolor: '#ffffff' }}>
                                               <Typography variant="body2" fontWeight={750} color="#1d1d1f">{sess.name}</Typography>
                                               {sess.files && sess.files.length > 0 ? (
                                                 <Stack spacing={1} sx={{ mt: 1, pl: 1 }}>
                                                   {sess.files.map((file: any) => (
                                                     <Box key={file.id} sx={{ p: 1, border: '1px dashed rgba(0,0,0,0.08)', borderRadius: '8px', bgcolor: 'rgba(0,0,0,0.005)' }}>
                                                       <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                                                         <Box sx={{ flexGrow: 1 }}>
                                                           <Typography variant="caption" fontWeight={700} color="#1d1d1f">{file.name}</Typography>
                                                           {file.description && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.1 }}>{file.description}</Typography>}
                                                         </Box>
                                                         {file.type === 'text' ? (
                                                           <Box sx={{ bgcolor: 'grey.50', p: 0.8, borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)', maxWidth: '60%', minWidth: '120px' }}>
                                                             <Typography variant="caption" color="text.primary" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block', fontSize: '0.72rem' }}>
                                                               {file.url}
                                                             </Typography>
                                                           </Box>
                                                         ) : (
                                                           <Button
                                                             size="small"
                                                             variant="outlined"
                                                             startIcon={<LaunchIcon />}
                                                             href={file.url}
                                                             target="_blank"
                                                             rel="noopener noreferrer"
                                                             sx={{ borderRadius: '6px', textTransform: 'none', py: 0.2, px: 1, minWidth: 0, fontSize: '0.75rem' }}
                                                           >
                                                             เปิดดู
                                                           </Button>
                                                         )}
                                                       </Stack>
                                                     </Box>
                                                   ))}
                                                 </Stack>
                                               ) : (
                                                 <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, pl: 1 }}>ไม่มีเอกสารแนบสำหรับรอบกิจกรรมย่อยนี้</Typography>
                                               )}
                                             </Box>
                                           ))}
                                         </Stack>
                                       </Box>
                                     )}

                                     {/* If no files or sessions */}
                                     {(!record.files || record.files.length === 0) && (!record.sessions || record.sessions.length === 0) && (
                                       <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
                                         ไม่มีเอกสารแนบหรือข้อมูลกิจกรรมย่อย
                                       </Typography>
                                     )}
                                   </Box>
                                 </motion.div>
                               )}
                             </AnimatePresence>
                           </Card>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </Stack>
                </Box>
              ))}
            </motion.div>
          )}
        </Container>
      </Box>

      <Footer />
    </Box>
  );
};

export default MyHistoryPage;
