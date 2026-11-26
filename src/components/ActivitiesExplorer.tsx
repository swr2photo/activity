// components/ActivitiesExplorer.tsx
"use client";

import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { ActivityListItem } from "@/lib/activitiesList";
import DeferredNavbar from "@/components/DeferredNavbar";
import Footer from "@/components/Footer";
import ActivityCard from "@/components/ActivityCard";
import DeferredHeroVideo from "@/components/DeferredHeroVideo";
import AuroraBackground from "@/components/graphics/AuroraBackground";
import ScienceOrbit from "@/components/graphics/ScienceOrbit";
import EmptyIllustration from "@/components/graphics/EmptyIllustration";
import CountUp from "@/components/graphics/CountUp";
import {
  ArrowDown,
  RefreshCw,
  Search,
  CalendarCheck,
  Filter,
  X,
} from "lucide-react";
import { glassCardLargeClass } from "@/lib/uiTheme";
import { getDepartmentLabel } from "@/types/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  getPaginationItems,
} from "@/components/ui/pagination";

// --- Hero media ---
// วิดีโอบanner ม.อ. — override ได้ด้วย NEXT_PUBLIC_HERO_VIDEO_URL / NEXT_PUBLIC_HERO_POSTER_URL
const HERO_VIDEO =
  process.env.NEXT_PUBLIC_HERO_VIDEO_URL ||
  "https://www.psu.ac.th/img/vdo/PSU-4-06-02-2025.mp4";
const HERO_POSTER =
  process.env.NEXT_PUBLIC_HERO_POSTER_URL || "/hero-poster.svg";

// --- Types ---
type StatusKey = "active" | "upcoming" | "full" | "ended" | "inactive";

const STATUS_OPTIONS = [
  { value: "active", label: "เปิดให้ลงทะเบียนแล้ว" },
  { value: "soon", label: "เร็วๆ นี้" },
  { value: "full", label: "เต็มแล้ว" },
  { value: "ended", label: "ผ่านมาแล้ว" },
];
/** จำนวนการ์ดต่อหน้า — เกินนี้แสดง pagination */
const PAGE_SIZE = 9;

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

const readCachedActivities = (): ActivityListItem[] | null => {
  const hit = readRefreshCache<ActivityListItem[]>(RefreshCacheKey.homeActivities);
  return hit?.data?.length ? hit.data : null;
};

/**
 * ใช้เฉพาะตอนผู้ใช้กดรีเฟรชหรือ server โหลดครั้งแรกไม่สำเร็จ
 * หน้าแรกไม่ fallback ไป Firestore ฝั่ง browser เพื่อไม่ให้ดึง Firebase SDK เข้าหน้า public
 */
const loadActivities = async (): Promise<ActivityListItem[]> => {
  const res = await fetch("/api/activities");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { activities?: ActivityListItem[] };
  if (!Array.isArray(json.activities)) throw new Error("bad payload");
  return json.activities;
};

type ActivitiesExplorerProps = {
  initialActivities: ActivityListItem[] | null;
};

