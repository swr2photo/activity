'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  RotateCcw,
  Send,
} from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  getOrderedSections,
  getQuestionSectionId,
  isSurveyAnswered,
  validateSurveyQuestion,
  type SurveyAnswerValue,
  type SurveyConfig,
} from '@/lib/surveyModel';
import { SurveyFields } from './SurveyFields';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';

interface SurveyFormProps {
  activityCode: string;
  activityDocId: string;
  surveyConfig: SurveyConfig;
  userId: string;
  userProfile?: {
    studentId?: string;
    firstName?: string;
    lastName?: string;
    department?: string;
    email?: string;
  };
  onCompleted: () => void;
  /** โหมดทดลองตอบในหน้าแอดมิน (ไม่บันทึกเข้า Firestore หรือ localStorage) */
  previewMode?: boolean;
}

const DRAFT_PREFIX = 'activity-survey-draft-v1:';

export default function SurveyForm({
  activityCode,
  activityDocId,
  surveyConfig,
  userId,
  userProfile,
  onCompleted,
  previewMode = false,
}: SurveyFormProps) {
  const draftKey = `${DRAFT_PREFIX}${activityCode}:${userId}`;
  const questions = useMemo(() => surveyConfig.questions || [], [surveyConfig.questions]);
  const sections = useMemo(() => getOrderedSections(surveyConfig), [surveyConfig]);
  const isMultiSection = sections.length > 1;

  const [answers, setAnswers] = useState<Record<string, SurveyAnswerValue>>({});
  const [otherAnswers, setOtherAnswers] = useState<Record<string, string>>({});
  const [sectionIndex, setSectionIndex] = useState(0);
  const [maxVisitedIndex, setMaxVisitedIndex] = useState(0);
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [previewDone, setPreviewDone] = useState(false);

  // กู้คืนฉบับร่างอัตโนมัติ (เฉพาะโหมดใช้งานจริง)
  useEffect(() => {
    if (previewMode || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        answers?: Record<string, SurveyAnswerValue>;
        otherAnswers?: Record<string, string>;
        sectionIndex?: number;
      };
      const allowedIds = new Set(questions.map((q) => q.id));
      if (parsed.answers) {
        const clean: Record<string, SurveyAnswerValue> = {};
        for (const [k, v] of Object.entries(parsed.answers)) {
          if (allowedIds.has(k)) clean[k] = v;
        }
        setAnswers(clean);
      }
      if (parsed.otherAnswers) {
        const cleanOther: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed.otherAnswers)) {
          if (allowedIds.has(k) && typeof v === 'string') cleanOther[k] = v;
        }
        setOtherAnswers(cleanOther);
      }
      if (typeof parsed.sectionIndex === 'number' && parsed.sectionIndex >= 0) {
        const target = Math.min(parsed.sectionIndex, Math.max(0, sections.length - 1));
        setSectionIndex(target);
        setMaxVisitedIndex(target);
      }
      setDraftSaved(true);
    } catch {
      /* ignore corrupt draft */
    }
  }, [draftKey, previewMode, questions, sections.length]);

  // บันทึกฉบับร่างอัตโนมัติเมื่อตอบคำถาม
  useEffect(() => {
    if (previewMode || typeof window === 'undefined') return;
    if (Object.keys(answers).length === 0 && Object.keys(otherAnswers).length === 0) return;
    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ answers, otherAnswers, sectionIndex })
      );
      setDraftSaved(true);
    } catch {
      /* quota exceeded */
    }
  }, [answers, otherAnswers, sectionIndex, draftKey, previewMode]);

  const safeSectionIndex = Math.min(sectionIndex, Math.max(0, sections.length - 1));
  const currentSection = sections[safeSectionIndex] ?? sections[0];

  const questionsBySection = useMemo(() => {
    const map = new Map<string, typeof questions>();
    sections.forEach((s) => map.set(s.id, []));
    for (const q of questions) {
      const sid = getQuestionSectionId(q, sections);
      const list = map.get(sid);
      if (list) list.push(q);
    }
    return map;
  }, [questions, sections]);

  const sectionQuestions = questionsBySection.get(currentSection?.id) ?? [];

  const sectionStartIndex = useMemo(() => {
    let offset = 0;
    for (let i = 0; i < safeSectionIndex; i++) {
      offset += (questionsBySection.get(sections[i].id) ?? []).length;
    }
    return offset;
  }, [questionsBySection, safeSectionIndex, sections]);

  const requiredQuestions = useMemo(() => questions.filter((q) => q.required), [questions]);
  const completedRequired = useMemo(
    () => requiredQuestions.filter((q) => isSurveyAnswered(q, answers[q.id], otherAnswers[q.id])).length,
    [requiredQuestions, answers, otherAnswers]
  );
  const totalAnswered = useMemo(
    () => questions.filter((q) => isSurveyAnswered(q, answers[q.id], otherAnswers[q.id])).length,
    [questions, answers, otherAnswers]
  );
  const optionalCompleted = totalAnswered - completedRequired;
  const optionalTotal = questions.length - requiredQuestions.length;

  const progressPct =
    requiredQuestions.length > 0
      ? Math.round((completedRequired / requiredQuestions.length) * 100)
      : questions.length > 0
        ? Math.round((totalAnswered / questions.length) * 100)
        : 0;

  const sectionCompleted = sectionQuestions.filter((q) =>
    isSurveyAnswered(q, answers[q.id], otherAnswers[q.id])
  ).length;

  const isSectionComplete = useCallback(
    (sectionId: string) => {
      const list = questionsBySection.get(sectionId) ?? [];
      const req = list.filter((q) => q.required);
      if (req.length === 0) return list.some((q) => isSurveyAnswered(q, answers[q.id], otherAnswers[q.id]));
      return req.every((q) => isSurveyAnswered(q, answers[q.id], otherAnswers[q.id]));
    },
    [questionsBySection, answers, otherAnswers]
  );

  const canNavigateTo = useCallback(
    (idx: number) => {
      if (idx === safeSectionIndex) return true;
      if (idx <= maxVisitedIndex) return true;
      for (let i = 0; i < idx; i++) {
        const list = questionsBySection.get(sections[i].id) ?? [];
        const req = list.filter((q) => q.required);
        if (!req.every((q) => isSurveyAnswered(q, answers[q.id], otherAnswers[q.id]))) {
          return false;
        }
      }
      return true;
    },
    [safeSectionIndex, maxVisitedIndex, questionsBySection, sections, answers, otherAnswers]
  );

  const focusAndShake = (questionId: string) => {
    requestAnimationFrame(() => {
      const card = document.getElementById(`survey-question-${questionId}`);
      if (!card) return;
      card.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center',
      });
      card.classList.remove('animate-shake');
      void card.offsetWidth;
      card.classList.add('animate-shake');
      setTimeout(() => card.classList.remove('animate-shake'), 600);
      const focusable = card.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]'
      );
      if (focusable) focusable.focus({ preventScroll: true });
      else card.focus({ preventScroll: true });
    });
  };

  const validateList = (list: typeof questions): { ok: boolean; firstId?: string; message?: string; missing: string[] } => {
    const missing: string[] = [];
    let firstMsg = '';
    let firstId: string | undefined;

    for (const q of list) {
      const errMsg = validateSurveyQuestion(q, answers[q.id], otherAnswers[q.id]);
      if (errMsg) {
        missing.push(q.id);
        if (!firstMsg) {
          firstMsg = errMsg;
          firstId = q.id;
        }
      }
    }
    return { ok: missing.length === 0, firstId, message: firstMsg, missing };
  };

  const validateCurrentSection = (): boolean => {
    const res = validateList(sectionQuestions);
    if (!res.ok) {
      setMissingIds(res.missing);
      setError(res.message || 'กรุณาตอบคำถามที่จำเป็นในส่วนนี้ให้ครบ');
      if (res.firstId) focusAndShake(res.firstId);
      return false;
    }
    setMissingIds([]);
    setError('');
    return true;
  };

  const moveSection = (next: number) => {
    setSectionIndex(next);
    setMaxVisitedIndex((prev) => Math.max(prev, next));
    setMissingIds([]);
    setError('');
  };

  const handleChange = (id: string, value: SurveyAnswerValue | undefined) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[id];
      else next[id] = value;
      return next;
    });
    if (value !== undefined) {
      setMissingIds((prev) => {
        const next = prev.filter((mid) => mid !== id);
        if (next.length === 0) setError('');
        return next;
      });
    }
  };

  const handleOtherChange = (id: string, other: string) => {
    setOtherAnswers((prev) => ({ ...prev, [id]: other }));
    if (other.trim()) {
      setMissingIds((prev) => {
        const next = prev.filter((mid) => mid !== id);
        if (next.length === 0) setError('');
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const allCheck = validateList(questions);
    if (!allCheck.ok && allCheck.firstId) {
      const targetQ = questions.find((q) => q.id === allCheck.firstId);
      if (targetQ && isMultiSection) {
        const targetSid = getQuestionSectionId(targetQ, sections);
        const targetIdx = sections.findIndex((s) => s.id === targetSid);
        if (targetIdx !== -1 && targetIdx !== safeSectionIndex) {
          setSectionIndex(targetIdx);
          setMaxVisitedIndex((prev) => Math.max(prev, targetIdx));
        }
      }
      setMissingIds(allCheck.missing);
      setError(allCheck.message || 'กรุณาตอบคำถามที่จำเป็นให้ครบ');
      focusAndShake(allCheck.firstId);
      return;
    }

    if (previewMode) {
      setPreviewDone(true);
      return;
    }

    setSubmitting(true);
    try {
      // เตรียมคำตอบให้เข้ากันได้ทั้งแบบเดิม (string) และหลายตัวเลือก (string[])
      const cleanOther: Record<string, string> = {};
      for (const [k, v] of Object.entries(otherAnswers)) {
        if (v.trim()) cleanOther[k] = v.trim();
      }

      await addDoc(collection(db, 'surveyResponses'), {
        activityCode,
        activityDocId,
        userId,
        ...(userProfile
          ? {
              studentId: userProfile.studentId || '',
              firstName: userProfile.firstName || '',
              lastName: userProfile.lastName || '',
              department: userProfile.department || '',
              email: userProfile.email || '',
            }
          : {}),
        answers,
        ...(Object.keys(cleanOther).length > 0 ? { otherAnswers: cleanOther } : {}),
        timestamp: serverTimestamp(),
      });
      try {
        window.localStorage.removeItem(draftKey);
      } catch {}
      onCompleted();
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการส่งแบบประเมิน');
      setSubmitting(false);
    }
  };

  if (previewMode && previewDone) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-card p-6 sm:p-8 text-center space-y-4 shadow-[0_5px_0_rgba(16,185,129,0.18)]">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-8" />
        </div>
        <h3 className="text-xl font-bold text-foreground">ส่งแบบประเมินสำเร็จ (โหมดทดลอง)</h3>
        <p className="text-sm text-muted-foreground">
          ตอบครบ {totalAnswered} / {questions.length} ข้อ · โหมดทดลองจะไม่บันทึกข้อมูลลงฐานข้อมูลจริง
        </p>
        <Button
          type="button"
          variant="outline"
          className="gap-2 rounded-xl"
          onClick={() => {
            setPreviewDone(false);
            setAnswers({});
            setOtherAnswers({});
            setSectionIndex(0);
            setMaxVisitedIndex(0);
            setMissingIds([]);
            setError('');
          }}
        >
          <RotateCcw className="size-4" />
          ทดลองตอบอีกครั้ง
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 w-full min-w-0">
      {/* Header (D:\01-web ManagedWizard style) */}
      <div className="text-center max-w-2xl mx-auto space-y-1.5 pt-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <ClipboardList className="size-3.5" />
          {previewMode ? 'โหมดทดลองตอบแบบประเมิน' : 'แบบประเมินกิจกรรม'}
        </span>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {surveyConfig.title?.trim() || 'แบบประเมินความพึงพอใจกิจกรรม'}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {surveyConfig.description?.trim() || 'กรุณาทำแบบประเมินให้ครบถ้วนเพื่อเสร็จสิ้นการลงทะเบียน'}
        </p>
      </div>

      {/* Progress & Section Navigation Bar (Sticky, compact, works in narrow cards and wide screens) */}
      <div className="sticky top-2 z-20 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md p-3.5 sm:p-4 shadow-sm space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              ตอบแล้ว{' '}
              <span className="font-bold text-primary">
                {requiredQuestions.length > 0 ? completedRequired : totalAnswered}
              </span>{' '}
              / {requiredQuestions.length > 0 ? requiredQuestions.length : questions.length} ข้อ
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {progressPct}%
            </span>
            {draftSaved && !previewMode && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                บันทึกฉบับร่างแล้ว
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {isMultiSection ? (
              <>
                ส่วนที่ {safeSectionIndex + 1} / {sections.length} ·{' '}
                <strong className="text-foreground">{currentSection?.label}</strong>
              </>
            ) : (
              <>
                ข้อบังคับ {requiredQuestions.length} ข้อ
                {optionalTotal > 0 ? ` · เลือกตอบ ${optionalCompleted}/${optionalTotal}` : ''}
              </>
            )}
          </span>
        </div>

        <Progress value={progressPct} className="h-2 rounded-full" />

        {isMultiSection && (
          <nav
            aria-label="ส่วนของแบบประเมิน"
            className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar"
          >
            {sections.map((sec, idx) => {
              const isCurrent = idx === safeSectionIndex;
              const isCompleted = isSectionComplete(sec.id);
              const isAccessible = canNavigateTo(idx);
              return (
                <button
                  key={sec.id}
                  type="button"
                  disabled={submitting || !isAccessible}
                  onClick={() => {
                    if (isCurrent) return;
                    if (isAccessible) moveSection(idx);
                    else validateCurrentSection();
                  }}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-left text-xs transition-all select-none ${
                    isCurrent
                      ? 'border-primary bg-primary/10 font-semibold text-primary shadow-xs ring-1 ring-primary/20'
                      : isCompleted
                        ? 'border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 cursor-pointer'
                        : isAccessible
                          ? 'border-border/80 bg-background text-foreground hover:bg-muted cursor-pointer'
                          : 'border-border/60 bg-muted/30 text-muted-foreground opacity-50 cursor-not-allowed'
                  }`}
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      isCurrent
                        ? 'bg-primary text-primary-foreground'
                        : isCompleted
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? <Check className="size-2.5" aria-hidden /> : idx + 1}
                  </span>
                  <span className="truncate max-w-[160px]">{sec.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Section Title */}
      {isMultiSection && currentSection && (
        <div className="px-1">
          <p className="text-xs font-semibold text-primary">ส่วนที่ {safeSectionIndex + 1}</p>
          <h3 className="mt-0.5 text-lg sm:text-xl font-bold text-foreground">
            {currentSection.label}
          </h3>
          {currentSection.description && (
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              {currentSection.description}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            ตอบแล้ว {sectionCompleted} / {sectionQuestions.length} ข้อในส่วนนี้
          </p>
        </div>
      )}

      {/* Question Cards */}
      <SurveyFields
        questions={sectionQuestions}
        sectionLabel={isMultiSection ? currentSection?.label : undefined}
        answers={answers}
        otherAnswers={otherAnswers}
        onChange={handleChange}
        onOtherChange={handleOtherChange}
        disabled={submitting}
        missingIds={missingIds}
        startIndex={sectionStartIndex}
      />

      {/* Validation / Submit Error */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs sm:text-sm font-medium text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation & Submit Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {isMultiSection ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={safeSectionIndex === 0 || submitting}
            onClick={() => moveSection(safeSectionIndex - 1)}
            className="rounded-xl gap-1.5"
          >
            <ArrowLeft className="size-4" />
            ย้อนกลับ
          </Button>
        ) : (
          <div />
        )}

        {isMultiSection && safeSectionIndex < sections.length - 1 ? (
          <Button
            type="button"
            size="lg"
            disabled={submitting}
            onClick={() => {
              if (validateCurrentSection()) moveSection(safeSectionIndex + 1);
            }}
            className="rounded-xl gap-1.5 px-6"
          >
            ถัดไป
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className={`rounded-xl gap-2 px-7 ${!isMultiSection ? 'w-full sm:w-auto' : ''}`}
          >
            {submitting ? (
              <>
                <Spinner size="sm" className="text-primary-foreground" />
                กำลังส่งแบบประเมิน...
              </>
            ) : (
              <>
                <Send className="size-4" />
                {previewMode ? 'ทดลองส่งแบบประเมิน' : 'ส่งแบบประเมิน'}
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
