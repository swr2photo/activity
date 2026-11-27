/**
 * โมเดลและตัวช่วยระบบแบบประเมิน (สไตล์ D:\01-web)
 * รองรับย้อนหลังกับข้อมูลเดิมใน Firestore (type: 'text' | 'choice' | 'rating', answers: Record<string, string>) 100%
 */
import type { CustomSelectItem } from '@/components/ui/custom-select';

export type SurveyQuestionType =
  | 'rating'
  | 'likert'
  | 'choice'
  | 'single_select'
  | 'dropdown'
  | 'multiple_select'
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'tel'
  | 'date'
  | 'time'
  | 'month'
  | 'year';

export type CanonicalSurveyInput =
  | 'likert'
  | 'single_select'
  | 'dropdown'
  | 'multiple_select'
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'tel'
  | 'date'
  | 'time'
  | 'month'
  | 'year';

export interface SurveyLikertPresentation {
  shape: 'circle' | 'star' | 'heart';
  levels: number;
  connect?: boolean;
  startFrom?: 0 | 1;
  scaleLabels?: string[];
}

export interface SurveySection {
  id: string;
  label: string;
  description?: string;
  order: number;
}

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  question: string;
  sectionId?: string;
  options?: string[];
  required?: boolean;
  allowOther?: boolean;
  exclusiveNone?: boolean;
  presentation?: SurveyLikertPresentation;
  min?: number;
  max?: number;
  step?: number;
  validationType?: 'any' | 'number' | 'thai' | 'english' | 'email';
  allowSpaces?: boolean;
  prefix?: string;
  postfix?: string;
}

export interface SurveyConfig {
  enabled: boolean;
  title?: string;
  description?: string;
  sections?: SurveySection[];
  questions: SurveyQuestion[];
  /** วันเวลาเปิดแบบประเมิน */
  openAt?: any;
  /** วันเวลาปิดแบบประเมิน */
  closeAt?: any;
  /** @deprecated ใช้ openAt/closeAt — คงไว้เพื่อกิจกรรมเก่า */
  surveyOpenMinutes?: number;
  sessionEligibility?: 'any' | 'all' | 'specific';
  requiredSessionIds?: string[];
  /** แอดมินบังคับเปิดทั้งกิจกรรมถึงเวลานี้ */
  forceOpenUntil?: any;
  /** แอดมินเปิดให้รายบุคคล: map uid → deadline */
  userForceOpenUntil?: Record<string, any>;
}

export type SurveyAnswerValue = string | string[];

export const DEFAULT_SECTION_ID = 'general';

export const DEFAULT_RATING_5_LABELS = [
  'น้อยที่สุด',
  'น้อย',
  'ปานกลาง',
  'มาก',
  'มากที่สุด',
];

export const DEFAULT_FREQUENCY_7_LABELS = [
  'ไม่เคยเลย',
  'ปีละ 2-3 ครั้ง',
  'เดือนละ 1 ครั้ง',
  'เดือนละ 2-3 ครั้ง',
  'สัปดาห์ละ 1 ครั้ง',
  'สัปดาห์ละ 2-3 ครั้ง',
  'ทุก ๆ วัน',
];

export const SURVEY_INPUT_LABELS: Record<CanonicalSurveyInput, string> = {
  likert: 'มาตราส่วน',
  single_select: 'เลือกข้อเดียว',
  dropdown: 'เลื่อนลง',
  multiple_select: 'เลือกหลายข้อ',
  text: 'ข้อความสั้น',
  textarea: 'ข้อความยาว',
  number: 'ตัวเลข',
  email: 'อีเมล',
  tel: 'โทรศัพท์',
  date: 'วันที่',
  time: 'เวลา',
  month: 'เดือน',
  year: 'ปี',
};

