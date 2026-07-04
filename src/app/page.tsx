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
      
      let snap;
      try {
        // Try the optimized query first
        const qRef = query(
          collection(db, "activityQRCodes"),
          where("activityCode", "!=", ""),
          orderBy("activityCode", "asc"),
          limit(100)
        );
        snap = await getDocs(qRef);
      } catch (err) {
        console.warn("Optimized query failed, falling back to direct collection fetch", err);
        // Fallback: fetch the whole collection directly (guaranteed to work without composite indexes or permissions)
        snap = await getDocs(collection(db, "activityQRCodes"));
      }

      const list: ActivityListItem[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      const filteredList = list.filter((x) => !!x.activityCode);
      setActivities(filteredList);
    } catch (e) {
      console.error(e);
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
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", bgcolor: "#f5f5f7" }}>
      <Navbar />

      {/* Hero Header - Apple Event Dark Minimal Theme */}
      <Box sx={{ 
        bgcolor: '#000000', 
        color: 'white', 
        pt: { xs: 10, md: 14 }, 
        pb: { xs: 18, md: 24 },
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: `radial-gradient(circle at center, #1c1c1e 0%, #000000 100%)`
      }}>
        <Container maxWidth="md">
          <Fade in timeout={1000}>
            <Box>
              <Typography variant="h2" fontWeight={800} sx={{ fontSize: { xs: '2.8rem', md: '4.5rem' }, mb: 2, letterSpacing: '-0.03em', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                ค้นพบกิจกรรมที่คุณชอบ.
              </Typography>
              <Typography variant="h6" sx={{ color: '#86868b', fontWeight: 500, mb: 4, px: 2, fontSize: { xs: '1rem', md: '1.25rem' }, letterSpacing: '-0.01em' }}>
                ระบบลงทะเบียนกิจกรรมออนไลน์ คณะวิทยาศาสตร์ ม.อ. สะดวก รวดเร็ว และแม่นยำ
              </Typography>
            </Box>
          </Fade>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ mt: -12, mb: 10, position: 'relative', zIndex: 2 }}>
        {/* Floating Search & Filter Bar - Apple Glassmorphism Design */}
        <Card sx={{ 
          p: { xs: 2.5, md: 3.5 }, 
          borderRadius: '24px', 
          boxShadow: '0 20px 40px rgba(0,0,0,0.04)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          backdropFilter: 'blur(30px)',
          bgcolor: 'rgba(255, 255, 255, 0.85)'
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
                    startAdornment: <InputAdornment position="start"><Search color="action" /></InputAdornment>,
                    sx: { 
                      borderRadius: '14px', 
                      bgcolor: 'rgba(0, 0, 0, 0.04)', 
                      border: 'none', 
                      '& fieldset': { border: 'none' },
                      '& input': { py: 1.5 }
                    }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack direction="row" spacing={1.5} justifyContent="flex-end" alignItems="center">
                  <Chip 
                    icon={<EventAvailable sx={{ fontSize: '1.1rem !important', color: '#1d1d1f !important' }} />} 
                    label={`เปิดรับสมัคร: ${counts.active}`} 
                    sx={{ 
                      bgcolor: 'rgba(52, 199, 89, 0.15)', // Apple Green
                      color: '#248a3d', 
                      fontWeight: 700, 
                      borderRadius: '10px',
                      fontSize: '0.85rem'
                    }} 
                  />
                  <Button 
                    variant="text" 
                    onClick={fetchActivities} 
                    sx={{ 
                      minWidth: 46, 
                      height: 46, 
                      borderRadius: '12px', 
                      bgcolor: 'rgba(0, 0, 0, 0.04)', 
                      color: '#1d1d1f',
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.08)' }
                    }}
                  >
                    <Refresh />
                  </Button>
                </Stack>
              </Grid>
            </Grid>

            {/* Apple Native Segment Control Style */}
            <Stack direction="row" alignItems="center" spacing={2} sx={{ overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
              <FilterList sx={{ color: '#86868b' }} />
              <ToggleButtonGroup
                exclusive
                value={filter}
                onChange={(_, v) => v && setFilter(v)}
                sx={{ 
                  bgcolor: 'rgba(0, 0, 0, 0.04)',
                  p: '3px',
                  borderRadius: '14px',
                  gap: '2px',
                  border: 'none !important',
                  '& .MuiToggleButton-root': { 
                    border: 'none !important', 
                    borderRadius: '11px !important', 
                    px: 3, 
                    py: 1, 
                    whiteSpace: 'nowrap',
                    color: '#86868b', 
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s ease',
                    '&.Mui-selected': { 
                      bgcolor: '#ffffff', 
                      color: '#1d1d1f', 
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      '&:hover': { bgcolor: '#ffffff' } 
                    },
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.02)'
                    }
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
            <Grid container spacing={4}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <Skeleton variant="rectangular" height={240} sx={{ borderRadius: '20px', mb: 2 }} />
                  <Skeleton width="60%" height={30} sx={{ borderRadius: '8px' }} />
                  <Skeleton width="40%" sx={{ borderRadius: '8px' }} />
                </Grid>
              ))}
            </Grid>
          ) : filteredAndSorted.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 12 }}>
              <InfoOutlined sx={{ fontSize: 80, color: '#86868b', mb: 2 }} />
              <Typography variant="h5" fontWeight={700} color="#1d1d1f">ไม่พบกิจกรรมที่คุณมองหา</Typography>
              <Button sx={{ mt: 2, color: '#0071e3', fontWeight: 600 }} onClick={() => setQText("")}>ล้างการค้นหา</Button>
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