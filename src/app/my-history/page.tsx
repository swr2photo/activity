// app/my-history/page.tsx
'use client';

import React, { useEffect, useMemo, useState, useDeferredValue, startTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { HistoryIcon } from '@/components/icons/history';
import { cn } from '@/lib/utils';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../../lib/firebaseAuth';
import { getSurveyWindowStatus, surveyStatusLabelTh } from '../../lib/surveyWindow';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useAlertDialog } from '@/components/providers/ConfirmDialogProvider';
import { optimizeAvatarUrl } from '@/utils/avatar';

type RegistrationRecord = {
  id: string;
  activityCode: string;
  activityDocId?: string;
  activityName?: string;
  studentId: string;
  firstName: string;
  lastName: string;
  department: string;
  institutionName?: string;
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

function looksLikeRawActivityCode(value: string) {
  const s = (value || '').trim();
  if (!s) return true;
  if (/^[0-9A-F]{16,}$/i.test(s)) return true;
  if (/^[0-9A-Z_-]{20,}$/i.test(s) && !/\s/.test(s)) return true;
  return false;
}

function displayActivityTitle(record: RegistrationRecord) {
  const name = (record.activityName || '').trim();
  const code = (record.activityCode || '').trim();
  if (name && !looksLikeRawActivityCode(name)) return name;
  if (code && !looksLikeRawActivityCode(code) && name !== code) return code;
  return 'กิจกรรมที่ลงทะเบียน';
}

function countFiles(r: RegistrationRecord) {
  const main = r.files?.length || 0;
  const sess = (r.sessions || []).reduce((n, s) => n + (s.files?.length || 0), 0);
  return main + sess;
}

function HistoryPageSkeleton() {
  return (
    <div className="flex-grow pb-12 pt-2 lg:pb-8 lg:pt-0">
      <div className="sticky top-0 z-20 border-b border-[var(--page-border)] bg-[color-mix(in_srgb,var(--page-bg)_88%,transparent)] pb-3 pt-3 backdrop-blur-[16px] backdrop-saturate-160 lg:top-16 lg:pt-2.5">
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="mb-1.5 h-5 w-[48%]" />
                <Skeleton className="h-3.5 w-[32%]" />
              </div>
            </div>
            <Skeleton className="h-[34px] w-[34px] rounded-[10px]" />
          </div>
          <Skeleton className="mb-3 h-11 w-full rounded-[14px]" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-22 rounded-[10px]" />
            <Skeleton className="h-8 w-32 rounded-[10px]" />
            <Skeleton className="h-8 w-24 rounded-[10px]" />
          </div>
        </div>
      </div>
      <div className="mx-auto mt-6 max-w-3xl space-y-3 px-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--page-border)] bg-[var(--page-card-solid)] p-4"
          >
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-grow">
                <Skeleton className={cn('mb-2 h-5', i % 3 === 0 ? 'w-[80%]' : i % 3 === 1 ? 'w-[70%]' : 'w-[60%]')} />
                <Skeleton className="mb-1.5 h-4 w-[40%]" />
                <Skeleton className="h-3.5 w-[28%]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const MyHistoryPage: React.FC = () => {
  const { user, userData, loading: authLoading, login: userLogin } = useAuth();
  const alertDialog = useAlertDialog();

  const [records, setRecords] = useState<RegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (!user) {
      setLoading(false);
      setRecords([]);
      return;
    }

    if (!userData?.studentId) {
      setLoading(!userData);
      return;
    }

    let cancelled = false;

    const fetchRecords = async () => {
      setLoading(true);
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
            activityDocId: data.activityDocId || '',
            activityName: data.activityName || '',
            studentId: data.studentId || '',
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            department: data.department || '',
            institutionName: data.institutionName || '',
            timestamp: ts,
          };
        });

        rawRecords.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        let completedSurveyCodes = new Set<string>();
        const uniqueCodes = [...new Set(rawRecords.map((r) => r.activityCode).filter(Boolean))];
        const uniqueDocIds = [
          ...new Set(
            rawRecords
              .map((r) => r.activityDocId)
              .filter((id): id is string => Boolean(id))
          ),
        ];
        type ActivityMeta = {
          activityName?: string;
          location?: string;
          bannerUrl?: string;
          surveyEnabled?: boolean;
          surveyStatus?: RegistrationRecord['surveyStatus'];
          surveyStatusLabel?: string;
          files?: any[];
          sessions?: any[];
        };
        const activityMapByCode: Record<string, ActivityMeta> = {};
        const activityMapByDocId: Record<string, ActivityMeta> = {};

        const putActivityMeta = (docId: string, actData: any) => {
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
          const meta: ActivityMeta = {
            activityName: actData.activityName || '',
            location: actData.location,
            bannerUrl: actData.bannerUrl,
            surveyEnabled: Boolean(cfg.enabled),
            surveyStatus: win.label,
            surveyStatusLabel: surveyStatusLabelTh(win),
            files: actData.files || [],
            sessions: actData.sessions || [],
          };
          activityMapByDocId[docId] = meta;
          const code = String(actData.activityCode || '').trim();
          if (code) {
            activityMapByCode[code] = meta;
            activityMapByCode[code.toUpperCase()] = meta;
          }
        };

        const surveyPromise = (async () => {
          if (!user?.uid) return;
          try {
            const surveyQ = query(collection(db, 'surveyResponses'), where('userId', '==', user.uid));
            const surveySnap = await getDocs(surveyQ);
            completedSurveyCodes = new Set(
              surveySnap.docs.map((d) => (d.data().activityCode || '').toUpperCase())
            );
          } catch (err) {
            console.error('Error fetching surveys:', err);
          }
        })();

        const metaPromise = (async () => {
          if (uniqueDocIds.length > 0) {
            try {
              const snaps = await Promise.all(
                uniqueDocIds.map((id) => getDoc(doc(db, 'activityQRCodes', id)))
              );
              snaps.forEach((snap, i) => {
                if (snap.exists()) putActivityMeta(uniqueDocIds[i], snap.data());
              });
            } catch (err) {
              console.error('Error fetching activities by doc id:', err);
            }
          }

          const missingCodes = uniqueCodes.filter((code) => {
            const key = code.toUpperCase();
            return !activityMapByCode[code] && !activityMapByCode[key];
          });
          if (missingCodes.length === 0) return;

          const queryCodes = [
            ...new Set(missingCodes.flatMap((c) => [c, c.toUpperCase(), c.toLowerCase()])),
          ];
          const chunks: string[][] = [];
          for (let i = 0; i < queryCodes.length; i += 30) {
            chunks.push(queryCodes.slice(i, i + 30));
          }
          try {
            const actSnaps = await Promise.all(
              chunks.map((chunk) =>
                getDocs(query(collection(db, 'activityQRCodes'), where('activityCode', 'in', chunk)))
              )
            );
            actSnaps.forEach((actSnap) => {
              actSnap.forEach((d) => putActivityMeta(d.id, d.data()));
            });
          } catch (err) {
            console.error('Error batch fetching activities:', err);
          }
        })();

        await Promise.all([surveyPromise, metaPromise]);
        if (cancelled) return;

        const resolveMeta = (r: RegistrationRecord): ActivityMeta | undefined => {
          if (r.activityDocId && activityMapByDocId[r.activityDocId]) {
            return activityMapByDocId[r.activityDocId];
          }
          const code = r.activityCode || '';
          return activityMapByCode[code] || activityMapByCode[code.toUpperCase()];
        };

        const enriched = rawRecords.map((r) => {
          const meta = resolveMeta(r);
          const resolvedName =
            (meta?.activityName && !looksLikeRawActivityCode(meta.activityName)
              ? meta.activityName
              : '') ||
            (r.activityName && !looksLikeRawActivityCode(r.activityName) ? r.activityName : '') ||
            meta?.activityName ||
            r.activityName ||
            '';
          return {
            ...r,
            activityName: resolvedName,
            location: meta?.location || r.location,
            bannerUrl: meta?.bannerUrl,
            surveyEnabled: meta?.surveyEnabled || false,
            surveyCompleted: completedSurveyCodes.has((r.activityCode || '').toUpperCase()),
            surveyStatus: meta?.surveyStatus,
            surveyStatusLabel: meta?.surveyStatusLabel,
            files: meta?.files || [],
            sessions: meta?.sessions || [],
          };
        });

        setRecords(enriched);
      } catch (e) {
        console.error('Error fetching history:', e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchRecords();
    return () => {
      cancelled = true;
    };
  }, [user, userData, user?.uid]);

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
    <div className="flex min-h-screen flex-col bg-[var(--page-bg)] text-[var(--page-text)]">
      <Navbar />
      {children}
      <Footer />
    </div>
  );

  if (authLoading || (user && loading)) {
    return pageShell(<HistoryPageSkeleton />);
  }

  if (!user) {
    return pageShell(
      <div className="flex flex-grow items-center justify-center px-4 py-20">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div className="mx-auto max-w-[420px] rounded-3xl border border-[var(--page-border)] bg-[var(--page-card-solid)] p-8 text-center shadow-[var(--page-shadow)] sm:p-10">
            <div
              className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[18px]"
              style={{ background: 'linear-gradient(145deg, #0a6bcf 0%, #1aa35a 100%)' }}
            >
              <HistoryIcon.History className="h-8 w-8 text-white" />
            </div>
            <h1 className="mb-2 text-xl font-extrabold tracking-tight sm:text-2xl">ประวัติการลงทะเบียน</h1>
            <p className="mb-6 text-sm leading-relaxed text-[var(--page-text-secondary)]">
              เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย เพื่อดูกิจกรรมที่เคยลงทะเบียน เอกสาร และแบบประเมินที่ค้างอยู่
            </p>
            <Button
              size="lg"
              className="w-full rounded-[14px] bg-[#0a6bcf] py-3 font-bold shadow-[0_8px_20px_rgba(10,107,207,0.28)] hover:bg-[#0858ad]"
              onClick={userLogin}
            >
              <HistoryIcon.Login />
              เข้าสู่ระบบ
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return pageShell(
    <div className="flex-grow pb-12 pt-2 lg:pb-8 lg:pt-0">
      <div className="sticky top-0 z-20 border-b border-[var(--page-border)] bg-[color-mix(in_srgb,var(--page-bg)_88%,transparent)] pb-3 pt-3 backdrop-blur-[16px] backdrop-saturate-160 lg:top-16 lg:pt-2.5">
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar className="h-11 w-11 shrink-0 border-2 border-[color-mix(in_srgb,#0a6bcf_35%,transparent)]">
                <AvatarImage
                  src={optimizeAvatarUrl(user?.photoURL || userData?.photoURL, 96)}
                  alt=""
                  referrerPolicy="no-referrer"
                />
                <AvatarFallback>
                  {(userData?.firstName?.charAt(0) || user?.displayName?.charAt(0) || '?').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="truncate text-base font-extrabold tracking-tight leading-tight sm:text-lg">
                  {userData?.username?.trim() ||
                    userData?.displayName ||
                    [userData?.firstName, userData?.lastName].filter(Boolean).join(' ') ||
                    user?.displayName ||
                    'ผู้ใช้'}
                </h1>
                <p className="block truncate text-xs font-semibold text-[var(--page-text-secondary)]">
                  {userData?.department && userData.department !== 'ไม่ระบุ'
                    ? userData.department
                    : userData?.faculty && userData.faculty !== 'ไม่ระบุ'
                      ? userData.faculty
                      : '—'}
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="icon" className="shrink-0 border-[var(--page-border)] bg-[var(--page-card)]" aria-label="กลับหน้าแรก">
              <Link href="/">
                <HistoryIcon.Back />
              </Link>
            </Button>
          </div>

          <div className="relative">
            <HistoryIcon.Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--page-text-secondary)]" />
            <Input
              placeholder="ค้นหาชื่อ รหัส หรือสถานที่…"
              value={searchText}
              onChange={(e) => startTransition(() => setSearchText(e.target.value))}
              className="h-11 rounded-[14px] border-[var(--page-border)] bg-[var(--page-card-solid)] pl-10 pr-10 text-[0.95rem]"
            />
            {searchText && (
              <button
                type="button"
                aria-label="ล้างคำค้น"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 hover:bg-accent"
                onClick={() => setSearchText('')}
              >
                <HistoryIcon.Clear size="lg" />
              </button>
            )}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {(
              [
                { key: 'all' as FilterKey, label: 'ทั้งหมด', count: records.length },
                { key: 'survey' as FilterKey, label: 'ค้างแบบประเมิน', count: surveyPendingCount },
                { key: 'files' as FilterKey, label: 'มีเอกสาร', count: withFilesCount },
              ] as const
            ).map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'h-8 shrink-0 rounded-[10px] border px-3 text-[0.8rem] font-bold transition-colors',
                    active
                      ? 'border-[#0a6bcf] bg-[#0a6bcf] text-white hover:bg-[#0858ad]'
                      : 'border-[var(--page-border)] bg-[var(--page-card-solid)] text-[var(--page-text)] hover:bg-[color-mix(in_srgb,var(--page-card)_80%,#0a6bcf)]'
                  )}
                >
                  {f.label}{f.count ? ` (${f.count})` : ''}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-3xl px-4">
        {filteredRecords.length === 0 ? (
          <div className="px-4 py-20 text-center">
            <HistoryIcon.Info className="mx-auto mb-4 h-14 w-14 text-[var(--page-text-secondary)] opacity-45" />
            <h2 className="mb-2 text-lg font-extrabold">
              {records.length === 0
                ? 'ยังไม่มีประวัติ'
                : filter === 'survey'
                  ? 'ไม่มีแบบประเมินค้าง'
                  : filter === 'files'
                    ? 'ไม่พบเอกสารแนบ'
                    : 'ไม่พบผลลัพธ์'}
            </h2>
            <p className="mb-6 text-sm text-[var(--page-text-secondary)]">
              {records.length === 0
                ? 'เมื่อลงทะเบียนกิจกรรมแล้ว จะแสดงที่นี่ทันที'
                : 'ลองเปลี่ยนตัวกรองหรือคำค้นหา'}
            </p>
            {records.length === 0 ? (
              <Button asChild className="rounded-xl bg-[#0a6bcf] px-8 font-bold hover:bg-[#0858ad]">
                <Link href="/">ดูกิจกรรมทั้งหมด</Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                className="rounded-xl font-bold"
                onClick={() => {
                  setFilter('all');
                  setSearchText('');
                }}
              >
                ล้างตัวกรอง
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groupedByDate.map((group) => (
              <div key={group.key}>
                <div className="mb-3 flex items-center gap-2 px-1">
                  <HistoryIcon.DayGroup className="text-[var(--page-text-secondary)]" size="md" />
                  <span className="text-xs font-extrabold text-[var(--page-text-secondary)]">{group.label}</span>
                  <span className="text-xs text-[var(--page-text-secondary)] opacity-70">· {group.items.length}</span>
                </div>

                <div className="space-y-3">
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
                          <div
                            className={cn(
                              'overflow-hidden rounded-2xl bg-[var(--page-card-solid)] transition-[border-color,box-shadow]',
                              'hover:shadow-[0_10px_28px_rgba(0,0,0,0.06)]',
                              needsSurvey
                                ? 'border border-[color-mix(in_srgb,#e8a317_55%,var(--page-border))]'
                                : 'border border-[var(--page-border)]'
                            )}
                          >
                            <div className="p-4 sm:p-4">
                              <div className="flex items-start gap-3">
                                <div className="shrink-0">
                                  {record.bannerUrl ? (
                                    <div className="relative h-[52px] w-[52px] overflow-hidden rounded-xl sm:h-[60px] sm:w-[60px]">
                                      <Image src={record.bannerUrl} alt="" fill sizes="60px" style={{ objectFit: 'cover' }} />
                                    </div>
                                  ) : (
                                    <div
                                      className="flex h-[52px] w-[52px] items-center justify-center rounded-xl sm:h-[60px] sm:w-[60px]"
                                      style={{ background: 'linear-gradient(145deg, #0a6bcf 0%, #1aa35a 100%)' }}
                                    >
                                      <HistoryIcon.ActivityThumb className="text-white" />
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0 flex-grow">
                                  <p className="mb-1 text-[0.95rem] font-extrabold leading-tight tracking-tight sm:text-[1.02rem]">
                                    {displayActivityTitle(record)}
                                  </p>
                                  {looksLikeRawActivityCode(record.activityName || record.activityCode) &&
                                    record.activityCode && (
                                      <p className="mb-1 block font-mono text-[0.7rem] text-[var(--page-text-secondary)]">
                                        รหัส {record.activityCode.slice(0, 8)}…
                                      </p>
                                    )}

                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[var(--page-text-secondary)]">
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold">
                                      <HistoryIcon.Time />
                                      {formatShortDate(record.timestamp)} · {formatTime(record.timestamp)}
                                    </span>
                                    {record.location && (
                                      <span className="inline-flex max-w-[160px] items-center gap-1 truncate text-xs font-semibold">
                                        <HistoryIcon.Location />
                                        {record.location}
                                      </span>
                                    )}
                                    {(record.institutionName || record.department) && (
                                      <span className="inline-flex max-w-[180px] items-center gap-1 truncate text-xs font-semibold sm:max-w-[220px]">
                                        <HistoryIcon.Affiliation />
                                        {record.institutionName || record.department}
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    <Badge className="h-6 gap-1 rounded-lg border-0 bg-[rgba(26,163,90,0.12)] text-[0.7rem] font-bold text-[#1a7a45]">
                                      <HistoryIcon.Registered />
                                      ลงทะเบียนแล้ว
                                    </Badge>
                                    {fileCount > 0 && (
                                      <button type="button" onClick={() => toggleExpand(record.id)}>
                                        <Badge className="h-6 cursor-pointer gap-1 rounded-lg border-0 bg-[rgba(10,107,207,0.1)] text-[0.7rem] font-bold text-[#0a6bcf]">
                                          <HistoryIcon.Docs />
                                          เอกสาร {fileCount}
                                        </Badge>
                                      </button>
                                    )}
                                    {record.surveyEnabled && record.surveyCompleted && (
                                      <Badge variant="secondary" className="h-6 gap-1 rounded-lg text-[0.7rem] font-bold">
                                        <HistoryIcon.SurveyDone />
                                        ทำแบบประเมินแล้ว
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                {needsSurvey && (
                                  <Button
                                    asChild
                                    size="sm"
                                    className="flex-1 rounded-[10px] bg-[#e8a317] py-2 text-[0.8rem] font-extrabold text-[#1d1d1f] shadow-none hover:bg-[#d4920f] hover:shadow-none"
                                  >
                                    <Link href={`/register?activity=${record.activityCode}`}>
                                      <HistoryIcon.SurveyAction />
                                      {record.surveyStatus === 'forced_open'
                                        ? 'ทำแบบประเมิน (ขยายเวลา)'
                                        : 'ทำแบบประเมิน (เปิดอยู่)'}
                                    </Link>
                                  </Button>
                                )}
                                {surveyPendingLater && (
                                  <Button asChild size="sm" variant="outline" className="flex-1 rounded-[10px] py-2 text-[0.8rem] font-bold">
                                    <Link href={`/register?activity=${record.activityCode}`}>
                                      <HistoryIcon.SurveyAction />
                                      {record.surveyStatus === 'not_started'
                                        ? 'แบบประเมินยังไม่เปิด'
                                        : 'หมดเวลาทำแบบประเมิน'}
                                    </Link>
                                  </Button>
                                )}
                                {hasDetails && (
                                  <Button
                                    size="sm"
                                    variant={needsSurvey ? 'outline' : 'default'}
                                    className={cn(
                                      'rounded-[10px] py-2 text-[0.8rem] font-bold',
                                      !needsSurvey && 'flex-1 bg-[#0a6bcf] shadow-none hover:bg-[#0858ad] hover:shadow-none'
                                    )}
                                    onClick={() => toggleExpand(record.id)}
                                  >
                                    {expanded ? 'ซ่อนรายละเอียด' : fileCount > 0 ? `เอกสาร (${fileCount})` : 'รายละเอียด'}
                                    <HistoryIcon.Expand className={cn(!expanded && 'rotate-180')} />
                                  </Button>
                                )}
                              </div>
                            </div>

                            {expanded && (
                              <div className="border-t border-[var(--page-border)] bg-[color-mix(in_srgb,var(--page-bg)_65%,transparent)] px-4 pb-4 pt-2">
                                {record.files && record.files.length > 0 && (
                                  <div className="mt-2">
                                    <p className="mb-2 flex items-center gap-1 text-xs font-extrabold">
                                      <HistoryIcon.Docs />
                                      เอกสารกิจกรรม
                                    </p>
                                    <div className="space-y-1.5">
                                      {record.files.map((file: any) => (
                                        <FileRow key={file.id} file={file} onDownload={handleAuthDownload} />
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {record.sessions && record.sessions.length > 0 && (
                                  <div className="mt-4">
                                    <p className="mb-2 block text-xs font-extrabold">กิจกรรมย่อย / รอบ</p>
                                    <div className="space-y-2">
                                      {record.sessions.map((sess: any) => (
                                        <div
                                          key={sess.id}
                                          className="rounded-xl border border-[var(--page-border)] bg-[var(--page-card-solid)] p-3"
                                        >
                                          <p className="text-sm font-bold">{sess.name}</p>
                                          {sess.files && sess.files.length > 0 ? (
                                            <div className="mt-2 space-y-1.5">
                                              {sess.files.map((file: any) => (
                                                <FileRow key={file.id} file={file} onDownload={handleAuthDownload} dense />
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="mt-1 block text-xs text-[var(--page-text-secondary)]">ไม่มีเอกสารแนบ</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {(!record.files || record.files.length === 0) &&
                                  (!record.sessions || record.sessions.length === 0) && (
                                    <p className="block py-4 text-center text-xs text-[var(--page-text-secondary)]">
                                      ไม่มีเอกสารแนบหรือข้อมูลกิจกรรมย่อย
                                    </p>
                                  )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
    <div
      className={cn(
        'rounded-xl border border-[var(--page-border)] bg-[var(--page-card-solid)]',
        dense ? 'p-2' : 'p-3'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-grow">
          <p className={cn('truncate font-bold', dense ? 'text-xs' : 'text-sm')}>{file.name}</p>
          {file.description && (
            <p className="mt-0.5 block truncate text-xs text-[var(--page-text-secondary)]">{file.description}</p>
          )}
        </div>
        {file.type === 'text' ? (
          <p className="max-w-[45%] whitespace-pre-wrap break-words text-xs text-[var(--page-text-secondary)]">
            {file.url}
          </p>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className={cn('shrink-0 rounded-lg font-bold', dense ? 'px-2 text-[0.72rem]' : 'px-3 text-[0.8rem]')}
            {...(file.type === 'link'
              ? { asChild: true }
              : { onClick: () => onDownload(file.url) })}
          >
            {file.type === 'link' ? (
              <a href={file.url} target="_blank" rel="noopener noreferrer">
                <HistoryIcon.OpenFile />
                เปิด
              </a>
            ) : (
              <>
                <HistoryIcon.OpenFile />
                เปิด
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default MyHistoryPage;
