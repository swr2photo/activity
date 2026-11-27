// src/components/admin/SurveyResultsPanel.tsx
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ClipboardCheck,
  RefreshCw,
  Download,
  Search,
  X,
  ChevronDown,
  Users,
  MessageSquareText,
  Star,
  BarChart3,
  FileText,
  Trash2,
  RotateCcw,
  Clock,
  CheckSquare,
  Square,
  User,
  SlidersHorizontal,
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  query,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { adminDb as db } from '@/lib/firebaseAdminClient';
import { ROLE_PERMISSIONS, type AdminProfile } from '@/types/admin';
import {
  Activity,
  SurveyQuestion,
  getActivitiesByDepartment,
  logAdminEvent,
  updateActivity,
} from '@/lib/adminFirebase';
import {
  SURVEY_INPUT_LABELS,
  formatAnswerForDisplay,
  getChoiceOptions,
  getLikertConfig,
  getLikertOptions,
  normalizeQuestionType,
  type SurveyAnswerValue,
} from '@/lib/surveyModel';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { CustomSelect } from '@/components/ui/custom-select';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/providers/ConfirmDialogProvider';
import {
  forceOpenUntilFromHours,
  getSurveyWindowStatus,
  surveyStatusLabelTh,
} from '@/lib/surveyWindow';

/* ============================= Types ============================= */

type SurveyResponse = {
  id: string;
  activityCode: string;
  userId: string;
  answers: Record<string, SurveyAnswerValue>;
  otherAnswers?: Record<string, string>;
  timestamp: Date;
};

type RespondentProfile = {
  studentId?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  email?: string;
};

type PendingUser = {
  userId: string;
  studentId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  department?: string;
};

interface Props {
  currentAdmin: AdminProfile;
}

const PAGE_SIZE = 25;

/* ============================= Helpers ============================= */

const toDateSafe = (v: any): Date => {
  if (v?.toDate) return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v || Date.now());
  return isNaN(+d) ? new Date() : d;
};

const displayName = (p?: RespondentProfile) => {
  if (!p) return '';
  return `${p.firstName || ''} ${p.lastName || ''}`.trim();
};

const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

/* ============================= Component ============================= */

