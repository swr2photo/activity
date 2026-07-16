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
  Card,
  Chip,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
  Drawer,
  Badge,
  IconButton,
} from "@mui/material";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ActivityCard from "@/components/ActivityCard";
import { Refresh, Search, EventAvailable, FilterList, InfoOutlined, Close as CloseIcon } from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";

// --- Hero media ---
// วางไฟล์ /public/hero.mp4 และ /public/hero.jpg เพื่อใช้วิดีโอ/รูปของคณะเอง
// (ถ้าไม่มีจะ fallback ไปใช้สื่อฟรีจาก Pexels ด้านล่างโดยอัตโนมัติผ่านค่า default นี้)
const HERO_VIDEO =
  process.env.NEXT_PUBLIC_HERO_VIDEO_URL ||
  'https://videos.pexels.com/video-files/3129671/3129671-hd_1920_1080_30fps.mp4';
const HERO_POSTER =
  process.env.NEXT_PUBLIC_HERO_POSTER_URL ||
  'https://images.pexels.com/videos/3129671/free-video-3129671.jpg?auto=compress&w=1920';

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
  department?: string;
};

type StatusKey = "active" | "upcoming" | "full" | "ended" | "inactive";

const STATUS_OPTIONS = [
  { value: "active", label: "เปิดให้ลงทะเบียนแล้ว" },
  { value: "soon", label: "เร็วๆ นี้" },
  { value: "full", label: "เต็มแล้ว" },
  { value: "ended", label: "ผ่านมาแล้ว" }
];
const CATEGORY_OPTIONS = [
  "วิชาการ / สัมมนา",
  "เวิร์กชอป / ฝึกอบรม",
  "กีฬา / สุขภาพ"
];

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
  
  // New Filter States
  const [categories, setCategories] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState("ทั้งหมด");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [departmentFilters, setDepartmentFilters] = useState<string[]>([]);
  
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

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

  const availableDepartments = useMemo(() => {
    const deps = new Set(activities.map(a => a.department || 'ไม่ระบุ'));
    return Array.from(deps).sort();
  }, [activities]);

  const filteredAndSorted = useMemo(() => {
    const t = qText.trim().toLowerCase();
    let result = activities.filter(a => {
      const matchSearch = !t || a.activityCode.toLowerCase().includes(t) || a.activityName.toLowerCase().includes(t) || (a.location || "").toLowerCase().includes(t);
      
      const sObj = getStatus(a);
      let sStr = sObj.key as string;
      if (sStr === "upcoming" && isSoon(a, 24)) sStr = "soon";
      
      const matchStatus = statuses.length === 0 || statuses.includes(sStr);
      const matchDepartment = departmentFilters.length === 0 || departmentFilters.includes(a.department || 'ไม่ระบุ');
      
      // Mocking category and type match for now since data doesn't have it
      // const matchCategory = categories.length === 0 || categories.includes(a.category);
      // const matchType = typeFilter === "ทั้งหมด" || a.type === typeFilter;

      return matchSearch && matchStatus && matchDepartment;
    });
    const rank = (s: StatusKey) => (s === "active" ? 0 : s === "upcoming" ? 1 : s === "full" ? 2 : 3);
    return result.sort((a, b) => rank(getStatus(a).key) - rank(getStatus(b).key));
  }, [activities, qText, statuses, categories, typeFilter, departmentFilters]);

  const activeFilterCount = statuses.length + categories.length + departmentFilters.length + (typeFilter !== "ทั้งหมด" ? 1 : 0);

  const FilterSidebarContent = (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* Category */}
      <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#1d1d1f', mb: 1.5 }}>
        หมวดหมู่
      </Typography>
      <FormGroup sx={{ mb: 4, gap: 0.5 }}>
        {CATEGORY_OPTIONS.map(cat => (
          <FormControlLabel
            key={cat}
            control={
              <Checkbox 
                size="small" 
                checked={categories.includes(cat)}
                onChange={(e) => {
                  if (e.target.checked) setCategories(prev => [...prev, cat]);
                  else setCategories(prev => prev.filter(c => c !== cat));
                }}
                sx={{ color: '#c7c7cc', py: 0.5, '&.Mui-checked': { color: '#0071e3' } }}
              />
            }
            label={<Typography variant="body2" color="#515154">{cat}</Typography>}
            sx={{ m: 0, '& .MuiFormControlLabel-label': { fontWeight: 500 } }}
          />
        ))}
      </FormGroup>

      {/* Type */}
      <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#1d1d1f', mb: 2 }}>
        ประเภท
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 4 }}>
        {['ทั้งหมด', 'Onsite', 'Online'].map(type => {
          const isSelected = typeFilter === type;
          return (
            <Chip
              key={type}
              label={type}
              onClick={() => setTypeFilter(type)}
              sx={{
                bgcolor: isSelected ? '#1d1d1f' : 'transparent',
                color: isSelected ? '#ffffff' : '#515154',
                border: isSelected ? '1px solid #1d1d1f' : '1px solid #d2d2d7',
                fontWeight: 600,
                fontSize: '0.8rem',
                height: 32,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: isSelected ? '#1d1d1f' : 'rgba(0,0,0,0.04)' }
              }}
            />
          );
        })}
      </Stack>

      {/* Status */}
      <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#1d1d1f', mb: 1.5 }}>
        สถานะ
      </Typography>
      <FormGroup sx={{ gap: 0.5 }}>
        {STATUS_OPTIONS.map(stat => (
          <FormControlLabel
            key={stat.value}
            control={
              <Checkbox 
                size="small" 
                checked={statuses.includes(stat.value)}
                onChange={(e) => {
                  if (e.target.checked) setStatuses(prev => [...prev, stat.value]);
                  else setStatuses(prev => prev.filter(s => s !== stat.value));
                }}
                sx={{ color: '#c7c7cc', py: 0.5, '&.Mui-checked': { color: '#34c759' } }}
              />
            }
            label={<Typography variant="body2" color="#515154">{stat.label}</Typography>}
            sx={{ m: 0, '& .MuiFormControlLabel-label': { fontWeight: 500 } }}
          />
        ))}
      </FormGroup>

      {/* Department */}
      {availableDepartments.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#1d1d1f', mb: 1.5 }}>
            สังกัด / คณะ
          </Typography>
          <FormGroup sx={{ mb: 4, gap: 0.5 }}>
            {availableDepartments.map(dep => (
              <FormControlLabel
                key={dep}
                control={
                  <Checkbox 
                    size="small" 
                    checked={departmentFilters.includes(dep)}
                    onChange={(e) => {
                      if (e.target.checked) setDepartmentFilters(prev => [...prev, dep]);
                      else setDepartmentFilters(prev => prev.filter(d => d !== dep));
                    }}
                    sx={{ color: '#c7c7cc', py: 0.5, '&.Mui-checked': { color: '#0071e3' } }}
                  />
                }
                label={<Typography variant="body2" color="#515154">{dep}</Typography>}
                sx={{ m: 0, '& .MuiFormControlLabel-label': { fontWeight: 500 } }}
              />
            ))}
          </FormGroup>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", bgcolor: "#000000" }}>
      <Navbar />

      {/* ===================== Hero — Cinematic Video Background ===================== */}
      <Box sx={{ 
        position: 'relative',
        bgcolor: '#000000', 
        color: 'white', 
        minHeight: { xs: '78svh', md: '86svh' },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        textAlign: 'center',
        overflow: 'hidden',
        zIndex: 1,
        pt: { xs: 12, md: 10 },
        pb: { xs: 16, md: 20 },
      }}>
        {/* Layer 1: Poster image (แสดงทันทีระหว่างวิดีโอโหลด / fallback ถ้าเล่นไม่ได้) */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: -3,
            backgroundImage: `url(${HERO_POSTER})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: 'scale(1.05)',
          }}
        />

        {/* Layer 2: Video background */}
        <Box
          component="video"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={HERO_POSTER}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: -2,
            animation: 'heroZoom 28s ease-in-out infinite alternate',
            '@keyframes heroZoom': {
              from: { transform: 'scale(1)' },
              to: { transform: 'scale(1.08)' },
            },
          }}
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </Box>

        {/* Layer 3: Readability overlays */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: -1,
            background: `
              radial-gradient(ellipse 90% 70% at 50% 45%, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.62) 100%),
              linear-gradient(to bottom, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.12) 28%, rgba(0,0,0,0.12) 62%, #000000 100%)
            `,
          }}
        />

        <Container maxWidth="md" sx={{ position: 'relative' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {/* Badge */}
            <Box
              component={motion.div}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 2.25,
                py: 0.9,
                mb: 3.5,
                borderRadius: '100px',
                bgcolor: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.18)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Box sx={{
                width: 8, height: 8, borderRadius: '50%', bgcolor: '#34c759',
                boxShadow: '0 0 12px rgba(52,199,89,0.9)',
                animation: 'heroPulse 2s ease-in-out infinite',
                '@keyframes heroPulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.45 },
                },
              }} />
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.92)', fontSize: '0.8rem' }}>
                {loading ? 'กำลังโหลดกิจกรรม...' : `เปิดรับสมัครแล้ว ${counts.active} กิจกรรม`}
              </Typography>
            </Box>

            <Typography variant="h1" fontWeight={800} sx={{ 
              fontSize: { xs: '2.9rem', md: '5rem' }, 
              mb: 2.5, 
              letterSpacing: '-0.04em', 
              lineHeight: 1.05,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              background: 'linear-gradient(135deg, #ffffff 35%, #c7c7cc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 8px 40px rgba(0,0,0,0.4)',
            }}>
              ค้นพบกิจกรรม
              <br />
              ที่คุณชอบ.
            </Typography>

            <Typography variant="h6" sx={{ 
              color: 'rgba(255,255,255,0.78)', 
              fontWeight: 500, 
              mb: 5, 
              px: 2, 
              fontSize: { xs: '1.05rem', md: '1.3rem' }, 
              letterSpacing: '-0.01em',
              maxWidth: 560,
              mx: 'auto',
              textShadow: '0 2px 16px rgba(0,0,0,0.5)',
            }}>
              ระบบลงทะเบียนกิจกรรมออนไลน์ คณะวิทยาศาสตร์ ม.อ.
              <br />
              สะดวก รวดเร็ว และแม่นยำ
            </Typography>

            {/* CTA */}
            <Stack
              component={motion.div}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent="center"
              alignItems="center"
            >
              <Button
                onClick={() => document.getElementById('activities')?.scrollIntoView({ behavior: 'smooth' })}
                sx={{
                  px: 4.5,
                  py: 1.6,
                  borderRadius: '100px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#000000',
                  bgcolor: '#ffffff',
                  boxShadow: '0 12px 32px rgba(255,255,255,0.22)',
                  transition: 'all 0.25s ease',
                  '&:hover': { bgcolor: '#f5f5f7', transform: 'translateY(-2px)', boxShadow: '0 16px 40px rgba(255,255,255,0.3)' },
                }}
              >
                สำรวจกิจกรรมทั้งหมด
              </Button>
              <Button
                onClick={() => { setStatuses(['active']); document.getElementById('activities')?.scrollIntoView({ behavior: 'smooth' }); }}
                sx={{
                  px: 4.5,
                  py: 1.6,
                  borderRadius: '100px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  bgcolor: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  backdropFilter: 'blur(12px)',
                  transition: 'all 0.25s ease',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.18)', transform: 'translateY(-2px)' },
                }}
              >
                เฉพาะที่เปิดรับสมัคร
              </Button>
            </Stack>
          </motion.div>
        </Container>

        {/* Scroll indicator */}
        <Box
          component={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          onClick={() => document.getElementById('activities')?.scrollIntoView({ behavior: 'smooth' })}
          sx={{
            position: 'absolute',
            bottom: { xs: 84, md: 110 },
            left: '50%',
            transform: 'translateX(-50%)',
            cursor: 'pointer',
            width: 26,
            height: 42,
            borderRadius: '14px',
            border: '2px solid rgba(255,255,255,0.35)',
            display: { xs: 'none', md: 'flex' },
            justifyContent: 'center',
            pt: '7px',
          }}
        >
          <Box sx={{
            width: 4, height: 9, borderRadius: '4px', bgcolor: 'rgba(255,255,255,0.75)',
            animation: 'heroScroll 1.8s ease-in-out infinite',
            '@keyframes heroScroll': {
              '0%': { transform: 'translateY(0)', opacity: 1 },
              '70%': { transform: 'translateY(12px)', opacity: 0 },
              '100%': { transform: 'translateY(0)', opacity: 0 },
            },
          }} />
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box id="activities" sx={{ bgcolor: '#f5f5f7', flexGrow: 1, borderTopLeftRadius: '40px', borderTopRightRadius: '40px', position: 'relative', zIndex: 2, scrollMarginTop: '80px' }}>
        <Container maxWidth="xl" sx={{ mt: -10, mb: 10 }}>
          <Grid container spacing={{ xs: 2, md: 4 }}>
            
            {/* Left Sidebar (Desktop) */}
            <Grid size={{ xs: 12, md: 3, lg: 2.5 }} sx={{ display: { xs: 'none', md: 'block' } }}>
              <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
                <Card sx={{ 
                  p: 2, 
                  borderRadius: '24px', 
                  boxShadow: '0 24px 48px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  backdropFilter: 'blur(40px)',
                  bgcolor: 'rgba(255, 255, 255, 0.75)',
                  position: 'sticky',
                  top: 100
                }}>
                  {FilterSidebarContent}
                </Card>
              </motion.div>
            </Grid>

            {/* Right Content */}
            <Grid size={{ xs: 12, md: 9, lg: 9.5 }}>
              {/* Floating Search Bar */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <Card sx={{ 
                  p: { xs: 2, md: 3 }, 
                  borderRadius: '24px', 
                  boxShadow: '0 24px 48px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  backdropFilter: 'blur(40px)',
                  bgcolor: 'rgba(255, 255, 255, 0.75)',
                }}>
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
                      <Stack direction="row" spacing={1.5} justifyContent={{ xs: 'flex-start', md: 'flex-end' }} alignItems="center">
                        <Button
                          variant="outlined"
                          onClick={() => setMobileFilterOpen(true)}
                          sx={{
                            display: { xs: 'flex', md: 'none' },
                            height: 48,
                            borderRadius: '14px',
                            color: '#1d1d1f',
                            borderColor: 'rgba(0,0,0,0.1)',
                            bgcolor: '#ffffff'
                          }}
                        >
                          <Badge color="primary" badgeContent={activeFilterCount} invisible={activeFilterCount === 0}>
                            <FilterList sx={{ mr: 1 }} /> ตัวกรอง
                          </Badge>
                        </Button>
                        <Box sx={{ flexGrow: 1, display: { xs: 'block', md: 'none' } }} />
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
                </Card>
              </motion.div>

              {/* Activity Cards List */}
              <Box sx={{ mt: 6 }}>
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
                      <Button variant="outlined" sx={{ borderRadius: '12px', px: 4, py: 1.5, fontWeight: 600 }} onClick={() => { setQText(""); setStatuses([]); setCategories([]); setTypeFilter("ทั้งหมด"); setDepartmentFilters([]); }}>ล้างตัวกรอง</Button>
                    </Box>
                  </motion.div>
                ) : (
                  <motion.div variants={containerVariants} initial="hidden" animate="show">
                    <Grid container spacing={3}>
                      <AnimatePresence>
                        {filteredAndSorted.map((a) => (
                          <Grid key={a.id} size={{ xs: 12, sm: 6, lg: 4, xl: 4 }}>
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
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Mobile Drawer Filter */}
      <Drawer 
        anchor="right" 
        open={mobileFilterOpen} 
        onClose={() => setMobileFilterOpen(false)}
        PaperProps={{
          sx: { width: 300, borderTopLeftRadius: 24, borderBottomLeftRadius: 24 }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight={800}>ตัวกรอง</Typography>
            <IconButton onClick={() => setMobileFilterOpen(false)}><CloseIcon /></IconButton>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          {FilterSidebarContent}
          <Box sx={{ mt: 4, pb: 4 }}>
            <Button 
              fullWidth 
              variant="contained" 
              onClick={() => setMobileFilterOpen(false)}
              sx={{ borderRadius: '12px', py: 1.5, fontWeight: 700 }}
            >
              แสดงผลลัพธ์ ({filteredAndSorted.length})
            </Button>
          </Box>
        </Box>
      </Drawer>

      <Footer />
    </Box>
  );
};

export default HomePage;