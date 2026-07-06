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
  Chip,
  InputAdornment,
} from "@mui/material";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ActivityCard from "@/components/ActivityCard";
import { Refresh, Search, EventAvailable, FilterList, InfoOutlined } from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---
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

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const HomePage: React.FC = () => {
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
        const qRef = query(collection(db, "activityQRCodes"), where("activityCode", "!=", ""), orderBy("activityCode", "asc"), limit(100));
        snap = await getDocs(qRef);
      } catch (err) {
        snap = await getDocs(collection(db, "activityQRCodes"));
      }
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
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", bgcolor: "#000000" }}>
      <Navbar />

      {/* Hero Header - Premium Dark Theme with Animated Blobs */}
      <Box sx={{ 
        position: 'relative',
        bgcolor: '#000000', 
        color: 'white', 
        pt: { xs: 12, md: 18 }, 
        pb: { xs: 20, md: 28 },
        textAlign: 'center',
        overflow: 'hidden',
        zIndex: 1
      }}>
        {/* Animated Background Gradients */}
        <Box
          component={motion.div}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          sx={{
            position: 'absolute',
            top: '-20%', left: '10%', width: '40vw', height: '40vw',
            background: 'radial-gradient(circle, rgba(0, 113, 227, 0.4) 0%, rgba(0,0,0,0) 70%)',
            filter: 'blur(80px)', zIndex: -1,
          }}
        />
        <Box
          component={motion.div}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          sx={{
            position: 'absolute',
            bottom: '-10%', right: '10%', width: '35vw', height: '35vw',
            background: 'radial-gradient(circle, rgba(142, 68, 173, 0.3) 0%, rgba(0,0,0,0) 70%)',
            filter: 'blur(80px)', zIndex: -1,
          }}
        />

        <Container maxWidth="md">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <Typography variant="h1" fontWeight={800} sx={{ 
              fontSize: { xs: '3rem', md: '5rem' }, 
              mb: 2, 
              letterSpacing: '-0.04em', 
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              background: 'linear-gradient(135deg, #ffffff 30%, #a1a1a6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              ค้นพบกิจกรรมที่คุณชอบ.
            </Typography>
            <Typography variant="h6" sx={{ 
              color: '#a1a1a6', 
              fontWeight: 500, 
              mb: 4, 
              px: 2, 
              fontSize: { xs: '1.1rem', md: '1.35rem' }, 
              letterSpacing: '-0.01em',
              maxWidth: '80%',
              mx: 'auto'
            }}>
              ระบบลงทะเบียนกิจกรรมออนไลน์ คณะวิทยาศาสตร์ ม.อ. สะดวก รวดเร็ว และแม่นยำ
            </Typography>
          </motion.div>
        </Container>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ bgcolor: '#f5f5f7', flexGrow: 1, borderTopLeftRadius: '40px', borderTopRightRadius: '40px', position: 'relative', zIndex: 2 }}>
        <Container maxWidth="lg" sx={{ mt: -10, mb: 10 }}>
          {/* Floating Search & Filter Bar */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <Card sx={{ 
              p: { xs: 2.5, md: 3.5 }, 
              borderRadius: '24px', 
              boxShadow: '0 24px 48px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset',
              border: '1px solid rgba(0, 0, 0, 0.05)',
              backdropFilter: 'blur(40px)',
              bgcolor: 'rgba(255, 255, 255, 0.75)',
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
                        startAdornment: <InputAdornment position="start"><Search sx={{ color: '#86868b' }} /></InputAdornment>,
                        sx: { 
                          borderRadius: '16px', 
                          bgcolor: '#ffffff', 
                          border: '1px solid rgba(0,0,0,0.04)', 
                          boxShadow: '0 2px 12px rgba(0,0,0,0.02) inset',
                          '& fieldset': { border: 'none' },
                          '& input': { py: 1.8, fontSize: '1.05rem', color: '#1d1d1f' },
                          transition: 'all 0.3s ease',
                          '&:hover': { boxShadow: '0 2px 12px rgba(0,0,0,0.04) inset' },
                          '&.Mui-focused': { boxShadow: '0 0 0 4px rgba(0, 113, 227, 0.15)' }
                        }
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Stack direction="row" spacing={1.5} justifyContent="flex-end" alignItems="center">
                      <Chip 
                        icon={<EventAvailable sx={{ fontSize: '1.2rem !important', color: '#248a3d !important' }} />} 
                        label={`เปิดรับสมัคร: ${counts.active}`} 
                        sx={{ 
                          bgcolor: 'rgba(52, 199, 89, 0.12)', 
                          color: '#248a3d', 
                          fontWeight: 700, 
                          borderRadius: '12px',
                          px: 1,
                          height: 48,
                          fontSize: '0.95rem',
                          border: '1px solid rgba(52, 199, 89, 0.2)'
                        }} 
                      />
                      <Button 
                        variant="text" 
                        onClick={fetchActivities} 
                        sx={{ 
                          minWidth: 48, 
                          height: 48, 
                          borderRadius: '14px', 
                          bgcolor: '#ffffff', 
                          color: '#1d1d1f',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          border: '1px solid rgba(0,0,0,0.04)',
                          transition: 'all 0.2s',
                          '&:hover': { bgcolor: '#f5f5f7', transform: 'scale(1.05)' }
                        }}
                      >
                        <Refresh />
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>

                <Stack direction="row" alignItems="center" spacing={2} sx={{ overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
                  <FilterList sx={{ color: '#86868b' }} />
                  <ToggleButtonGroup
                    exclusive
                    value={filter}
                    onChange={(_, v) => v && setFilter(v)}
                    sx={{ 
                      bgcolor: 'rgba(0, 0, 0, 0.03)',
                      p: 0.5,
                      borderRadius: '16px',
                      gap: 0.5,
                      border: 'none',
                      '& .MuiToggleButton-root': { 
                        border: 'none !important', 
                        borderRadius: '12px !important', 
                        px: 3.5, 
                        py: 1.2, 
                        whiteSpace: 'nowrap',
                        color: '#86868b', 
                        fontWeight: 600,
                        textTransform: 'none',
                        fontSize: '0.9rem',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&.Mui-selected': { 
                          bgcolor: '#ffffff', 
                          color: '#1d1d1f', 
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                          transform: 'scale(1.02)',
                          '&:hover': { bgcolor: '#ffffff' } 
                        },
                        '&:hover:not(.Mui-selected)': {
                          bgcolor: 'rgba(0, 0, 0, 0.04)'
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
          </motion.div>

          {/* Activity Cards List */}
          <Box sx={{ mt: 8 }}>
            {loading ? (
              <Grid container spacing={4}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <Skeleton variant="rectangular" height={280} sx={{ borderRadius: '24px', mb: 2 }} />
                    <Skeleton width="70%" height={32} sx={{ borderRadius: '8px', mb: 1 }} />
                    <Skeleton width="40%" height={24} sx={{ borderRadius: '8px' }} />
                  </Grid>
                ))}
              </Grid>
            ) : filteredAndSorted.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Box sx={{ textAlign: 'center', py: 14 }}>
                  <InfoOutlined sx={{ fontSize: 90, color: '#d2d2d7', mb: 3 }} />
                  <Typography variant="h5" fontWeight={700} color="#1d1d1f" mb={1}>ไม่พบกิจกรรมที่คุณมองหา</Typography>
                  <Typography variant="body1" color="#86868b" mb={3}>ลองปรับเงื่อนไขการค้นหาใหม่ หรือเลือกดูทั้งหมด</Typography>
                  <Button variant="outlined" sx={{ borderRadius: '12px', px: 4, py: 1.5, fontWeight: 600 }} onClick={() => { setQText(""); setFilter("all"); }}>ดูทั้งหมด</Button>
                </Box>
              </motion.div>
            ) : (
              <motion.div variants={containerVariants} initial="hidden" animate="show">
                <Grid container spacing={4}>
                  <AnimatePresence>
                    {filteredAndSorted.map((a) => (
                      <Grid key={a.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                        <motion.div variants={itemVariants} layoutId={a.id} style={{ height: '100%' }}>
                          <ActivityCard {...a} status={getStatus(a)} canOpen={getStatus(a).key === "active"} />
                        </motion.div>
                      </Grid>
                    ))}
                  </AnimatePresence>
                </Grid>
              </motion.div>
            )}
          </Box>
        </Container>
      </Box>

      <Footer />
    </Box>
  );
};

export default HomePage;