const SurveyResultsPanel: React.FC<Props> = ({ currentAdmin }) => {
  const confirm = useConfirm();
  const effectivePerms = Array.isArray(currentAdmin.permissions)
    ? currentAdmin.permissions
    : (ROLE_PERMISSIONS[currentAdmin.role] ?? []);
  const canMutateSurvey =
    currentAdmin.role === 'super_admin' || effectivePerms.includes('manage_activities');

  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');

  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [profiles, setProfiles] = useState<Record<string, RespondentProfile>>({});
  const [checkinCount, setCheckinCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const [viewTab, setViewTab] = useState<'analytics' | 'responses' | 'access'>('analytics');
  const [searchText, setSearchText] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [detailTabs, setDetailTabs] = useState<Record<string, 'answers' | 'profile'>>({});
  const [page, setPage] = useState(1);

  const [extendHours, setExtendHours] = useState(24);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [grantBusyId, setGrantBusyId] = useState<string | null>(null);
  const [manualStudentId, setManualStudentId] = useState('');

  /* ---------- โหลดกิจกรรมที่มีแบบประเมิน ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await getActivitiesByDepartment(currentAdmin.department);
        const withSurvey = all.filter((a) => (a.surveyConfig?.questions?.length ?? 0) > 0);
        if (!cancelled) {
          setActivities(withSurvey);
          if (withSurvey.length > 0) setSelectedId(withSurvey[0].id);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('โหลดรายการกิจกรรมไม่สำเร็จ');
      } finally {
        if (!cancelled) setActivitiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentAdmin.department]);

  const selectedActivity = useMemo(
    () => activities.find((a) => a.id === selectedId) || null,
    [activities, selectedId]
  );
  const questions: SurveyQuestion[] = selectedActivity?.surveyConfig?.questions ?? [];

  const surveyWindowStatus = useMemo(() => {
    const cfg = selectedActivity?.surveyConfig as any;
    return getSurveyWindowStatus({
      enabled: cfg?.enabled,
      questionsLength: cfg?.questions?.length ?? 0,
      openAt: cfg?.openAt,
      closeAt: cfg?.closeAt,
      surveyOpenMinutes: cfg?.surveyOpenMinutes,
      forceOpenUntil: cfg?.forceOpenUntil,
      endDateTime: selectedActivity?.endDateTime,
      sessions: selectedActivity?.sessions,
    });
  }, [selectedActivity]);

  /* ---------- โหลดคำตอบ + โปรไฟล์ผู้ตอบ + ยอดเช็คอิน (0 N+1 reads!) ---------- */
  const selectedActivityCode = selectedActivity?.activityCode || '';

  const fetchResponses = useCallback(async () => {
    if (!selectedActivityCode) return;
    setLoading(true);
    setError('');
    setExpandedIds(new Set());
    setSelectedIds([]);
    setPage(1);
    try {
      const code = selectedActivityCode;
      const [snap, recSnap] = await Promise.all([
        getDocs(query(collection(db, 'surveyResponses'), where('activityCode', '==', code))),
        getDocs(query(collection(db, 'activityRecords'), where('activityCode', '==', code))).catch(
          () => null
        ),
      ]);

      const profileMap: Record<string, RespondentProfile> = {};

      const rows: SurveyResponse[] = snap.docs
        .map((d) => {
          const data: any = d.data();
          const uid = String(data.userId || '');
          if (uid && (data.studentId || data.firstName)) {
            profileMap[uid] = {
              studentId: data.studentId,
              firstName: data.firstName,
              lastName: data.lastName,
              department: data.department,
              email: data.email,
            };
          }
          return {
            id: d.id,
            activityCode: data.activityCode || '',
            userId: uid,
            answers: data.answers || {},
            otherAnswers: data.otherAnswers || undefined,
            timestamp: toDateSafe(data.timestamp),
          };
        })
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setResponses(rows);

      if (recSnap) {
        const responded = new Set(rows.map((r) => r.userId).filter(Boolean));
        const uniqueStudents = new Set<string>();
        const pending: PendingUser[] = [];
        const seenUid = new Set<string>();

        for (const d of recSnap.docs) {
          const data: any = d.data();
          if (data.studentId) uniqueStudents.add(data.studentId);
          let uid = data.userId || data.uid || '';
          if (!uid && typeof d.id === 'string' && d.id.includes('_')) {
            uid = d.id.slice(code.length + 1);
          }
          if (uid && !profileMap[uid] && (data.studentId || data.firstName)) {
            profileMap[uid] = {
              studentId: data.studentId,
              firstName: data.firstName,
              lastName: data.lastName,
              department: data.department,
              email: data.email,
            };
          }
          if (!uid || seenUid.has(uid) || responded.has(uid)) continue;
          seenUid.add(uid);
          pending.push({
            userId: uid,
            studentId: data.studentId,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            department: data.department,
          });
        }
        setCheckinCount(uniqueStudents.size);
        setPendingUsers(pending);
      } else {
        setCheckinCount(null);
        setPendingUsers([]);
      }

      const missingUids = Array.from(
        new Set(rows.map((r) => r.userId).filter((uid) => uid && !profileMap[uid]))
      );
      if (missingUids.length > 0) {
        const chunks: string[][] = [];
        for (let i = 0; i < missingUids.length; i += 30) {
          chunks.push(missingUids.slice(i, i + 30));
        }
        const batchSnaps = await Promise.all(
          chunks.map((chunk) =>
            getDocs(
              query(collection(db, 'universityUsers'), where(documentId(), 'in', chunk))
            ).catch(() => null)
          )
        );
        batchSnaps.forEach((bSnap) => {
          bSnap?.forEach((uDoc) => {
            const d: any = uDoc.data();
            profileMap[uDoc.id] = {
              studentId: d.studentId,
              firstName: d.firstName,
              lastName: d.lastName,
              department: d.department,
              email: d.email,
            };
          });
        });
      }

      setProfiles(profileMap);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'โหลดคำตอบแบบประเมินไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [selectedActivityCode]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  useEffect(() => {
    setActionMsg('');
    setError('');
  }, [selectedId]);

  useEffect(() => {
    setPage(1);
  }, [searchText, selectedId]);

  /* ---------- สรุปรายคำถาม (รองรับครบ 13 ประเภท) ---------- */
  const questionStats = useMemo(() => {
    return questions.map((q) => {
      const canonical = normalizeQuestionType(q.type);
      const answeredRows = responses
        .map((r) => ({ raw: r.answers[q.id], other: r.otherAnswers?.[q.id] }))
        .filter((x) => {
          if (x.raw === undefined || x.raw === null) return false;
          if (Array.isArray(x.raw)) return x.raw.length > 0;
          return String(x.raw).trim() !== '';
        });

      if (canonical === 'likert') {
        const cfg = getLikertConfig(q);
        const opts = getLikertOptions(q);
        const nums = answeredRows
          .map((x) => Number(Array.isArray(x.raw) ? x.raw[0] : x.raw))
          .filter((n) => !Number.isNaN(n));
        const avg = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
        const maxScale = cfg.startFrom + cfg.levels - 1;
        const dist = opts.map((o) => ({
          key: o.value,
          label: `${o.value} · ${o.label}`,
          count: nums.filter((n) => String(n) === o.value).length,
        }));
        return {
          q,
          canonical,
          answered: answeredRows.length,
          avg,
          maxScale,
          dist,
          numberSummary: null as { min: number; avg: number; max: number } | null,
          texts: [] as string[],
          otherTexts: [] as string[],
        };
      }

      if (
        canonical === 'single_select' ||
        canonical === 'dropdown' ||
        canonical === 'multiple_select'
      ) {
        const opts = getChoiceOptions(q);
        const counts = new Map<string, { label: string; count: number }>();
        opts.forEach((o) => counts.set(o.value, { label: o.label, count: 0 }));
        const otherTexts: string[] = [];

        for (const row of answeredRows) {
          const vals = Array.isArray(row.raw) ? row.raw : [String(row.raw)];
          for (const v of vals) {
            const key = String(v).trim();
            if (!key) continue;
            const cur = counts.get(key) ?? {
              label: key === 'other' ? 'อื่น ๆ (โปรดระบุ)' : key === 'none' ? 'ไม่มี' : key,
              count: 0,
            };
            cur.count++;
            counts.set(key, cur);
          }
          if (row.other?.trim()) otherTexts.push(row.other.trim());
        }

        const dist = Array.from(counts.entries()).map(([key, info]) => ({
          key,
          label: info.label,
          count: info.count,
        }));
        return {
          q,
          canonical,
          answered: answeredRows.length,
          avg: null,
          maxScale: null,
          dist,
          numberSummary: null,
          texts: [] as string[],
          otherTexts,
        };
      }

      if (canonical === 'number') {
        const nums = answeredRows
          .map((x) => Number(Array.isArray(x.raw) ? x.raw[0] : x.raw))
          .filter((n) => !Number.isNaN(n));
        const numberSummary =
          nums.length > 0
            ? {
                min: Math.min(...nums),
                avg: nums.reduce((s, n) => s + n, 0) / nums.length,
                max: Math.max(...nums),
              }
            : null;
        return {
          q,
          canonical,
          answered: answeredRows.length,
          avg: null,
          maxScale: null,
          dist: null,
          numberSummary,
          texts: nums.map(String),
          otherTexts: [] as string[],
        };
      }

      const texts = answeredRows
        .map((x) => formatAnswerForDisplay(q, x.raw, x.other))
        .filter(Boolean);
      return {
        q,
        canonical,
        answered: answeredRows.length,
        avg: null,
        maxScale: null,
        dist: null,
        numberSummary: null,
        texts,
        otherTexts: [] as string[],
      };
    });
  }, [questions, responses]);

  const overallLikertAvg = useMemo(() => {
    const likerts = questionStats.filter((s) => s.canonical === 'likert' && s.answered > 0 && s.avg != null);
    if (likerts.length === 0) return null;
    const sum = likerts.reduce((acc, item) => acc + (item.avg || 0), 0);
    const maxScale = likerts[0].maxScale ?? 5;
    return { avg: sum / likerts.length, maxScale };
  }, [questionStats]);

  /* ---------- ค้นหารายคน ---------- */
  const filteredResponses = useMemo(() => {
    if (!searchText.trim()) return responses;
    const s = searchText.toLowerCase();
    return responses.filter((r) => {
      const p = profiles[r.userId];
      return (
        (p?.studentId || '').toLowerCase().includes(s) ||
        (p?.firstName || '').toLowerCase().includes(s) ||
        (p?.lastName || '').toLowerCase().includes(s) ||
        (p?.department || '').toLowerCase().includes(s) ||
        (p?.email || '').toLowerCase().includes(s) ||
        Object.values(r.answers).some((v) =>
          (Array.isArray(v) ? v.join(' ') : String(v)).toLowerCase().includes(s)
        )
      );
    });
  }, [responses, profiles, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredResponses.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedResponses = useMemo(
    () => filteredResponses.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredResponses, safePage]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredResponses.length && filteredResponses.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredResponses.map((r) => r.id));
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ---------- Export CSV ---------- */
  const exportCSV = () => {
    if (!selectedActivity) return;
    const targetRows =
      selectedIds.length > 0
        ? filteredResponses.filter((r) => selectedIds.includes(r.id))
        : filteredResponses;
    const headers = [
      'วันที่/เวลา',
      'รหัสผู้เข้าร่วม',
      'ชื่อ',
      'นามสกุล',
      'สังกัด',
      ...questions.map((q, i) => `${i + 1}. ${q.question}`),
    ];
    const body = targetRows.map((r) => {
      const p = profiles[r.userId] || {};
      return [
        r.timestamp.toLocaleString('th-TH'),
        p.studentId || '',
        p.firstName || '',
        p.lastName || '',
        p.department || '',
        ...questions.map((q) => formatAnswerForDisplay(q, r.answers[q.id], r.otherAnswers?.[q.id])),
      ];
    });
    const csv = [headers, ...body].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey_${selectedActivity.activityCode}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- Actions: ขยายเวลา / เปิดสิทธิ์รายบุคคล / ลบคำตอบ ---------- */
  const applyForceOpen = async (hours: number) => {
    if (!selectedActivity) return null;
    const until = forceOpenUntilFromHours(hours);
    const prev = (selectedActivity.surveyConfig || { enabled: true, questions: [] }) as any;
    const nextConfig = { ...prev, forceOpenUntil: Timestamp.fromDate(until) };
    await updateActivity(selectedActivity.id, { surveyConfig: nextConfig } as any);
    setActivities((list) =>
      list.map((a) => (a.id === selectedActivity.id ? { ...a, surveyConfig: nextConfig } : a))
    );
    return until;
  };

  const applyUserForceOpen = async (userId: string, hours: number) => {
    if (!selectedActivity || !userId) return null;
    const until = forceOpenUntilFromHours(hours);
    const prev = (selectedActivity.surveyConfig || { enabled: true, questions: [] }) as any;
    const map = { ...(prev.userForceOpenUntil || {}) };
    map[userId] = Timestamp.fromDate(until);
    const nextConfig = { ...prev, userForceOpenUntil: map };
    await updateActivity(selectedActivity.id, { surveyConfig: nextConfig } as any);
    setActivities((list) =>
      list.map((a) => (a.id === selectedActivity.id ? { ...a, surveyConfig: nextConfig } : a))
    );
    return until;
  };

  const extendSurveyWindow = async () => {
    if (!selectedActivity) return;
    const hours = extendHours;
    const ok = await confirm({
      title: 'ขยายเวลาทำแบบประเมิน?',
      description: `จะเปิดแบบประเมินของ «${selectedActivity.activityName}» เพิ่มอีก ${hours} ชั่วโมง จากตอนนี้`,
      confirmText: `ขยาย ${hours} ชม.`,
      cancelText: 'ยกเลิก',
      variant: 'warning',
    });
    if (!ok) return;
    setBulkBusy(true);
    setActionMsg('');
    setError('');
    try {
      const until = await applyForceOpen(hours);
      await logAdminEvent(
        'SURVEY_EXTEND_WINDOW',
        {
          activityId: selectedActivity.id,
          activityCode: selectedActivity.activityCode,
          hours,
          forceOpenUntil: until?.toISOString(),
        },
        { uid: currentAdmin.uid, email: currentAdmin.email }
      );
      setActionMsg(`ขยายเวลาแล้ว — เปิดถึง ${until?.toLocaleString('th-TH') || '-'}`);
    } catch (e: any) {
      setError(e?.message || 'ขยายเวลาไม่สำเร็จ');
    } finally {
      setBulkBusy(false);
    }
  };

  const resetOneResponse = async (r: SurveyResponse) => {
    const p = profiles[r.userId];
    const who = displayName(p) || p?.studentId || p?.email || r.userId;
    const needExtend = !surveyWindowStatus.open;
    const ok = await confirm({
      title: 'ให้ผู้ใช้ทำแบบประเมินใหม่?',
      description: needExtend
        ? `จะลบคำตอบของ «${who}» และเปิดสิทธิ์ให้เฉพาะคนนี้ทำได้อีก ${extendHours} ชั่วโมง`
        : `จะลบคำตอบของ «${who}» ออกจากระบบ ผู้ใช้จะสามารถส่งแบบประเมินกิจกรรมนี้อีกครั้งได้`,
      confirmText: needExtend ? 'ลบและเปิดสิทธิ์รายบุคคล' : 'ลบแล้วให้ทำใหม่',
      cancelText: 'ยกเลิก',
      variant: 'destructive',
    });
    if (!ok) return;

    setDeletingId(r.id);
    setActionMsg('');
    setError('');
    try {
      await deleteDoc(doc(db, 'surveyResponses', r.id));
      setResponses((prev) => prev.filter((x) => x.id !== r.id));
      setSelectedIds((prev) => prev.filter((x) => x !== r.id));

      let until: Date | null = null;
      if (needExtend) until = await applyUserForceOpen(r.userId, extendHours);

      await logAdminEvent(
        'SURVEY_RESPONSE_RESET',
        {
          activityId: selectedActivity?.id,
          activityCode: r.activityCode,
          responseId: r.id,
          targetUserId: r.userId,
          extendedHours: needExtend ? extendHours : 0,
          userForceOpenUntil: until?.toISOString() || null,
          scope: 'user',
        },
        { uid: currentAdmin.uid, email: currentAdmin.email }
      );

      setActionMsg(
        needExtend
          ? `ลบคำตอบของ ${who} แล้ว และเปิดสิทธิ์รายบุคคลถึง ${until?.toLocaleString('th-TH')}`
          : `ลบคำตอบของ ${who} แล้ว — ผู้ใช้สามารถทำแบบประเมินใหม่ได้`
      );
      await fetchResponses();
    } catch (e: any) {
      setError(e?.message || 'ลบคำตอบไม่สำเร็จ');
    } finally {
      setDeletingId(null);
    }
  };

  const grantUserSurveyAccess = async (userId: string, whoLabel: string) => {
    if (!selectedActivity || !userId) return;
    const ok = await confirm({
      title: 'เปิดแบบประเมินให้รายบุคคล?',
      description: `อนุญาตให้ «${whoLabel}» ทำแบบประเมินได้อีก ${extendHours} ชั่วโมง โดยไม่เปิดให้ผู้ใช้อื่น`,
      confirmText: `เปิด ${extendHours} ชม.`,
      cancelText: 'ยกเลิก',
      variant: 'warning',
    });
    if (!ok) return;

    setGrantBusyId(userId);
    setActionMsg('');
    setError('');
    try {
      const until = await applyUserForceOpen(userId, extendHours);
      await logAdminEvent(
        'SURVEY_USER_FORCE_OPEN',
        {
          activityId: selectedActivity.id,
          activityCode: selectedActivity.activityCode,
          targetUserId: userId,
          hours: extendHours,
          userForceOpenUntil: until?.toISOString(),
        },
        { uid: currentAdmin.uid, email: currentAdmin.email }
      );
      setActionMsg(`เปิดสิทธิ์ให้ ${whoLabel} แล้ว — ถึง ${until?.toLocaleString('th-TH') || '-'}`);
    } catch (e: any) {
      setError(e?.message || 'เปิดสิทธิ์รายบุคคลไม่สำเร็จ');
    } finally {
      setGrantBusyId(null);
    }
  };

  const grantByStudentId = async () => {
    const sid = manualStudentId.trim();
    if (!sid || !selectedActivity) return;
    setGrantBusyId('manual');
    setActionMsg('');
    setError('');
    try {
      const snap = await getDocs(
        query(collection(db, 'universityUsers'), where('studentId', '==', sid))
      );
      if (snap.empty) {
        setError(`ไม่พบผู้ใช้รหัสผู้เข้าร่วม ${sid}`);
        return;
      }
      const docSnap = snap.docs[0];
      const d: any = docSnap.data();
      const who = `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.email || sid;
      await grantUserSurveyAccess(docSnap.id, who);
      setManualStudentId('');
    } catch (e: any) {
      setError(e?.message || 'ค้นหาผู้ใช้ไม่สำเร็จ');
    } finally {
      setGrantBusyId(null);
    }
  };

  const resetAllResponses = async () => {
    if (!selectedActivity || responses.length === 0) return;
    const needExtend = !surveyWindowStatus.open;
    const ok = await confirm({
      title: 'ลบคำตอบแบบประเมินทั้งหมด?',
      description: needExtend
        ? `จะลบคำตอบ ${responses.length} รายการ และขยายเวลาทำแบบประเมินอีก ${extendHours} ชั่วโมง การลบย้อนกลับไม่ได้`
        : `จะลบคำตอบ ${responses.length} รายการของกิจกรรม «${selectedActivity.activityName}» การกระทำนี้ย้อนกลับไม่ได้`,
      confirmText: needExtend ? 'ลบทั้งหมดและขยายเวลา' : 'ลบทั้งหมด',
      cancelText: 'ยกเลิก',
      variant: 'destructive',
    });
    if (!ok) return;

    setBulkBusy(true);
    setActionMsg('');
    setError('');
    try {
      const ids = responses.map((r) => r.id);
      for (let i = 0; i < ids.length; i += 450) {
        const chunk = ids.slice(i, i + 450);
        const batch = writeBatch(db);
        chunk.forEach((id) => batch.delete(doc(db, 'surveyResponses', id)));
        await batch.commit();
      }
      setResponses([]);
      setExpandedIds(new Set());
      setSelectedIds([]);

      let until: Date | null = null;
      if (needExtend) until = await applyForceOpen(extendHours);

      await logAdminEvent(
        'SURVEY_RESPONSES_RESET_ALL',
        {
          activityId: selectedActivity.id,
          activityCode: selectedActivity.activityCode,
          deletedCount: ids.length,
          extendedHours: needExtend ? extendHours : 0,
          forceOpenUntil: until?.toISOString() || null,
        },
        { uid: currentAdmin.uid, email: currentAdmin.email }
      );

      setActionMsg(
        needExtend
          ? `ลบคำตอบทั้งหมด ${ids.length} รายการแล้ว และขยายเวลาถึง ${until?.toLocaleString('th-TH')}`
          : `ลบคำตอบทั้งหมด ${ids.length} รายการแล้ว — ผู้ใช้สามารถทำแบบประเมินใหม่ได้`
      );
    } catch (e: any) {
      setError(e?.message || 'ลบคำตอบทั้งหมดไม่สำเร็จ');
      await fetchResponses();
    } finally {
      setBulkBusy(false);
    }
  };

  const responseRate =
    checkinCount != null && checkinCount > 0
      ? Math.round((responses.length / checkinCount) * 100)
      : null;

  /* ============================= Render ============================= */

  return (
    <div className="space-y-5 w-full min-w-0 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            ผลแบบประเมินกิจกรรม
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            วิเคราะห์สรุปผลรายข้อ ดูคำตอบรายบุคคล ส่งออก CSV และจัดการสิทธิ์การทำแบบประเมิน
          </p>
        </div>
      </div>

      {/* Top Filter & Activity Selector Card (D:\01-web ResponsesView Card Style) */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="flex-1 min-w-0 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground block">
              เลือกกิจกรรม (เฉพาะที่มีแบบประเมิน)
            </label>
            <CustomSelect
              value={selectedId}
              disabled={activitiesLoading || activities.length === 0}
              placeholder="— ไม่มีกิจกรรมที่ตั้งแบบประเมินไว้ —"
              searchable={activities.length > 5}
              searchPlaceholder="ค้นหาชื่อหรือรหัสกิจกรรม..."
              onChange={(val) => setSelectedId(val)}
              options={activities.map((a) => ({
                value: a.id,
                label: a.activityName,
                description: a.activityCode,
                badge: `${a.surveyConfig?.questions?.length ?? 0} ข้อ`,
              }))}
            />
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchResponses}
              disabled={loading || bulkBusy || !selectedActivity}
              className="h-10 rounded-xl gap-1.5"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              รีเฟรช
            </Button>
            <Button
              size="sm"
              onClick={exportCSV}
              disabled={filteredResponses.length === 0 || bulkBusy}
              className="h-10 rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Download className="h-4 w-4" />
              <span>ส่งออก CSV</span>
              {selectedIds.length > 0 && (
                <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px]">
                  {selectedIds.length}
                </span>
              )}
            </Button>
            {canMutateSurvey && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetAllResponses}
                disabled={responses.length === 0 || loading || bulkBusy || !selectedActivity}
                className="h-10 rounded-xl gap-1.5 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <RotateCcw className={cn('h-4 w-4', bulkBusy && 'animate-spin')} />
                ลบทั้งหมด
              </Button>
            )}
          </div>
        </div>

        {/* Status Pill Strip */}
        {selectedActivity && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="size-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground">
                สถานะ:{' '}
                <span className={surveyWindowStatus.open ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                  {surveyStatusLabelTh(surveyWindowStatus)}
                </span>
              </span>
              <span className="text-muted-foreground hidden sm:inline">·</span>
              <span className="text-muted-foreground truncate">
                {surveyWindowStatus.openTime && surveyWindowStatus.closeTime
                  ? `${surveyWindowStatus.openTime.toLocaleString('th-TH')} – ${surveyWindowStatus.closeTime.toLocaleString('th-TH')}`
                  : surveyWindowStatus.closeTime
                    ? `ปิด ${surveyWindowStatus.closeTime.toLocaleString('th-TH')}`
                    : 'ยังไม่ได้ตั้งช่วงเวลา'}
              </span>
            </div>
            {pendingUsers.length > 0 && (
              <button
                type="button"
                onClick={() => setViewTab('access')}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 transition-colors cursor-pointer"
              >
                ยังไม่ทำแบบประเมิน {pendingUsers.length} คน
              </button>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive font-medium">{error}</p>}
        {actionMsg && <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{actionMsg}</p>}
      </div>

      {activitiesLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !selectedActivity ? (
        <Card className="rounded-2xl">
          <CardContent className="text-center py-16 text-muted-foreground">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-foreground">ยังไม่มีกิจกรรมที่ตั้งแบบประเมินไว้</p>
            <p className="text-sm mt-1">เปิดใช้และออกแบบแบบประเมินได้ในหน้าต่างสร้าง/แก้ไขกิจกรรม</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tactile Stat Cards (D:\01-web style) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <StatCard
              label="ทำแบบประเมินแล้ว"
              value={loading ? '…' : responses.length.toLocaleString('th-TH')}
              icon={<ClipboardCheck className="h-5 w-5 text-primary" />}
              iconBg="bg-primary/10"
            />
            <StatCard
              label="ผู้เช็คอิน (ไม่ซ้ำคน)"
              value={loading ? '…' : checkinCount != null ? checkinCount.toLocaleString('th-TH') : '-'}
              icon={<Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
              iconBg="bg-emerald-500/10"
            />
            <StatCard
              label="อัตราการตอบ"
              value={loading ? '…' : responseRate != null ? `${responseRate}%` : '-'}
              icon={<BarChart3 className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
              iconBg="bg-violet-500/10"
              extra={responseRate != null ? <Progress value={Math.min(100, responseRate)} className="mt-2 h-1.5" /> : null}
            />
            <StatCard
              label={overallLikertAvg ? 'คะแนนเฉลี่ยรวม' : 'จำนวนคำถาม'}
              value={
                overallLikertAvg
                  ? `${overallLikertAvg.avg.toFixed(2)} / ${overallLikertAvg.maxScale}`
                  : questions.length.toLocaleString('th-TH')
              }
              icon={<Star className="h-5 w-5 text-amber-500" />}
              iconBg="bg-amber-500/10"
              sublabel={overallLikertAvg ? `${questions.length} คำถามทั้งหมด` : undefined}
            />
          </div>

          {/* Segmented View Switcher (D:\01-web style) */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-muted/40 p-1.5 no-scrollbar">
            {(
              [
                ['analytics', `สรุปผลรายข้อ (${questions.length})`, BarChart3],
                ['responses', `คำตอบรายคน (${responses.length})`, FileText],
                ['access', `เวลา & เปิดสิทธิ์รายบุคคล (${pendingUsers.length})`, SlidersHorizontal],
              ] as const
            ).map(([key, label, IconComp]) => (
              <button
                key={key}
                type="button"
                onClick={() => setViewTab(key)}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer',
                  viewTab === key
                    ? 'bg-card text-primary shadow-xs font-semibold ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <IconComp className="size-4" />
                {label}
              </button>
            ))}
          </div>

          {/* VIEW 1: Analytics Summary */}
          {viewTab === 'analytics' && (
            <div className="space-y-4">
              {loading ? (
                <div className="rounded-2xl border border-border bg-card flex items-center justify-center py-14">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : responses.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
                  <BarChart3 className="mx-auto size-10 opacity-30 mb-3" />
                  <p className="font-semibold text-foreground">ยังไม่มีผู้ทำแบบประเมินกิจกรรมนี้</p>
                </div>
              ) : (
                questionStats.map(
                  ({ q, canonical, answered, avg, maxScale, dist, numberSummary, texts, otherTexts }, qi) => (
                    <div
                      key={q.id}
                      className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-[0_4px_0_rgba(15,23,42,0.05)] dark:shadow-[0_4px_0_rgba(0,0,0,0.3)] space-y-3.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">
                            {String(qi + 1).padStart(2, '0')}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground leading-snug">{q.question}</p>
                            <span className="text-[11px] text-muted-foreground">
                              {SURVEY_INPUT_LABELS[canonical]}
                              {q.required ? ' · บังคับตอบ' : ''}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {avg != null && maxScale != null && (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0 gap-1">
                              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                              เฉลี่ย {avg.toFixed(2)} / {maxScale}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            ตอบ {answered}/{responses.length} คน
                          </Badge>
                        </div>
                      </div>

                      {/* Distribution Bars (Likert / Choice / Dropdown / Multi-select) */}
                      {dist && (
                        <div className="space-y-2">
                          {dist.map(({ key, label, count }) => {
                            const pct = answered > 0 ? Math.round((count / answered) * 100) : 0;
                            return (
                              <div key={key} className="space-y-1">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="text-foreground font-medium truncate">{label}</span>
                                  <span className="text-muted-foreground font-mono shrink-0">
                                    {count} คน ({pct}%)
                                  </span>
                                </div>
                                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all duration-300',
                                      canonical === 'likert' ? 'bg-amber-400' : 'bg-primary'
                                    )}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                          {otherTexts.length > 0 && (
                            <div className="mt-3 rounded-xl border border-border/70 bg-muted/30 p-3 space-y-1.5">
                              <p className="text-xs font-semibold text-muted-foreground">
                                คำตอบที่ระบุเพิ่มเติม (&ldquo;อื่น ๆ&rdquo;) ({otherTexts.length})
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {otherTexts.map((t, idx) => (
                                  <span
                                    key={idx}
                                    className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Number Summary */}
                      {numberSummary && (
                        <div className="grid grid-cols-3 gap-2.5">
                          <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                            <p className="text-[11px] text-muted-foreground">ต่ำสุด</p>
                            <p className="text-lg font-bold font-mono">{numberSummary.min}</p>
                          </div>
                          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-center">
                            <p className="text-[11px] text-primary">ค่าเฉลี่ย</p>
                            <p className="text-lg font-bold font-mono text-primary">
                              {numberSummary.avg.toFixed(2)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                            <p className="text-[11px] text-muted-foreground">สูงสุด</p>
                            <p className="text-lg font-bold font-mono">{numberSummary.max}</p>
                          </div>
                        </div>
                      )}

                      {/* Open Text / Date / Time / etc. */}
                      {!dist && !numberSummary && (
                        texts.length > 0 ? (
                          <div className="space-y-1.5 max-h-60 overflow-y-auto overscroll-contain pr-1">
                            {texts.map((t, i) => (
                              <div
                                key={i}
                                className="text-sm text-foreground bg-muted/30 border border-border/70 rounded-xl px-3.5 py-2 whitespace-pre-wrap"
                              >
                                {t}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">ยังไม่มีผู้ตอบข้อนี้</p>
                        )
                      )}
                    </div>
                  )
                )
              )}
            </div>
          )}

          {/* VIEW 2: Individual Responses (D:\01-web ResponsesView Card Layout) */}
          {viewTab === 'responses' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="ค้นหา ชื่อ, รหัสผู้เข้าร่วม, สังกัด, คำตอบ..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="pl-9 pr-8 h-9 rounded-xl text-sm"
                    />
                    {searchText && (
                      <button
                        type="button"
                        onClick={() => setSearchText('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        title="ล้างคำค้นหา"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {selectedIds.length === filteredResponses.length &&
                      filteredResponses.length > 0 ? (
                        <CheckSquare className="size-4 text-primary" />
                      ) : (
                        <Square className="size-4 text-muted-foreground/60" />
                      )}
                      <span>
                        {selectedIds.length === filteredResponses.length &&
                        filteredResponses.length > 0
                          ? 'ยกเลิกเลือกทั้งหมด'
                          : `เลือกทั้งหมด (${filteredResponses.length})`}
                      </span>
                    </button>
                    {selectedIds.length > 0 && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
                        เลือกแล้ว {selectedIds.length} รายการ
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                <span>
                  พบ <strong className="text-foreground">{filteredResponses.length}</strong> จากทั้งหมด{' '}
                  {responses.length} รายการ (หน้า {safePage}/{totalPages})
                </span>
                <span>กด &ldquo;ให้ทำใหม่&rdquo; เพื่อลบคำตอบรายบุคคลให้ผู้เข้าร่วมส่งอีกครั้ง</span>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-border bg-card flex items-center justify-center py-14">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pagedResponses.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-12 text-center">
                  <Users className="mx-auto size-10 text-muted-foreground/40 mb-3" />
                  <h4 className="font-semibold text-foreground">ไม่พบรายการคำตอบ</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ลองปรับคำค้นหาหรือตรวจสอบกิจกรรมอื่น
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pagedResponses.map((r) => {
                    const p = profiles[r.userId];
                    const isSelected = selectedIds.includes(r.id);
                    const isExpanded = expandedIds.has(r.id);
                    const activeSubTab = detailTabs[r.id] || 'answers';
                    const busy = deletingId === r.id;

                    // คำนวณคะแนนเฉลี่ย Likert ของคำตอบรายนี้ (ถ้ามี)
                    const likertVals = questions
                      .filter((q) => normalizeQuestionType(q.type) === 'likert')
                      .map((q) => Number(r.answers[q.id]))
                      .filter((n) => !Number.isNaN(n) && n > 0);
                    const avgPerson =
                      likertVals.length > 0
                        ? likertVals.reduce((s, n) => s + n, 0) / likertVals.length
                        : null;

                    return (
                      <div
                        key={r.id}
                        className={cn(
                          'rounded-2xl border bg-card transition-all shadow-xs',
                          isSelected
                            ? 'border-primary/50 ring-1 ring-primary/20'
                            : 'border-border/80 hover:border-border'
                        )}
                      >
                        <div className="p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={() => toggleSelect(r.id)}
                              className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                              aria-label={`เลือกรายการ ${displayName(p) || r.id}`}
                            >
                              {isSelected ? (
                                <CheckSquare className="size-5 text-primary" />
                              ) : (
                                <Square className="size-5 opacity-50 hover:opacity-100" />
                              )}
                            </button>

                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-foreground text-sm sm:text-base truncate">
                                  {displayName(p) || 'ไม่พบข้อมูลชื่อผู้ใช้'}
                                </h4>
                                {p?.studentId && (
                                  <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-mono font-medium">
                                    {p.studentId}
                                  </span>
                                )}
                                {avgPerson !== null && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                    <Star className="size-3 fill-amber-500 text-amber-500" />
                                    เฉลี่ย {avgPerson.toFixed(1)}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
                                <span>{p?.department || 'ไม่ระบุสังกัด'}</span>
                                <span>·</span>
                                <span>{r.timestamp.toLocaleString('th-TH')}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1 rounded-xl"
                              onClick={() => toggleExpand(r.id)}
                            >
                              <span>{isExpanded ? 'ย่อ' : 'ดูรายละเอียด'}</span>
                              <ChevronDown
                                className={cn(
                                  'size-3.5 transition-transform duration-200',
                                  isExpanded && 'rotate-180'
                                )}
                              />
                            </Button>
                            {canMutateSurvey && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={busy || bulkBusy}
                                onClick={() => resetOneResponse(r)}
                                className="h-8 text-xs gap-1 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 rounded-xl"
                                title="ลบคำตอบนี้แล้วให้ผู้ใช้ทำใหม่"
                              >
                                <RotateCcw className={cn('size-3.5', busy && 'animate-spin')} />
                                <span className="hidden sm:inline">ให้ทำใหม่</span>
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Expanded Panel (D:\01-web Sub-Tabs + Styled Table) */}
                        {isExpanded && (
                          <div className="border-t border-border/70 bg-muted/20 p-4 sm:p-5 rounded-b-2xl space-y-4 animate-in fade-in-0 duration-150">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2">
                              <div className="flex gap-4 text-xs font-semibold">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDetailTabs((prev) => ({ ...prev, [r.id]: 'answers' }))
                                  }
                                  className={cn(
                                    'flex items-center gap-1.5 pb-1 border-b-2 transition-colors cursor-pointer',
                                    activeSubTab === 'answers'
                                      ? 'border-primary text-primary'
                                      : 'border-transparent text-muted-foreground hover:text-foreground'
                                  )}
                                >
                                  <FileText className="size-3.5" />
                                  คำตอบแบบประเมิน ({questions.length} ข้อ)
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDetailTabs((prev) => ({ ...prev, [r.id]: 'profile' }))
                                  }
                                  className={cn(
                                    'flex items-center gap-1.5 pb-1 border-b-2 transition-colors cursor-pointer',
                                    activeSubTab === 'profile'
                                      ? 'border-primary text-primary'
                                      : 'border-transparent text-muted-foreground hover:text-foreground'
                                  )}
                                >
                                  <User className="size-3.5" />
                                  ข้อมูลผู้ตอบ
                                </button>
                              </div>
                              {canMutateSurvey && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={busy || bulkBusy}
                                  onClick={() => resetOneResponse(r)}
                                  className="h-7 text-xs gap-1.5 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                >
                                  <Trash2 className="size-3" />
                                  ลบคำตอบนี้ / ให้ทำใหม่
                                </Button>
                              )}
                            </div>

                            {activeSubTab === 'answers' && (
                              <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground">
                                    <tr>
                                      <th className="p-3 w-1/2">ข้อคำถาม</th>
                                      <th className="p-3">คำตอบ</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/60">
                                    {questions.map((q, qi) => {
                                      const formatted = formatAnswerForDisplay(
                                        q,
                                        r.answers[q.id],
                                        r.otherAnswers?.[q.id]
                                      );
                                      return (
                                        <tr key={q.id} className="hover:bg-muted/20">
                                          <td className="p-3 font-medium text-foreground align-top">
                                            {qi + 1}. {q.question}
                                          </td>
                                          <td className="p-3 text-foreground align-top whitespace-pre-wrap">
                                            {formatted ? (
                                              <span className="font-semibold">{formatted}</span>
                                            ) : (
                                              <span className="text-muted-foreground italic">
                                                — ไม่ได้ตอบ —
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {activeSubTab === 'profile' && (
                              <div className="rounded-xl border border-border bg-card p-4 grid gap-3 sm:grid-cols-2 text-xs">
                                <div>
                                  <p className="text-muted-foreground">ชื่อ-นามสกุล</p>
                                  <p className="font-semibold text-foreground">
                                    {displayName(p) || '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">รหัสผู้เข้าร่วม</p>
                                  <p className="font-mono font-semibold text-foreground">
                                    {p?.studentId || '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">อีเมล</p>
                                  <p className="font-medium text-foreground break-all">
                                    {p?.email || '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">สังกัด</p>
                                  <p className="font-medium text-foreground">
                                    {p?.department || '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Response ID</p>
                                  <p className="font-mono text-muted-foreground break-all">{r.id}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">เวลาที่ส่ง</p>
                                  <p className="font-medium text-foreground">
                                    {r.timestamp.toLocaleString('th-TH')}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination Footer */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 text-xs rounded-lg"
                  >
                    ก่อนหน้า
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    หน้า {safePage} จากทั้งหมด {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 text-xs rounded-lg"
                  >
                    ถัดไป
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: Window Extension & Individual Access */}
          {viewTab === 'access' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <Clock className="size-4 text-primary" />
                      ขยายเวลาทำแบบประเมินทั้งกิจกรรม
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {surveyWindowStatus.forceOpenUntil
                        ? `เปิดพิเศษถึง ${surveyWindowStatus.forceOpenUntil.toLocaleString('th-TH')}`
                        : 'ใช้เมื่อต้องการเปิดรับคำตอบเพิ่มหลังหมดเวลา'}
                    </p>
                  </div>
                  {canMutateSurvey && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        จำนวน
                        <input
                          type="number"
                          min={1}
                          max={336}
                          value={extendHours}
                          onChange={(e) =>
                            setExtendHours(Math.max(1, Math.min(336, Number(e.target.value) || 24)))
                          }
                          className="w-16 px-2 py-1.5 rounded-lg border border-input bg-background text-sm text-center font-mono"
                          title="จำนวนชั่วโมง"
                        />
                        ชม.
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!selectedActivity || bulkBusy}
                        onClick={extendSurveyWindow}
                        className="gap-1.5 rounded-xl"
                      >
                        <Clock className="h-4 w-4" />
                        ขยายทั้งกิจกรรม
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 space-y-4">
                <div>
                  <h3 className="font-bold text-foreground">เปิดแบบประเมินให้รายบุคคล</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    อนุญาตเฉพาะรายบุคคลตามจำนวนชั่วโมงที่ตั้งไว้ด้านบน ({extendHours} ชม.) โดยไม่กระทบผู้อื่น
                  </p>
                </div>

                {canMutateSurvey && (
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <Input
                      type="text"
                      placeholder="รหัสผู้เข้าร่วม เช่น 6710210317"
                      value={manualStudentId}
                      onChange={(e) => setManualStudentId(e.target.value)}
                      className="flex-1 rounded-xl font-mono bg-background"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!manualStudentId.trim() || bulkBusy || grantBusyId === 'manual'}
                      onClick={grantByStudentId}
                      className="h-10 gap-1.5 rounded-xl"
                    >
                      <Users className="h-4 w-4" />
                      เปิดสิทธิ์ตามรหัส
                    </Button>
                  </div>
                )}

                {!loading && pendingUsers.length > 0 ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto overscroll-contain pr-1">
                    <p className="text-xs font-semibold text-muted-foreground">
                      ลงทะเบียนแล้วแต่ยังไม่ทำแบบประเมิน ({pendingUsers.length} คน)
                    </p>
                    {pendingUsers.slice(0, 60).map((u) => {
                      const who =
                        `${u.firstName || ''} ${u.lastName || ''}`.trim() ||
                        u.studentId ||
                        u.email ||
                        u.userId;
                      const busy = grantBusyId === u.userId;
                      const alreadyGranted = !!(selectedActivity.surveyConfig as any)
                        ?.userForceOpenUntil?.[u.userId];
                      return (
                        <div
                          key={u.userId}
                          className="flex items-center justify-between gap-2 rounded-xl bg-card border border-border/80 px-3.5 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{who}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {u.studentId || '-'}
                              {alreadyGranted ? ' · มีสิทธิ์พิเศษแล้ว' : ''}
                            </p>
                          </div>
                          {canMutateSurvey && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy || bulkBusy}
                              onClick={() => grantUserSurveyAccess(u.userId, who)}
                              className="h-8 shrink-0 gap-1 rounded-lg"
                            >
                              <Clock className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />
                              เปิดสิทธิ์
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    ผู้ลงทะเบียนทุกคนทำแบบประเมินครบแล้ว หรือยังไม่มีข้อมูลการเช็คอิน
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* ---------- Tactile Stat Card (D:\01-web style) ---------- */
const StatCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  sublabel?: string;
  extra?: React.ReactNode;
}> = ({ label, value, icon, iconBg, sublabel, extra }) => (
  <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-[0_4px_0_rgba(15,23,42,0.05)] dark:shadow-[0_4px_0_rgba(0,0,0,0.3)]">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="mt-1 text-2xl sm:text-3xl font-bold text-foreground tabular-nums truncate">
          {value}
        </p>
        {sublabel && <p className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</p>}
      </div>
      <div className={cn('h-10 w-10 shrink-0 rounded-xl flex items-center justify-center', iconBg)}>
        {icon}
      </div>
    </div>
    {extra}
  </div>
);

export default SurveyResultsPanel;
