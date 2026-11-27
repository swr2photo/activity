'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  FlaskConical,
  Folder,
  GripVertical,
  Info,
  Layers,
  ListChecks,
  ListFilter,
  Monitor,
  Plus,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CustomSelect } from '@/components/ui/custom-select';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { MonthPicker } from '@/components/ui/month-picker';
import { YearPicker } from '@/components/ui/year-picker';
import { cn } from '@/lib/utils';
import SurveyForm from '@/components/activity/SurveyForm';
import {
  DEFAULT_FREQUENCY_7_LABELS,
  DEFAULT_RATING_5_LABELS,
  DEFAULT_SECTION_ID,
  SURVEY_INPUT_LABELS,
  SURVEY_INPUT_TYPE_OPTIONS,
  SURVEY_OPTION_PRESETS,
  SURVEY_STARTER_TEMPLATES,
  getLikertConfig,
  isLikertInput,
  isOptionInput,
  normalizeQuestionType,
  type CanonicalSurveyInput,
  type SurveyConfig,
  type SurveyQuestion,
  type SurveySection,
} from '@/lib/surveyModel';

export interface SurveyBuilderValue {
  title?: string;
  description?: string;
  sections?: SurveySection[];
  questions: SurveyQuestion[];
}

interface SurveyBuilderProps {
  value: SurveyBuilderValue;
  onChange: (next: SurveyBuilderValue) => void;
}

const DEFAULT_SECTIONS: SurveySection[] = [
  { id: DEFAULT_SECTION_ID, label: 'คำถามแบบประเมิน', order: 0 },
];