export const SURVEY_INPUT_TYPE_OPTIONS: CustomSelectItem[] = [
  {
    group: 'มาตราส่วน / ตัวเลือก',
    items: [
      { value: 'likert', label: 'มาตราส่วน (Likert / ให้คะแนน)', badge: 'สเกล' },
      { value: 'single_select', label: 'เลือกข้อเดียว (Radio button)' },
      { value: 'dropdown', label: 'รายการแบบเลื่อนลง (Dropdown ค้นหาได้)' },
      { value: 'multiple_select', label: 'เลือกหลายข้อ (Checkbox)' },
    ],
  },
  {
    group: 'ข้อความและตัวเลข',
    items: [
      { value: 'text', label: 'ข้อความสั้น (Single-line text)' },
      { value: 'textarea', label: 'ข้อความยาว (Paragraph text)' },
      { value: 'number', label: 'ตัวเลข (Number)' },
      { value: 'email', label: 'อีเมล (Email)' },
      { value: 'tel', label: 'เบอร์โทรศัพท์ (Phone)' },
    ],
  },
  {
    group: 'วันและเวลา',
    items: [
      { value: 'date', label: 'วันที่ (Date: วว/ดด/ปปปป)' },
      { value: 'time', label: 'เวลา (Time: ชช:นน)' },
      { value: 'month', label: 'เดือน (Month: ดด/ปปปป)' },
      { value: 'year', label: 'ปี (Year: พ.ศ. / ค.ศ.)' },
    ],
  },
];

export const SURVEY_OPTION_PRESETS: {
  id: string;
  label: string;
  options: string[];
  allowOther?: boolean;
}[] = [
  {
    id: 'agree5',
    label: 'เห็นด้วย 5 ระดับ',
    options: ['ไม่เห็นด้วยอย่างยิ่ง', 'ไม่เห็นด้วย', 'เฉยๆ', 'เห็นด้วย', 'เห็นด้วยอย่างยิ่ง'],
  },
  {
    id: 'yesno',
    label: 'ใช่ / ไม่ใช่',
    options: ['ใช่', 'ไม่ใช่'],
  },
  {
    id: 'channels',
    label: 'ช่องทางการรับรู้ข่าวสาร',
    options: ['Facebook / Instagram', 'LINE Official / กลุ่มไลน์', 'เว็บไซต์คณะ/มหาวิทยาลัย', 'เพื่อน / อาจารย์แนะนำ', 'โปสเตอร์ประชาสัมพันธ์'],
    allowOther: true,
  },
  {
    id: 'roles',
    label: 'สถานะผู้เข้าร่วม',
    options: ['นักศึกษาระดับปริญญาตรี', 'นักศึกษาระดับบัณฑิตศึกษา', 'คณาจารย์ / บุคลากร', 'นักเรียน / บุคคลภายนอก'],
  },
];

