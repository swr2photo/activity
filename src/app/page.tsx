// app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ActivityCard from "@/components/ActivityCard";
import {
  RefreshCw,
  Search,
  CalendarCheck,
  Filter,
  Info,
  X,
} from "lucide-react";
import { glassCardLargeClass } from "@/lib/uiTheme";
import { getDepartmentLabel } from "@/types/admin";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  isRefreshCacheFresh,
  readRefreshCache,
  RefreshCacheKey,
  RefreshCacheTtl,
  writeRefreshCache,
} from "@/lib/refreshCache";

// --- Hero media ---
// วางไฟล์ /public/hero.mp4 และ /public/hero.jpg เพื่อใช้วิดีโอ/รูปของคณะเอง
// (ถ้าไม่มีจะ fallback ไปใช้สื่อฟรีจาก Pexels ด้านล่างโดยอัตโนมัติผ่านค่า default นี้)
const HERO_VIDEO =
  process.env.NEXT_PUBLIC_HERO_VIDEO_URL ||
  "https://videos.pexels.com/video-files/3129671/3129671-hd_1920_1080_30fps.mp4";
const HERO_POSTER =
  process.env.NEXT_PUBLIC_HERO_POSTER_URL ||
  "https://images.pexels.com/videos/3129671/free-video-3129671.jpg?auto=compress&w=1920";

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
  { value: "ended", label: "ผ่านมาแล้ว" },
];
const CATEGORY_OPTIONS = [
  "วิชาการ / สัมมนา",
  "เวิร์กชอป / ฝึกอบรม",
  "กีฬา / สุขภาพ",
];

const toDate = (d: any): Date =>
  d?.toDate?.() ?? (d instanceof Date ? d : new Date(d));

