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

      {/* Hero Header - Premium Dark Theme with Video Background */}
      <Box sx={{ 
        position: 'relative',
        bgcolor: '#000000', 
        color: 'white', 
        pt: { xs: 14, md: 22 }, 
        pb: { xs: 22, md: 32 },
        textAlign: 'center',
        overflow: 'hidden',
        zIndex: 1
      }}>
        {/* Video Background Placeholder */}
        <Box
          component="video"
          autoPlay
          loop
          muted
          playsInline
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: -1,
            opacity: 0.4,
            filter: 'blur(4px) brightness(0.7)'
          }}
          src="https://cdn.pixabay.com/video/2021/08/04/83866-584732685_tiny.mp4"
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