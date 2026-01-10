// app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Container,
  Grid,
  Skeleton,
  Stack,
  Typography,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  Fade,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ActivityCard from "@/components/ActivityCard";
import { Refresh, Search, EventAvailable, AccessTime, InfoOutlined, FilterList } from "@mui/icons-material";

// --- Types (เหมือนเดิม) ---
type ActivityListItem = {
  id: string;
  activityCode: string;
  activityName: string;
  location?: string;
  startDateTime?: any;
  endDateTime?: any;
  isActive?: boolean;
  maxParticipants?: number;
  currentParticipants?: number;
  bannerUrl?: string;
  bannerColor?: string;
  bannerAspect?: string;
  closeReason?: string;
};

type StatusKey = "active" | "upcoming" | "full" | "ended" | "inactive";
type FilterKey = "all" | "active" | "ended" | "upcoming" | "soon";

const toDate = (d: any): Date => d?.toDate?.() ?? (d instanceof Date ? d : new Date(d));

const getStatus = (a: ActivityListItem): { key: StatusKey; label: string; tone: any } => {
  const now = new Date();
  const start = a.startDateTime ? toDate(a.startDateTime) : null;
  const end = a.endDateTime ? toDate(a.endDateTime) : null;
  if (a.isActive === false) return { key: "inactive", label: a.closeReason || "ปิดรับ", tone: "default" };
  if (start && now < start) return { key: "upcoming", label: "กำลังจะเปิด", tone: "info" };
  if (end && now > end) return { key: "ended", label: "สิ้นสุดแล้ว", tone: "error" };
  if ((a.maxParticipants || 0) > 0 && (a.currentParticipants || 0) >= (a.maxParticipants || 0))
    return { key: "full", label: "เต็มแล้ว", tone: "warning" };
  return { key: "active", label: "เปิดรับสมัคร", tone: "success" };
};

const isSoon = (a: ActivityListItem, hours = 24) => {
  if (!a.startDateTime) return false;
  const now = new Date();
  const start = toDate(a.startDateTime);
  const diffMs = start.getTime() - now.getTime();
  return diffMs > 0 && diffMs <= hours * 60 * 60 * 1000;
};