const HomePage: React.FC<ActivitiesExplorerProps> = ({ initialActivities }) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isActivitiesPage = pathname === "/activities";

  const [loading, setLoading] = useState(initialActivities === null);
  const [activities, setActivities] = useState<ActivityListItem[]>(
    initialActivities ?? []
  );
  const [error, setError] = useState("");
  const [qText, setQText] = useState("");
  const deferredQText = useDeferredValue(qText);

  const [statuses, setStatuses] = useState<string[]>(() =>
    searchParams.get("status") === "active" ? ["active"] : []
  );
  const [departmentFilters, setDepartmentFilters] = useState<string[]>([]);

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

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
      const list = await loadActivities();
      setActivities(list);
      writeRefreshCache(RefreshCacheKey.homeActivities, list);
    } catch (e) {
      if (!hasCache) setError("ไม่สามารถโหลดรายการกิจกรรมได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialActivities !== null) {
      writeRefreshCache(RefreshCacheKey.homeActivities, initialActivities);
      setLoading(false);
      return;
    }

    const cached = readCachedActivities();
    if (cached?.length) {
      setActivities(cached);
      setLoading(false);
    }
    void fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialActivities]);

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
        .filter((d) => {
          const normalized = d.toLowerCase();
          return (
            d &&
            d !== "ไม่ระบุ" &&
            d !== "ทุกสังกัด" &&
            normalized !== "all"
          );
        })
    );
    return Array.from(deps).sort((a, b) =>
      getDepartmentLabel(a).localeCompare(getDepartmentLabel(b), "th")
    );
  }, [activities]);

  const filteredAndSorted = useMemo(() => {
    const t = deferredQText.trim().toLowerCase();
    const withStatus = activities.map((a) => ({
      activity: a,
      status: getStatus(a),
      soon: isSoon(a, 24),
    }));
    const filtered = withStatus.filter(({ activity: a, status: sObj, soon }) => {
      const matchSearch =
        !t ||
        a.activityCode.toLowerCase().includes(t) ||
        a.activityName.toLowerCase().includes(t) ||
        (a.location || "").toLowerCase().includes(t);

      let sStr = sObj.key as string;
      if (sStr === "upcoming" && soon) sStr = "soon";

      const matchStatus = statuses.length === 0 || statuses.includes(sStr);
      const matchDepartment =
        departmentFilters.length === 0 ||
        departmentFilters.includes(a.department || "ไม่ระบุ");

      return matchSearch && matchStatus && matchDepartment;
    });
    const rank = (s: StatusKey) =>
      s === "active" ? 0 : s === "upcoming" ? 1 : s === "full" ? 2 : 3;
    return filtered.sort((a, b) => rank(a.status.key) - rank(b.status.key));
  }, [activities, deferredQText, statuses, departmentFilters]);

  // sync ?status= จาก URL (เช่น /activities?status=active)
  useEffect(() => {
    const s = searchParams.get("status");
    if (s === "active") setStatuses(["active"]);
  }, [searchParams]);

  // เปลี่ยนตัวกรอง/ค้นหา → กลับหน้า 1
  useEffect(() => {
    setPage(1);
  }, [qText, statuses, departmentFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedActivities = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSorted.slice(start, start + PAGE_SIZE);
  }, [filteredAndSorted, currentPage]);

  const goToPage = (p: number) => {
    const next = Math.max(1, Math.min(totalPages, p));
    setPage(next);
    if (typeof window !== "undefined") {
      document.getElementById("activities")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const activeFilterCount = statuses.length + departmentFilters.length;

  const scrollToActivities = () => {
    document
      .getElementById("activities")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchActivities({ force: true });
    } finally {
      setRefreshing(false);
    }
  };

  const renderFilterSidebar = (idPrefix: string) => (
    <div className="p-2 md:p-4">
      {/* Status */}
      <p className="mb-3 text-sm font-bold text-[var(--page-text)]">สถานะ</p>
      <div className="flex flex-col gap-2">
        {STATUS_OPTIONS.map((stat) => (
          <div key={stat.value} className="flex items-center gap-2">
            <Checkbox
              id={`${idPrefix}-stat-${stat.value}`}
              checked={statuses.includes(stat.value)}
              onCheckedChange={(checked) => {
                if (checked) setStatuses((prev) => [...prev, stat.value]);
                else
                  setStatuses((prev) => prev.filter((s) => s !== stat.value));
              }}
              className="border-[var(--page-border)] data-[state=checked]:border-[#34c759] data-[state=checked]:bg-[#34c759]"
            />
            <Label
              htmlFor={`${idPrefix}-stat-${stat.value}`}
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
                  id={`${idPrefix}-dep-${dep}`}
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
                  htmlFor={`${idPrefix}-dep-${dep}`}
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
    <div
      className={cn(
        "flex min-h-screen flex-col",
        isActivitiesPage ? "bg-[var(--page-bg)]" : "bg-[#050914]"
      )}
    >
      <DeferredNavbar />

      {/* ===================== Hero — เฉพาะหน้าแรก ===================== */}
      {!isActivitiesPage && (
      <section className="relative z-[1] isolate flex min-h-[68svh] flex-col justify-center overflow-hidden bg-[#050914] pb-20 pt-16 text-white md:min-h-[88svh] md:pb-28 md:pt-10">
        <Link
          href="/"
          aria-label="PSU REGISTER หน้าแรก"
          className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-black tracking-wide text-white backdrop-blur-md md:hidden"
        >
          <span className="h-2 w-2 rounded-full bg-brand-gradient" />
          PSU REGISTER
        </Link>

        {/* Layer 1: Poster image */}
        {HERO_POSTER ? (
          <div
            className="absolute inset-0 -z-[3] scale-105 bg-cover bg-center opacity-70"
            style={{ backgroundImage: `url(${HERO_POSTER})` }}
          />
        ) : null}

        {/* Layer 2: Video background — โหลดหลังเนื้อหาหลักและไม่โหลดบนมือถือ/Save-Data */}
        <DeferredHeroVideo src={HERO_VIDEO} poster={HERO_POSTER} />

        {/* Layer 3: Readability overlay + aurora light */}
        <div
          className="absolute inset-0 -z-[1]"
          style={{
            background: `
              radial-gradient(ellipse 90% 70% at 50% 40%, rgba(5,9,20,0.35) 0%, rgba(5,9,20,0.78) 100%),
              linear-gradient(to bottom, rgba(5,9,20,0.75) 0%, rgba(5,9,20,0.25) 30%, rgba(5,9,20,0.35) 65%, #050914 100%)
            `,
          }}
        />
        <AuroraBackground variant="hero" className="-z-[1] opacity-80 mix-blend-screen" />

        {/* Graphics: อะตอมลอย + วงแหวนประดับ (ซ่อนบนจอเล็กเพื่อความเร็ว) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-[1] hidden md:block">
          <ScienceOrbit
            tone="light"
            className="absolute right-[6%] top-[14%] h-[210px] w-[210px] animate-float opacity-80 lg:h-[260px] lg:w-[260px]"
          />
          <ScienceOrbit
            tone="light"
            className="absolute bottom-[20%] left-[5%] h-[120px] w-[120px] animate-float-slow opacity-50 [animation-delay:-3s]"
          />
          <div className="absolute left-[12%] top-[18%] h-24 w-24 animate-spin-slow rounded-full border border-dashed border-white/20" />
          <div className="absolute bottom-[28%] right-[16%] h-40 w-40 animate-spin-slower rounded-full border border-white/10" />
        </div>

        <div className="relative mx-auto w-full max-w-4xl px-4 text-center">
          {/* Badge */}
          <div className="mb-7 inline-flex animate-fade-down items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.08] px-4 py-2 backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
            </span>
            <span className="text-[0.8rem] font-bold tracking-wide text-white/90">
              {loading
                ? "กำลังโหลดกิจกรรม..."
                : counts.active > 0
                  ? `เปิดรับสมัครแล้ว ${counts.active} กิจกรรม`
                  : "ยังไม่มีกิจกรรมที่เปิดรับสมัคร"}
            </span>
          </div>

          <h1
            className="mb-6 font-extrabold leading-[1.08] tracking-tight"
            style={{ fontSize: "clamp(2.7rem, 7.5vw, 5.25rem)" }}
          >
            <span className="block animate-fade-up text-white [animation-delay:80ms]">ค้นพบกิจกรรม</span>
            <span className="block animate-fade-up [animation-delay:200ms]">
              <span className="text-gradient-brand animate-gradient-x">ที่คุณชอบ</span>
              <span className="text-white">.</span>
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-[580px] animate-fade-up px-2 text-[1.05rem] font-medium text-white/75 [animation-delay:320ms] md:text-[1.25rem]">
            ระบบลงทะเบียนกิจกรรมออนไลน์ คณะวิทยาศาสตร์ ม.อ.
            <br className="hidden sm:block" /> สะดวก รวดเร็ว และแม่นยำ
          </p>

          {/* CTA: เลื่อนลงดูรายการกิจกรรมได้ทันทีไม่ต้องโหลดหน้าใหม่ */}
          <div className="flex animate-fade-up flex-wrap items-center justify-center gap-3 [animation-delay:440ms]">
            <Button
              type="button"
              onClick={scrollToActivities}
              className="shine h-auto rounded-full bg-white px-9 py-4 text-base font-bold text-slate-900 shadow-[0_12px_32px_rgba(255,255,255,0.18)] hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_18px_44px_rgba(34,211,238,0.35)]"
            >
              สำรวจกิจกรรมทั้งหมด
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-auto rounded-full border-white/25 bg-white/[0.06] px-7 py-4 text-base font-bold text-white backdrop-blur-md hover:border-white/50 hover:bg-white/15 hover:text-white"
            >
              <Link href="/my-history">ประวัติของฉัน</Link>
            </Button>
          </div>

          {/* Stats */}
          <dl className="mx-auto mt-12 grid max-w-xl animate-fade-up grid-cols-3 gap-2 [animation-delay:560ms] sm:gap-4">
            {[
              { label: "กิจกรรมทั้งหมด", value: counts.all, dot: "bg-sky-400" },
              { label: "เปิดรับตอนนี้", value: counts.active, dot: "bg-emerald-400" },
              { label: "เริ่มใน 24 ชม.", value: counts.soon, dot: "bg-amber-400" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-2 py-3 backdrop-blur-md sm:px-4 sm:py-4"
              >
                <dt className="flex items-center justify-center gap-1.5 text-[0.7rem] font-semibold text-white/60 sm:text-xs">
                  <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                  {s.label}
                </dt>
                <dd className="mt-1 text-2xl font-extrabold tabular-nums sm:text-3xl">
                  {loading ? "–" : <CountUp value={s.value} />}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Scroll indicator */}
        <button
          type="button"
          aria-label="ไปยังรายการกิจกรรม"
          onClick={scrollToActivities}
          className="absolute bottom-[86px] left-1/2 hidden h-[42px] w-[26px] -translate-x-1/2 cursor-pointer justify-center rounded-[14px] border-2 border-white/30 pt-[7px] transition-colors hover:border-white/60 [@media(min-width:768px)_and_(min-height:860px)]:flex"
        >
          <span className="h-[9px] w-1 animate-scroll-hint rounded bg-white/75" />
        </button>
      </section>
      )}

      {/* หัวข้อหน้ารวมกิจกรรม */}
      {isActivitiesPage && (
        <div className="relative z-[2] isolate overflow-hidden border-b border-[var(--page-border)] bg-[var(--page-bg)] pb-6 pt-8 md:pb-10 md:pt-12">
          <AuroraBackground />
          <ScienceOrbit className="pointer-events-none absolute -right-6 -top-6 hidden h-48 w-48 animate-float opacity-70 md:block" />
          <div className="relative mx-auto w-full max-w-[1400px] px-4">
            <p className="mb-2 animate-fade-down text-sm font-semibold text-[var(--page-text-secondary)]">
              <Link href="/" className="hover:text-[var(--page-text)] hover:underline">
                หน้าแรก
              </Link>
              {" / "}
              กิจกรรม
            </p>
            <h1 className="animate-fade-up text-3xl font-extrabold tracking-tight text-[var(--page-text)] md:text-4xl">
              กิจกรรม<span className="text-gradient-brand">ทั้งหมด</span>
            </h1>
            <p className="mt-2 animate-fade-up text-sm text-[var(--page-text-secondary)] [animation-delay:120ms] md:text-base">
              ค้นหา กรอง และเรียกดูกิจกรรมที่เปิดรับสมัคร
            </p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div
        id="activities"
        className={cn(
          "relative z-[2] flex-grow scroll-mt-20 bg-[var(--page-bg)]",
          !isActivitiesPage && "mt-0 rounded-t-[40px]"
        )}
      >
        <div
          className={cn(
            "mx-auto mb-24 w-full max-w-[1400px] px-4",
            isActivitiesPage ? "mt-6 md:mt-8" : "mt-[-2.5rem]"
          )}
        >
          <div className="grid grid-cols-12 gap-4 md:gap-8">
            {/* Left Sidebar (Desktop) */}
            <div className="col-span-12 hidden md:col-span-3 md:block lg:col-span-3 xl:col-span-3">
              <Card
                className={cn(
                  glassCardLargeClass,
                  "sticky top-[100px] p-2 shadow-[var(--page-shadow)]"
                )}
              >
                {renderFilterSidebar("desktop")}
              </Card>
            </div>

            {/* Right Content */}
            <div className="col-span-12 md:col-span-9 lg:col-span-9">
              {/* Floating Search Bar + Quick Filter Pills */}
              <Card
                className={cn(
                  glassCardLargeClass,
                  "animate-fade-up p-4 shadow-[var(--page-shadow-lg)] md:p-6"
                )}
              >
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {[
                    { key: "all", label: `ทั้งหมด (${counts.all})` },
                    { key: "active", label: `เปิดรับตอนนี้ (${counts.active})` },
                    { key: "soon", label: `เร็วๆ นี้ (${counts.soon})` },
                  ].map((pill) => {
                    const isSelected =
                      pill.key === "all"
                        ? statuses.length === 0
                        : statuses.length === 1 && statuses[0] === pill.key;
                    return (
                      <button
                        key={pill.key}
                        type="button"
                        onClick={() =>
                          setStatuses(pill.key === "all" ? [] : [pill.key])
                        }
                        aria-pressed={isSelected}
                        className={cn(
                          "rounded-full border px-4 py-1.5 text-xs font-bold transition-[background-color,border-color,color,box-shadow,scale] duration-300 active:scale-95",
                          isSelected
                            ? "border-transparent bg-brand-gradient text-white shadow-[0_6px_18px_-6px_rgba(10,107,207,0.6)]"
                            : "border-[var(--page-border)] bg-[var(--page-card-solid)] text-[var(--page-text)] hover:border-primary/50 hover:text-primary"
                        )}
                      >
                        {pill.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-col items-center gap-4 md:flex-row">
                    <div className="group relative w-full flex-1">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--page-text-secondary)] transition-colors group-focus-within:text-primary" />
                      <Input
                        type="search"
                        enterKeyHint="search"
                        placeholder="ค้นหาชื่อกิจกรรม รหัส หรือสถานที่..."
                        value={qText}
                        onChange={(e) => setQText(e.target.value)}
                        className="h-14 rounded-2xl border-[var(--page-border)] bg-[var(--page-card-solid)] pl-12 pr-10 text-[1.05rem] text-[var(--page-text)] shadow-none"
                      />
                      {qText && (
                        <button
                          type="button"
                          onClick={() => setQText("")}
                          aria-label="ล้างคำค้นหา"
                          className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 animate-pop-in items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
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
                          <Badge className="absolute -right-2 -top-2 h-5 min-w-5 animate-pop-in justify-center rounded-full px-1.5 text-[0.65rem]">
                            {activeFilterCount}
                          </Badge>
                        )}
                      </Button>
                      <div className="flex-grow md:hidden" />
                      <Badge
                        variant="success"
                        className="h-12 gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-[0.95rem] font-bold text-emerald-700 dark:text-emerald-400"
                      >
                        <CalendarCheck className="h-5 w-5" />
                        เปิดรับสมัคร: <CountUp value={counts.active} />
                      </Badge>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        aria-label="รีเฟรชรายการกิจกรรม"
                        title="รีเฟรชรายการกิจกรรม"
                        className="group h-12 w-12 rounded-xl border-[var(--page-border)] bg-[var(--page-card-solid)] text-[var(--page-text)] hover:bg-[var(--page-bg)] hover:text-primary"
                      >
                        <RefreshCw
                          className={cn(
                            "h-5 w-5 transition-transform duration-500 group-hover:rotate-180",
                            refreshing && "animate-spin"
                          )}
                        />
                      </Button>
                    </div>
                  </div>
                </Card>

              {/* Activity Cards List */}
              <div className="mt-12">
                {loading ? (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className="overflow-hidden rounded-[28px] border border-[var(--page-border)] bg-[var(--page-card-solid)]"
                      >
                        <Skeleton className="h-[150px] rounded-none" />
                        <div className="space-y-3 p-5">
                          <Skeleton className="h-6 w-[78%] rounded-lg" />
                          <Skeleton className="h-4 w-[45%] rounded-lg" />
                          <Skeleton className="h-20 w-full rounded-xl" />
                          <Skeleton className="h-11 w-full rounded-xl" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <Alert variant="destructive" className="mx-auto max-w-2xl rounded-2xl">
                    <AlertDescription className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                      <span>{error}</span>
                      <Button
                        variant="outline"
                        onClick={() => fetchActivities({ force: true })}
                        className="shrink-0"
                      >
                        ลองใหม่อีกครั้ง
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : filteredAndSorted.length === 0 ? (
                  <div className="animate-scale-in">
                    <div className="py-16 text-center md:py-24">
                      <EmptyIllustration className="mx-auto mb-4 h-40 w-56 text-[var(--page-text)]" />
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
                          setDepartmentFilters([]);
                        }}
                      >
                        ล้างตัวกรอง
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* key ตามหน้า/ตัวกรอง → การ์ดเล่นแอนิเมชันเรียงลำดับใหม่ทุกครั้งที่ผลลัพธ์เปลี่ยน */}
                    <div
                      key={`${currentPage}-${statuses.join(",")}-${departmentFilters.join(",")}`}
                      className="stagger grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
                    >
                      {pagedActivities.map(({ activity: a, status }, idx) => (
                        <div
                          key={a.id}
                          className="h-full"
                          style={{ "--i": idx } as React.CSSProperties}
                        >
                          <ActivityCard
                            {...a}
                            status={status}
                            canOpen={status.key === "active"}
                            priority={currentPage === 1 && idx < 3}
                          />
                        </div>
                      ))}
                    </div>

                    {filteredAndSorted.length > PAGE_SIZE && (
                      <div className="mt-10 flex flex-col items-center gap-3">
                        <p className="text-sm text-[var(--page-text-secondary)]">
                          หน้า {currentPage} จาก {totalPages} · แสดง{" "}
                          {(currentPage - 1) * PAGE_SIZE + 1}–
                          {Math.min(currentPage * PAGE_SIZE, filteredAndSorted.length)} จาก{" "}
                          {filteredAndSorted.length} กิจกรรม
                        </p>
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() => goToPage(currentPage - 1)}
                                disabled={currentPage <= 1}
                              />
                            </PaginationItem>
                            {getPaginationItems(currentPage, totalPages).map((item, idx) =>
                              item === "ellipsis" ? (
                                <PaginationItem key={`e-${idx}`}>
                                  <PaginationEllipsis />
                                </PaginationItem>
                              ) : (
                                <PaginationItem key={item}>
                                  <PaginationLink
                                    isActive={item === currentPage}
                                    onClick={() => goToPage(item)}
                                  >
                                    {item}
                                  </PaginationLink>
                                </PaginationItem>
                              )
                            )}
                            <PaginationItem>
                              <PaginationNext
                                onClick={() => goToPage(currentPage + 1)}
                                disabled={currentPage >= totalPages}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Filter Panel */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-[4px]"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div role="dialog" aria-modal="true" aria-label="ตัวกรอง" className="absolute inset-y-0 right-0 flex w-[min(320px,88vw)] animate-slide-in-right flex-col rounded-l-3xl border-l border-[var(--page-border)] bg-[var(--page-card-solid)] text-[var(--page-text)] shadow-2xl">
            <div className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-extrabold">ตัวกรอง</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileFilterOpen(false)}
                  aria-label="ปิดตัวกรอง"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <Separator className="mb-4" />
              <div className="max-h-[calc(100dvh-180px)] overflow-y-auto">
                {renderFilterSidebar("mobile")}
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

    </div>
  );
};

export default function ActivitiesExplorer({
  initialActivities,
}: ActivitiesExplorerProps) {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <HomePage initialActivities={initialActivities} />
    </React.Suspense>
  );
}