export const SURVEY_STARTER_TEMPLATES: {
  id: string;
  label: string;
  description: string;
  sections: SurveySection[];
  questions: Omit<SurveyQuestion, 'id'>[];
}[] = [
  {
    id: 'standard_activity',
    label: 'ชุดประเมินความพึงพอใจกิจกรรมมาตรฐาน',
    description: '2 ส่วน · 6 ข้อ (ความพึงพอใจ 5 ระดับ + ช่องทางรับข่าวสาร + ข้อเสนอแนะ)',
    sections: [
      { id: 'sec_satisfaction', label: 'ด้านความพึงพอใจต่อกิจกรรม', order: 0 },
      { id: 'sec_feedback', label: 'ข้อมูลเพิ่มเติมและข้อเสนอแนะ', order: 1 },
    ],
    questions: [
      {
        sectionId: 'sec_satisfaction',
        type: 'likert',
        question: 'ความพึงพอใจโดยรวมต่อการจัดกิจกรรมครั้งนี้',
        required: true,
        presentation: { shape: 'circle', levels: 5, startFrom: 1, scaleLabels: DEFAULT_RATING_5_LABELS },
      },
      {
        sectionId: 'sec_satisfaction',
        type: 'likert',
        question: 'เนื้อหาและกิจกรรมมีประโยชน์และสามารถนำไปประยุกต์ใช้ได้',
        required: true,
        presentation: { shape: 'circle', levels: 5, startFrom: 1, scaleLabels: DEFAULT_RATING_5_LABELS },
      },
      {
        sectionId: 'sec_satisfaction',
        type: 'likert',
        question: 'ความเหมาะสมของสถานที่ ระยะเวลา และการอำนวยความสะดวก',
        required: true,
        presentation: { shape: 'circle', levels: 5, startFrom: 1, scaleLabels: DEFAULT_RATING_5_LABELS },
      },
      {
        sectionId: 'sec_feedback',
        type: 'multiple_select',
        question: 'ท่านทราบข่าวสารกิจกรรมนี้จากช่องทางใดบ้าง',
        required: false,
        options: ['Facebook / Instagram', 'LINE / กลุ่มไลน์', 'เว็บไซต์คณะ/มหาวิทยาลัย', 'เพื่อน / อาจารย์แนะนำ'],
        allowOther: true,
      },
      {
        sectionId: 'sec_feedback',
        type: 'single_select',
        question: 'ท่านสนใจเข้าร่วมกิจกรรมลักษณะนี้อีกในอนาคตหรือไม่',
        required: true,
        options: ['สนใจมาก', 'สนใจ', 'ไม่แน่ใจ', 'ไม่สนใจ'],
      },
      {
        sectionId: 'sec_feedback',
        type: 'textarea',
        question: 'ข้อเสนอแนะเพิ่มเติมเพื่อปรับปรุงการจัดกิจกรรมครั้งต่อไป',
        required: false,
      },
    ],
  },
  {
    id: 'workshop',
    label: 'ชุดประเมินอบรม / สัมมนาเชิงปฏิบัติการ',
    description: '2 ส่วน · 5 ข้อ (วิทยากร + ความรู้ก่อน-หลัง + ข้อเสนอแนะ)',
    sections: [
      { id: 'sec_speaker', label: 'การประเมินวิทยากรและเนื้อหา', order: 0 },
      { id: 'sec_outcome', label: 'ผลลัพธ์และข้อเสนอแนะ', order: 1 },
    ],
    questions: [
      {
        sectionId: 'sec_speaker',
        type: 'likert',
        question: 'ความชัดเจนในการถ่ายทอดความรู้ของวิทยากร',
        required: true,
        presentation: { shape: 'star', levels: 5, startFrom: 1, scaleLabels: DEFAULT_RATING_5_LABELS },
      },
      {
        sectionId: 'sec_speaker',
        type: 'likert',
        question: 'ความเหมาะสมของเอกสารประกอบและสื่อการสอน',
        required: true,
        presentation: { shape: 'star', levels: 5, startFrom: 1, scaleLabels: DEFAULT_RATING_5_LABELS },
      },
      {
        sectionId: 'sec_outcome',
        type: 'likert',
        question: 'ระดับความรู้ความเข้าใจที่ได้รับหลังจบการอบรม',
        required: true,
        presentation: { shape: 'circle', levels: 5, startFrom: 1, connect: true, scaleLabels: DEFAULT_RATING_5_LABELS },
      },
      {
        sectionId: 'sec_outcome',
        type: 'text',
        question: 'หัวข้อที่ท่านต้องการให้จัดอบรมเพิ่มเติมในครั้งหน้า',
        required: false,
      },
      {
        sectionId: 'sec_outcome',
        type: 'textarea',
        question: 'ความคิดเห็นและข้อเสนอแนะเพิ่มเติม',
        required: false,
      },
    ],
  },
];

/** แปลงประเภทคำถามเดิม ('rating', 'choice') เป็นประเภทมาตรฐาน */
export function normalizeQuestionType(type?: string): CanonicalSurveyInput {
  if (type === 'rating' || type === 'likert') return 'likert';
  if (type === 'choice' || type === 'single_select') return 'single_select';
  if (
    type === 'dropdown' ||
    type === 'multiple_select' ||
    type === 'text' ||
    type === 'textarea' ||
    type === 'number' ||
    type === 'email' ||
    type === 'tel' ||
    type === 'date' ||
    type === 'time' ||
    type === 'month' ||
    type === 'year'
  ) {
    return type;
  }
  return 'text';
}

export function isOptionInput(type?: string): boolean {
  const canonical = normalizeQuestionType(type);
  return canonical === 'single_select' || canonical === 'dropdown' || canonical === 'multiple_select';
}

