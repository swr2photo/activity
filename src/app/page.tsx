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
  useMediaQuery,
  Card,
  CardContent,
  Chip,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ActivityCard from "@/components/ActivityCard";
import { Refresh } from "@mui/icons-material";

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
  bannerTintColor?: string;
  bannerTintOpacity?: number;
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

  if (a.isActive === false) return { key: "inactive", label: a.closeReason || "ปิดใช้งาน", tone: "default" };
  if (start && now < start) return { key: "upcoming", label: "กำลังจะเปิด", tone: "info" };
  if (end && now > end) return { key: "ended", label: "สิ้นสุดแล้ว", tone: "default" };
  if ((a.maxParticipants || 0) > 0 && (a.currentParticipants || 0) >= (a.maxParticipants || 0))
    return { key: "full", label: "เต็มแล้ว", tone: "warning" };
  return { key: "active", label: "กำลังจัด", tone: "success" };
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
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
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
        limit(250)
      );

      const snap = await getDocs(qRef);
      const list: ActivityListItem[] = snap.docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          activityCode: (data.activityCode || "").toString().trim(),
          activityName: (data.activityName || "กิจกรรม").toString(),
          location: data.location || "",
          startDateTime: data.startDateTime,
          endDateTime: data.endDateTime,
          isActive: data.isActive !== undefined ? !!data.isActive : true,
          maxParticipants: Number(data.maxParticipants || 0),
          currentParticipants: Number(data.currentParticipants || 0),
          bannerUrl: data.bannerUrl,
          bannerColor: data.bannerColor,
          bannerTintColor: data.bannerTintColor,
          bannerTintOpacity: typeof data.bannerTintOpacity === "number" ? data.bannerTintOpacity : undefined,
          bannerAspect: data.bannerAspect,
          closeReason: data.closeReason || "",
        };
      });

      setActivities(list.filter((x) => !!x.activityCode));
    } catch {
      setError("ไม่สามารถโหลดรายการกิจกรรมได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const counts = useMemo(() => {
    const c = { all: activities.length, active: 0, ended: 0, upcoming: 0, soon: 0 };
    for (const a of activities) {
      const s = getStatus(a).key;
      if (s === "active") c.active += 1;
      if (s === "ended") c.ended += 1;
      if (s === "upcoming") c.upcoming += 1;
      if (isSoon(a, 24) && s === "upcoming") c.soon += 1;
    }
    return c;
  }, [activities]);

  const searched = useMemo(() => {
    const t = qText.trim().toLowerCase();
    if (!t) return activities;
    return activities.filter((a) => {
      const code = (a.activityCode || "").toLowerCase();
      const name = (a.activityName || "").toLowerCase();
      const loc = (a.location || "").toLowerCase();
      return code.includes(t) || name.includes(t) || loc.includes(t);
    });
  }, [activities, qText]);

  const filtered = useMemo(() => {
    if (filter === "all") return searched;
    if (filter === "active") return searched.filter((a) => getStatus(a).key === "active");
    if (filter === "ended") return searched.filter((a) => getStatus(a).key === "ended");
    if (filter === "upcoming") return searched.filter((a) => getStatus(a).key === "upcoming");
    if (filter === "soon") return searched.filter((a) => getStatus(a).key === "upcoming" && isSoon(a, 24));
    return searched;
  }, [searched, filter]);

  const sorted = useMemo(() => {
    const rank = (s: StatusKey) => (s === "active" ? 0 : s === "upcoming" ? 1 : s === "full" ? 2 : 3);
    const copy = [...filtered];
    copy.sort((a, b) => {
      const sa = getStatus(a).key;
      const sb = getStatus(b).key;
      const r = rank(sa) - rank(sb);
      if (r !== 0) return r;

      const da = a.startDateTime ? toDate(a.startDateTime).getTime() : 0;
      const db = b.startDateTime ? toDate(b.startDateTime).getTime() : 0;
      return da - db;
    });
    return copy;
  }, [filtered]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar />

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          pt: { xs: 3, md: 5 },
          pb: { xs: 4, md: 6 },
          background: `
            radial-gradient(1200px 600px at 100% -40%, ${alpha(theme.palette.primary.main, 0.08)}, transparent 60%),
            radial-gradient(900px 500px at -10% -20%, ${alpha(theme.palette.secondary.main, 0.06)}, transparent 60%),
            linear-gradient(180deg, ${theme.palette.background.default}, ${theme.palette.background.paper})
          `,
        }}
      >
        <Container maxWidth="lg">
          {/* Hero Section */}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h3"
              fontWeight={950}
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                mb: 1,
              }}
            >
              ลงทะเบียนกิจกรรมชุมนุม
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
              เลือกกิจกรรมที่คุณสนใจเพื่อเข้าร่วมการจัดการลงทะเบียน
            </Typography>
          </Box>

          {/* Search & Filter Section */}
          <Stack spacing={2} sx={{ mb: 3.5 }}>
            {/* Search */}
            <TextField
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="ค้นหา: รหัส / ชื่อกิจกรรม / สถานที่"
              fullWidth
              size="medium"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  background: alpha("#ffffff", 0.7),
                  backdropFilter: "blur(10px)",
                  fontSize: "0.95rem",
                  "&:hover, &.Mui-focused": {
                    background: alpha("#ffffff", 0.85),
                  },
                },
              }}
            />

            {/* Stats */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
              <Chip label={`ทั้งหมด ${counts.all}`} color="default" variant="outlined" sx={{ fontWeight: 950 }} />
              <Chip label={`กำลังจัด ${counts.active}`} color="success" variant="outlined" sx={{ fontWeight: 950 }} />
              <Chip label={`เร็วๆนี้ ${counts.soon}`} color="warning" variant="outlined" sx={{ fontWeight: 950 }} />
              <Box sx={{ flex: 1 }} />
              <Button startIcon={<Refresh />} onClick={fetchActivities} size="small" variant="outlined" sx={{ borderRadius: 999 }}>
                รีเฟรช
              </Button>
            </Stack>

            {/* Filter Buttons */}
            <ToggleButtonGroup
              exclusive
              value={filter}
              onChange={(_, v) => v && setFilter(v)}
              fullWidth={isMobile}
              sx={{
                display: "flex",
                gap: 1,
                flexWrap: "wrap",
                "& .MuiToggleButton-root": {
                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 900,
                  flex: isMobile ? 1 : "auto",
                  transition: "all .2s",
                  "&.Mui-selected": {
                    background: alpha(theme.palette.primary.main, 0.12),
                    borderColor: theme.palette.primary.main,
                  },
                },
              }}
            >
              <ToggleButton value="all">ทั้งหมด</ToggleButton>
              <ToggleButton value="active">กำลังจัด</ToggleButton>
              <ToggleButton value="soon">เร็วๆนี้</ToggleButton>
              <ToggleButton value="upcoming">กำลังจะเปิด</ToggleButton>
              <ToggleButton value="ended">สิ้นสุด</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {/* Error Message */}
          {error && (
            <Card sx={{ mb: 3, background: alpha("#d32f2f", 0.08) }}>
              <CardContent>
                <Typography color="error" fontWeight={700}>
                  ⚠️ {error}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* Activities Grid */}
          {loading ? (
            <Grid container spacing={2.5}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <Card sx={{ height: 420 }}>
                    <Skeleton variant="rectangular" height={180} />
                    <CardContent>
                      <Skeleton height={30} sx={{ mb: 1 }} />
                      <Skeleton height={20} width="60%" sx={{ mb: 2 }} />
                      {Array.from({ length: 3 }).map((_, j) => (
                        <Skeleton key={j} height={16} sx={{ mb: 1 }} />
                      ))}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : sorted.length === 0 ? (
            <Card sx={{ textAlign: "center", py: 5 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={950} gutterBottom>
                  ไม่พบกิจกรรม
                </Typography>
                <Typography color="text.secondary">ลองค้นหาด้วยคำอื่น หรือเปลี่ยนตัวกรอง</Typography>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={2.5}>
              {sorted.map((a) => (
                <Grid key={a.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <ActivityCard {...a} status={getStatus(a)} canOpen={getStatus(a).key === "active"} />
                </Grid>
              ))}
            </Grid>
          )}
        </Container>
      </Box>

      <Footer />
    </Box>
  );
};

export default HomePage;