const getStatus = (
  a: ActivityListItem
): { key: StatusKey; label: string; tone: any } => {
  const now = new Date();
  const start = a.startDateTime ? toDate(a.startDateTime) : null;
  const end = a.endDateTime ? toDate(a.endDateTime) : null;
  if (a.isActive === false)
    return { key: "inactive", label: a.closeReason || "ปิดรับ", tone: "default" };
  if (start && now < start)
    return { key: "upcoming", label: "กำลังจะเปิด", tone: "info" };
  if (end && now > end)
    return { key: "ended", label: "สิ้นสุดแล้ว", tone: "error" };
  if (
    (a.maxParticipants || 0) > 0 &&
    (a.currentParticipants || 0) >= (a.maxParticipants || 0)
  )
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
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

const toMillis = (d: any): number | undefined => {
  if (d == null) return undefined;
  if (typeof d === "number") return d;
  if (typeof d === "string") {
    const t = Date.parse(d);
    return Number.isNaN(t) ? undefined : t;
  }
  if (typeof d?.toDate === "function") return d.toDate().getTime();
  if (d instanceof Date) return d.getTime();
  if (typeof d?.seconds === "number") return d.seconds * 1000;
  return undefined;
};

const serializeActivity = (a: ActivityListItem): ActivityListItem => ({
  ...a,
  startDateTime: toMillis(a.startDateTime),
  endDateTime: toMillis(a.endDateTime),
});

const readCachedActivities = (): ActivityListItem[] | null => {
  const hit = readRefreshCache<ActivityListItem[]>(RefreshCacheKey.homeActivities);
  return hit?.data?.length ? hit.data : null;
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

  const fetchActivities = async (opts?: { force?: boolean }) => {
    const force = opts?.force === true;
    const cachedList = readCachedActivities();
    const hasCache = Boolean(cachedList?.length);
    const fresh = isRefreshCacheFresh(
      RefreshCacheKey.homeActivities,
      RefreshCacheTtl.homeActivities
    );

    // รีเฟรชหน้า + cache ยังสด → ไม่โหลด Firestore ซ้ำ (กดปุ่มรีเฟรช = force)
    if (!force && hasCache && fresh) {
      setActivities(cachedList!);
      setLoading(false);
      return;
    }

    try {
      // มี cache อยู่แล้ว → อัปเดตเงียบ ๆ ไม่กระพริบ skeleton
      if (!hasCache) setLoading(true);
      setError("");
      let snap;
      try {
        const qRef = query(
          collection(db, "activityQRCodes"),
          where("activityCode", "!=", ""),
          orderBy("activityCode", "asc"),
          limit(100)
        );
        snap = await getDocs(qRef);
      } catch (err) {
        snap = await getDocs(collection(db, "activityQRCodes"));
      }
      const list: ActivityListItem[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter((x) => !!x.activityCode)
        .map(serializeActivity);
      setActivities(list);
      writeRefreshCache(RefreshCacheKey.homeActivities, list);
    } catch (e) {
      if (!hasCache) setError("ไม่สามารถโหลดรายการกิจกรรมได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = readCachedActivities();
    if (cached?.length) {
      setActivities(cached);
      setLoading(false);
    }
    void fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c = { all: activities.length, active: 0, soon: 0 };
    activities.forEach((a) => {
      const s = getStatus(a).key;
      if (s === "active") c.active++;
      if (s === "upcoming" && isSoon(a, 24)) c.soon++;
    });
    return c;
  }, [activities]);

  const availableDepartments = useMemo(() => {
    const deps = new Set(
      activities
        .map((a) => (a.department || "").trim())
        .filter((d) => d && d !== "ไม่ระบุ")
    );
    return Array.from(deps).sort((a, b) =>
      getDepartmentLabel(a).localeCompare(getDepartmentLabel(b), "th")
    );
  }, [activities]);

  const filteredAndSorted = useMemo(() => {
    const t = qText.trim().toLowerCase();
    let result = activities.filter((a) => {
      const matchSearch =
        !t ||
        a.activityCode.toLowerCase().includes(t) ||
        a.activityName.toLowerCase().includes(t) ||
        (a.location || "").toLowerCase().includes(t);

      const sObj = getStatus(a);
      let sStr = sObj.key as string;
      if (sStr === "upcoming" && isSoon(a, 24)) sStr = "soon";

      const matchStatus = statuses.length === 0 || statuses.includes(sStr);
      const matchDepartment =
        departmentFilters.length === 0 ||
        departmentFilters.includes(a.department || "ไม่ระบุ");

      // Mocking category and type match for now since data doesn't have it
      // const matchCategory = categories.length === 0 || categories.includes(a.category);
      // const matchType = typeFilter === "ทั้งหมด" || a.type === typeFilter;

      return matchSearch && matchStatus && matchDepartment;
    });
    const rank = (s: StatusKey) =>
      s === "active" ? 0 : s === "upcoming" ? 1 : s === "full" ? 2 : 3;
    return result.sort(
      (a, b) => rank(getStatus(a).key) - rank(getStatus(b).key)
    );
  }, [activities, qText, statuses, categories, typeFilter, departmentFilters]);

  const activeFilterCount =
    statuses.length +
    categories.length +
    departmentFilters.length +
    (typeFilter !== "ทั้งหมด" ? 1 : 0);

  // silence unused error in UI for now (preserved for future toast)
  void error;

  const FilterSidebarContent = (
    <div className="p-2 md:p-4">
      {/* Category */}
      <p className="mb-3 text-sm font-bold text-[var(--page-text)]">หมวดหมู่</p>
      <div className="mb-8 flex flex-col gap-2">
        {CATEGORY_OPTIONS.map((cat) => (
          <div key={cat} className="flex items-center gap-2">
            <Checkbox
              id={`cat-${cat}`}
              checked={categories.includes(cat)}
              onCheckedChange={(checked) => {
                if (checked) setCategories((prev) => [...prev, cat]);
                else setCategories((prev) => prev.filter((c) => c !== cat));
              }}
              className="border-[var(--page-border)] data-[state=checked]:border-[#0071e3] data-[state=checked]:bg-[#0071e3]"
            />
            <Label
              htmlFor={`cat-${cat}`}
              className="cursor-pointer text-sm font-medium text-[var(--page-text)] opacity-85"
            >
              {cat}
            </Label>
          </div>
        ))}
      </div>

      {/* Type */}
      <p className="mb-4 text-sm font-bold text-[var(--page-text)]">ประเภท</p>
      <div className="mb-8 flex flex-wrap gap-2">
        {["ทั้งหมด", "Onsite", "Online"].map((type) => {
          const isSelected = typeFilter === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={cn(
                "h-8 cursor-pointer rounded-full border px-3 text-[0.8rem] font-semibold transition-all",
                isSelected
                  ? "border-[var(--page-text)] bg-[var(--page-text)] text-[var(--page-card-solid)]"
                  : "border-[var(--page-border)] bg-transparent text-[var(--page-text-secondary)] hover:bg-muted"
              )}
            >
              {type}
            </button>
          );
        })}
      </div>

      {/* Status */}
      <p className="mb-3 text-sm font-bold text-[var(--page-text)]">สถานะ</p>
      <div className="flex flex-col gap-2">
        {STATUS_OPTIONS.map((stat) => (
          <div key={stat.value} className="flex items-center gap-2">
            <Checkbox
              id={`stat-${stat.value}`}
              checked={statuses.includes(stat.value)}
              onCheckedChange={(checked) => {
                if (checked) setStatuses((prev) => [...prev, stat.value]);
                else
                  setStatuses((prev) => prev.filter((s) => s !== stat.value));
              }}
              className="border-[var(--page-border)] data-[state=checked]:border-[#34c759] data-[state=checked]:bg-[#34c759]"
            />
            <Label
              htmlFor={`stat-${stat.value}`}
              className="cursor-pointer text-sm font-medium text-[var(--page-text)] opacity-85"
            >
              {stat.label}
            </Label>
          </div>
        ))}
      </div>

      {/* Department */}
      {availableDepartments.length > 0 && (
        <div className="mt-4">
          <p className="mb-3 text-sm font-bold text-[var(--page-text)]">
            สังกัด / คณะ
          </p>
          <div className="mb-8 flex flex-col gap-2">
            {availableDepartments.map((dep) => (
              <div key={dep} className="flex items-center gap-2">
                <Checkbox
                  id={`dep-${dep}`}
                  checked={departmentFilters.includes(dep)}
                  onCheckedChange={(checked) => {
                    if (checked)
                      setDepartmentFilters((prev) => [...prev, dep]);
                    else
                      setDepartmentFilters((prev) =>
                        prev.filter((d) => d !== dep)
                      );
                  }}
                  className="border-[var(--page-border)] data-[state=checked]:border-[#0071e3] data-[state=checked]:bg-[#0071e3]"
                />
                <Label
                  htmlFor={`dep-${dep}`}
                  className="cursor-pointer text-sm font-semibold text-[var(--page-text)] opacity-90"
                >
                  {getDepartmentLabel(dep)}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <Navbar />

      {/* ===================== Hero — Cinematic Video Background ===================== */}
      <div className="relative z-[1] flex min-h-[78svh] flex-col justify-center overflow-hidden bg-black pb-16 pt-12 text-center text-white md:min-h-[86svh] md:pb-20 md:pt-10">
        {/* Layer 1: Poster image */}
        <div
          className="absolute inset-0 -z-[3] scale-105 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_POSTER})` }}
        />

        {/* Layer 2: Video background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={HERO_POSTER}
          className="absolute inset-0 -z-[2] h-full w-full object-cover animate-[heroZoom_28s_ease-in-out_infinite_alternate]"
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>

        {/* Layer 3: Readability overlays */}
        <div
          className="absolute inset-0 -z-[1]"
          style={{
            background: `
              radial-gradient(ellipse 90% 70% at 50% 45%, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.62) 100%),
              linear-gradient(to bottom, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.12) 28%, rgba(0,0,0,0.12) 62%, #000000 100%)
            `,
          }}
        />

        <div className="relative mx-auto w-full max-w-3xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 backdrop-blur-md"
            >
              <span className="h-2 w-2 rounded-full bg-[#34c759] shadow-[0_0_12px_rgba(52,199,89,0.9)] animate-[heroPulse_2s_ease-in-out_infinite]" />
              <span className="text-[0.8rem] font-bold tracking-wider text-white/90">
                {loading
                  ? "กำลังโหลดกิจกรรม..."
                  : `เปิดรับสมัครแล้ว ${counts.active} กิจกรรม`}
              </span>
            </motion.div>

            <h1
              className="mb-6 font-extrabold leading-[1.05] tracking-tight text-transparent"
              style={{
                fontSize: "clamp(2.9rem, 8vw, 5rem)",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                background: "linear-gradient(135deg, #ffffff 35%, #c7c7cc 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 8px 40px rgba(0,0,0,0.4)",
              }}
            >
              ค้นพบกิจกรรม
              <br />
              ที่คุณชอบ.
            </h1>

            <p
              className="mx-auto mb-10 max-w-[560px] px-2 text-[1.05rem] font-medium tracking-tight text-white/78 md:text-[1.3rem]"
              style={{ textShadow: "0 2px 16px rgba(0,0,0,0.5)" }}
            >
              ระบบลงทะเบียนกิจกรรมออนไลน์ คณะวิทยาศาสตร์ ม.อ.
              <br />
              สะดวก รวดเร็ว และแม่นยำ
            </p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Button
                onClick={() =>
                  document
                    .getElementById("activities")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="rounded-full bg-white px-9 py-6 text-base font-bold text-black shadow-[0_12px_32px_rgba(255,255,255,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#f5f5f7] hover:shadow-[0_16px_40px_rgba(255,255,255,0.3)]"
              >
                สำรวจกิจกรรมทั้งหมด
              </Button>
              <Button
                onClick={() => {
                  setStatuses(["active"]);
                  document
                    .getElementById("activities")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="rounded-full border border-white/25 bg-white/10 px-9 py-6 text-base font-bold text-white backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/18"
              >
                เฉพาะที่เปิดรับสมัคร
              </Button>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          onClick={() =>
            document
              .getElementById("activities")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          className="absolute bottom-[110px] left-1/2 hidden h-[42px] w-[26px] -translate-x-1/2 cursor-pointer justify-center rounded-[14px] border-2 border-white/35 pt-[7px] md:flex"
        >
          <span className="h-[9px] w-1 rounded bg-white/75 animate-[heroScroll_1.8s_ease-in-out_infinite]" />
        </motion.div>
      </div>

      {/* Main Content Area */}
      <div
        id="activities"
        className="relative z-[2] flex-grow scroll-mt-20 rounded-t-[40px] bg-[var(--page-bg)]"
      >
        <div className="mx-auto mb-24 mt-[-2.5rem] w-full max-w-[1400px] px-4">
          <div className="grid grid-cols-12 gap-4 md:gap-8">
            {/* Left Sidebar (Desktop) */}
            <div className="col-span-12 hidden md:col-span-3 md:block lg:col-span-3 xl:col-span-3">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Card
                  className={cn(
                    glassCardLargeClass,
                    "sticky top-[100px] p-2 shadow-[var(--page-shadow)]"
                  )}
                >
                  {FilterSidebarContent}
                </Card>
              </motion.div>
            </div>

            {/* Right Content */}
            <div className="col-span-12 md:col-span-9 lg:col-span-9">
              {/* Floating Search Bar */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  delay: 0.2,
                  type: "spring",
                  stiffness: 200,
                }}
              >
                <Card
                  className={cn(
                    glassCardLargeClass,
                    "p-4 shadow-[var(--page-shadow)] md:p-6"
                  )}
                >
                  <div className="flex flex-col items-center gap-4 md:flex-row">
                    <div className="relative w-full flex-1">
                      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--page-text-secondary)]" />
                      <Input
                        placeholder="ค้นหาชื่อกิจกรรม รหัส หรือสถานที่..."
                        value={qText}
                        onChange={(e) => setQText(e.target.value)}
                        className="h-14 rounded-2xl border-[var(--page-border)] bg-[var(--page-card-solid)] pl-10 text-[1.05rem] text-[var(--page-text)] shadow-none focus-visible:ring-[#0071e3]/40"
                      />
                    </div>
                    <div className="flex w-full items-center justify-start gap-3 md:w-auto md:justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setMobileFilterOpen(true)}
                        className="relative flex h-12 rounded-xl border-[var(--page-border)] bg-[var(--page-card-solid)] text-[var(--page-text)] md:hidden"
                      >
                        <Filter className="h-4 w-4" />
                        ตัวกรอง
                        {activeFilterCount > 0 && (
                          <Badge className="absolute -right-2 -top-2 h-5 min-w-5 justify-center rounded-full px-1.5 text-[0.65rem]">
                            {activeFilterCount}
                          </Badge>
                        )}
                      </Button>
                      <div className="flex-grow md:hidden" />
                      <Badge
                        variant="success"
                        className="h-12 gap-1.5 rounded-xl border border-[rgba(52,199,89,0.2)] bg-[rgba(52,199,89,0.12)] px-3 text-[0.95rem] font-bold text-[#248a3d]"
                      >
                        <CalendarCheck className="h-5 w-5 text-[#248a3d]" />
                        เปิดรับสมัคร: {counts.active}
                      </Badge>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => fetchActivities({ force: true })}
                        className="h-12 w-12 rounded-xl border-[var(--page-border)] bg-[var(--page-card-solid)] text-[var(--page-text)] transition-all hover:scale-105 hover:bg-[var(--page-bg)]"
                      >
                        <RefreshCw className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* Activity Cards List */}
              <div className="mt-12">
                {loading ? (
                  <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i}>
                        <Skeleton className="mb-2 h-[280px] rounded-[24px]" />
                        <Skeleton className="mb-1 h-8 w-[70%] rounded-lg" />
                        <Skeleton className="h-6 w-[40%] rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : filteredAndSorted.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="py-28 text-center">
                      <Info className="mx-auto mb-6 h-[90px] w-[90px] text-[var(--page-border)]" />
                      <h2 className="mb-2 text-xl font-bold text-[var(--page-text)]">
                        ไม่พบกิจกรรมที่คุณมองหา
                      </h2>
                      <p className="mb-6 text-base text-[var(--page-text-secondary)]">
                        ลองปรับเงื่อนไขการค้นหาใหม่ หรือเลือกดูทั้งหมด
                      </p>
                      <Button
                        variant="outline"
                        className="rounded-xl px-8 py-5 font-semibold"
                        onClick={() => {
                          setQText("");
                          setStatuses([]);
                          setCategories([]);
                          setTypeFilter("ทั้งหมด");
                          setDepartmentFilters([]);
                        }}
                      >
                        ล้างตัวกรอง
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                  >
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      <AnimatePresence>
                        {filteredAndSorted.map((a) => (
                          <motion.div
                            key={a.id}
                            variants={itemVariants}
                            layoutId={a.id}
                            className="h-full"
                          >
                            <ActivityCard
                              {...a}
                              status={getStatus(a)}
                              canOpen={getStatus(a).key === "active"}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Filter Panel */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[300px] flex-col rounded-l-3xl border-l border-[var(--page-border)] bg-[var(--page-card-solid)] text-[var(--page-text)] shadow-2xl">
            <div className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-extrabold">ตัวกรอง</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileFilterOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <Separator className="mb-4" />
              <div className="max-h-[calc(100dvh-180px)] overflow-y-auto">
                {FilterSidebarContent}
              </div>
              <div className="mt-8 pb-8">
                <Button
                  className="w-full rounded-xl py-5 font-bold"
                  onClick={() => setMobileFilterOpen(false)}
                >
                  แสดงผลลัพธ์ ({filteredAndSorted.length})
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />

      <style jsx global>{`
        @keyframes heroZoom {
          from {
            transform: scale(1);
          }
          to {
            transform: scale(1.08);
          }
        }
        @keyframes heroPulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.45;
          }
        }
        @keyframes heroScroll {
          0% {
            transform: translateY(0);
            opacity: 1;
          }
          70% {
            transform: translateY(12px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default HomePage;
