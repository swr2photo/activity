// src/components/admin/SurveyResultsPanel.tsx
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ClipboardCheck, RefreshCw, Download, Search, X, ChevronDown,
  Users, MessageSquareText, Star, BarChart3, FileText,
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { adminDb as db } from '@/lib/firebase';
import type { AdminProfile } from '@/types/admin';
import {
  Activity,
  SurveyQuestion,
  getActivitiesByDepartment,
} from '@/lib/adminFirebase';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/* ============================= Types ============================= */

type SurveyResponse = {
  id: string;
  activityCode: string;
  userId: string;
  answers: Record<string, string>;
  timestamp: Date;
};

type RespondentProfile = {
  studentId?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  email?: string;
};

interface Props {
  currentAdmin: AdminProfile;
}

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

/* ============================= Component ============================= */

const SurveyResultsPanel: React.FC<Props> = ({ currentAdmin }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');

  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [profiles, setProfiles] = useState<Record<string, RespondentProfile>>({});
  const [checkinCount, setCheckinCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    return () => { cancelled = true; };
  }, [currentAdmin.department]);

  const selectedActivity = useMemo(
    () => activities.find((a) => a.id === selectedId) || null,
    [activities, selectedId]
  );
  const questions: SurveyQuestion[] = selectedActivity?.surveyConfig?.questions ?? [];

  /* ---------- โหลดคำตอบ + โปรไฟล์ผู้ตอบ + ยอดเช็คอิน ---------- */
  const fetchResponses = useCallback(async () => {
    if (!selectedActivity) return;
    setLoading(true);
    setError('');
    setExpandedId(null);
    try {
      const code = selectedActivity.activityCode;
      const snap = await getDocs(
        query(collection(db, 'surveyResponses'), where('activityCode', '==', code))
      );
      const rows: SurveyResponse[] = snap.docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          activityCode: data.activityCode || '',
          userId: data.userId || '',
          answers: data.answers || {},
          timestamp: toDateSafe(data.timestamp),
        };
      }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setResponses(rows);

      // โปรไฟล์ผู้ตอบ (universityUsers → fallback users)
      const uids = Array.from(new Set(rows.map((r) => r.userId).filter(Boolean)));
      const entries = await Promise.all(
        uids.map(async (uid): Promise<[string, RespondentProfile]> => {
          try {
            let s = await getDoc(doc(db, 'universityUsers', uid));
            if (!s.exists()) s = await getDoc(doc(db, 'users', uid));
            const d: any = s.exists() ? s.data() : {};
            return [uid, {
              studentId: d.studentId,
              firstName: d.firstName,
              lastName: d.lastName,
              department: d.department,
              email: d.email,
            }];
          } catch {
            return [uid, {}];
          }
        })
      );
      setProfiles(Object.fromEntries(entries));

      // ยอดผู้เช็คอิน (ไม่ซ้ำคน) เพื่อคำนวณอัตราการตอบ
      try {
        const recSnap = await getDocs(
          query(collection(db, 'activityRecords'), where('activityCode', '==', code))
        );
        const uniqueStudents = new Set(
          recSnap.docs.map((d) => (d.data() as any).studentId).filter(Boolean)
        );
        setCheckinCount(uniqueStudents.size);
      } catch {
        setCheckinCount(null);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'โหลดคำตอบแบบประเมินไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [selectedActivity]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  /* ---------- สรุปรายคำถาม ---------- */
  const questionStats = useMemo(() => {
    return questions.map((q) => {
      const values = responses
        .map((r) => (r.answers[q.id] ?? '').toString().trim())
        .filter((v) => v !== '');

      if (q.type === 'rating') {
        const nums = values.map(Number).filter((n) => !isNaN(n));
        const avg = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
        const dist = [1, 2, 3, 4, 5].map((star) => ({
          label: String(star),
          count: nums.filter((n) => n === star).length,
        }));
        return { q, answered: values.length, avg, dist, texts: [] as string[] };
      }

      if (q.type === 'choice') {
        const opts = q.options || [];
        const counts = new Map<string, number>();
        opts.forEach((o) => counts.set(o, 0));
        values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
        const dist = Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
        return { q, answered: values.length, avg: null, dist, texts: [] as string[] };
      }

      // text
      return { q, answered: values.length, avg: null, dist: null, texts: values };
    });
  }, [questions, responses]);

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
        (p?.email || '').toLowerCase().includes(s) ||
        Object.values(r.answers).some((v) => String(v).toLowerCase().includes(s))
      );
    });
  }, [responses, profiles, searchText]);

  /* ---------- Export CSV ---------- */
  const exportCSV = () => {
    if (!selectedActivity) return;
    const headers = [
      'วันที่/เวลา', 'รหัสนักศึกษา', 'ชื่อ', 'นามสกุล', 'สาขา',
      ...questions.map((q, i) => `${i + 1}. ${q.question}`),
    ];
    const body = filteredResponses.map((r) => {
      const p = profiles[r.userId] || {};
      return [
        r.timestamp.toLocaleString('th-TH'),
        p.studentId || '',
        p.firstName || '',
        p.lastName || '',
        p.department || '',
        ...questions.map((q) => r.answers[q.id] ?? ''),
      ];
    });
    const csv = [headers, ...body]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `survey_${selectedActivity.activityCode}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const responseRate =
    checkinCount != null && checkinCount > 0
      ? Math.round((responses.length / checkinCount) * 100)
      : null;

  /* ============================= Render ============================= */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          ผลแบบประเมินกิจกรรม
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ดูจำนวนผู้ทำแบบประเมิน สรุปคำตอบรายข้อ และรายละเอียดคำตอบของแต่ละคน
        </p>
      </div>

      {/* Activity picker */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">เลือกกิจกรรม (เฉพาะที่มีแบบประเมิน)</label>
              <select
                title="เลือกกิจกรรม"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={activitiesLoading || activities.length === 0}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {activities.length === 0 && <option value="">— ไม่มีกิจกรรมที่ตั้งแบบประเมินไว้ —</option>}
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.activityName} ({a.activityCode})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchResponses} disabled={loading || !selectedActivity} className="gap-1.5">
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                รีเฟรช
              </Button>
              <Button
                size="sm"
                onClick={exportCSV}
                disabled={filteredResponses.length === 0}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                <Download className="h-4 w-4" />
                ส่งออก CSV
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </CardContent>
      </Card>

      {activitiesLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !selectedActivity ? (
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">ยังไม่มีกิจกรรมที่ตั้งแบบประเมินไว้</p>
            <p className="text-sm mt-1">เปิดใช้แบบประเมินได้ในหน้าต่างแก้ไขกิจกรรม</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="ทำแบบประเมินแล้ว"
              value={loading ? '…' : responses.length.toLocaleString()}
              icon={<ClipboardCheck className="h-6 w-6 text-blue-600" />}
              iconBg="bg-blue-100"
            />
            <StatCard
              label="ผู้เช็คอิน (ไม่ซ้ำคน)"
              value={loading ? '…' : checkinCount != null ? checkinCount.toLocaleString() : '-'}
              icon={<Users className="h-6 w-6 text-green-600" />}
              iconBg="bg-green-100"
            />
            <StatCard
              label="อัตราการตอบ"
              value={loading ? '…' : responseRate != null ? `${responseRate}%` : '-'}
              icon={<BarChart3 className="h-6 w-6 text-purple-600" />}
              iconBg="bg-purple-100"
            />
            <StatCard
              label="จำนวนคำถาม"
              value={questions.length.toLocaleString()}
              icon={<MessageSquareText className="h-6 w-6 text-amber-600" />}
              iconBg="bg-amber-100"
            />
          </div>

          {/* สรุปรายคำถาม */}
          <Card>
            <CardContent className="pt-6 space-y-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                สรุปคำตอบรายข้อ
              </h2>

              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : responses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">ยังไม่มีผู้ทำแบบประเมินกิจกรรมนี้</p>
              ) : (
                questionStats.map(({ q, answered, avg, dist, texts }, qi) => (
                  <div key={q.id} className="rounded-xl border border-slate-100 p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold text-slate-800">
                        {qi + 1}. {q.question}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {q.type === 'rating' && avg != null && (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 gap-1">
                            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                            เฉลี่ย {avg.toFixed(2)} / 5
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          ตอบ {answered}/{responses.length} คน
                        </Badge>
                      </div>
                    </div>

                    {/* rating / choice → distribution bars */}
                    {dist && (
                      <div className="space-y-1.5">
                        {dist.map(({ label, count }) => {
                          const pct = answered > 0 ? Math.round((count / answered) * 100) : 0;
                          return (
                            <div key={label} className="flex items-center gap-3">
                              <span className={cn(
                                'text-xs text-slate-600 shrink-0 truncate',
                                q.type === 'rating' ? 'w-10 font-mono' : 'w-40'
                              )}>
                                {q.type === 'rating' ? `★ ${label}` : label}
                              </span>
                              <div className="flex-1 h-5 rounded-md bg-slate-100 overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-md transition-all',
                                    q.type === 'rating' ? 'bg-amber-400' : 'bg-blue-500'
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500 w-20 shrink-0 text-right font-mono">
                                {count} คน ({pct}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* text → list answers */}
                    {texts && texts.length > 0 && (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {texts.map((t, i) => (
                          <div key={i} className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                            {t}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.type === 'text' && texts && texts.length === 0 && (
                      <p className="text-sm text-muted-foreground">ไม่มีผู้ตอบข้อนี้</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* รายละเอียดรายคน */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  คำตอบรายคน ({filteredResponses.length})
                </h2>
                <div className="relative sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="ค้นหา ชื่อ, รหัสนักศึกษา, คำตอบ..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full pl-10 pr-9 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {searchText && (
                    <button
                      title="ล้างคำค้นหา"
                      onClick={() => setSearchText('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredResponses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">ไม่พบข้อมูล</p>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        {['#', 'วันที่/เวลา', 'รหัสนักศึกษา', 'ชื่อ-นามสกุล', 'สาขา', ''].map((h, i) => (
                          <th key={i} className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredResponses.map((r, idx) => {
                        const p = profiles[r.userId];
                        const expanded = expandedId === r.id;
                        return (
                          <React.Fragment key={r.id}>
                            <tr
                              className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                              onClick={() => setExpandedId(expanded ? null : r.id)}
                            >
                              <td className="px-3 py-3 text-sm text-slate-400 font-mono">{idx + 1}</td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="text-sm font-semibold text-slate-800">
                                  {r.timestamp.toLocaleDateString('th-TH')}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {r.timestamp.toLocaleTimeString('th-TH')}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-sm font-mono font-bold text-slate-800">
                                {p?.studentId || '-'}
                              </td>
                              <td className="px-3 py-3 text-sm text-slate-700">
                                {displayName(p) || <span className="text-slate-400">ไม่พบข้อมูลผู้ใช้</span>}
                                {p?.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                              </td>
                              <td className="px-3 py-3">
                                <Badge variant="secondary" className="text-xs font-medium">
                                  {p?.department || '-'}
                                </Badge>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform inline-block', expanded && 'rotate-180')} />
                              </td>
                            </tr>
                            {expanded && (
                              <tr className="bg-slate-50/60">
                                <td colSpan={6} className="px-4 py-4">
                                  <div className="space-y-3 max-w-3xl">
                                    {questions.map((q, qi) => {
                                      const ans = (r.answers[q.id] ?? '').toString().trim();
                                      return (
                                        <div key={q.id}>
                                          <p className="text-xs font-semibold text-slate-500 mb-0.5">
                                            {qi + 1}. {q.question}
                                          </p>
                                          {ans ? (
                                            q.type === 'rating' ? (
                                              <div className="flex items-center gap-0.5">
                                                {[1, 2, 3, 4, 5].map((s) => (
                                                  <Star
                                                    key={s}
                                                    className={cn(
                                                      'h-4 w-4',
                                                      s <= Number(ans)
                                                        ? 'fill-amber-400 text-amber-400'
                                                        : 'text-slate-300'
                                                    )}
                                                  />
                                                ))}
                                                <span className="text-sm text-slate-700 ml-1.5 font-semibold">{ans}/5</span>
                                              </div>
                                            ) : (
                                              <p className="text-sm text-slate-800 bg-white border border-slate-100 rounded-lg px-3 py-1.5 whitespace-pre-wrap">
                                                {ans}
                                              </p>
                                            )
                                          ) : (
                                            <p className="text-sm text-slate-400 italic">— ไม่ได้ตอบ —</p>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

/* ---------- small stat card ---------- */
const StatCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
}> = ({ label, value, icon, iconBg }) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center', iconBg)}>
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

export default SurveyResultsPanel;