export default function SurveyBuilder({ value, onChange }: SurveyBuilderProps) {
  const questions = value.questions || [];
  const sections = useMemo<SurveySection[]>(() => {
    const raw = Array.isArray(value.sections) && value.sections.length > 0 ? value.sections : DEFAULT_SECTIONS;
    return [...raw].sort((a, b) => a.order - b.order);
  }, [value.sections]);

  const [tab, setTab] = useState<'questions' | 'preview'>('questions');
  const [selectedId, setSelectedId] = useState<string>(() => questions[0]?.id ?? '');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [showMobileList, setShowMobileList] = useState(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = useState<'mobile' | 'tablet' | 'full'>('full');
  const [previewKey, setPreviewKey] = useState(0);

  const activeQuestion =
    questions.find((q) => q.id === selectedId) ?? questions[0] ?? null;
  const activeId = activeQuestion?.id ?? '';

  const commit = (patch: Partial<SurveyBuilderValue>) => {
    onChange({
      title: value.title,
      description: value.description,
      sections: value.sections,
      questions,
      ...patch,
    });
  };

  const patchQuestion = (id: string, patch: Partial<SurveyQuestion>) => {
    commit({
      questions: questions.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    sections.forEach((s) => (counts[s.id] = 0));
    const fallbackId = sections[0]?.id ?? DEFAULT_SECTION_ID;
    for (const q of questions) {
      const sid = q.sectionId && counts[q.sectionId] !== undefined ? q.sectionId : fallbackId;
      counts[sid] = (counts[sid] || 0) + 1;
    }
    return counts;
  }, [questions, sections]);

  const groupedQuestions = useMemo(() => {
    const fallbackId = sections[0]?.id ?? DEFAULT_SECTION_ID;
    const withIdx = questions.map((q, globalIndex) => ({
      ...q,
      globalIndex,
      resolvedSectionId:
        q.sectionId && sections.some((s) => s.id === q.sectionId) ? q.sectionId : fallbackId,
    }));
    const list =
      filterSection === 'all' ? sections : sections.filter((s) => s.id === filterSection);

    return list
      .map((section) => ({
        section,
        items: withIdx.filter((q) => q.resolvedSectionId === section.id),
      }))
      .filter((g) => filterSection !== 'all' || g.items.length > 0 || sections.length === 1);
  }, [questions, sections, filterSection]);

  const addQuestion = (copy?: SurveyQuestion, targetSectionId?: string) => {
    const id = `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const secId =
      targetSectionId ||
      (copy?.sectionId && sections.some((s) => s.id === copy.sectionId) ? copy.sectionId : undefined) ||
      (filterSection !== 'all' ? filterSection : sections[0]?.id ?? DEFAULT_SECTION_ID);

    const created: SurveyQuestion = copy
      ? {
          ...copy,
          id,
          sectionId: secId,
          question: `${copy.question || 'คำถาม'} (สำเนา)`,
          options: copy.options ? [...copy.options] : undefined,
          presentation: copy.presentation
            ? {
                ...copy.presentation,
                scaleLabels: copy.presentation.scaleLabels
                  ? [...copy.presentation.scaleLabels]
                  : undefined,
              }
            : undefined,
        }
      : {
          id,
          sectionId: secId,
          type: 'likert',
          question: '',
          required: true,
          presentation: {
            shape: 'circle',
            levels: 5,
            startFrom: 1,
            connect: false,
            scaleLabels: [...DEFAULT_RATING_5_LABELS],
          },
        };

    commit({
      sections: value.sections && value.sections.length > 0 ? value.sections : sections,
      questions: [...questions, created],
    });
    setSelectedId(id);
  };

  const moveQuestion = (direction: -1 | 1) => {
    const idx = questions.findIndex((item) => item.id === activeId);
    if (idx < 0 || idx + direction < 0 || idx + direction >= questions.length) return;
    const next = [...questions];
    [next[idx], next[idx + direction]] = [next[idx + direction], next[idx]];
    commit({ questions: next });
  };

  const deleteQuestion = (id: string) => {
    const next = questions.filter((item) => item.id !== id);
    commit({ questions: next });
    if (activeId === id) {
      setSelectedId(next[0]?.id ?? '');
    }
  };

  const reorderQuestionByDrop = (fromId: string, toId: string) => {
    if (!fromId || fromId === toId) return;
    const next = [...questions];
    const fromIdx = next.findIndex((q) => q.id === fromId);
    const toIdx = next.findIndex((q) => q.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = next.splice(fromIdx, 1);
    const targetQ = next[toIdx > fromIdx ? toIdx - 1 : toIdx];
    if (targetQ?.sectionId) {
      moved.sectionId = targetQ.sectionId;
    }
    next.splice(toIdx, 0, moved);
    commit({ questions: next });
  };

  const autoSortBySections = () => {
    const orderMap = new Map(sections.map((s, idx) => [s.id, idx]));
    const fallbackId = sections[0]?.id ?? DEFAULT_SECTION_ID;
    const sorted = [...questions].sort((a, b) => {
      const sa = orderMap.get(a.sectionId || fallbackId) ?? 999;
      const sb = orderMap.get(b.sectionId || fallbackId) ?? 999;
      return sa - sb;
    });
    commit({ questions: sorted });
  };

  const handleCreateSection = () => {
    const label = newSectionName.trim();
    if (!label) {
      setIsAddingSection(false);
      return;
    }
    const id = `sec_${Date.now().toString(36)}`;
    const nextSections: SurveySection[] = [...sections, { id, label, order: sections.length }];
    commit({
      sections: nextSections,
      questions: activeQuestion
        ? questions.map((item) => (item.id === activeQuestion.id ? { ...item, sectionId: id } : item))
        : questions,
    });
    setNewSectionName('');
    setIsAddingSection(false);
  };

  const applyTemplate = (templateId: string) => {
    const tpl = SURVEY_STARTER_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const now = Date.now().toString(36);
    const nextQuestions: SurveyQuestion[] = tpl.questions.map((q, i) => ({
      ...q,
      id: `q_${now}_${i}`,
      options: q.options ? [...q.options] : undefined,
      presentation: q.presentation
        ? {
            ...q.presentation,
            scaleLabels: q.presentation.scaleLabels ? [...q.presentation.scaleLabels] : undefined,
          }
        : undefined,
    }));
    commit({
      sections: tpl.sections.map((s) => ({ ...s })),
      questions: nextQuestions,
    });
    setFilterSection('all');
    setSelectedId(nextQuestions[0]?.id ?? '');
  };

  const canonicalType: CanonicalSurveyInput = activeQuestion
    ? normalizeQuestionType(activeQuestion.type)
    : 'text';
  const activeLikert = activeQuestion && isLikertInput(activeQuestion.type)
    ? getLikertConfig(activeQuestion)
    : null;

  const previewConfig: SurveyConfig = {
    enabled: true,
    title: value.title,
    description: value.description,
    sections: value.sections,
    questions,
  };

  return (
    <div className="space-y-4">
      {/* Meta & Template Card (D:\01-web Editor Meta style) */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary border border-primary/20">
              คำถาม {questions.length} ข้อ
            </span>
            <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {sections.length} ส่วน
            </span>
          </div>

          <div className="w-full sm:w-64">
            <CustomSelect
              portal={false}
              size="xs"
              value=""
              placeholder="ใช้ชุดคำถามสำเร็จรูป..."
              onChange={(val) => {
                if (val) applyTemplate(val);
              }}
              options={SURVEY_STARTER_TEMPLATES.map((t) => ({
                value: t.id,
                label: t.label,
                description: t.description,
                icon: <Sparkles className="size-3.5" />,
              }))}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">ชื่อหัวข้อแบบประเมิน</Label>
            <Input
              value={value.title || ''}
              maxLength={140}
              placeholder="เช่น แบบประเมินความพึงพอใจกิจกรรม"
              onChange={(e) => commit({ title: e.target.value })}
              className="h-9 text-sm rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">คำชี้แจงเพิ่มเติม (ไม่บังคับ)</Label>
            <Input
              value={value.description || ''}
              maxLength={240}
              placeholder="เช่น กรุณาตอบตามความเป็นจริงเพื่อนำไปพัฒนาในครั้งต่อไป"
              onChange={(e) => commit({ description: e.target.value })}
              className="h-9 text-sm rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Mode Tabs Bar (D:\01-web Segmented Pill Bar) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/40 p-1.5">
        <div className="flex items-center gap-1 rounded-lg bg-muted/80 p-0.5">
          {(
            [
              ['questions', 'ออกแบบคำถาม', ListChecks],
              ['preview', 'ลองตอบ (Preview)', FlaskConical],
            ] as const
          ).map(([key, label, IconComp]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all cursor-pointer',
                tab === key
                  ? 'bg-background text-primary shadow-xs font-semibold ring-1 ring-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <IconComp className="size-4" />
              {label}
            </button>
          ))}
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-lg text-xs"
          onClick={() => {
            setTab('questions');
            addQuestion();
          }}
        >
          <Plus className="size-3.5" />
          เพิ่มคำถามใหม่
        </Button>
      </div>

      {/* TAB 1: Questions Editor (2-column split like D:\01-web) */}
      {tab === 'questions' && (
        <div className="space-y-4 lg:space-y-0 lg:grid lg:items-start lg:gap-4 lg:grid-cols-[270px_minmax(0,1fr)]">
          {/* Mobile Navigator Bar */}
          {questions.length > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3 shadow-xs lg:hidden">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-primary">
                    ข้อ #{questions.findIndex((x) => x.id === activeId) + 1} / {questions.length}
                  </span>
                  <span>·</span>
                  <span className="truncate">{SURVEY_INPUT_LABELS[canonicalType]}</span>
                </div>
                <p className="truncate text-xs font-semibold text-foreground mt-0.5">
                  {activeQuestion?.question || '(ยังไม่มีข้อความคำถาม)'}
                </p>
              </div>
              <Button
                type="button"
                variant={showMobileList ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs gap-1 shrink-0"
                onClick={() => setShowMobileList((prev) => !prev)}
              >
                <ListFilter className="size-3.5" />
                {showMobileList ? 'ซ่อนรายการ' : 'เลือกข้อ'}
              </Button>
            </div>
          )}

          {/* Left Sidebar: Grouped Question Navigator */}
          <aside
            className={cn(
              'rounded-2xl border border-border bg-card p-3 space-y-2.5',
              showMobileList ? 'block' : 'hidden lg:block'
            )}
          >
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs gap-1 rounded-lg"
                onClick={() => addQuestion()}
              >
                <Plus className="size-3.5" />
                เพิ่มคำถาม
              </Button>
              {sections.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs gap-1 rounded-lg"
                  title="จัดเรียงคำถามตามลำดับส่วน"
                  onClick={autoSortBySections}
                >
                  <Layers className="size-3.5" />
                  จัดกลุ่ม
                </Button>
              )}
            </div>

            {/* Section Filter Pills */}
            {sections.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterSection('all')}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer',
                    filterSection === 'all'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  ทั้งหมด ({questions.length})
                </button>
                {sections.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      setFilterSection(sec.id);
                      const first = questions.find(
                        (item) => (item.sectionId || sections[0].id) === sec.id
                      );
                      if (first) setSelectedId(first.id);
                    }}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer truncate max-w-[160px]',
                      filterSection === sec.id
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {sec.label} ({sectionCounts[sec.id] || 0})
                  </button>
                ))}
              </div>
            )}

            {/* Question List */}
            <div className="max-h-[460px] space-y-2.5 overflow-y-auto overscroll-contain pr-0.5">
              {questions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-8 px-3 text-center text-xs text-muted-foreground space-y-2">
                  <p>ยังไม่มีคำถามในแบบประเมิน</p>
                  <p className="text-[11px]">กด &ldquo;เพิ่มคำถาม&rdquo; หรือเลือกชุดคำถามสำเร็จรูปด้านบน</p>
                </div>
              ) : (
                groupedQuestions.map((group) => (
                  <div key={group.section.id} className="space-y-1.5">
                    <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border border-border/80 bg-muted/95 px-2.5 py-1.5 backdrop-blur-sm">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-xs font-semibold text-foreground">
                          {group.section.label}
                        </span>
                        <span className="rounded-full bg-background px-1.5 text-[10px] font-semibold text-muted-foreground">
                          {group.items.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => addQuestion(undefined, group.section.id)}
                        className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-background transition-colors cursor-pointer"
                        title={`เพิ่มคำถามใน ${group.section.label}`}
                      >
                        <Plus className="size-3" />
                        เพิ่มข้อ
                      </button>
                    </div>

                    {group.items.map((item) => {
                      const itemType = normalizeQuestionType(item.type);
                      const isSel = activeId === item.id;
                      return (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => setDragId(item.id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragId) reorderQuestionByDrop(dragId, item.id);
                            setDragId(null);
                          }}
                          onDragEnd={() => setDragId(null)}
                          onClick={() => {
                            setSelectedId(item.id);
                            setShowMobileList(false);
                          }}
                          className={cn(
                            'group flex w-full items-start gap-2 rounded-xl border p-2.5 text-left text-xs transition-all cursor-pointer',
                            isSel
                              ? 'border-primary/60 bg-primary/5 shadow-xs ring-1 ring-primary/20'
                              : 'border-border/80 bg-background hover:border-primary/30 hover:bg-muted/40',
                            dragId === item.id && 'opacity-50'
                          )}
                        >
                          <span
                            className="mt-0.5 shrink-0 cursor-grab text-muted-foreground/60 group-hover:text-muted-foreground"
                            title="ลากเพื่อสลับลำดับ"
                          >
                            <GripVertical className="size-3.5" />
                          </span>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1 text-[10px]">
                              <span className="font-bold text-foreground">#{item.globalIndex + 1}</span>
                              <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
                                {SURVEY_INPUT_LABELS[itemType]}
                              </span>
                              {item.required && (
                                <span className="font-bold text-destructive" title="บังคับตอบ">
                                  *
                                </span>
                              )}
                            </div>
                            <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
                              {item.question || '(ยังไม่มีข้อความคำถาม)'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* Right Pane: Active Question Editor */}
          {activeQuestion ? (
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4 shadow-xs min-w-0">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/60">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    แก้ไขคำถามข้อที่ #{questions.findIndex((x) => x.id === activeQuestion.id) + 1}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono">{activeQuestion.id}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-lg"
                    title="เลื่อนขึ้น"
                    disabled={questions.findIndex((x) => x.id === activeQuestion.id) <= 0}
                    onClick={() => moveQuestion(-1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-lg"
                    title="เลื่อนลง"
                    disabled={
                      questions.findIndex((x) => x.id === activeQuestion.id) >= questions.length - 1
                    }
                    onClick={() => moveQuestion(1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-lg"
                    title="ทำสำเนาคำถาม"
                    onClick={() => addQuestion(activeQuestion)}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                    title="ลบคำถามนี้"
                    onClick={() => deleteQuestion(activeQuestion.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Question Prompt */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ข้อความคำถาม</Label>
                <textarea
                  rows={2}
                  maxLength={500}
                  placeholder="พิมพ์คำถามที่ต้องการให้ผู้เข้าร่วมประเมิน..."
                  value={activeQuestion.question}
                  onChange={(e) => patchQuestion(activeQuestion.id, { question: e.target.value })}
                  className="w-full min-h-20 rounded-xl border border-input bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
                />
              </div>

              {/* Section + Answer Type Row */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">ส่วน / หมวดหมู่</Label>
                    {!isAddingSection && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingSection(true);
                          setNewSectionName('');
                        }}
                        className="text-xs text-primary hover:underline font-medium cursor-pointer"
                      >
                        + เพิ่มส่วนใหม่
                      </button>
                    )}
                  </div>
                  {isAddingSection ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        autoFocus
                        placeholder="ชื่อส่วนใหม่ เช่น ด้านวิทยากร"
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateSection();
                          } else if (e.key === 'Escape') {
                            setIsAddingSection(false);
                          }
                        }}
                        className="h-10 text-sm rounded-xl"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-10 px-3 shrink-0 rounded-xl"
                        onClick={handleCreateSection}
                      >
                        เพิ่ม
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 px-2.5 shrink-0 rounded-xl"
                        onClick={() => setIsAddingSection(false)}
                      >
                        ยกเลิก
                      </Button>
                    </div>
                  ) : (
                    <CustomSelect
                      portal={false}
                      value={
                        activeQuestion.sectionId &&
                        sections.some((s) => s.id === activeQuestion.sectionId)
                          ? activeQuestion.sectionId
                          : sections[0].id
                      }
                      onChange={(val) => {
                        if (val === '__new__') {
                          setIsAddingSection(true);
                          setNewSectionName('');
                          return;
                        }
                        patchQuestion(activeQuestion.id, { sectionId: val });
                      }}
                      options={[
                        {
                          group: 'ส่วนทั้งหมด',
                          items: sections.map((s) => ({ value: s.id, label: s.label })),
                        },
                        {
                          value: '__new__',
                          label: '+ สร้างส่วนใหม่...',
                          badge: 'สร้างใหม่',
                        },
                      ]}
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">ประเภทคำตอบ</Label>
                  <CustomSelect
                    portal={false}
                    value={canonicalType}
                    searchable
                    searchPlaceholder="ค้นหาประเภทคำตอบ..."
                    options={SURVEY_INPUT_TYPE_OPTIONS}
                    onChange={(val) => {
                      const nextType = val as CanonicalSurveyInput;
                      const patch: Partial<SurveyQuestion> = { type: nextType };
                      if (nextType === 'likert' && !activeQuestion.presentation) {
                        patch.presentation = {
                          shape: 'circle',
                          levels: 5,
                          startFrom: 1,
                          connect: false,
                          scaleLabels: [...DEFAULT_RATING_5_LABELS],
                        };
                      }
                      if (
                        isOptionInput(nextType) &&
                        (!activeQuestion.options || activeQuestion.options.length < 2)
                      ) {
                        patch.options = ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2'];
                      }
                      patchQuestion(activeQuestion.id, patch);
                    }}
                  />
                </div>
              </div>

              {/* Required toggle */}
              <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm">
                <Switch
                  checked={Boolean(activeQuestion.required)}
                  onCheckedChange={(checked) =>
                    patchQuestion(activeQuestion.id, { required: checked })
                  }
                />
                <span className="font-medium">บังคับตอบข้อนี้ (Required)</span>
              </label>

              {/* TYPE-SPECIFIC CONFIG: Likert / Rating */}
              {canonicalType === 'likert' && activeLikert && (
                <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-primary">ตั้งค่ามาตราส่วน (Likert Scale)</span>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] rounded-lg bg-background"
                        onClick={() =>
                          patchQuestion(activeQuestion.id, {
                            presentation: {
                              ...activeLikert,
                              levels: 5,
                              startFrom: 1,
                              scaleLabels: [...DEFAULT_RATING_5_LABELS],
                            },
                          })
                        }
                      >
                        ความพึงพอใจ (1–5)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] rounded-lg bg-background"
                        onClick={() =>
                          patchQuestion(activeQuestion.id, {
                            presentation: {
                              ...activeLikert,
                              levels: 7,
                              startFrom: 0,
                              scaleLabels: [...DEFAULT_FREQUENCY_7_LABELS],
                            },
                          })
                        }
                      >
                        ระดับความถี่ (0–6)
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">รูปแบบปุ่มคะแนน</Label>
                      <CustomSelect
                        portal={false}
                        size="sm"
                        value={activeLikert.shape}
                        onChange={(val) =>
                          patchQuestion(activeQuestion.id, {
                            presentation: {
                              ...activeLikert,
                              shape: val as 'circle' | 'star' | 'heart',
                            },
                          })
                        }
                        options={[
                          { value: 'circle', label: 'วงกลมตัวเลข (Circle)' },
                          { value: 'star', label: 'ดาว (Star ★)' },
                          { value: 'heart', label: 'หัวใจ (Heart ♥)' },
                        ]}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">จำนวนระดับ</Label>
                      <CustomSelect
                        portal={false}
                        size="sm"
                        value={String(activeLikert.levels)}
                        onChange={(val) => {
                          const levels = Number(val);
                          const scaleLabels = Array.from({ length: levels }, (_, i) =>
                            activeLikert.scaleLabels[i] || `ระดับ ${activeLikert.startFrom + i}`
                          );
                          patchQuestion(activeQuestion.id, {
                            presentation: { ...activeLikert, levels, scaleLabels },
                          });
                        }}
                        options={[3, 4, 5, 6, 7, 10].map((lv) => ({
                          value: String(lv),
                          label: `${lv} ระดับ`,
                        }))}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">เลขเริ่มต้น</Label>
                      <CustomSelect
                        portal={false}
                        size="sm"
                        value={String(activeLikert.startFrom)}
                        onChange={(val) =>
                          patchQuestion(activeQuestion.id, {
                            presentation: { ...activeLikert, startFrom: val === '0' ? 0 : 1 },
                          })
                        }
                        options={[
                          { value: '1', label: 'เริ่มจาก 1 (1, 2, 3...)' },
                          { value: '0', label: 'เริ่มจาก 0 (0, 1, 2...)' },
                        ]}
                      />
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeLikert.connect}
                      onChange={(e) =>
                        patchQuestion(activeQuestion.id, {
                          presentation: { ...activeLikert, connect: e.target.checked },
                        })
                      }
                      className="size-4 accent-primary"
                    />
                    เชื่อมเส้นระหว่างปุ่มคะแนน
                  </label>

                  <div className="space-y-2">
                    <Label className="text-xs">คำอธิบายแต่ละระดับ</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {activeLikert.scaleLabels.map((lbl, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background border border-primary/30 font-mono text-xs font-bold text-primary">
                            {activeLikert.startFrom + idx}
                          </span>
                          <Input
                            value={lbl}
                            onChange={(e) => {
                              const nextLabels = [...activeLikert.scaleLabels];
                              nextLabels[idx] = e.target.value;
                              patchQuestion(activeQuestion.id, {
                                presentation: { ...activeLikert, scaleLabels: nextLabels },
                              });
                            }}
                            className="h-8 text-xs rounded-lg bg-background"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TYPE-SPECIFIC CONFIG: Choice / Dropdown / Multi-select */}
              {isOptionInput(canonicalType) && (
                <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground">
                      รายการตัวเลือก ({(activeQuestion.options || []).length})
                    </span>
                    <div className="w-52">
                      <CustomSelect
                        portal={false}
                        size="xs"
                        value=""
                        placeholder="ใส่ชุดตัวเลือกสำเร็จรูป..."
                        onChange={(presetId) => {
                          const preset = SURVEY_OPTION_PRESETS.find((p) => p.id === presetId);
                          if (!preset) return;
                          patchQuestion(activeQuestion.id, {
                            options: [...preset.options],
                            ...(preset.allowOther ? { allowOther: true } : {}),
                          });
                        }}
                        options={SURVEY_OPTION_PRESETS.map((p) => ({
                          value: p.id,
                          label: p.label,
                        }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(activeQuestion.options || []).map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-1.5">
                        <span className="w-5 text-center font-mono text-[11px] text-muted-foreground">
                          {optIdx + 1}
                        </span>
                        <Input
                          value={opt}
                          placeholder={`ตัวเลือกที่ ${optIdx + 1}`}
                          onChange={(e) => {
                            const nextOpts = [...(activeQuestion.options || [])];
                            nextOpts[optIdx] = e.target.value;
                            patchQuestion(activeQuestion.id, { options: nextOpts });
                          }}
                          className="h-9 text-sm rounded-xl bg-background flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          disabled={optIdx === 0}
                          onClick={() => {
                            const nextOpts = [...(activeQuestion.options || [])];
                            [nextOpts[optIdx - 1], nextOpts[optIdx]] = [
                              nextOpts[optIdx],
                              nextOpts[optIdx - 1],
                            ];
                            patchQuestion(activeQuestion.id, { options: nextOpts });
                          }}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          disabled={optIdx === (activeQuestion.options || []).length - 1}
                          onClick={() => {
                            const nextOpts = [...(activeQuestion.options || [])];
                            [nextOpts[optIdx + 1], nextOpts[optIdx]] = [
                              nextOpts[optIdx],
                              nextOpts[optIdx + 1],
                            ];
                            patchQuestion(activeQuestion.id, { options: nextOpts });
                          }}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            const nextOpts = (activeQuestion.options || []).filter(
                              (_, i) => i !== optIdx
                            );
                            patchQuestion(activeQuestion.id, { options: nextOpts });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 rounded-xl bg-background"
                      onClick={() =>
                        patchQuestion(activeQuestion.id, {
                          options: [
                            ...(activeQuestion.options || []),
                            `ตัวเลือกที่ ${(activeQuestion.options || []).length + 1}`,
                          ],
                        })
                      }
                    >
                      <Plus className="size-3.5" />
                      เพิ่มตัวเลือก
                    </Button>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(activeQuestion.allowOther)}
                          onChange={(e) =>
                            patchQuestion(activeQuestion.id, { allowOther: e.target.checked })
                          }
                          className="size-3.5 accent-primary"
                        />
                        เพิ่มตัวเลือก &ldquo;อื่น ๆ (โปรดระบุ)&rdquo;
                      </label>
                      {canonicalType === 'multiple_select' && (
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(activeQuestion.exclusiveNone)}
                            onChange={(e) =>
                              patchQuestion(activeQuestion.id, { exclusiveNone: e.target.checked })
                            }
                            className="size-3.5 accent-primary"
                          />
                          เพิ่มตัวเลือก &ldquo;ไม่มี&rdquo; (ยกเลิกข้ออื่น)
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TYPE-SPECIFIC CONFIG: Number */}
              {canonicalType === 'number' && (
                <div className="grid gap-3 sm:grid-cols-3 rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="space-y-1">
                    <Label className="text-xs">ค่าต่ำสุด (ไม่บังคับ)</Label>
                    <Input
                      type="number"
                      value={activeQuestion.min ?? ''}
                      placeholder="เช่น 0"
                      onChange={(e) =>
                        patchQuestion(activeQuestion.id, {
                          min: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      className="h-9 rounded-xl bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ค่าสูงสุด (ไม่บังคับ)</Label>
                    <Input
                      type="number"
                      value={activeQuestion.max ?? ''}
                      placeholder="เช่น 100"
                      onChange={(e) =>
                        patchQuestion(activeQuestion.id, {
                          max: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      className="h-9 rounded-xl bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">เพิ่มทีละ (Step)</Label>
                    <Input
                      type="number"
                      step="any"
                      value={activeQuestion.step ?? ''}
                      placeholder="เช่น 1"
                      onChange={(e) =>
                        patchQuestion(activeQuestion.id, {
                          step: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      className="h-9 rounded-xl bg-background"
                    />
                  </div>
                </div>
              )}

              {/* TYPE-SPECIFIC CONFIG: Short Text Validation */}
              {canonicalType === 'text' && (
                <div className="p-4 bg-muted/30 rounded-2xl border border-dashed border-border space-y-3">
                  <span className="block text-xs font-bold text-muted-foreground">
                    เงื่อนไขความถูกต้องของคำตอบ (Validation — ไม่บังคับ)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-4 space-y-1">
                      <Label className="text-xs">ประเภทข้อมูล</Label>
                      <CustomSelect
                        portal={false}
                        size="sm"
                        value={activeQuestion.validationType || 'any'}
                        onChange={(v) =>
                          patchQuestion(activeQuestion.id, { validationType: v as any })
                        }
                        options={[
                          { value: 'any', label: 'ทั่วไป (ใด ๆ)' },
                          { value: 'number', label: 'ตัวเลขเท่านั้น' },
                          { value: 'thai', label: 'ภาษาไทยเท่านั้น' },
                          { value: 'english', label: 'ภาษาอังกฤษเท่านั้น' },
                          { value: 'email', label: 'รูปแบบอีเมล' },
                        ]}
                      />
                    </div>
                    <div className="sm:col-span-3 space-y-1">
                      <Label className="text-xs">คำขึ้นต้น (Prefix)</Label>
                      <Input
                        value={activeQuestion.prefix || ''}
                        onChange={(e) => patchQuestion(activeQuestion.id, { prefix: e.target.value })}
                        placeholder="เช่น 6 หรือ 08"
                        className="h-9 rounded-xl bg-background"
                      />
                    </div>
                    <div className="sm:col-span-3 space-y-1">
                      <Label className="text-xs">คำลงท้าย (Postfix)</Label>
                      <Input
                        value={activeQuestion.postfix || ''}
                        onChange={(e) =>
                          patchQuestion(activeQuestion.id, { postfix: e.target.value })
                        }
                        placeholder="เช่น @psu.ac.th"
                        className="h-9 rounded-xl bg-background"
                      />
                    </div>
                    <div className="sm:col-span-2 pb-1">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <Switch
                          checked={activeQuestion.allowSpaces !== false}
                          disabled={
                            activeQuestion.validationType === 'email' ||
                            activeQuestion.validationType === 'number'
                          }
                          onCheckedChange={(checked) =>
                            patchQuestion(activeQuestion.id, { allowSpaces: checked })
                          }
                        />
                        <span>เว้นวรรค</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* LIVE INPUT PREVIEW for special inputs (D:\01-web style) */}
              {['textarea', 'email', 'tel', 'date', 'time', 'month', 'year'].includes(
                canonicalType
              ) && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground text-xs sm:text-sm flex items-center gap-2">
                      <span className="size-2 rounded-full bg-primary inline-block" />
                      ตัวอย่างช่องกรอก: {SURVEY_INPUT_LABELS[canonicalType]}
                    </p>
                    <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                      มุมมองผู้ตอบ
                    </span>
                  </div>
                  <div className="max-w-md bg-background p-3 rounded-xl border border-border">
                    {canonicalType === 'date' && <DatePicker />}
                    {canonicalType === 'time' && <TimePicker />}
                    {canonicalType === 'month' && <MonthPicker />}
                    {canonicalType === 'year' && <YearPicker />}
                    {canonicalType === 'textarea' && (
                      <textarea
                        rows={2}
                        disabled
                        placeholder="กรอกข้อความหรือข้อเสนอแนะ..."
                        className="w-full rounded-xl border border-input bg-muted/20 p-2 text-xs"
                      />
                    )}
                    {canonicalType === 'email' && (
                      <Input placeholder="name@psu.ac.th" disabled className="rounded-xl" />
                    )}
                    {canonicalType === 'tel' && (
                      <Input placeholder="081-234-5678" disabled className="rounded-xl" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Info className="size-3.5 shrink-0" />
                    ผู้เข้าร่วมจะกรอกข้อมูลผ่าน UI เฉพาะประเภทนี้โดยอัตโนมัติ
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-foreground">เริ่มต้นสร้างแบบประเมิน</p>
              <p className="text-xs text-muted-foreground">
                เพิ่มคำถามทีละข้อ หรือเลือก &ldquo;ชุดคำถามสำเร็จรูป&rdquo; ด้านบนเพื่อสร้างแบบประเมินทันที
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={() => addQuestion()}
              >
                <Plus className="size-4" />
                เพิ่มคำถามข้อแรก
              </Button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Interactive Live Preview (D:\01-web DevicePreview style) */}
      {tab === 'preview' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs">
            <span className="font-medium text-foreground">
              โหมดทดลองตอบ — ใช้หน้าแบบประเมินจริง ไม่บันทึกข้อมูลลงฐานข้อมูล
            </span>
            <div className="flex items-center gap-1">
              {(
                [
                  ['mobile', 'มือถือ', Smartphone],
                  ['tablet', 'แท็บเล็ต', Tablet],
                  ['full', 'เต็มจอ', Monitor],
                ] as const
              ).map(([mode, label, IconComp]) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={previewWidth === mode ? 'default' : 'outline'}
                  className="h-7 px-2.5 text-xs gap-1 rounded-lg"
                  onClick={() => setPreviewWidth(mode)}
                >
                  <IconComp className="size-3.5" />
                  {label}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setPreviewKey((k) => k + 1)}
              >
                รีเซ็ต
              </Button>
            </div>
          </div>

          {questions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              ยังไม่มีคำถามสำหรับทดลองตอบ กรุณาเพิ่มคำถามในแท็บ &ldquo;ออกแบบคำถาม&rdquo; ก่อน
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-muted/30 p-3 sm:p-5">
              <div
                className={cn(
                  'mx-auto rounded-2xl border border-border bg-background p-4 sm:p-6 shadow-sm transition-all',
                  previewWidth === 'mobile'
                    ? 'max-w-[390px]'
                    : previewWidth === 'tablet'
                      ? 'max-w-[768px]'
                      : 'w-full'
                )}
              >
                <SurveyForm
                  key={previewKey}
                  activityCode="PREVIEW"
                  activityDocId="preview"
                  surveyConfig={previewConfig}
                  userId="preview-admin"
                  onCompleted={() => {}}
                  previewMode
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