const HomePage: React.FC = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityListItem[]>([]);
  const [error, setError] = useState("");
  const [qText, setQText] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError("");
      const qRef = query(
        collection(db, "activityQRCodes"),
        where("activityCode", "!=", ""),
        orderBy("activityCode", "asc"),
        limit(100)
      );
      const snap = await getDocs(qRef);
      const list: ActivityListItem[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      setActivities(list.filter((x) => !!x.activityCode));
    } catch (e) {
      setError("ไม่สามารถโหลดรายการกิจกรรมได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchActivities(); }, []);

  const counts = useMemo(() => {
    const c = { all: activities.length, active: 0, soon: 0 };
    activities.forEach(a => {
      const s = getStatus(a).key;
      if (s === "active") c.active++;
      if (s === "upcoming" && isSoon(a, 24)) c.soon++;
    });
    return c;
  }, [activities]);

  const filteredAndSorted = useMemo(() => {
    const t = qText.trim().toLowerCase();
    let result = activities.filter(a => {
      const matchSearch = !t || a.activityCode.toLowerCase().includes(t) || a.activityName.toLowerCase().includes(t) || (a.location || "").toLowerCase().includes(t);
      const s = getStatus(a).key;
      const matchFilter = filter === "all" || (filter === "active" && s === "active") || (filter === "ended" && s === "ended") || (filter === "upcoming" && s === "upcoming") || (filter === "soon" && s === "upcoming" && isSoon(a, 24));
      return matchSearch && matchFilter;
    });
    const rank = (s: StatusKey) => (s === "active" ? 0 : s === "upcoming" ? 1 : s === "full" ? 2 : 3);
    return result.sort((a, b) => rank(getStatus(a).key) - rank(getStatus(b).key));
  }, [activities, qText, filter]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", bgcolor: "#f8fafc" }}>
      <Navbar />

      {/* Hero Header */}
      <Box sx={{ 
        bgcolor: 'primary.main', 
        color: 'white', 
        pt: { xs: 8, md: 12 }, 
        pb: { xs: 15, md: 20 },
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`
      }}>
        <Box sx={{ 
          position: 'absolute', top: '-10%', left: '-5%', width: '40%', height: '80%', 
          borderRadius: '50%', background: alpha('#fff', 0.1), filter: 'blur(80px)' 
        }} />
        
        <Container maxWidth="md">
          <Fade in timeout={800}>
            <Box>
              <Typography variant="h2" fontWeight={900} sx={{ fontSize: { xs: '2.5rem', md: '4rem' }, mb: 2, letterSpacing: -1 }}>
                ค้นพบกิจกรรมที่คุณชอบ
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 400, mb: 4, px: 2 }}>
                ระบบลงทะเบียนกิจกรรมออนไลน์ คณะวิทยาศาสตร์ ม.อ. สะดวก รวดเร็ว และแม่นยำ
              </Typography>
            </Box>
          </Fade>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ mt: -10, mb: 10, position: 'relative', zIndex: 2 }}>
        {/* Floating Search & Filter Bar */}
        <Card sx={{ 
          p: { xs: 2, md: 3 }, 
          borderRadius: 6, 
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          border: '1px solid',
          borderColor: alpha(theme.palette.divider, 0.1),
          backdropFilter: 'blur(20px)',
          bgcolor: alpha('#fff', 0.95)
        }}>
          <Stack spacing={3}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  fullWidth
                  placeholder="ค้นหาชื่อกิจกรรม รหัส หรือสถานที่..."
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Search color="primary" /></InputAdornment>,
                    sx: { borderRadius: 4, bgcolor: '#f1f5f9', border: 'none', '& fieldset': { border: 'none' } }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                   {/* แก้ไข Chip Soft Variant เป็นการใช้ Filled + Alpha แทน */}
                  <Chip 
                    icon={<EventAvailable sx={{ fontSize: '1.2rem !important' }} />} 
                    label={`เปิดรับ ${counts.active}`} 
                    sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.dark', fontWeight: 700, borderRadius: 2 }} 
                  />
                  <Button variant="contained" onClick={fetchActivities} sx={{ borderRadius: 4, px: 3, boxShadow: theme.shadows[4] }}>
                    <Refresh />
                  </Button>
                </Stack>
              </Grid>
            </Grid>

            <Stack direction="row" alignItems="center" spacing={2} sx={{ overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
              <FilterList color="action" />
              <ToggleButtonGroup
                exclusive
                value={filter}
                onChange={(_, v) => v && setFilter(v)}
                sx={{ 
                  gap: 1, 
                  '& .MuiToggleButton-root': { 
                    border: 'none !important', borderRadius: '12px !important', 
                    px: 3, py: 0.8, whiteSpace: 'nowrap',
                    color: 'text.secondary', fontWeight: 600,
                    '&.Mui-selected': { bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }
                  } 
                }}
              >
                <ToggleButton value="all">ทั้งหมด ({activities.length})</ToggleButton>
                <ToggleButton value="active">กำลังเปิดรับ</ToggleButton>
                <ToggleButton value="soon">เร็วๆ นี้</ToggleButton>
                <ToggleButton value="ended">สิ้นสุดแล้ว</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>
        </Card>

        {/* Content Section */}
        <Box sx={{ mt: 6 }}>
          {loading ? (
            <Grid container spacing={3}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 5, mb: 2 }} />
                  <Skeleton width="60%" height={30} />
                  <Skeleton width="40%" />
                </Grid>
              ))}
            </Grid>
          ) : filteredAndSorted.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 10 }}>
              <InfoOutlined sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h5" fontWeight={700} color="text.secondary">ไม่พบกิจกรรมที่คุณมองหา</Typography>
              <Button sx={{ mt: 2 }} onClick={() => setQText("")}>ล้างการค้นหา</Button>
            </Box>
          ) : (
            <Grid container spacing={4}>
              {filteredAndSorted.map((a) => (
                <Grid key={a.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <ActivityCard {...a} status={getStatus(a)} canOpen={getStatus(a).key === "active"} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Container>

      <Footer />
    </Box>
  );
};

export default HomePage;