export function isLikertInput(type?: string): boolean {
  return normalizeQuestionType(type) === 'likert';
}

export function getLikertConfig(q: SurveyQuestion): Required<SurveyLikertPresentation> {
  const levels = Math.max(2, Math.min(10, q.presentation?.levels || 5));
  const startFrom: 0 | 1 = q.presentation?.startFrom === 0 ? 0 : 1;
  const shape = q.presentation?.shape ?? (q.type === 'rating' ? 'circle' : 'circle');
  const connect = Boolean(q.presentation?.connect);
  const defaultLabels =
    levels === 5 && startFrom === 1
      ? DEFAULT_RATING_5_LABELS
      : levels === 7 && startFrom === 0
        ? DEFAULT_FREQUENCY_7_LABELS
        : Array.from({ length: levels }, (_, i) => `ระดับ ${startFrom + i}`);
  const rawLabels = q.presentation?.scaleLabels;
  const scaleLabels = Array.from({ length: levels }, (_, i) =>
    rawLabels?.[i]?.trim() ? rawLabels[i] : (defaultLabels[i] ?? `ระดับ ${startFrom + i}`)
  );
  return { shape, levels, connect, startFrom, scaleLabels };
}

export function getLikertOptions(q: SurveyQuestion): { value: string; label: string }[] {
  const cfg = getLikertConfig(q);
  return Array.from({ length: cfg.levels }, (_, i) => ({
    value: String(cfg.startFrom + i),
    label: cfg.scaleLabels[i] || String(cfg.startFrom + i),
  }));
}

export function getChoiceOptions(q: SurveyQuestion): { value: string; label: string }[] {
  const base = (q.options || [])
    .map((o) => String(o ?? '').trim())
    .filter(Boolean)
    .map((o) => ({ value: o, label: o }));

  const hasNone = base.some((o) => o.value === 'none');
  const hasOther = base.some((o) => o.value === 'other');

  const out = [...base];
  if (q.exclusiveNone && !hasNone) {
    out.push({ value: 'none', label: 'ไม่มี' });
  }
  if (q.allowOther && !hasOther) {
    out.push({ value: 'other', label: 'อื่น ๆ (โปรดระบุ)' });
  }
  return out;
}

export function getOrderedSections(config: Pick<SurveyConfig, 'sections' | 'questions' | 'title'>): SurveySection[] {
  const existing = Array.isArray(config.sections) && config.sections.length > 0
    ? [...config.sections].sort((a, b) => a.order - b.order)
    : [];

  if (existing.length === 0) {
    return [
      {
        id: DEFAULT_SECTION_ID,
        label: config.title?.trim() || 'แบบประเมินกิจกรรม',
        order: 0,
      },
    ];
  }

  // ถ้ามีคำถามที่ไม่ได้ผูก sectionId หรือผูกกับ section ที่ไม่อยู่ใน list → รวมเข้า section แรก
  const ids = new Set(existing.map((s) => s.id));
  const used = new Set<string>();
  for (const q of config.questions || []) {
    const sid = q.sectionId && ids.has(q.sectionId) ? q.sectionId : existing[0].id;
    used.add(sid);
  }
  const active = existing.filter((s) => used.has(s.id));
  return active.length > 0 ? active : existing;
}

export function getQuestionSectionId(
  q: SurveyQuestion,
  sections: SurveySection[]
): string {
  if (q.sectionId && sections.some((s) => s.id === q.sectionId)) return q.sectionId;
  return sections[0]?.id ?? DEFAULT_SECTION_ID;
}

export function isSurveyAnswered(
  q: SurveyQuestion,
  value: SurveyAnswerValue | undefined,
  otherText?: string
): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    if (value.includes('other') && !(otherText || '').trim()) return false;
    return true;
  }
  const trimmed = String(value).trim();
  if (!trimmed) return false;
  if (trimmed === 'other' && !(otherText || '').trim()) return false;
  return true;
}

export function validateSurveyQuestion(
  q: SurveyQuestion,
  value: SurveyAnswerValue | undefined,
  otherText?: string
): string | null {
  const canonical = normalizeQuestionType(q.type);
  const answered = isSurveyAnswered(q, value, otherText);

  if (q.required && !answered) {
    if (
      (value === 'other' || (Array.isArray(value) && value.includes('other'))) &&
      !(otherText || '').trim()
    ) {
      return `กรุณาระบุรายละเอียดเพิ่มเติมสำหรับ "${q.question}"`;
    }
    return `กรุณาตอบคำถาม: ${q.question}`;
  }

  if (!answered) return null;

  const strVal = Array.isArray(value) ? value.join(', ') : String(value ?? '').trim();

  if (canonical === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) {
      return `คำถาม "${q.question}" ต้องเป็นรูปแบบอีเมลที่ถูกต้อง`;
    }
  }

  if (canonical === 'number') {
    const num = Number(strVal);
    if (Number.isNaN(num)) return `คำถาม "${q.question}" ต้องเป็นตัวเลขเท่านั้น`;
    if (typeof q.min === 'number' && num < q.min) {
      return `คำถาม "${q.question}" ต้องมีค่าไม่น้อยกว่า ${q.min}`;
    }
    if (typeof q.max === 'number' && num > q.max) {
      return `คำถาม "${q.question}" ต้องมีค่าไม่เกิน ${q.max}`;
    }
  }

  if (canonical === 'text') {
    const vType = q.validationType || 'any';
    const allowSpaces = q.allowSpaces !== false;
    const prefix = q.prefix || '';
    const postfix = q.postfix || '';

    if (prefix && !strVal.startsWith(prefix)) {
      return `คำถาม "${q.question}" ต้องเริ่มต้นด้วย "${prefix}"`;
    }
    if (postfix && !strVal.endsWith(postfix)) {
      return `คำถาม "${q.question}" ต้องลงท้ายด้วย "${postfix}"`;
    }

    let cleanVal = strVal;
    if (prefix && cleanVal.startsWith(prefix)) cleanVal = cleanVal.slice(prefix.length);
    if (postfix && cleanVal.endsWith(postfix)) {
      cleanVal = cleanVal.slice(0, cleanVal.length - postfix.length);
    }

    if (!allowSpaces && cleanVal.includes(' ')) {
      return `คำถาม "${q.question}" ห้ามมีเว้นวรรค`;
    }

    const checkVal = allowSpaces ? cleanVal.replace(/\s+/g, '') : cleanVal;
    if (vType === 'number' && !/^\d+$/.test(checkVal)) {
      return `คำถาม "${q.question}" ต้องเป็นตัวเลขเท่านั้น`;
    }
    if (vType === 'thai' && !/^[ก-๙]+$/.test(checkVal)) {
      return `คำถาม "${q.question}" ต้องเป็นภาษาไทยเท่านั้น`;
    }
    if (vType === 'english' && !/^[a-zA-Z]+$/.test(checkVal)) {
      return `คำถาม "${q.question}" ต้องเป็นภาษาอังกฤษเท่านั้น`;
    }
    if (vType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) {
      return `คำถาม "${q.question}" ต้องเป็นรูปแบบอีเมลที่ถูกต้อง`;
    }
  }

  return null;
}

export function formatAnswerForDisplay(
  q: SurveyQuestion,
  raw: SurveyAnswerValue | undefined,
  otherText?: string
): string {
  if (raw === undefined || raw === null) return '';
  const canonical = normalizeQuestionType(q.type);
  const labelOf = (v: string) => {
    if (v === 'other') return otherText?.trim() ? `อื่น ๆ: ${otherText.trim()}` : 'อื่น ๆ';
    if (v === 'none') return 'ไม่มี';
    if (canonical === 'likert') {
      const match = getLikertOptions(q).find((o) => o.value === v);
      return match ? `${v} (${match.label})` : v;
    }
    return v;
  };
  if (Array.isArray(raw)) {
    return raw.map((item) => labelOf(String(item))).join(', ');
  }
  const s = String(raw).trim();
  if (!s) return '';
  return labelOf(s);
}
