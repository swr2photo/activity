
// components/admin/QRCodeAdminPanel.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import {
  MonitorPlay,
  QrCode as QrCodeIcon,
  Plus as AddIcon,
  Pencil as EditIcon,
  Trash2 as DeleteIcon,
  Eye as ViewIcon,
  Image as ImageIcon,
  X as ClearIcon,
  Shuffle as ShuffleIcon,
  Copy as CopyIcon,
  Eye as PreviewIcon,
  MapPin as PlaceIcon,
  Download as DownloadIcon,
  Users as PeopleIcon,
  LayoutGrid as GridIcon,
  Rows3 as TableIcon,
  LocateFixed as MyLocationIcon,
  Tag as BadgeIcon,
  X as CloseIcon,
  Paperclip as AttachFileIcon,
  History as HistoryIcon,
  Sparkles as SparklesIcon,
} from 'lucide-react';


import dayjs, { Dayjs } from 'dayjs';
import { DatePicker, ConfigProvider, ColorPicker } from 'antd';
import type { AggregationColor } from 'antd/es/color-picker/color';
import type { ColorValueType } from 'antd/es/color-picker/interface';
import thTH from 'antd/locale/th_TH';

import {
  getAllActivities,
  getActivitiesByDepartment,
  subscribeActivities,
  toggleActivityLive,
  reopenEndedActivity,
  createActivity,
  archiveActivityVersion,
  listActivityVersions,
  restoreActivityVersion,
  type Activity,
  type ActivityFile,
  type SurveyQuestion,
  type ActivityVersionMeta,
} from '../../lib/adminFirebase';
import { DEPARTMENT_LABELS, type AdminProfile, type AdminDepartment } from '../../types/admin';
import { QuillEditor } from './QuillEditor';
import { ActivityTable } from './qr/ActivityTable';

import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  getDoc,
} from 'firebase/firestore';
import { adminDb as db, adminStorage as storage, adminAuth as auth } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

import GeofenceMap from '../maps/GeofenceMap';
import { useLoadScript } from '@react-google-maps/api';
import { PageHeader } from './shared/PageHeader';
import { useConfirm } from '@/components/providers/ConfirmDialogProvider';
import { useSnackbar } from '@/lib/toast';

const LOCATION_OPTIONS = [
  'หอประชุมใหญ่',
  'ลานกิจกรรม',
  'อาคารเรียนรวม 1',
  'อาคารเรียนรวม 2',
  'ห้องสมุด',
  'ห้องประชุม',
  'สนามกีฬา',
  'โรงอาหาร',
  'ออนไลน์ (Online)',
];

const BANNER_COLOR_PRESETS = [
  '#0ea5e9',
  '#0284c7',
  '#4f46e5',
  '#7c3aed',
  '#06b6d4',
  '#14b8a6',
  '#10b981',
  '#22c55e',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#e11d48',
  '#ec4899',
  '#d946ef',
  '#8b5cf6',
  '#6366f1',
  '#0f172a',
  '#334155',
  '#64748b',
  '#ffffff',
] as const;

const COLOR_PRESET_GROUPS = [
  {
    label: 'แนะนำ',
    colors: [...BANNER_COLOR_PRESETS],
  },
  {
    label: 'Sky / Blue',
    colors: ['#f0f9ff', '#bae6fd', '#38bdf8', '#0ea5e9', '#0284c7', '#075985'],
  },
  {
    label: 'Indigo / Violet',
    colors: ['#eef2ff', '#c7d2fe', '#818cf8', '#6366f1', '#4f46e5', '#7c3aed'],
  },
  {
    label: 'Emerald / Teal',
    colors: ['#ecfdf5', '#a7f3d0', '#34d399', '#10b981', '#059669', '#0f766e'],
  },
  {
    label: 'Amber / Rose',
    colors: ['#fffbeb', '#fde68a', '#f59e0b', '#ea580c', '#fb7185', '#e11d48'],
  },
  {
    label: 'Neutral',
    colors: ['#ffffff', '#f8fafc', '#cbd5e1', '#64748b', '#334155', '#0f172a'],
  },
];

type EditSectionId =
  | 'basics'
  | 'banner'
  | 'content'
  | 'location'
  | 'schedule'
  | 'regcodes'
  | 'sessions'
  | 'survey'
  | 'files';

const EDIT_SECTIONS: { id: EditSectionId; label: string }[] = [
  { id: 'basics', label: 'ข้อมูลพื้นฐาน' },
  { id: 'banner', label: 'แบนเนอร์และสี' },
  { id: 'content', label: 'รายละเอียด' },
  { id: 'location', label: 'สถานที่' },
  { id: 'schedule', label: 'เวลาและตัวเลือก' },
  { id: 'regcodes', label: 'รหัสลงทะเบียน' },
  { id: 'sessions', label: 'รอบกิจกรรม' },
  { id: 'survey', label: 'แบบประเมิน' },
  { id: 'files', label: 'ไฟล์แนบ' },
];

function toHexColor(value?: string, fallback = '#0ea5e9'): string {
  if (!value) return fallback;
  const v = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v;
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9A-Fa-f]{8}$/.test(v)) return `#${v.slice(1, 7)}`;
  return fallback;
}

const GRADIENT_PRESETS: { color: string; percent: number }[][] = [
  [
    { color: '#4f46e5', percent: 0 },
    { color: '#06b6d4', percent: 100 },
  ],
  [
    { color: '#0ea5e9', percent: 0 },
    { color: '#8b5cf6', percent: 100 },
  ],
  [
    { color: '#10b981', percent: 0 },
    { color: '#06b6d4', percent: 100 },
  ],
  [
    { color: '#f59e0b', percent: 0 },
    { color: '#ef4444', percent: 100 },
  ],
  [
    { color: '#ec4899', percent: 0 },
    { color: '#8b5cf6', percent: 100 },
  ],
  [
    { color: '#0f172a', percent: 0 },
    { color: '#334155', percent: 50 },
    { color: '#0ea5e9', percent: 100 },
  ],
];

function parseColorPickerValue(value?: string): ColorValueType {
  const raw = (value || '').trim();
  if (!raw) return '#0ea5e9';

  // Ant Design gradient CSS เช่น linear-gradient(90deg, rgb(a) 0%, ...)
  if (/gradient\(/i.test(raw)) return raw;

  if (/^#[0-9A-Fa-f]{3,8}$/.test(raw)) return toHexColor(raw);
  if (/^rgba?\(/i.test(raw) || /^hsla?\(/i.test(raw)) return raw;

  return toHexColor(raw);
}

function colorToCss(color: AggregationColor, cssFromEvent?: string): string {
  if (cssFromEvent && cssFromEvent.trim()) return cssFromEvent.trim();
  try {
    return color.toCssString();
  } catch {
    return color.isGradient?.() ? color.toCssString() : color.toHexString().toLowerCase();
  }
}

function ColorPickerField({
  label,
  value,
  onChange,
  placeholder,
  allowCssGradient,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** เปิดโหมดไล่สี (gradient) ของ Ant Design ColorPicker */
  allowCssGradient?: boolean;
}) {
  const raw = (value || '').trim();
  const pickerValue = parseColorPickerValue(raw);
  const previewBg = raw || (typeof pickerValue === 'string' ? pickerValue : '#0ea5e9');

  const presets = [
    ...COLOR_PRESET_GROUPS,
    ...(allowCssGradient
      ? [
          {
            label: 'ไล่สีแนะนำ',
            colors: GRADIENT_PRESETS,
            defaultOpen: true,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <ConfigProvider
          theme={{
            token: { fontFamily: 'inherit', colorPrimary: '#0f172a', borderRadius: 8 },
          }}
        >
          <ColorPicker
            value={pickerValue}
            mode={allowCssGradient ? ['single', 'gradient'] : 'single'}
            defaultFormat="hex"
            showText={(c) => (
              <span className="font-mono text-xs max-w-[9rem] truncate">
                {c.isGradient() ? 'ไล่สี' : c.toHexString().toUpperCase()}
              </span>
            )}
            size="large"
            disabledAlpha={!allowCssGradient}
            presets={presets as any}
            getPopupContainer={(trigger) =>
              (trigger.closest('[role="dialog"]') as HTMLElement) ||
              trigger.parentElement ||
              document.body
            }
            styles={{
              popup: {
                root: { zIndex: 80 },
              },
            }}
            onChange={(color, css) => {
              onChange(colorToCss(color, css));
            }}
            onChangeComplete={(color) => {
              onChange(colorToCss(color));
            }}
          />
        </ConfigProvider>

        <Input
          className="min-w-[10rem] flex-1 font-mono text-sm"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            placeholder ||
            (allowCssGradient ? '#0ea5e9 หรือเลือกโหมดไล่สี' : '#0ea5e9')
          }
        />

        <div
          className="h-10 w-10 shrink-0 rounded-lg border border-border shadow-inner"
          style={{ background: previewBg }}
          title="ตัวอย่างสี"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {BANNER_COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onChange(c.toLowerCase())}
            className={cn(
              'h-7 w-7 rounded-md border border-black/10 transition-transform hover:scale-110',
              raw.toLowerCase() === c.toLowerCase() && 'ring-2 ring-primary ring-offset-2'
            )}
            style={{ background: c }}
          />
        ))}
        {allowCssGradient &&
          GRADIENT_PRESETS.slice(0, 4).map((g, i) => {
            const css = `linear-gradient(90deg, ${g
              .map((s) => `${s.color} ${s.percent}%`)
              .join(', ')})`;
            return (
              <button
                key={`g-${i}`}
                type="button"
                title="ไล่สี"
                onClick={() => onChange(css)}
                className={cn(
                  'h-7 w-10 rounded-md border border-black/10 transition-transform hover:scale-105',
                  raw === css && 'ring-2 ring-primary ring-offset-2'
                )}
                style={{ background: css }}
              />
            );
          })}
      </div>

      {allowCssGradient && (
        <p className="text-xs text-muted-foreground">
          ในจานสีสลับแท็บ <span className="font-medium text-foreground">สีเดียว / ไล่สี</span> เพื่อตั้ง gradient ได้
        </p>
      )}
    </div>
  );
}

/* ===================== Small utils ===================== */
const clean = <T extends Record<string, any>>(obj: T): T => {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) continue;
    out[k] = v;
  }
  return out as T;
};
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// อ่าน baseUrl จาก ENV (fallback เป็น window.location.origin)
const envBase = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || '').toString();

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.origin) {
    const origin = window.location.origin;
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('[::1]');
    if (isLocalhost && envBase) {
      return envBase.replace(/\/$/, '');
    }
    return origin.replace(/\/$/, '');
  }
  if (envBase) return envBase.replace(/\/$/, '');
  return '';
};

// สร้าง URL ที่จะ encode ลง QR (สั้น เพื่อไม่ให้ข้อมูลเยอะเกิน)
const makeShortUrl = (code: string) => `${getBaseUrl()}/r/${encodeURIComponent(code.trim().toUpperCase())}`;

// URL หน้าลงทะเบียน (ไว้แสดง/เปิดดูหน้า)
const makeRegisterUrl = (code: string) => `${getBaseUrl()}/register?activity=${encodeURIComponent(code.trim().toUpperCase())}`;

const pathFromStorageUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const i = url.indexOf('/o/');
  if (i === -1) return null;
  const after = url.substring(i + 3);
  const path = after.split('?')[0];
  return decodeURIComponent(path);
};

const randomHex = (bytes: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
const randomActivityCode = () => randomHex(16);
const randomUserCode = () => randomHex(8);

const downloadDataUrl = (dataUrl: string, filename: string) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const downloadCanvas = (canvas: HTMLCanvasElement, filename: string) => {
  const url = canvas.toDataURL('image/png');
  downloadDataUrl(url, filename);
};

// ปลอดภัยเวลา index DEPARTMENT_LABELS
const deptLabelOf = (dept: string | undefined | null) =>
  (DEPARTMENT_LABELS as Record<string, string>)[String(dept ?? '')] ?? String(dept ?? '');

/* ===================== Registration Code Series helpers ===================== */
const padNum = (n: number, digits: number) => String(Math.max(0, n)).padStart(digits, '0');
const formatRegCode = (prefix: string, seq: number, digits: number) =>
  `${String(prefix || '').toUpperCase()}${padNum(seq, digits)}`;
const isValidPrefix = (v: string) => /^[A-Z]{1,6}$/.test(String(v || '').toUpperCase().trim());
const regRangeText = (prefix: string, start: number, total: number, digits: number) => {
  const p = String(prefix || '').toUpperCase().trim();
  const s = Math.max(1, Number(start || 1));
  const t = Math.max(0, Number(total || 0));
  const d = clamp(Number(digits || 2), 1, 6);
  if (!p || !isValidPrefix(p) || t <= 0) return '-';
  return `${formatRegCode(p, s, d)} - ${formatRegCode(p, s + t - 1, d)}`;
};

/* ===================== QR helpers ===================== */
// PNG DataURL
const generateQrPng = async (text: string, size = 600) => {
  const QR = await import('qrcode');
  return QR.toDataURL(text, { margin: 1, width: size, errorCorrectionLevel: 'M' });
};

/* ===================== Time helpers ===================== */
const INVALID_DJ = dayjs(new Date(NaN)); // invalid instance (หลบ TS ไม่มี dayjs.invalid())
const toDay = (v: any | undefined) => {
  if (v == null) return INVALID_DJ;
  const d = typeof v?.toDate === 'function' ? v.toDate() : v;
  return dayjs(d);
};
const fmt = (v: any, f = 'DD MMM YYYY HH:mm') => {
  const d = toDay(v);
  return d.isValid() ? d.format(f) : '-';
};

/* ===================== Image helpers (safe) ===================== */
const loadImageSafe = async (src: string, timeoutMs = 12000): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';

      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        resolve(ok && img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null);
      };

      const t = setTimeout(() => finish(false), timeoutMs);
      img.onload = () => {
        clearTimeout(t);
        finish(true);
      };
      img.onerror = () => {
        clearTimeout(t);
        finish(false);
      };

      img.src = src;
    } catch {
      resolve(null);
    }
  });
};

const drawCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dWidth: number,
  dHeight: number
) => {
  const iw = img.naturalWidth,
    ih = img.naturalHeight;
  const ir = iw / ih,
    tr = dWidth / dHeight;
  let sx = 0,
    sy = 0,
    sw = iw,
    sh = ih;
  if (ir > tr) {
    const newW = ih * tr;
    sx = Math.round((iw - newW) / 2);
    sw = Math.round(newW);
  } else {
    const newH = iw / tr;
    sy = Math.round((ih - newH) / 2);
    sh = Math.round(newH);
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dWidth, dHeight);
};

/* ===================== Types for local use ===================== */
type BannerMode = 'image' | 'color' | 'none';
type PosterVariant = 'square' | 'a4';

type CreateForm = {
  activityName: string;
  activityCode: string;
  headerTitle: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  checkInRadius: number;
  startDateTime: Dayjs | null;
  endDateTime: Dayjs | null;
  isActive: boolean;
  scanEnabled: boolean;
  requiresUniversityLogin: boolean;
  singleUserMode: boolean;
  maxParticipants?: number;
  targetUrl: string;
  qrDataUrl: string; // preview QR
  userCode: string;
  bannerMode: BannerMode;
  bannerUrl?: string;
  bannerFile?: File | null;
  bannerColor?: string;
  bannerTintColor?: string;
  bannerTintOpacity: number; // 0..1

  // ✅ Registration code series (เช่น CS01 - CS92)
  regCodeEnabled: boolean;
  regCodePrefix: string;
  regCodeDigits: number; // 1..6
  regCodeStart: number; // >= 1
  regCodeTotal: number; // >= 0
  regCodeNext: number; // internal tracking (read-only for admin)
  regCodeAssigned: number; // internal tracking (read-only for admin)
  
  // Dynamic QR Code (Rolling QR)
  dynamicQREnabled: boolean;
  /** ชื่อจุดลงทะเบียนหน้างาน (แสดงตอน QR หมดอายุ) */
  onsiteRegistrationPoint: string;

  // กิจกรรมย่อย (Sessions)
  sessions: { id: string; name: string; startDateTime: Dayjs | null; endDateTime: Dayjs | null; files?: ActivityFile[] }[];

  // แบบประเมิน (Survey)
  surveyConfig: {
    enabled: boolean;
    openAt: Dayjs | null;
    closeAt: Dayjs | null;
    sessionEligibility: 'any' | 'all' | 'specific';
    requiredSessionIds: string[];
    questions: SurveyQuestion[];
    forceOpenUntil?: any;
    userForceOpenUntil?: Record<string, any>;
  };

  // ไฟล์/เอกสารแนบกิจกรรมหลัก
  files: ActivityFile[];
};

const defaultForm: CreateForm = {
  activityName: '',
  activityCode: '',
  headerTitle: '',
  description: '',
  location: '',
  latitude: undefined,
  longitude: undefined,
  checkInRadius: 100,
  startDateTime: dayjs().startOf('minute'),
  endDateTime: dayjs().add(2, 'hour').startOf('minute'),
  isActive: false,
  scanEnabled: true,
  requiresUniversityLogin: true,
  singleUserMode: false,
  maxParticipants: undefined,
  targetUrl: '',
  qrDataUrl: '',
  userCode: '',
  bannerMode: 'none',
  bannerUrl: undefined,
  bannerFile: null,
  bannerColor: '#0ea5e9',
  bannerTintColor: '#0ea5e9',
  bannerTintOpacity: 0.42,

  // ✅ defaults (แก้ตามต้องการ)
  regCodeEnabled: false,
  regCodePrefix: 'CS',
  regCodeDigits: 2,
  regCodeStart: 1,
  regCodeTotal: 0,
  regCodeNext: 1,
  regCodeAssigned: 0,
  
  dynamicQREnabled: false,
  onsiteRegistrationPoint: '',
  sessions: [],
  surveyConfig: {
    enabled: false,
    openAt: dayjs().add(2, 'hour').startOf('minute'),
    closeAt: dayjs().add(1, 'day').add(2, 'hour').startOf('minute'),
    sessionEligibility: 'any',
    requiredSessionIds: [],
    questions: [],
  },
  files: [],
};

/** แปลง surveyConfig จากฟอร์ม → บันทึก Firestore */
const serializeSurveyConfig = (cfg: CreateForm['surveyConfig']) => {
  const out: Record<string, any> = {
    enabled: !!cfg.enabled,
    questions: cfg.questions || [],
    sessionEligibility: cfg.sessionEligibility || 'any',
    requiredSessionIds: cfg.requiredSessionIds || [],
  };
  if (cfg.openAt) out.openAt = cfg.openAt.toDate();
  if (cfg.closeAt) out.closeAt = cfg.closeAt.toDate();
  if (cfg.forceOpenUntil != null) out.forceOpenUntil = cfg.forceOpenUntil;
  if (cfg.userForceOpenUntil && Object.keys(cfg.userForceOpenUntil).length > 0) {
    out.userForceOpenUntil = cfg.userForceOpenUntil;
  }
  return out;
};

interface Props {
  currentAdmin: AdminProfile;
}

/* ===================== Poster (Canvas) ===================== */
const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) => {
  const words = text.split(/\s+/);
  let line = '';
  let yy = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + (line ? ' ' : '') + words[n];
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, yy);
      line = words[n];
      yy += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, yy);
  return yy;
};

/**
 * สร้างโปสเตอร์ (Canvas) แบบสวยงาม
 * - ใช้ short URL ใน QR (ป้องกันข้อมูลเยอะเกิน)
 * - วางหัวเรื่อง / เวลา / สถานที่ / QR / โค้ด
 */
const buildPosterCanvas = async (a: Activity, variant: PosterVariant = 'square') => {
  const shortUrl = makeShortUrl(a.activityCode);
  const qrData = await generateQrPng(shortUrl, 1024);

  const size =
    variant === 'a4'
      ? { w: 1240, h: 1754 } // A4 ~150dpi
      : { w: 1080, h: 1350 }; // สี่เหลี่ยมแนวตั้ง

  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d')!;

  const grd = ctx.createLinearGradient(0, 0, 0, size.h);
  grd.addColorStop(0, '#e6efff');
  grd.addColorStop(1, '#dff4ff');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size.w, size.h);

  const bannerColor = (a as any).bannerColor as string | undefined;
  const tintColor = (a as any).bannerTintColor as string | undefined;
  const tintOpacity =
    typeof (a as any).bannerTintOpacity === 'number' ? Number((a as any).bannerTintOpacity) : 0.42;

  const headerH = Math.round(size.h * 0.2);
  let drewImage = false;
  const bannerUrl = (a as any).bannerUrl as string | undefined;
  if (bannerUrl) {
    const img = await loadImageSafe(bannerUrl);
    if (img) {
      drawCover(ctx, img, 0, 0, size.w, headerH);
      drewImage = true;
      if (tintColor && tintOpacity > 0) {
        ctx.fillStyle = tintColor;
        ctx.globalAlpha = clamp(tintOpacity, 0, 1);
        ctx.fillRect(0, 0, size.w, headerH);
        ctx.globalAlpha = 1;
      }
    }
  }
  if (!drewImage) {
    const bg = (bannerColor || '').startsWith('linear-gradient') ? '#4f46e5' : bannerColor || '#c7d2fe';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size.w, headerH);
  }

  const pad = Math.round(size.w * 0.04);
  ctx.fillStyle = '#0b1220';
  ctx.font = `600 ${Math.round(size.w * 0.04)}px Inter, "Noto Sans Thai", system-ui`;
  ctx.fillText(deptLabelOf((a as any).department), pad, pad + Math.round(size.w * 0.04));

  ctx.fillStyle = '#111827';
  ctx.font = `800 ${Math.round(size.w * 0.065)}px Inter, "Noto Sans Thai", system-ui`;
  const titleY = pad + Math.round(size.w * 0.04) + Math.round(size.w * 0.065) + 8;
  wrapText(ctx, a.activityName || '-', pad, titleY, size.w - pad * 2, Math.round(size.w * 0.075));

  ctx.fillStyle = '#334155';
  ctx.font = `500 ${Math.round(size.w * 0.038)}px Inter, "Noto Sans Thai", system-ui`;
  ctx.fillText(`${fmt(a.startDateTime)} - ${fmt(a.endDateTime)}`, pad, Math.round(headerH - pad * 0.8));

  const panelY = headerH + Math.round(size.h * 0.02);
  const panelH = size.h - panelY - Math.round(size.h * 0.05);
  const panelR = Math.round(size.w * 0.02);
  ctx.fillStyle = '#ffffff';
  const rr = new Path2D();
  rr.moveTo(pad + panelR, panelY);
  rr.arcTo(size.w - pad, panelY, size.w - pad, panelY + panelR, panelR);
  rr.arcTo(size.w - pad, panelY + panelH, size.w - pad - panelR, panelY + panelH, panelR);
  rr.arcTo(pad, panelY + panelH, pad, panelY + panelH - panelR, panelR);
  rr.arcTo(pad, panelY, pad + panelR, panelY, panelR);
  ctx.fill(rr);

  const qrImg = await loadImageSafe(qrData);
  const qrSize = Math.min(Math.round(panelH * 0.7), Math.round(size.w * 0.75));
  const qrX = Math.round((size.w - qrSize) / 2);
  const qrY = Math.round(panelY + panelH * 0.08);
  if (qrImg) {
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  } else {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
    ctx.fillStyle = '#64748b';
    ctx.font = `600 ${Math.round(size.w * 0.035)}px Inter, system-ui`;
    ctx.fillText('QR โหลดไม่สำเร็จ', qrX + 16, qrY + Math.round(qrSize / 2));
  }

  ctx.fillStyle = '#111827';
  ctx.font = `800 ${Math.round(size.w * 0.045)}px Inter, "Noto Sans Thai", system-ui`;
  const codeText = `รหัสกิจกรรม: ${a.activityCode}`;
  const codeY = qrY + qrSize + Math.round(size.w * 0.08);
  ctx.fillText(codeText, pad, codeY);

  if ((a as any).location) {
    ctx.fillStyle = '#334155';
    ctx.font = `600 ${Math.round(size.w * 0.036)}px Inter, "Noto Sans Thai", system-ui`;
    wrapText(ctx, (a as any).location, pad, codeY + Math.round(size.w * 0.06), size.w - pad * 2, Math.round(size.w * 0.05));
  }

  ctx.fillStyle = '#64748b';
  ctx.font = `400 ${Math.round(size.w * 0.028)}px Inter, system-ui`;
  const u = new URL(shortUrl);
  ctx.fillText(`สร้างด้วย ระบบลงทะเบียนกิจกรรม • ${u.host}${u.pathname}`, pad, size.h - Math.round(size.w * 0.02));

  return canvas;
};

const toDayjsSafe = (v: any): Dayjs | null => {
  if (!v) return null;
  if (dayjs.isDayjs(v)) return v;
  if (v.toDate) return dayjs(v.toDate());
  if (v instanceof Date) return dayjs(v);
  if (typeof v === 'object' && typeof v.seconds === 'number') {
    return dayjs(new Date(v.seconds * 1000));
  }
  const d = dayjs(v);
  return d.isValid() ? d : null;
};

const FileConfigSection: React.FC<{
  title: string;
  files: ActivityFile[];
  onChange: (files: ActivityFile[]) => void;
  activityCode: string;
  department: string;
}> = ({ title, files = [], onChange, activityCode, department }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const addFile = () => {
    const newFile: ActivityFile = {
      id: Date.now().toString(),
      name: '',
      url: '',
      type: 'pdf',
      description: '',
    };
    onChange([...files, newFile]);
  };

  const updateFile = (index: number, key: keyof ActivityFile, value: any) => {
    const newFiles = [...files];
    newFiles[index] = { ...newFiles[index], [key]: value };
    onChange(newFiles);
  };

  const removeFile = (index: number) => {
    onChange(files.filter((_, idx) => idx !== index));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number, fileId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(fileId);
    try {
      const ext = file.name.split('.').pop() || 'file';
      const storagePath = `banners/${department}/file_${activityCode || 'temp'}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const r = ref(storage, storagePath);
      await uploadBytes(r, file);
      const downloadUrl = await getDownloadURL(r);
      
      const newFiles = [...files];
      newFiles[idx] = {
        ...newFiles[idx],
        url: downloadUrl,
        name: newFiles[idx].name || file.name,
      };
      onChange(newFiles);
    } catch (err: any) {
      enqueueSnackbar('อัปโหลดไฟล์ล้มเหลว: ' + err.message, { variant: 'error' });
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="mt-3">
      <p className="mb-2 text-sm font-medium flex items-center gap-1">
        <AttachFileIcon className="h-4 w-4" /> {title} ({files.length})
      </p>

      {files.length > 0 && (
        <div className="mb-3 flex flex-col gap-3">
          {files.map((file, idx) => (
            <div
              key={file.id}
              className="p-3 border border-dashed border-border rounded-lg bg-muted/50"
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-4 flex flex-col gap-1.5">
                  <Label className="text-xs">ชื่อเอกสาร/หัวข้อข้อความ</Label>
                  <Input
                    value={file.name}
                    onChange={(e) => updateFile(idx, 'name', e.target.value)}
                    placeholder="เช่น คู่มืออบรม.pdf"
                  />
                </div>
                <div className="sm:col-span-3 flex flex-col gap-1.5">
                  <Label className="text-xs">ประเภท</Label>
                  <Select value={file.type} onValueChange={(v) => updateFile(idx, 'type', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">ไฟล์ PDF</SelectItem>
                      <SelectItem value="image">รูปภาพ (Image)</SelectItem>
                      <SelectItem value="link">ลิงก์เว็บไซต์ (Link)</SelectItem>
                      <SelectItem value="text">ข้อความ/คำอธิบาย (Text)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-4 flex flex-col gap-1.5">
                  <Label className="text-xs">
                    {file.type === 'text' ? 'ข้อความ/คำอธิบาย' : 'URL ของไฟล์/ลิงก์'}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={file.url}
                      onChange={(e) => updateFile(idx, 'url', e.target.value)}
                      placeholder={file.type === 'text' ? 'กรอกรายละเอียดข้อความที่นี่' : 'https://...'}
                    />
                    {file.type !== 'text' && (
                      <div>
                        <input
                          accept={file.type === 'image' ? 'image/*' : 'application/pdf,*/*'}
                          style={{ display: 'none' }}
                          id={`upload-file-btn-${file.id}`}
                          type="file"
                          onChange={(e) => handleFileUpload(e, idx, file.id)}
                          disabled={uploadingId !== null}
                        />
                        <label htmlFor={`upload-file-btn-${file.id}`}>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            disabled={uploadingId !== null}
                            className="min-w-[95px] cursor-pointer"
                          >
                            <span>
                              {uploadingId === file.id ? <Spinner size="sm" /> : 'อัปโหลด'}
                            </span>
                          </Button>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeFile(idx)}
                  >
                    <DeleteIcon className="h-4 w-4" />
                  </Button>
                </div>
                <div className="sm:col-span-12 flex flex-col gap-1.5">
                  <Label className="text-xs">รายละเอียดเพิ่มเติม (ระบุหรือไม่ก็ได้)</Label>
                  <Input
                    value={file.description || ''}
                    onChange={(e) => updateFile(idx, 'description', e.target.value)}
                    placeholder="เช่น ให้อ่านก่อนเข้าร่วมกิจกรรม..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" className="gap-2" onClick={addFile}>
        <AddIcon className="h-4 w-4" /> เพิ่มไฟล์/ลิงก์/ข้อความ
      </Button>
    </div>
  );
};

/* ===================== Main ===================== */
interface QRCodeAdminPanelProps {
  currentAdmin: AdminProfile;
}

const googleLibraries: ("places" | "geometry" | "drawing" | "visualization")[] = ['places', 'geometry'];

/** รัศมี bias สำหรับจัดอันดับสถานที่ใกล้เคียงก่อน (เมตร) */
const PLACE_SEARCH_BIAS_RADIUS_M = 50_000;

type PlaceSuggestion = {
  description: string;
  mainText?: string;
  secondaryText?: string;
  placeId?: string;
  distanceMeters?: number;
};

/** ตัด Plus Code นำหน้าออก เช่น "2F4X+HQ9 ตำบล..." */
function stripPlusCodePrefix(text: string): string {
  return text.replace(/^[A-Z0-9]{2,}\+[A-Z0-9]+\s*/i, '').trim() || text.trim();
}

function isPlusCodeLike(text?: string | null): boolean {
  if (!text) return true;
  const t = text.trim();
  return /^[A-Z0-9]{2,}\+[A-Z0-9]+$/i.test(t) || /^[A-Z0-9]{2,}\+[A-Z0-9]+\s/i.test(t);
}

/** เลือกชื่อสถานที่จาก Google Place (ไม่ใช้ Plus Code เป็นชื่อหลัก) */
function pickPlaceName(
  place: {
    name?: string | null;
    formatted_address?: string | null;
  },
  suggestion?: PlaceSuggestion
): string {
  const name = place.name?.trim();
  if (name && !isPlusCodeLike(name)) return name;

  const main = suggestion?.mainText?.trim();
  if (main && !isPlusCodeLike(main)) {
    const secondary = suggestion.secondaryText?.trim();
    return secondary && !isPlusCodeLike(secondary) ? `${main}, ${secondary}` : main;
  }

  const formatted = place.formatted_address ? stripPlusCodePrefix(place.formatted_address) : '';
  if (formatted) return formatted;

  if (suggestion?.description) return stripPlusCodePrefix(suggestion.description);
  return name || '';
}

function pickNameFromGeocodeResult(result: google.maps.GeocoderResult): string {
  // หา establishment / premise / point_of_interest ก่อน
  const preferredTypes = [
    'establishment',
    'point_of_interest',
    'premise',
    'university',
    'school',
    'tourist_attraction',
  ];
  for (const type of preferredTypes) {
    const comp = result.address_components?.find((c) => c.types.includes(type));
    if (comp?.long_name && !isPlusCodeLike(comp.long_name)) return comp.long_name;
  }

  // ชื่อจาก formatted_address โดยตัด plus code
  const cleaned = stripPlusCodePrefix(result.formatted_address || '');
  if (cleaned) {
    // เอาส่วนแรกก่อนเครื่องหมายจุลภาคถ้ามี
    const first = cleaned.split(',')[0]?.trim();
    if (first && !isPlusCodeLike(first)) return first;
    return cleaned;
  }

  return result.formatted_address || '';
}

const GooglePlaceAutocomplete: React.FC<{
  value: string;
  onChange: (address: string, lat?: number, lng?: number) => void;
  isLoaded: boolean;
}> = ({ value, onChange, isLoaded }) => {
  const [options, setOptions] = useState<PlaceSuggestion[]>([]);
  const [inputValue, setInputValue] = useState(value || '');
  const [openList, setOpenList] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  /** ISO 3166-1 Alpha-2 — ค่าเริ่มต้นไทย (แอปใช้งานหลักในประเทศ) */
  const [country, setCountry] = useState('th');
  const [locReady, setLocReady] = useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // ดึงตำแหน่งปัจจุบัน → จำกัดประเทศ + bias ใกล้เคียง
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocReady(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLoc({ lat, lng });
        setLocReady(true);
      },
      () => setLocReady(true),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  // reverse geocode → รหัสประเทศจากตำแหน่งจริง
  useEffect(() => {
    if (!isLoaded || !userLoc || !(window as any).google?.maps?.Geocoder) return;
    try {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: userLoc }, (results, status) => {
        if (status !== window.google.maps.GeocoderStatus.OK || !results?.[0]) return;
        const countryComp = results[0].address_components?.find((c) =>
          c.types.includes('country')
        );
        const code = countryComp?.short_name?.toLowerCase();
        if (code && /^[a-z]{2}$/.test(code)) setCountry(code);
      });
    } catch {
      /* keep default */
    }
  }, [isLoaded, userLoc]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpenList(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      setOptions(LOCATION_OPTIONS.map((description) => ({ description })));
      return;
    }

    const q = inputValue.trim();
    if (!q) {
      setOptions(LOCATION_OPTIONS.map((description) => ({ description })));
      return;
    }

    let cancelled = false;
    const delayDebounce = setTimeout(() => {
      try {
        const autocompleteService = new window.google.maps.places.AutocompleteService();
        const request: google.maps.places.AutocompletionRequest = {
          input: q,
          componentRestrictions: { country },
          language: 'th',
          region: country,
        };

        if (userLoc) {
          const center = new window.google.maps.LatLng(userLoc.lat, userLoc.lng);
          // จัดอันดับตามระยะจากตำแหน่งปัจจุบัน
          request.origin = center;
          // bias ผลลัพธ์รอบตัวผู้ใช้ (ใกล้ขึ้นก่อน)
          request.location = center;
          request.radius = PLACE_SEARCH_BIAS_RADIUS_M;
          (request as any).locationBias = {
            center: userLoc,
            radius: PLACE_SEARCH_BIAS_RADIUS_M,
          };
        }

        autocompleteService.getPlacePredictions(request, (predictions, status) => {
          if (cancelled) return;
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions?.length) {
            // Google คืนผลเรียงตามความเกี่ยวข้อง + ระยะเมื่อมี origin แล้ว
            setOptions(
              predictions.map((p) => ({
                description: p.description,
                mainText: p.structured_formatting?.main_text,
                secondaryText: p.structured_formatting?.secondary_text,
                placeId: p.place_id,
                distanceMeters: (p as any).distance_meters as number | undefined,
              }))
            );
          } else {
            const local = LOCATION_OPTIONS.filter((o) =>
              o.toLowerCase().includes(q.toLowerCase())
            );
            setOptions(local.map((description) => ({ description })));
          }
        });
      } catch {
        if (!cancelled) {
          setOptions(LOCATION_OPTIONS.map((description) => ({ description })));
        }
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(delayDebounce);
    };
  }, [inputValue, isLoaded, country, userLoc, locReady]);

  const resolvePlace = (suggestion: PlaceSuggestion) => {
    const preview =
      suggestion.mainText && !isPlusCodeLike(suggestion.mainText)
        ? suggestion.secondaryText && !isPlusCodeLike(suggestion.secondaryText)
          ? `${suggestion.mainText}, ${suggestion.secondaryText}`
          : suggestion.mainText
        : stripPlusCodePrefix(suggestion.description);

    setInputValue(preview);
    setOpenList(false);
    onChange(preview);

    if (!isLoaded || !(window as any).google) return;

    try {
      if (suggestion.placeId && window.google.maps.places?.PlacesService) {
        const stub = document.createElement('div');
        const svc = new window.google.maps.places.PlacesService(stub);
        svc.getDetails(
          {
            placeId: suggestion.placeId,
            fields: ['geometry', 'formatted_address', 'name', 'address_components'],
            language: 'th',
          },
          (place, status) => {
            if (
              status === window.google.maps.places.PlacesServiceStatus.OK &&
              place?.geometry?.location
            ) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              const label = pickPlaceName(place, suggestion) || preview;
              setInputValue(label);
              onChange(label, lat, lng);
              return;
            }
            geocodeAddress(suggestion.description, preview);
          }
        );
        return;
      }
      geocodeAddress(suggestion.description, preview);
    } catch (e) {
      console.error('Place resolve error:', e);
    }
  };

  const geocodeAddress = (address: string, displayFallback?: string) => {
    try {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode(
        {
          address,
          componentRestrictions: { country },
          region: country,
          language: 'th',
        },
        (results, status) => {
          if (status === window.google.maps.GeocoderStatus.OK && results?.[0]) {
            const lat = results[0].geometry.location.lat();
            const lng = results[0].geometry.location.lng();
            const label =
              pickNameFromGeocodeResult(results[0]) ||
              displayFallback ||
              stripPlusCodePrefix(address);
            setInputValue(label);
            onChange(label, lat, lng);
          }
        }
      );
    } catch (e) {
      console.error('Geocoding error:', e);
    }
  };

  const formatDistance = (m?: number) => {
    if (typeof m !== 'number' || !Number.isFinite(m)) return null;
    if (m < 1000) return `${Math.round(m)} ม.`;
    return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} กม.`;
  };

  return (
    <div className="flex flex-col gap-1.5" ref={wrapRef}>
      <Label className="text-xs">สถานที่จัดกิจกรรม (ค้นหาจาก Google Maps)</Label>
      <div className="relative">
        <Input
          role="combobox"
          aria-expanded={openList}
          aria-controls={listId}
          autoComplete="off"
          value={inputValue}
          placeholder={
            userLoc
              ? 'พิมพ์ชื่อสถานที่ใกล้คุณ...'
              : 'พิมพ์ชื่อสถานที่เพื่อค้นหา...'
          }
          onFocus={() => setOpenList(true)}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpenList(true);
            onChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpenList(false);
            if (e.key === 'Enter' && options[0]) {
              e.preventDefault();
              resolvePlace(options[0]);
            }
          }}
        />
        {openList && options.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-[60] mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-background py-1 shadow-lg"
          >
            {options.map((opt) => {
              const dist = formatDistance(opt.distanceMeters);
              const title =
                opt.mainText && !isPlusCodeLike(opt.mainText)
                  ? opt.mainText
                  : stripPlusCodePrefix(opt.description);
              const subtitle =
                opt.mainText && !isPlusCodeLike(opt.mainText)
                  ? opt.secondaryText
                  : undefined;
              return (
                <li key={`${opt.placeId || ''}:${opt.description}`}>
                  <button
                    type="button"
                    role="option"
                    className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => resolvePlace(opt)}
                  >
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="font-medium block">{title}</span>
                      {subtitle && (
                        <span className="text-xs text-muted-foreground block mt-0.5">{subtitle}</span>
                      )}
                    </span>
                    {dist && (
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {dist}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        ค้นหาเฉพาะประเทศ{country === 'th' ? 'ไทย' : ` ${country.toUpperCase()}`}
        {userLoc ? ' · แสดงสถานที่ใกล้ตำแหน่งคุณก่อน' : ' · อนุญาตตำแหน่งเพื่อจัดอันดับใกล้เคียง'}
      </p>
    </div>
  );
};

const QRCodeAdminPanel: React.FC<QRCodeAdminPanelProps> = ({ currentAdmin }) => {
  const confirm = useConfirm();
  const { enqueueSnackbar } = useSnackbar();
  const { isLoaded: isGoogleMapsLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: googleLibraries,
  });

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  // view mode: การ์ด / ตาราง
  const [view, setView] = useState<'cards' | 'table'>('cards');

  // create
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [saveAction, setSaveAction] = useState<'draft' | 'publish' | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const [openPreview, setOpenPreview] = useState(false);

  // Magnific AI states
  const [magnificOpen, setMagnificOpen] = useState(false);
  const [magnificPrompt, setMagnificPrompt] = useState('');
  const [magnificRatio, setMagnificRatio] = useState('widescreen_16_9');
  const [magnificModel, setMagnificModel] = useState('realism');
  const [magnificLoading, setMagnificLoading] = useState(false);
  const [magnificStatus, setMagnificStatus] = useState<'IDLE' | 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'>('IDLE');
  const [magnificTaskId, setMagnificTaskId] = useState<string | null>(null);
  const [magnificResultUrl, setMagnificResultUrl] = useState<string | null>(null);
  const [magnificError, setMagnificError] = useState('');

  // Polling Magnific AI task status
  useEffect(() => {
    if (!magnificTaskId || magnificStatus === 'COMPLETED' || magnificStatus === 'FAILED') return;

    let timerId: any;

    const checkStatus = async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error('ไม่พบข้อมูลการเข้าสู่ระบบ');

        const res = await fetch(`/api/magnific?taskId=${magnificTaskId}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });
        const json = await res.json();
        
        if (!res.ok) {
          throw new Error(json.error || 'ตรวจสอบสถานะล้มเหลว');
        }

        const data = json.data;
        if (data) {
          if (data.status === 'COMPLETED') {
            setMagnificStatus('COMPLETED');
            if (data.generated && data.generated.length > 0) {
              setMagnificResultUrl(data.generated[0]);
            } else {
              throw new Error('ไม่พบ URL รูปภาพที่สร้างขึ้น');
            }
          } else if (data.status === 'FAILED') {
            setMagnificStatus('FAILED');
            throw new Error('การสร้างรูปภาพล้มเหลว (Failed)');
          } else {
            setMagnificStatus('IN_PROGRESS');
          }
        }
      } catch (err: any) {
        setMagnificError(err.message || 'เกิดข้อผิดพลาดในการตรวจสอบสถานะ');
        setMagnificStatus('FAILED');
        setMagnificTaskId(null);
      }
    };

    timerId = setInterval(checkStatus, 3000);

    return () => clearInterval(timerId);
  }, [magnificTaskId, magnificStatus]);

  const handleGenerateImage = async () => {
    try {
      setMagnificLoading(true);
      setMagnificError('');
      setMagnificResultUrl(null);
      setMagnificStatus('CREATED');

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('ไม่พบข้อมูลการเข้าสู่ระบบ');

      const res = await fetch('/api/magnific', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          prompt: magnificPrompt,
          aspect_ratio: magnificRatio,
          model: magnificModel,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'ไม่สามารถเริ่มต้นสร้างรูปภาพได้');
      }

      if (json.data && json.data.task_id) {
        setMagnificTaskId(json.data.task_id);
        setMagnificStatus('IN_PROGRESS');
      } else {
        throw new Error('ไม่ได้รับข้อมูล Task ID จากระบบ');
      }
    } catch (err: any) {
      setMagnificError(err.message || 'เกิดข้อผิดพลาดในการสร้างรูปภาพ');
      setMagnificStatus('FAILED');
    } finally {
      setMagnificLoading(false);
    }
  };

  const handleUseGeneratedImage = async () => {
    if (!magnificResultUrl) return;
    try {
      setMagnificLoading(true);
      setMagnificError('');

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('ไม่พบข้อมูลการเข้าสู่ระบบ');

      // Fetch via proxy to avoid CORS
      const proxyUrl = `/api/magnific?proxyUrl=${encodeURIComponent(magnificResultUrl)}`;
      const res = await fetch(proxyUrl, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!res.ok) {
        throw new Error('ไม่สามารถดาวน์โหลดรูปภาพผ่าน proxy ได้');
      }

      const blob = await res.blob();
      const ext = blob.type.split('/')[1] || 'jpg';
      const file = new File([blob], `magnific_${Date.now()}.${ext}`, { type: blob.type });

      updateForm('bannerFile', file as any);
      updateForm('bannerUrl', URL.createObjectURL(file) as any);

      // Close and Reset Dialog
      setMagnificOpen(false);
      setMagnificResultUrl(null);
      setMagnificTaskId(null);
      setMagnificStatus('IDLE');
    } catch (err: any) {
      setMagnificError(err.message || 'เกิดข้อผิดพลาดในการดึงรูปภาพมาใช้');
    } finally {
      setMagnificLoading(false);
    }
  };

  // ===================== Magnific AI Upscale (แบนเนอร์) =====================
  const [upscaling, setUpscaling] = useState(false);
  const [upscaleError, setUpscaleError] = useState('');

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        // ตัด prefix "data:image/...;base64," ให้เหลือ base64 ล้วน
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = () => reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'));
      reader.readAsDataURL(file);
    });

  const handleUpscaleBanner = async () => {
    try {
      setUpscaling(true);
      setUpscaleError('');

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('ไม่พบข้อมูลการเข้าสู่ระบบ');

      // เตรียมรูปต้นฉบับ: ไฟล์ในเครื่อง → base64, รูปที่อัปโหลดแล้ว → ส่งเป็น URL
      let image: string;
      if (form.bannerFile) {
        image = await fileToBase64(form.bannerFile);
      } else if (form.bannerUrl && form.bannerUrl.startsWith('https://')) {
        image = form.bannerUrl;
      } else if (form.bannerUrl && form.bannerUrl.startsWith('blob:')) {
        const blob = await (await fetch(form.bannerUrl)).blob();
        image = await fileToBase64(new File([blob], 'banner.jpg', { type: blob.type }));
      } else {
        throw new Error('ไม่พบรูปแบนเนอร์ที่จะปรับความคมชัด');
      }

      const res = await fetch('/api/magnific', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          action: 'upscale',
          image,
          scale_factor: 2,
          flavor: 'photo',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ไม่สามารถเริ่มปรับความคมชัดได้');

      const taskId = json?.data?.task_id;
      if (!taskId) throw new Error('ไม่ได้รับ Task ID จากระบบ');

      // Poll จนกว่างานจะเสร็จ (สูงสุด ~4 นาที)
      let resultUrl: string | null = null;
      for (let i = 0; i < 80; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const statusRes = await fetch(`/api/magnific?taskId=${taskId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` },
        });
        const statusJson = await statusRes.json();
        if (!statusRes.ok) throw new Error(statusJson.error || 'ตรวจสอบสถานะล้มเหลว');

        const data = statusJson.data;
        if (data?.status === 'COMPLETED') {
          if (!data.generated || data.generated.length === 0) {
            throw new Error('ไม่พบ URL รูปภาพที่ปรับความคมชัดแล้ว');
          }
          resultUrl = data.generated[0];
          break;
        }
        if (data?.status === 'FAILED') {
          throw new Error('การปรับความคมชัดล้มเหลว (Failed)');
        }
      }
      if (!resultUrl) throw new Error('หมดเวลารอผลลัพธ์ กรุณาลองใหม่อีกครั้ง');

      // ดาวน์โหลดผ่าน proxy แล้วแทนที่รูปแบนเนอร์ในฟอร์ม
      const proxied = await fetch(`/api/magnific?proxyUrl=${encodeURIComponent(resultUrl)}`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
      });
      if (!proxied.ok) throw new Error('ไม่สามารถดาวน์โหลดรูปที่ปรับแล้วได้');

      const blob = await proxied.blob();
      const ext = blob.type.split('/')[1] || 'jpg';
      const file = new File([blob], `magnific_upscaled_${Date.now()}.${ext}`, { type: blob.type });
      updateForm('bannerFile', file as any);
      updateForm('bannerUrl', URL.createObjectURL(file) as any);
    } catch (err: any) {
      setUpscaleError(err.message || 'เกิดข้อผิดพลาดในการปรับความคมชัด');
    } finally {
      setUpscaling(false);
    }
  };

  // อัปโหลดรูปประกอบ (จาก Magnific AI) สำหรับแทรกใน rich description
  // เก็บใน desc-images/ ซึ่ง rules ปิด read ตรง — เสิร์ฟผ่าน /api/images เท่านั้น
  const uploadDescriptionImage = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `desc-images/${currentAdmin.department}/desc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const r = ref(storage, path);
    await uploadBytes(r, file);
    return `/api/images?path=${encodeURIComponent(path)}`;
  };


  // edit
  const [openEdit, setOpenEdit] = useState(false);
  const [editActivityId, setEditActivityId] = useState<string | null>(null);
  const [qrDocId, setQrDocId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editSection, setEditSection] = useState<EditSectionId>('basics');
  const [openVersions, setOpenVersions] = useState(false);
  const [versions, setVersions] = useState<ActivityVersionMeta[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);

  // download menu
  const [dlMenu, setDlMenu] = useState<{ anchorEl: HTMLElement | null; activity: Activity | null }>({
    anchorEl: null,
    activity: null,
  });
  const openDownloadMenu = (e: React.MouseEvent<HTMLElement>, a: Activity) =>
    setDlMenu({ anchorEl: e.currentTarget as HTMLElement, activity: a });
  const closeDownloadMenu = () => setDlMenu({ anchorEl: null, activity: null });

  const activeCount = useMemo(() => activities.filter((a) => a.isActive).length, [activities]);

  const statusOf = (a: Activity) => {
    const now = new Date();
    if (!a.isActive) return { label: 'ฉบับร่าง', color: 'warning' as const };
    if (a.startDateTime && now < a.startDateTime) return { label: 'รอเปิด', color: 'warning' as const };
    if (a.endDateTime && now > a.endDateTime) return { label: 'สิ้นสุดแล้ว', color: 'default' as const };
    return { label: 'เผยแพร่แล้ว', color: 'success' as const };
  };

  const handleToggle = async (a: Activity) => {
    try {
      const opening = !a.isActive;
      const result = await toggleActivityLive(a.id, opening, {
        uid: currentAdmin.uid,
        email: currentAdmin.email,
      });
      if (opening && result.extendedSchedule) {
        enqueueSnackbar(
          'เปิดกิจกรรมแล้ว และขยายวันสิ้นสุดอัตโนมัติ 24 ชม. — ปรับเวลาได้ในหน้าแก้ไข',
          { variant: 'success' }
        );
      } else if (opening) {
        enqueueSnackbar('เปิดการใช้งานกิจกรรมแล้ว', { variant: 'success' });
      } else {
        enqueueSnackbar('ปิดการใช้งานกิจกรรมแล้ว', { variant: 'info' });
      }
    } catch {
      enqueueSnackbar('เปลี่ยนสถานะไม่สำเร็จ', { variant: 'error' });
    }
    await load();
  };

  const handleReopenEnded = async (a: Activity) => {
    try {
      const result = await reopenEndedActivity(a.id, {
        uid: currentAdmin.uid,
        email: currentAdmin.email,
      });
      enqueueSnackbar(
        result.extendedSchedule
          ? 'เปิดกิจกรรมใหม่อีกครั้งแล้ว (ขยายวันสิ้นสุด 24 ชม.) — ปรับเวลาได้ในหน้าแก้ไข'
          : 'เปิดกิจกรรมใหม่อีกครั้งแล้ว',
        { variant: 'success' }
      );
    } catch {
      enqueueSnackbar('เปิดกิจกรรมใหม่ไม่สำเร็จ', { variant: 'error' });
    }
    await load();
  };

  const load = async () => {};

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeActivities(
      currentAdmin.department as AdminDepartment,
      (data) => {
        setActivities(data);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentAdmin.department]);

  /* ---------- Create ---------- */
  const handleOpenCreate = () => {
    setErrMsg('');
    const ac = randomActivityCode();
    const start = defaultForm.regCodeStart || 1;
    const endDt = dayjs().add(2, 'hour').startOf('minute');
    setForm({
      ...defaultForm,
      activityCode: ac,
      userCode: randomUserCode(),
      startDateTime: dayjs().startOf('minute'),
      endDateTime: endDt,
      targetUrl: makeRegisterUrl(ac),
      surveyConfig: {
        ...defaultForm.surveyConfig,
        openAt: endDt,
        closeAt: endDt.add(1, 'day'),
      },

      // series counters
      regCodeNext: start,
      regCodeAssigned: 0,
    });
    setOpenCreate(true);
  };

  const handleCloseCreate = () => {
    if (!saving) setOpenCreate(false);
  };

  const updateForm = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === 'activityCode') {
        const code = String(value || '').toUpperCase();
        next.targetUrl = code ? makeRegisterUrl(code) : '';
      }

      // sync regCodeNext if start changes (only when 아직ไม่แจก)
      if (key === 'regCodeStart') {
        const start = Math.max(1, Number(value || 1));
        if ((prev.regCodeAssigned || 0) <= 0) next.regCodeNext = start;
      }

      return next;
    });
  };

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setErrMsg('อุปกรณ์ไม่รองรับการระบุตำแหน่ง');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        updateForm('latitude', lat as any);
        updateForm('longitude', lng as any);
        setErrMsg('');
        void reverseGeocodeToPlaceName(lat, lng);
      },
      () => setErrMsg('ไม่สามารถอ่านตำแหน่งได้ กรุณาลองใหม่'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const reverseGeocodeToPlaceName = async (lat: number, lng: number) => {
    if (!isGoogleMapsLoaded || !(window as any).google?.maps?.Geocoder) return;
    try {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng }, language: 'th' }, (results, status) => {
        if (status !== window.google.maps.GeocoderStatus.OK || !results?.[0]) return;
        const label = pickNameFromGeocodeResult(results[0]);
        if (label) updateForm('location', label as any);
      });
    } catch {
      /* ignore */
    }
  };

  const uploadBannerIfNeeded = async (dept: string, code: string, file?: File | null) => {
    if (!file) return form.bannerUrl;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `banners/${dept}/${code}_${Date.now()}.${ext}`;
    const r = ref(storage, path);
    await uploadBytes(r, file);
    return await getDownloadURL(r);
  };

  const deleteBannerIfOwned = async (url?: string | null) => {
    try {
      const path = pathFromStorageUrl(url);
      if (!path) return;
      await deleteObject(ref(storage, path));
    } catch {}
  };

  const handleCreateSubmit = async (mode: 'draft' | 'publish') => {
    try {
      setErrMsg('');
      if (!form.activityName.trim()) return setErrMsg('กรุณากรอกชื่อกิจกรรม');
      if (!form.activityCode.trim()) return setErrMsg('กรุณากรอกรหัสกิจกรรม');

      const code = form.activityCode.trim().toUpperCase();
      const willPublish = mode === 'publish';

      // กันซ้ำ
      const qDup = query(
        collection(db, 'activityQRCodes'),
        where('activityCode', '==', code),
        where('department', '==', currentAdmin.department),
        limit(1)
      );
      const dupSnap = await getDocs(qDup);
      if (!dupSnap.empty) return setErrMsg('รหัสกิจกรรมนี้มีอยู่แล้วในสังกัดของคุณ');

      const lat = typeof form.latitude === 'number' ? form.latitude : undefined;
      const lng = typeof form.longitude === 'number' ? form.longitude : undefined;
      const radius = clamp(Number(form.checkInRadius || 0) || 100, 10, 2000);
      const max = typeof form.maxParticipants === 'number' ? clamp(form.maxParticipants, 0, 1_000_000) : 0;

      // banner
      let bannerUrl: string | undefined;
      let bannerColor: string | undefined;
      if (form.bannerMode === 'image') {
        bannerUrl = await uploadBannerIfNeeded(currentAdmin.department, code, form.bannerFile || null);
      } else if (form.bannerMode === 'color' || form.bannerMode === 'none') {
        bannerColor = (form.bannerColor || '').trim() || undefined;
      }

      // reg code series
      const regEnabled = !!form.regCodeEnabled;
      const regPrefix = String(form.regCodePrefix || '').toUpperCase().trim();
      const regDigits = clamp(Number(form.regCodeDigits || 2), 1, 6);
      const regStart = Math.max(1, Number(form.regCodeStart || 1));
      const regTotal = clamp(Number(form.regCodeTotal || 0), 0, 1_000_000);
      const shouldSaveReg = regEnabled && regPrefix && isValidPrefix(regPrefix) && regTotal > 0;
      if (regEnabled && !shouldSaveReg) {
        return setErrMsg('ตั้งค่ารหัสลงทะเบียนไม่ถูกต้อง (Prefix ต้องเป็น A-Z 1-6 ตัว และจำนวนรวมต้องมากกว่า 0)');
      }

      // Check for overlapping sessions
      if (form.sessions.length > 1) {
        const sortedSessions = [...form.sessions].sort((a, b) => {
          const aStart = a.startDateTime?.valueOf() || 0;
          const bStart = b.startDateTime?.valueOf() || 0;
          return aStart - bStart;
        });
        
        for (let i = 0; i < sortedSessions.length - 1; i++) {
          const curr = sortedSessions[i];
          const next = sortedSessions[i + 1];
          const currEnd = curr.endDateTime?.valueOf() || 0;
          const nextStart = next.startDateTime?.valueOf() || 0;
          
          if (currEnd > nextStart) {
            return setErrMsg(`รอบกิจกรรมย่อยซ้อนทับกัน: "${curr.name}" และ "${next.name}" มีเวลาที่คาบเกี่ยวกัน`);
          }
        }
      }

      const userCode = (form.userCode || '').trim();
      const targetUrl = makeRegisterUrl(code);

      // QR ใช้ short URL เสมอ (กันข้อมูลเยอะเกิน)
      const qrDataUrl = await generateQrPng(makeShortUrl(code), 600);

      setSaving(true);
      setSaveAction(mode);

      // เผยแพร่: ขยายเวลาถ้าหมดอายุแล้ว / บันทึกฉบับร่าง: ไม่บังคับเปิดใช้งาน
      let createStart = form.startDateTime;
      let createEnd = form.endDateTime;
      let createSessions = form.sessions.map((s) => ({ ...s }));
      if (willPublish) {
        const now = dayjs();
        const extendTo = now.add(24, 'hour').startOf('minute');
        if (createEnd && createEnd.isBefore(now)) {
          createEnd = extendTo;
          if (!createStart || createStart.isAfter(extendTo)) createStart = now.startOf('minute');
        }
        if (createSessions.length > 0) {
          const anyOpen = createSessions.some((s) => s.endDateTime && !s.endDateTime.isBefore(now));
          if (!anyOpen) {
            let lastIdx = 0;
            let lastEnd = -Infinity;
            createSessions.forEach((s, i) => {
              const endMs = s.endDateTime?.valueOf() ?? -Infinity;
              if (endMs >= lastEnd) {
                lastEnd = endMs;
                lastIdx = i;
              }
            });
            const last = createSessions[lastIdx];
            createSessions[lastIdx] = {
              ...last,
              startDateTime:
                !last.startDateTime || last.startDateTime.isAfter(extendTo)
                  ? now.startOf('minute')
                  : last.startDateTime,
              endDateTime: extendTo,
            };
            if (!createEnd || createEnd.isBefore(extendTo)) createEnd = extendTo;
          }
        }
      }

      const qrPayload = clean({
        activityCode: code,
        activityName: form.activityName,
        headerTitle: form.headerTitle,
        description: form.description,
        bannerUrl,
        bannerColor,
        bannerTintColor: form.bannerTintColor,
        bannerTintOpacity: form.bannerTintOpacity,
        location: form.location,
        latitude: lat,
        longitude: lng,
        checkInRadius: radius,
        startDateTime: createStart?.toDate(),
        endDateTime: createEnd?.toDate(),
        isActive: willPublish,
        scanEnabled: form.scanEnabled,
        requiresUniversityLogin: form.requiresUniversityLogin,
        singleUserMode: form.singleUserMode,
        maxParticipants: max,
        currentParticipants: 0,
        userCode: userCode || undefined,
        qrUrl: qrDataUrl,
        targetUrl,
        department: currentAdmin.department,

        // ✅ Registration Code Series fields
        registrationCodeEnabled: shouldSaveReg ? true : false,
        registrationCodePrefix: shouldSaveReg ? regPrefix : undefined,
        registrationCodeDigits: shouldSaveReg ? regDigits : undefined,
        registrationCodeStart: shouldSaveReg ? regStart : undefined,
        registrationCodeTotal: shouldSaveReg ? regTotal : undefined,
        registrationCodeNext: shouldSaveReg ? regStart : undefined,
        registrationCodeAssigned: shouldSaveReg ? 0 : undefined,

        dynamicQREnabled: form.dynamicQREnabled,
        onsiteRegistrationPoint: form.onsiteRegistrationPoint.trim() || undefined,

        sessions: createSessions.map(s => ({
          ...s,
          startDateTime: s.startDateTime?.toDate() || null,
          endDateTime: s.endDateTime?.toDate() || null,
          files: s.files || [],
        })),
        surveyConfig: serializeSurveyConfig(form.surveyConfig),
        files: form.files || [],

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await createActivity(qrPayload as any);

      setForm((p) => ({
        ...p,
        targetUrl,
        qrDataUrl,
        bannerUrl,
        bannerColor,
        isActive: willPublish,
        startDateTime: createStart,
        endDateTime: createEnd,
        sessions: createSessions,
        regCodeNext: shouldSaveReg ? regStart : p.regCodeNext,
        regCodeAssigned: shouldSaveReg ? 0 : p.regCodeAssigned,
      }));

      enqueueSnackbar(
        willPublish ? 'เผยแพร่กิจกรรมสำเร็จ' : 'บันทึกฉบับร่างสำเร็จ',
        { variant: 'success' }
      );
      setOpenCreate(false);
      await load();
    } catch (e: any) {
      setErrMsg(e?.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
      setSaveAction(null);
    }
  };

  /* ---------- Edit ---------- */
  const openEditDialog = async (a: Activity) => {
    try {
      setErrMsg('');
      setEditSection('basics');
      setEditActivityId(a.id);
      setQrDocId(null);

      const qQr = query(
        collection(db, 'activityQRCodes'),
        where('activityCode', '==', a.activityCode),
        where('department', '==', currentAdmin.department),
        limit(1)
      );
      const snap = await getDocs(qQr);
      let qr: any = null;
      let qrId: string | null = null;
      if (!snap.empty) {
        const d = snap.docs[0];
        qrId = d.id;
        qr = d.data();
      }
      setQrDocId(qrId);

      const regEnabled = Boolean(qr?.registrationCodeEnabled);
      const regPrefix = String(qr?.registrationCodePrefix || 'CS').toUpperCase();
      const regDigits = typeof qr?.registrationCodeDigits === 'number' ? qr.registrationCodeDigits : 2;
      const regStart = typeof qr?.registrationCodeStart === 'number' ? qr.registrationCodeStart : 1;
      const regTotal = typeof qr?.registrationCodeTotal === 'number' ? qr.registrationCodeTotal : 0;
      const regNext = typeof qr?.registrationCodeNext === 'number' ? qr.registrationCodeNext : regStart;
      const regAssigned = typeof qr?.registrationCodeAssigned === 'number' ? qr.registrationCodeAssigned : 0;

      setForm({
        activityName: a.activityName || qr?.activityName || '',
        activityCode: a.activityCode || '',
        headerTitle: qr?.headerTitle || '',
        description: a.description || qr?.description || '',
        location: a.location || qr?.location || '',
        latitude: qr?.latitude,
        longitude: qr?.longitude,
        checkInRadius: a.checkInRadius ?? qr?.checkInRadius ?? 100,
        startDateTime: a.startDateTime
          ? dayjs(a.startDateTime)
          : qr?.startDateTime
          ? dayjs(qr.startDateTime.toDate?.() ?? qr.startDateTime)
          : dayjs(),
        endDateTime: a.endDateTime
          ? dayjs(a.endDateTime)
          : qr?.endDateTime
          ? dayjs(qr.endDateTime.toDate?.() ?? qr.endDateTime)
          : dayjs().add(2, 'hour'),
        isActive: a.isActive ?? true,
        scanEnabled: qr?.scanEnabled !== false,
        requiresUniversityLogin: qr?.requiresUniversityLogin ?? true,
        singleUserMode: qr?.singleUserMode ?? false,
        maxParticipants: a.maxParticipants || qr?.maxParticipants || undefined,
        targetUrl: makeRegisterUrl(a.activityCode),
        qrDataUrl: a.qrUrl || qr?.qrUrl || '',
        userCode: (a as any).userCode || qr?.userCode || '',
        bannerMode: qr?.bannerUrl ? 'image' : qr?.bannerColor ? 'color' : 'none',
        bannerUrl: a.bannerUrl || qr?.bannerUrl || undefined,
        bannerFile: null,
        bannerColor: qr?.bannerColor || '#0ea5e9',
        bannerTintColor: qr?.bannerTintColor || '#0ea5e9',
        bannerTintOpacity: typeof qr?.bannerTintOpacity === 'number' ? qr.bannerTintOpacity : 0.42,

        // ✅ registration code series
        regCodeEnabled: regEnabled,
        regCodePrefix: regPrefix,
        regCodeDigits: regDigits,
        regCodeStart: regStart,
        regCodeTotal: regTotal,
        regCodeNext: regNext,
        regCodeAssigned: regAssigned,
        
        dynamicQREnabled: a.dynamicQREnabled ?? qr?.dynamicQREnabled ?? false,
        onsiteRegistrationPoint:
          (a as any).onsiteRegistrationPoint ||
          (qr as any)?.onsiteRegistrationPoint ||
          '',

        sessions: a.sessions?.map(s => ({
          ...s,
          startDateTime: toDayjsSafe(s.startDateTime),
          endDateTime: toDayjsSafe(s.endDateTime),
        })) || qr?.sessions?.map((s: any) => ({
          ...s,
          startDateTime: toDayjsSafe(s.startDateTime),
          endDateTime: toDayjsSafe(s.endDateTime),
        })) || [],
        
        surveyConfig: (() => {
          const raw = (a.surveyConfig ?? qr?.surveyConfig ?? { enabled: false, questions: [] }) as any;
          const endFallback = a.endDateTime
            ? dayjs(a.endDateTime)
            : qr?.endDateTime
              ? dayjs(qr.endDateTime.toDate?.() ?? qr.endDateTime)
              : dayjs();
          let openAt = toDayjsSafe(raw.openAt);
          let closeAt = toDayjsSafe(raw.closeAt);
          // กิจกรรมเก่าที่ยังใช้ surveyOpenMinutes
          if (!openAt && !closeAt && raw.surveyOpenMinutes != null) {
            openAt = endFallback;
            closeAt = endFallback.add(Math.max(1, Number(raw.surveyOpenMinutes) || 1440), 'minute');
          }
          if (!openAt) openAt = endFallback;
          if (!closeAt) closeAt = endFallback.add(1, 'day');
          return {
            enabled: !!raw.enabled,
            openAt,
            closeAt,
            sessionEligibility: raw.sessionEligibility || 'any',
            requiredSessionIds: raw.requiredSessionIds || [],
            questions: raw.questions || [],
            forceOpenUntil: raw.forceOpenUntil,
            userForceOpenUntil: raw.userForceOpenUntil,
          };
        })(),
        files: a.files || qr?.files || [],
      });

      setOpenEdit(true);
    } catch (e: any) {
      setErrMsg(e?.message || 'ไม่สามารถเปิดหน้าต่างแก้ไขได้');
    }
  };

  const handleCloseEdit = () => {
    if (!editing) {
      setOpenEdit(false);
      setOpenVersions(false);
    }
  };

  const openVersionsDialog = async () => {
    if (!qrDocId) {
      enqueueSnackbar('ยังไม่มีเอกสารกิจกรรมสำหรับดูประวัติเวอร์ชัน', { variant: 'warning' });
      return;
    }
    setOpenVersions(true);
    setVersionsLoading(true);
    try {
      const list = await listActivityVersions(qrDocId);
      setVersions(list);
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'โหลดประวัติเวอร์ชันไม่สำเร็จ', { variant: 'error' });
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!qrDocId) return;
    const ok = await confirm({
      title: 'ยืนยันย้อนเวอร์ชัน',
      description: 'ระบบจะบันทึกสถานะปัจจุบันเป็นเวอร์ชันใหม่ก่อน แล้วคืนค่าจากเวอร์ชันที่เลือก (จำนวนผู้สมัคร/รหัสที่แจกแล้วจะไม่ถูกย้อน)',
      confirmText: 'ย้อนเวอร์ชัน',
      cancelText: 'ยกเลิก',
    });
    if (!ok) return;

    setRestoringVersionId(versionId);
    try {
      await restoreActivityVersion(qrDocId, versionId, {
        uid: currentAdmin.uid,
        email: currentAdmin.email,
      });
      enqueueSnackbar('ย้อนเวอร์ชันสำเร็จ', { variant: 'success' });
      setOpenVersions(false);
      await openEditDialog({
        id: editActivityId || qrDocId,
        activityCode: form.activityCode,
        activityName: form.activityName,
        department: currentAdmin.department,
        isActive: form.isActive,
      } as Activity);
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'ย้อนเวอร์ชันไม่สำเร็จ', { variant: 'error' });
    } finally {
      setRestoringVersionId(null);
    }
  };

  const handleEditSubmit = async (mode: 'draft' | 'publish') => {
    if (!editActivityId) return;
    try {
      setEditing(true);
      setSaveAction(mode);
      setErrMsg('');

      const willPublish = mode === 'publish';
      const code = form.activityCode.trim().toUpperCase();
      const radius = clamp(Number(form.checkInRadius || 0) || 100, 10, 2000);
      const max = typeof form.maxParticipants === 'number' ? clamp(form.maxParticipants, 0, 1_000_000) : 0;
      const lat = typeof form.latitude === 'number' ? form.latitude : undefined;
      const lng = typeof form.longitude === 'number' ? form.longitude : undefined;

      let newBannerUrl = form.bannerUrl;
      let bannerColor: string | undefined =
        form.bannerMode === 'color' || form.bannerMode === 'none'
          ? (form.bannerColor || '').trim() || undefined
          : undefined;

      if (form.bannerMode === 'image' && form.bannerFile) {
        if (form.bannerUrl) await deleteBannerIfOwned(form.bannerUrl);
        newBannerUrl = await uploadBannerIfNeeded(currentAdmin.department, code, form.bannerFile);
      }
      if (form.bannerMode !== 'image') {
        if (form.bannerUrl) await deleteBannerIfOwned(form.bannerUrl);
        newBannerUrl = undefined;
      }

      // reg series
      const regEnabled = !!form.regCodeEnabled;
      const regPrefix = String(form.regCodePrefix || '').toUpperCase().trim();
      const regDigits = clamp(Number(form.regCodeDigits || 2), 1, 6);
      const regStart = Math.max(1, Number(form.regCodeStart || 1));
      const regTotal = clamp(Number(form.regCodeTotal || 0), 0, 1_000_000);
      const shouldSaveReg = regEnabled && regPrefix && isValidPrefix(regPrefix) && regTotal > 0;
      if (regEnabled && !shouldSaveReg) {
        setEditing(false);
        return setErrMsg('ตั้งค่ารหัสลงทะเบียนไม่ถูกต้อง (Prefix ต้องเป็น A-Z 1-6 ตัว และจำนวนรวมต้องมากกว่า 0)');
      }

      // preserve counters (ไม่รีเซ็ตอัตโนมัติ)
      const regNext = Math.max(regStart, Number(form.regCodeNext || regStart));
      const regAssigned = Math.max(0, Number(form.regCodeAssigned || 0));

      // Check for overlapping sessions
      if (form.sessions.length > 1) {
        const sortedSessions = [...form.sessions].sort((a, b) => {
          const aStart = a.startDateTime?.valueOf() || 0;
          const bStart = b.startDateTime?.valueOf() || 0;
          return aStart - bStart;
        });
        
        for (let i = 0; i < sortedSessions.length - 1; i++) {
          const curr = sortedSessions[i];
          const next = sortedSessions[i + 1];
          const currEnd = curr.endDateTime?.valueOf() || 0;
          const nextStart = next.startDateTime?.valueOf() || 0;
          
          if (currEnd > nextStart) {
            setEditing(false);
            return setErrMsg(`รอบกิจกรรมย่อยซ้อนทับกัน: "${curr.name}" และ "${next.name}" มีเวลาที่คาบเกี่ยวกัน`);
          }
        }
      }

      // เผยแพร่แต่เวลาหมดแล้ว → ขยายอัตโนมัติ 24 ชม. / บันทึกฉบับร่างไม่บังคับขยาย
      const now = dayjs();
      const extendTo = now.add(24, 'hour').startOf('minute');
      let saveStart = form.startDateTime;
      let saveEnd = form.endDateTime;
      let saveSessions = form.sessions.map((s) => ({ ...s }));
      let autoExtended = false;

      if (willPublish) {
        if (saveEnd && saveEnd.isBefore(now)) {
          saveEnd = extendTo;
          if (!saveStart || saveStart.isAfter(extendTo)) saveStart = now.startOf('minute');
          autoExtended = true;
        }

        if (saveSessions.length > 0) {
          const anySessionOpen = saveSessions.some(
            (s) => s.endDateTime && !s.endDateTime.isBefore(now)
          );
          if (!anySessionOpen) {
            let lastIdx = 0;
            let lastEnd = -Infinity;
            saveSessions.forEach((s, i) => {
              const endMs = s.endDateTime?.valueOf() ?? -Infinity;
              if (endMs >= lastEnd) {
                lastEnd = endMs;
                lastIdx = i;
              }
            });
            const last = saveSessions[lastIdx];
            saveSessions[lastIdx] = {
              ...last,
              startDateTime:
                !last.startDateTime || last.startDateTime.isAfter(extendTo)
                  ? now.startOf('minute')
                  : last.startDateTime,
              endDateTime: extendTo,
            };
            if (!saveEnd || saveEnd.isBefore(extendTo)) saveEnd = extendTo;
            autoExtended = true;
          }
        }
      }

      if (autoExtended) {
        setForm((prev) => ({
          ...prev,
          startDateTime: saveStart,
          endDateTime: saveEnd,
          sessions: saveSessions,
        }));
        enqueueSnackbar(
          'ขยายวันสิ้นสุด/รอบกิจกรรมอัตโนมัติ 24 ชม. เพื่อเผยแพร่ได้ — ปรับเวลาได้ในหมวดเวลา/รอบ',
          { variant: 'info' }
        );
      }

      // legacy
      try {
        await updateDoc(
          doc(db, 'activities', editActivityId),
          clean({
            activityName: form.activityName,
            description: form.description || undefined,
            location: form.location,
            startDateTime: saveStart?.toDate(),
            endDateTime: saveEnd?.toDate(),
            checkInRadius: radius,
            maxParticipants: max || 0,
            isActive: willPublish,
            userCode: form.userCode?.trim() || undefined,
            bannerUrl: newBannerUrl || undefined,
            bannerColor: bannerColor || undefined,
            bannerTintColor: form.bannerTintColor || undefined,
            bannerTintOpacity: form.bannerTintOpacity,

            // ✅ mirror reg series
            registrationCodeEnabled: shouldSaveReg ? true : false,
            registrationCodePrefix: shouldSaveReg ? regPrefix : undefined,
            registrationCodeDigits: shouldSaveReg ? regDigits : undefined,
            registrationCodeStart: shouldSaveReg ? regStart : undefined,
            registrationCodeTotal: shouldSaveReg ? regTotal : undefined,

            updatedAt: serverTimestamp(),
          })
        );
      } catch {}

      // primary — เก็บเวอร์ชันก่อนแก้ แล้วอัปเดต
      if (qrDocId) {
        try {
          const curSnap = await getDoc(doc(db, 'activityQRCodes', qrDocId));
          if (curSnap.exists()) {
            await archiveActivityVersion(qrDocId, curSnap.data() as any, {
              savedBy: currentAdmin.uid || currentAdmin.email || 'admin',
              mode: willPublish ? 'publish' : 'draft',
              label: form.activityName || form.activityCode,
            });
          }
        } catch (e) {
          console.warn('archiveActivityVersion failed', e);
        }

        const updates: any = clean({
          activityName: form.activityName,
          headerTitle: form.headerTitle,
          location: form.location,
          latitude: lat,
          longitude: lng,
          checkInRadius: radius,
          startDateTime: saveStart?.toDate(),
          endDateTime: saveEnd?.toDate(),
          isActive: willPublish,
          scanEnabled: form.scanEnabled,
          requiresUniversityLogin: form.requiresUniversityLogin,
          singleUserMode: form.singleUserMode,
          maxParticipants: max || 0,
          userCode: form.userCode?.trim() || undefined,
          bannerUrl: newBannerUrl || undefined,
          bannerColor: bannerColor || undefined,
          bannerTintColor: form.bannerTintColor || undefined,
          bannerTintOpacity: form.bannerTintOpacity,

          // ✅ reg series config
          registrationCodeEnabled: shouldSaveReg ? true : false,
          registrationCodePrefix: shouldSaveReg ? regPrefix : undefined,
          registrationCodeDigits: shouldSaveReg ? regDigits : undefined,
          registrationCodeStart: shouldSaveReg ? regStart : undefined,
          registrationCodeTotal: shouldSaveReg ? regTotal : undefined,

          // keep counters if enabled
          registrationCodeNext: shouldSaveReg ? regNext : undefined,
          registrationCodeAssigned: shouldSaveReg ? regAssigned : undefined,

          dynamicQREnabled: form.dynamicQREnabled,
          onsiteRegistrationPoint: form.onsiteRegistrationPoint.trim() || undefined,

          sessions: saveSessions.map((s) => ({
            ...s,
            startDateTime: s.startDateTime?.toDate() || null,
            endDateTime: s.endDateTime?.toDate() || null,
            files: s.files || [],
          })),
          surveyConfig: serializeSurveyConfig(form.surveyConfig),
          files: form.files || [],

          updatedAt: serverTimestamp(),
          stateVersion: Date.now(),
        });

        if ((form.description ?? '').trim() === '') {
          updates.description = deleteField();
        } else {
          updates.description = form.description.trim();
        }

        if (!shouldSaveReg) {
          updates.registrationCodeEnabled = false;
          updates.registrationCodePrefix = deleteField();
          updates.registrationCodeDigits = deleteField();
          updates.registrationCodeStart = deleteField();
          updates.registrationCodeTotal = deleteField();
          updates.registrationCodeNext = deleteField();
          updates.registrationCodeAssigned = deleteField();
        }

        await updateDoc(doc(db, 'activityQRCodes', qrDocId), updates);
      }

      enqueueSnackbar(
        willPublish ? 'เผยแพร่กิจกรรมสำเร็จ' : 'บันทึกฉบับร่างสำเร็จ',
        { variant: 'success' }
      );
      setOpenEdit(false);
      await load();
    } catch (e: any) {
      setErrMsg(e?.message || 'เกิดข้อผิดพลาดในการบันทึกการแก้ไข');
    } finally {
      setEditing(false);
      setSaveAction(null);
    }
  };

  const handleDeleteActivity = async (a: Activity) => {
    const confirmed = await confirm({
      title: 'ยืนยันลบกิจกรรม',
      description: (
        <>
          ต้องการลบกิจกรรม <b>&quot;{a.activityName}&quot;</b> และ QR ที่เกี่ยวข้องหรือไม่?
          <br /><br />
          การลบนี้ไม่สามารถย้อนกลับได้
        </>
      ),
      confirmText: 'ลบกิจกรรม',
      cancelText: 'ยกเลิก',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      const qQr = query(
        collection(db, 'activityQRCodes'),
        where('activityCode', '==', a.activityCode),
        where('department', '==', currentAdmin.department),
        limit(1)
      );
      const snap = await getDocs(qQr);

      try {
        if (!snap.empty) {
          const qd = snap.docs[0];
          await updateDoc(qd.ref, {
            isActive: false,
            scanEnabled: false,
            forceRefresh: true,
            updatedAt: serverTimestamp(),
          });
        }
      } catch {}

      try {
        await updateDoc(doc(db, 'activities', a.id), { isActive: false, updatedAt: serverTimestamp() });
      } catch {}
      try {
        await deleteDoc(doc(db, 'activities', a.id));
      } catch {}

      if (!snap.empty) {
        const qd = snap.docs[0];
        const qdata = qd.data() as any;
        try {
          if (qdata?.bannerUrl) await deleteBannerIfOwned(qdata.bannerUrl);
        } catch {}
        try {
          await deleteDoc(qd.ref);
        } catch {}
      }
      await load();
      enqueueSnackbar('ลบกิจกรรมสำเร็จ', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar('ลบ/ปิดกิจกรรมไม่สำเร็จ (ตรวจสอบสิทธิ์และ rules)', { variant: 'error' });
    }
  };

  /* ---------- QR / Poster download ---------- */
  const handleDownloadQr = async (size: number) => {
    try {
      if (!dlMenu.activity) return;
      const a = dlMenu.activity;
      const dataUrl = await generateQrPng(makeShortUrl(a.activityCode), size);
      const filename = `QR_${a.activityCode}_${size}.png`;
      downloadDataUrl(dataUrl, filename);
    } finally {
      closeDownloadMenu();
    }
  };

  const handleDownloadPoster = async (variant: PosterVariant) => {
    try {
      if (!dlMenu.activity) return;
      const a = dlMenu.activity;
      const canvas = await buildPosterCanvas(a, variant);
      const filename = `POSTER_${a.activityCode}_${variant}.png`;
      downloadCanvas(canvas, filename);
    } finally {
      closeDownloadMenu();
    }
  };

  /* ---------- Small card preview ---------- */
  const QrPreviewCard: React.FC<{
    title: string;
    code: string;
    qr?: string;
    dept: string;
    when: string;
    place?: string;
    scanEnabled: boolean;
    bannerUrl?: string;
    bannerColor?: string;
  }> = ({ title, code, qr, dept, when, place, scanEnabled, bannerUrl, bannerColor }) => {
    const hasImg = Boolean(bannerUrl);
    const style: React.CSSProperties = hasImg
      ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : bannerColor
      ? { background: bannerColor }
      : { background: 'linear-gradient(135deg,#4f46e5,#06b6d4)' };

    return (
      <div className="w-full overflow-hidden bg-transparent">
        <div className="h-[72px] sm:h-24" style={style} />
        <div className="p-3 sm:p-4">
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">{dept}</span>
            <p className="text-base sm:text-[1.1rem] font-extrabold text-center leading-tight px-1 break-words">
              {title}
            </p>
            <span className="text-xs text-muted-foreground text-center px-1">{when}</span>
            {place && (
              <span className="text-xs text-muted-foreground text-center flex items-center gap-1">
                <PlaceIcon className="h-3 w-3" />
                {place}
              </span>
            )}
            <div className="mt-2 p-1.5 sm:p-2 rounded-lg border border-dashed border-border relative w-[min(200px,70vw)] aspect-square">
              {qr ? (
                <img src={qr} alt="QR" className="w-full h-full block" />
              ) : (
                <div className="w-full h-full bg-muted rounded" />
              )}
              {!scanEnabled && (
                <div className="absolute inset-0 rounded-lg grid place-items-center p-2 bg-white/[.65] dark:bg-black/[.55]">
                  <Badge variant="warning">ปิดการสแกนชั่วคราว</Badge>
                </div>
              )}
            </div>
            <Badge variant="secondary" className="font-mono max-w-full">{code}</Badge>
          </div>
        </div>
      </div>
    );
  };

  const MainActivityFilesSection = () => {
    return (
      <div className="col-span-12">
        <Separator className="my-2" />
        <FileConfigSection
          title="เอกสาร/ไฟล์แนบ/ข้อความ สำหรับกิจกรรมหลัก"
          files={form.files || []}
          onChange={(newFiles) => updateForm('files', newFiles as any)}
          activityCode={form.activityCode}
          department={currentAdmin.department}
        />
      </div>
    );
  };

  const SessionsSection = () => {
    return (
      <div className="col-span-12">
        <Separator className="my-2" />
        <p className="mb-2 text-sm font-medium">
          กิจกรรมย่อย / รอบกิจกรรม (Sessions)
        </p>
        <div className="flex flex-col gap-4">
          {form.sessions.map((s, i) => (
            <Card key={s.id} className="border-border">
              <CardContent className="py-3 px-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-4 flex flex-col gap-1.5">
                    <Label className="text-xs">ชื่อกิจกรรมย่อย</Label>
                    <Input
                      value={s.name}
                      onChange={(e) => {
                        const newSessions = [...form.sessions];
                        newSessions[i].name = e.target.value;
                        updateForm('sessions', newSessions as any);
                      }}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'inherit', colorPrimary: '#0f172a', borderRadius: 4 } }}>
                      <DatePicker
                        showTime
                        placeholder="เริ่ม"
                        style={{ width: '100%', height: '40px' }}
                        format="DD/MM/YYYY HH:mm"
                        value={s.startDateTime}
                        onChange={(val: any) => {
                          const newSessions = [...form.sessions];
                          newSessions[i].startDateTime = val;
                          updateForm('sessions', newSessions as any);
                        }}
                        getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
                      />
                    </ConfigProvider>
                  </div>
                  <div className="md:col-span-3">
                    <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'inherit', colorPrimary: '#0f172a', borderRadius: 4 } }}>
                      <DatePicker
                        showTime
                        placeholder="สิ้นสุด"
                        style={{ width: '100%', height: '40px' }}
                        format="DD/MM/YYYY HH:mm"
                        value={s.endDateTime}
                        onChange={(val: any) => {
                          const newSessions = [...form.sessions];
                          newSessions[i].endDateTime = val;
                          updateForm('sessions', newSessions as any);
                        }}
                        getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
                      />
                    </ConfigProvider>
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        const newSessions = form.sessions.filter((_, idx) => idx !== i);
                        updateForm('sessions', newSessions as any);
                      }}
                    >
                      <DeleteIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="md:col-span-12">
                    <FileConfigSection
                      title="เอกสาร/ไฟล์แนบสำหรับกิจกรรมย่อยนี้"
                      files={s.files || []}
                      onChange={(newFiles) => {
                        const newSessions = [...form.sessions];
                        newSessions[i].files = newFiles;
                        updateForm('sessions', newSessions as any);
                      }}
                      activityCode={form.activityCode}
                      department={currentAdmin.department}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button
            variant="outline"
            className="gap-2 self-start"
            onClick={() => {
              updateForm('sessions', [
                ...form.sessions,
                { id: Date.now().toString(), name: '', startDateTime: null, endDateTime: null }
              ] as any);
            }}
          >
            <AddIcon className="h-4 w-4" /> เพิ่มรอบกิจกรรมย่อย
          </Button>
        </div>
      </div>
    );
  };

  const SurveyConfigSection = () => {
    return (
      <div className="col-span-12">
        <Separator className="my-2" />
        <div className="flex flex-row items-center justify-between mb-2">
          <p className="text-sm font-medium">แบบประเมินเมื่อสิ้นสุดกิจกรรม (Survey)</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={form.surveyConfig.enabled}
              onCheckedChange={(checked) => {
                const enabled = checked;
                const openAt = form.surveyConfig.openAt || form.endDateTime || dayjs();
                const closeAt =
                  form.surveyConfig.closeAt ||
                  (openAt ? openAt.add(1, 'day') : dayjs().add(1, 'day'));
                updateForm('surveyConfig', {
                  ...form.surveyConfig,
                  enabled,
                  openAt,
                  closeAt,
                } as any);
              }}
            />
            <span className="text-sm">เปิดใช้งาน</span>
          </label>
        </div>

        {form.surveyConfig.enabled && (
          <div className="flex flex-col gap-4">
            {/* วันเวลาเปิด–ปิดแบบประเมิน */}
            <p className="text-sm font-semibold">
              ช่วงเวลาเปิด–ปิดแบบประเมิน
            </p>
            <span className="block -mt-3 text-xs text-muted-foreground">
              กำหนดวันและเวลาที่ผู้ใช้สามารถเข้าทำแบบประเมินได้โดยตรง
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'inherit', colorPrimary: '#0f172a', borderRadius: 4 } }}>
                  <DatePicker
                    showTime
                    placeholder="วันเวลาที่เปิด"
                    style={{ width: '100%', height: '48px' }}
                    format="DD/MM/YYYY HH:mm"
                    value={form.surveyConfig.openAt}
                    onChange={(value: any) =>
                      updateForm('surveyConfig', { ...form.surveyConfig, openAt: value } as any)
                    }
                    getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
                  />
                </ConfigProvider>
              </div>
              <div>
                <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'inherit', colorPrimary: '#0f172a', borderRadius: 4 } }}>
                  <DatePicker
                    showTime
                    placeholder="วันเวลาที่ปิด"
                    style={{ width: '100%', height: '48px' }}
                    format="DD/MM/YYYY HH:mm"
                    value={form.surveyConfig.closeAt}
                    onChange={(value: any) =>
                      updateForm('surveyConfig', { ...form.surveyConfig, closeAt: value } as any)
                    }
                    getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
                  />
                </ConfigProvider>
              </div>
            </div>
            {form.surveyConfig.openAt &&
              form.surveyConfig.closeAt &&
              form.surveyConfig.closeAt.isBefore(form.surveyConfig.openAt) && (
                <Alert variant="warning">
                  <AlertDescription>เวลาปิดต้องอยู่หลังเวลาเปิด</AlertDescription>
                </Alert>
              )}
            {/* เงื่อนไขการเข้าถึงแบบประเมิน */}
            <div>
              <p className="mb-2 text-sm font-semibold">เงื่อนไขการเข้าถึงแบบประเมิน</p>
              <span className="block mb-3 text-xs text-muted-foreground">
                กำหนดว่าผู้ใช้ต้องเช็กอินกิจกรรมย่อยใดบ้าง จึงจะมีสิทธิ์ทำแบบประเมิน
              </span>
              <RadioGroup
                value={(form.surveyConfig as any).sessionEligibility || 'any'}
                onValueChange={(v) => updateForm('surveyConfig', { ...form.surveyConfig, sessionEligibility: v } as any)}
                className="gap-2"
              >
                {(['any', 'all', 'specific'] as const).map((mode) => (
                  <label key={mode} className="flex items-center gap-2 cursor-pointer text-sm">
                    <RadioGroupItem value={mode} />
                    <span>
                      {mode === 'any' ? 'เช็กอินอย่างน้อย 1 กิจกรรมย่อย (ค่าเริ่มต้น)'
                        : mode === 'all' ? 'ต้องเช็กอินครบทุกกิจกรรมย่อย'
                        : 'กำหนดเองว่าต้องเช็กอินกิจกรรมย่อยใดบ้าง'}
                    </span>
                  </label>
                ))}
              </RadioGroup>

              {/* Checkbox list เมื่อเลือก specific */}
              {(form.surveyConfig as any).sessionEligibility === 'specific' && (
                <div className="mt-3 pl-4 border-l-[3px] border-primary">
                  {form.sessions.length === 0 ? (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      ยังไม่มีกิจกรรมย่อย กรุณาเพิ่มรอบกิจกรรมย่อยก่อน
                    </span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <span className="mb-1 text-xs text-muted-foreground">
                        เลือกกิจกรรมย่อยที่ต้องเช็กอิน (เลือกได้หลายอัน):
                      </span>
                      {form.sessions.map((s) => {
                        const rid = (form.surveyConfig as any).requiredSessionIds ?? [];
                        const checked = rid.includes(s.id);
                        return (
                          <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => {
                                const current: string[] = [...((form.surveyConfig as any).requiredSessionIds ?? [])];
                                const next = c
                                  ? [...current, s.id]
                                  : current.filter((id) => id !== s.id);
                                updateForm('surveyConfig', { ...form.surveyConfig, requiredSessionIds: next } as any);
                              }}
                            />
                            <span>{s.name || `รอบ ${s.id}`}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {form.surveyConfig.questions.map((q, i) => (
              <Card key={q.id} className="border-border">
                <CardContent className="py-3 px-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-6 flex flex-col gap-1.5">
                      <Label className="text-xs">คำถาม</Label>
                      <Input
                        value={q.question}
                        onChange={(e) => {
                          const newQs = [...form.surveyConfig.questions];
                          newQs[i].question = e.target.value;
                          updateForm('surveyConfig', { ...form.surveyConfig, questions: newQs } as any);
                        }}
                      />
                    </div>
                    <div className="md:col-span-3 flex flex-col gap-1.5">
                      <Label className="text-xs">ประเภท</Label>
                      <Select
                        value={q.type}
                        onValueChange={(v) => {
                          const newQs = [...form.surveyConfig.questions];
                          newQs[i].type = v as any;
                          updateForm('surveyConfig', { ...form.surveyConfig, questions: newQs } as any);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">ข้อความ</SelectItem>
                          <SelectItem value="choice">ตัวเลือก</SelectItem>
                          <SelectItem value="rating">ให้ดาว (1-5)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <Switch
                          checked={q.required || false}
                          onCheckedChange={(checked) => {
                            const newQs = [...form.surveyConfig.questions];
                            newQs[i].required = checked;
                            updateForm('surveyConfig', { ...form.surveyConfig, questions: newQs } as any);
                          }}
                        />
                        <span>จำเป็น</span>
                      </label>
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          const newQs = form.surveyConfig.questions.filter((_, idx) => idx !== i);
                          updateForm('surveyConfig', { ...form.surveyConfig, questions: newQs } as any);
                        }}
                      >
                        <DeleteIcon className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Options for Text validation type */}
                    {q.type === 'text' && (
                      <div className="md:col-span-12">
                        <div className="p-3 bg-muted/50 rounded-lg border border-dashed border-border">
                          <span className="block mb-2 text-xs font-bold text-muted-foreground">
                            เงื่อนไขความถูกต้องของคำตอบ (Validation)
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                            <div className="sm:col-span-3 flex flex-col gap-1.5">
                              <Label className="text-xs">ประเภทข้อมูล</Label>
                              <Select
                                value={q.validationType || 'any'}
                                onValueChange={(v) => {
                                  const newQs = [...form.surveyConfig.questions];
                                  newQs[i] = { ...newQs[i], validationType: v as any };
                                  updateForm('surveyConfig', { ...form.surveyConfig, questions: newQs } as any);
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="any">ทั่วไป (ใดๆ)</SelectItem>
                                  <SelectItem value="number">ตัวเลขเท่านั้น</SelectItem>
                                  <SelectItem value="thai">ภาษาไทยเท่านั้น</SelectItem>
                                  <SelectItem value="english">ภาษาอังกฤษเท่านั้น</SelectItem>
                                  <SelectItem value="email">รูปแบบอีเมล</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="sm:col-span-3 flex flex-col gap-1.5">
                              <Label className="text-xs">มีคำขึ้นต้น (Prefix)</Label>
                              <Input
                                value={q.prefix || ''}
                                onChange={(e) => {
                                  const newQs = [...form.surveyConfig.questions];
                                  newQs[i] = { ...newQs[i], prefix: e.target.value };
                                  updateForm('surveyConfig', { ...form.surveyConfig, questions: newQs } as any);
                                }}
                                placeholder="เช่น 6 หรือ 08"
                              />
                            </div>
                            <div className="sm:col-span-3 flex flex-col gap-1.5">
                              <Label className="text-xs">มีคำลงท้าย (Postfix)</Label>
                              <Input
                                value={q.postfix || ''}
                                onChange={(e) => {
                                  const newQs = [...form.surveyConfig.questions];
                                  newQs[i] = { ...newQs[i], postfix: e.target.value };
                                  updateForm('surveyConfig', { ...form.surveyConfig, questions: newQs } as any);
                                }}
                                placeholder="เช่น .txt"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <label className="flex items-center gap-2 cursor-pointer text-sm">
                                <Switch
                                  checked={q.allowSpaces !== false}
                                  disabled={q.validationType === 'email' || q.validationType === 'number'}
                                  onCheckedChange={(checked) => {
                                    const newQs = [...form.surveyConfig.questions];
                                    newQs[i] = { ...newQs[i], allowSpaces: checked };
                                    updateForm('surveyConfig', { ...form.surveyConfig, questions: newQs } as any);
                                  }}
                                />
                                <span>อนุญาตเว้นวรรค</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Options for Choice type */}
                    {q.type === 'choice' && (
                      <div className="md:col-span-12">
                        <div className="flex flex-col gap-2">
                          {(q.options || []).map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-end gap-2">
                              <div className="flex-1 flex flex-col gap-1.5">
                                <Label className="text-xs">{`ตัวเลือกที่ ${optIdx + 1}`}</Label>
                                <Input
                                  value={opt}
                                  onChange={(e) => {
                                    const newQs = [...form.surveyConfig.questions];
                                    const newOpts = [...(newQs[i].options || [])];
                                    newOpts[optIdx] = e.target.value;
                                    newQs[i].options = newOpts;
                                    updateForm('surveyConfig', { ...form.surveyConfig, questions: newQs } as any);
                                  }}
                                />
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => {
                                  const newQs = [...form.surveyConfig.questions];
                                  const newOpts = [...(newQs[i].options || [])];
                                  newOpts.splice(optIdx, 1);
                                  newQs[i].options = newOpts;
                                  updateForm('surveyConfig', { ...form.surveyConfig, questions: newQs } as any);
                                }}
                              >
                                <DeleteIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 self-start"
                            onClick={() => {
                              const newQs = [...form.surveyConfig.questions];
                              const newOpts = [...(newQs[i].options || [])];
                              newOpts.push('');
                              newQs[i].options = newOpts;
                              updateForm('surveyConfig', { ...form.surveyConfig, questions: newQs } as any);
                            }}
                          >
                            <AddIcon className="h-4 w-4" /> เพิ่มตัวเลือก
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button
              variant="outline"
              className="gap-2 self-start"
              onClick={() => {
                updateForm('surveyConfig', {
                  ...form.surveyConfig,
                  questions: [
                    ...form.surveyConfig.questions,
                    { id: Date.now().toString(), type: 'text', question: '', required: false }
                  ]
                } as any);
              }}
            >
              <AddIcon className="h-4 w-4" /> เพิ่มคำถาม
            </Button>
          </div>
        )}
      </div>
    );
  };


  const RegistrationSeriesSection = () => {
    const enabled = !!form.regCodeEnabled;
    const invalidPrefix = enabled && !!form.regCodePrefix && !isValidPrefix(form.regCodePrefix);
    const invalidTotal = enabled && Number(form.regCodeTotal || 0) <= 0;

    const remaining =
      enabled && Number(form.regCodeTotal || 0) > 0
        ? Math.max(0, Number(form.regCodeTotal) - Number(form.regCodeAssigned || 0))
        : 0;

    return (
      <div className="col-span-12">
        <Separator className="my-2" />
        <p className="mb-2 text-sm font-medium">
          รหัสลงทะเบียน (เช่น CS01 - CS92)
        </p>

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Switch checked={enabled} onCheckedChange={(checked) => updateForm('regCodeEnabled', checked as any)} />
            <span>เปิดใช้รหัสลงทะเบียนแบบ Prefix + เลขรัน</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-4 flex flex-col gap-1.5">
              <Label className="text-xs">Prefix (ตัวอักษร)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                  <BadgeIcon className="h-4 w-4" />
                </span>
                <Input
                  className={`pl-9 ${invalidPrefix ? 'border-destructive' : ''}`}
                  value={form.regCodePrefix}
                  onChange={(e) => updateForm('regCodePrefix', e.target.value.toUpperCase() as any)}
                  disabled={!enabled}
                />
              </div>
              <p className={`text-xs ${invalidPrefix ? 'text-destructive' : 'text-muted-foreground'}`}>A-Z 1-6 ตัว เช่น CS</p>
            </div>

            <div className="sm:col-span-4 flex flex-col gap-1.5">
              <Label className="text-xs">จำนวนหลักของเลข</Label>
              <Input
                type="number"
                min={1}
                max={6}
                value={form.regCodeDigits}
                onChange={(e) => updateForm('regCodeDigits', Number(e.target.value) as any)}
                disabled={!enabled}
              />
              <p className="text-xs text-muted-foreground">เช่น 2 -&gt; 01</p>
            </div>

            <div className="sm:col-span-4 flex flex-col gap-1.5">
              <Label className="text-xs">เริ่มที่เลข</Label>
              <Input
                type="number"
                min={1}
                max={1_000_000}
                value={form.regCodeStart}
                onChange={(e) => updateForm('regCodeStart', Number(e.target.value) as any)}
                disabled={!enabled}
              />
              <p className="text-xs text-muted-foreground">เช่น 1 -&gt; CS01</p>
            </div>

            <div className="sm:col-span-6 flex flex-col gap-1.5">
              <Label className="text-xs">จำนวนรหัสทั้งหมด</Label>
              <Input
                type="number"
                min={0}
                max={1_000_000}
                className={invalidTotal ? 'border-destructive' : ''}
                value={form.regCodeTotal}
                onChange={(e) => updateForm('regCodeTotal', Number(e.target.value) as any)}
                disabled={!enabled}
              />
              <p className={`text-xs ${invalidTotal ? 'text-destructive' : 'text-muted-foreground'}`}>เช่น 92 -&gt; CS01..CS92</p>
            </div>

            <div className="sm:col-span-6">
              <Card className="h-full border-border">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">
                    ช่วงรหัสที่จะเปิดให้แจก
                  </p>
                  <p className="mt-1 text-lg font-extrabold">
                    {enabled
                      ? regRangeText(form.regCodePrefix, form.regCodeStart, form.regCodeTotal, form.regCodeDigits)
                      : '-'}
                  </p>

                  <Separator className="my-2" />

                  <p className="text-sm text-muted-foreground">
                    สถานะการแจก (ระบบจะอัปเดตเมื่อมีการลงทะเบียนจริง)
                  </p>
                  <div className="mt-2 flex flex-row flex-wrap gap-2">
                    <Badge variant="secondary">{`แจกแล้ว: ${Number(form.regCodeAssigned || 0)}`}</Badge>
                    <Badge variant="secondary">{`คงเหลือ: ${remaining}`}</Badge>
                    <Badge variant="secondary">
                      {enabled && isValidPrefix(form.regCodePrefix) && Number(form.regCodeTotal || 0) > 0
                        ? `ถัดไป: ${formatRegCode(form.regCodePrefix, Number(form.regCodeNext || form.regCodeStart || 1), clamp(Number(form.regCodeDigits || 2), 1, 6))}`
                        : 'ถัดไป: -'}
                    </Badge>
                  </div>

                  <span className="block mt-2 text-xs text-muted-foreground">
                    หมายเหตุ: การแจกเลขต้องทำใน flow ลงทะเบียน (แนะนำให้ใช้ Firestore transaction เพื่อกันเลขซ้ำ)
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ===================== Render ===================== */
  return (
    <div className="space-y-4 sm:space-y-6 relative w-full min-w-0">
      <PageHeader
        title="จัดการ QR Code & กิจกรรม"
        subtitle={
          <span className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-2 gap-y-0.5">
            <span>สังกัด: {deptLabelOf(currentAdmin.department)}</span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-600">|</span>
            <span className="truncate max-w-full sm:max-w-[min(420px,60vw)]" title={getBaseUrl()}>
              ฐาน: {getBaseUrl()}
            </span>
          </span>
        }
        icon={<QrCodeIcon className="h-6 w-6" />}
        actions={
          <div className="flex flex-col xs:flex-row sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden self-start">
              <button
                type="button"
                title="มุมมองการ์ด"
                onClick={() => setView('cards')}
                className={`px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
                  view === 'cards'
                    ? 'bg-primary text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <GridIcon className="h-4 w-4" />
                <span className="hidden sm:inline">การ์ด</span>
              </button>
              <button
                type="button"
                title="มุมมองตาราง"
                onClick={() => setView('table')}
                className={`px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 transition-colors ${
                  view === 'table'
                    ? 'bg-primary text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <TableIcon className="h-4 w-4" />
                <span className="hidden sm:inline">ตาราง</span>
              </button>
            </div>
            <Button
              className="gap-2 w-full sm:w-auto whitespace-nowrap"
              onClick={handleOpenCreate}
            >
              <AddIcon className="h-4 w-4" /> สร้างกิจกรรมใหม่
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card className="border-border rounded-2xl">
          <CardContent className="text-center py-4 sm:py-5">
            <p className="text-primary font-extrabold text-[1.75rem] sm:text-[2.125rem]">
              {activeCount}
            </p>
            <p className="text-muted-foreground text-xs sm:text-sm">
              เปิดอยู่
            </p>
          </CardContent>
        </Card>
        <Card className="border-border rounded-2xl">
          <CardContent className="text-center py-4 sm:py-5">
            <p className="text-emerald-600 dark:text-emerald-400 font-extrabold text-[1.75rem] sm:text-[2.125rem]">
              {activities.length}
            </p>
            <p className="text-muted-foreground text-xs sm:text-sm">
              ทั้งหมด
            </p>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <Card className="border-border rounded-2xl overflow-hidden">
        <CardContent className="p-3 sm:p-4 md:p-6">
          {loading ? (
            <div className="text-center py-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-10 sm:py-12 px-2">
              <QrCodeIcon className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/40" />
              <p className="mt-2 text-muted-foreground">ยังไม่มีกิจกรรม</p>
              <Button className="mt-4 gap-2" onClick={handleOpenCreate}>
                <AddIcon className="h-4 w-4" /> สร้างกิจกรรมใหม่
              </Button>
            </div>
          ) : view === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
              {activities.map((a) => {
                const st = statusOf(a);
                const when = `${fmt(a.startDateTime)} - ${fmt(a.endDateTime)}`;
                const bannerColor = (a as any).bannerColor as string | undefined;

                return (
                  <div
                    key={a.id}
                    className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm"
                  >
                    <QrPreviewCard
                      title={a.activityName || 'กิจกรรม'}
                      code={a.activityCode}
                      qr={a.qrUrl}
                      dept={deptLabelOf((a as any).department ?? currentAdmin.department)}
                      when={when}
                      place={(a as any).location || ''}
                      scanEnabled={true}
                      bannerUrl={(a as any).bannerUrl}
                      bannerColor={bannerColor}
                    />

                    <div className="px-3 pb-3 pt-1 space-y-2 border-t border-slate-100 dark:border-slate-800 mt-auto">
                      <div className="flex justify-center">
                        <Badge variant={st.color === 'default' ? 'secondary' : st.color}>{st.label}</Badge>
                      </div>

                      {st.label === 'สิ้นสุดแล้ว' ? (
                        <Button
                          size="sm"
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleReopenEnded(a)}
                        >
                          เปิดใหม่อีกครั้ง
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className={`w-full ${a.isActive ? 'border-amber-500/60 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                          variant={a.isActive ? 'outline' : 'default'}
                          onClick={() => handleToggle(a)}
                        >
                          {a.isActive ? 'ยกเลิกเผยแพร่' : 'เผยแพร่'}
                        </Button>
                      )}

                      {/* ปุ่มจัดการ — ห่อได้บนมือถือ ไม่ล้นจอ */}
                      <TooltipProvider>
                        <div className="flex flex-wrap justify-center gap-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 border border-border text-primary" onClick={() => openEditDialog(a)}>
                                <EditIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>แก้ไข</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 border border-border" onClick={(e) => openDownloadMenu(e, a)}>
                                <DownloadIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>ดาวน์โหลด</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 border border-border text-blue-600 dark:text-blue-400"
                                onClick={() => window.open(`/admin/records?activity=${encodeURIComponent(a.activityCode)}`, '_blank')}
                              >
                                <PeopleIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>รายชื่อผู้ลงทะเบียน</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 border border-border text-blue-600 dark:text-blue-400" onClick={() => window.open(makeRegisterUrl(a.activityCode), '_blank')}>
                                <ViewIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>ดูหน้าลงทะเบียน</TooltipContent>
                          </Tooltip>
                          {a.dynamicQREnabled && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 border border-border"
                                  onClick={() => window.open(`/admin/dynamic-qr/${a.activityCode}`, '_blank')}
                                >
                                  <MonitorPlay className="h-[18px] w-[18px]" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>เปิดหน้าจอ Dynamic QR</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 border border-border text-destructive" onClick={() => handleDeleteActivity(a)}>
                                <DeleteIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>ลบ</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="min-w-0 -mx-1.5 sm:mx-0">
              <ActivityTable
                activities={activities}
                onToggleStatus={handleToggle}
                onReopenEnded={handleReopenEnded}
                onEdit={openEditDialog}
                onDelete={handleDeleteActivity}
                onDownload={openDownloadMenu}
                onViewParticipants={(code) => window.open(`/admin/records?activity=${encodeURIComponent(code)}`, '_blank')}
                onViewRegistration={(code) => window.open(makeRegisterUrl(code), '_blank')}
                isSuperAdmin={currentAdmin.role === 'super_admin'}
                currentDept={currentAdmin.department}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====== เมนูดาวน์โหลด ====== */}
      <DropdownMenu open={Boolean(dlMenu.anchorEl)} onOpenChange={(o) => { if (!o) closeDownloadMenu(); }}>
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden
            style={{
              position: 'fixed',
              width: 0,
              height: 0,
              ...(dlMenu.anchorEl
                ? (() => {
                    const r = dlMenu.anchorEl.getBoundingClientRect();
                    return { left: r.left, top: r.bottom };
                  })()
                : { left: 0, top: 0 }),
            }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handleDownloadQr(512)}>
            <DownloadIcon className="h-4 w-4" /> QR PNG (512px)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDownloadQr(1024)}>
            <DownloadIcon className="h-4 w-4" /> QR PNG (1024px)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDownloadQr(2048)}>
            <DownloadIcon className="h-4 w-4" /> QR PNG (2048px)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleDownloadPoster('square')}>
            <ImageIcon className="h-4 w-4" /> โปสเตอร์ (สี่เหลี่ยมแนวตั้ง)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDownloadPoster('a4')}>
            <ImageIcon className="h-4 w-4" /> โปสเตอร์ (A4)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ===================== Create Dialog ===================== */}
      <Dialog open={openCreate} onOpenChange={(o) => { if (!o) handleCloseCreate(); }}>
        <DialogContent className="!fixed !inset-0 !left-0 !top-0 z-50 !flex !h-[100dvh] !w-screen !max-h-none !max-w-none !flex-col !translate-x-0 !translate-y-0 !rounded-none !border-0 !p-0 !gap-0 overflow-hidden [&>button]:hidden">
          <div className="z-20 flex w-full shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-3 sm:px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <Button size="icon" variant="ghost" onClick={handleCloseCreate} aria-label="close" className="shrink-0">
                <CloseIcon className="h-5 w-5" />
              </Button>
              <DialogTitle className="truncate font-semibold text-[0.95rem] sm:text-[1.15rem]">
                สร้างกิจกรรม & QR Code
              </DialogTitle>
            </div>
            <div className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  const code = form.activityCode.trim();
                  const url = code ? makeShortUrl(code) : '';
                  const data = url ? await generateQrPng(url, 600) : '';
                  updateForm('qrDataUrl', data as any);
                  setOpenPreview(true);
                }}
                disabled={saving}
              >
                <PreviewIcon className="h-4 w-4" />
                <span className="hidden sm:inline">พรีวิว</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 whitespace-nowrap"
                onClick={() => handleCreateSubmit('draft')}
                disabled={saving}
              >
                {saving && saveAction === 'draft' ? <Spinner size="sm" /> : null}
                <span className="hidden sm:inline">บันทึกข้อมูล</span>
                <span className="inline sm:hidden">บันทึก</span>
              </Button>
              <Button
                size="sm"
                className="gap-2 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleCreateSubmit('publish')}
                disabled={saving}
              >
                {saving && saveAction === 'publish' ? <Spinner size="sm" /> : <AddIcon className="h-4 w-4" />}
                เผยแพร่
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-muted/40 p-3 sm:p-4 md:p-8">
            <div className="mx-auto max-w-3xl">
              <div className="p-4 md:p-8 rounded-2xl border border-border bg-background">
          {errMsg && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{errMsg}</AlertDescription>
            </Alert>
          )}

          <>
            <div className="grid grid-cols-12 gap-4">
              {/* สังกัด */}
              <div className="col-span-12">
                <div className="flex flex-row items-center gap-2">
                  <span className="text-sm text-muted-foreground">สังกัดที่จะบันทึก:</span>
                  <Badge variant="outline" className="border-primary text-primary">{deptLabelOf(currentAdmin.department)}</Badge>
                </div>
              </div>

              {/* ชื่อ/รหัสกิจกรรม + สุ่ม/คัดลอก */}
              <div className="col-span-12 md:col-span-8 flex flex-col gap-1.5">
                <Label>ชื่อกิจกรรม *</Label>
                <Input
                  value={form.activityName}
                  onChange={(e) => updateForm('activityName', e.target.value as any)}
                />
              </div>

              <div className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                <Label>รหัสกิจกรรม *</Label>
                <div className="flex flex-row items-center gap-2">
                  <Input
                    value={form.activityCode}
                    maxLength={64}
                    onChange={(e) => updateForm('activityCode', e.target.value.toUpperCase() as any)}
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="shrink-0" onClick={() => updateForm('activityCode', randomActivityCode() as any)}>
                          <ShuffleIcon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>สุ่ม</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="shrink-0"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(form.activityCode);
                            } catch {}
                          }}
                        >
                          <CopyIcon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>คัดลอก</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* ส่วนหัว */}
              <div className="col-span-12 md:col-span-8 flex flex-col gap-1.5">
                <Label>ส่วนหัว (จะแสดงบนหน้าลงทะเบียน)</Label>
                <Input
                  value={form.headerTitle}
                  onChange={(e) => updateForm('headerTitle', e.target.value as any)}
                  placeholder="เช่น ลงทะเบียนกิจกรรม Orientation"
                />
              </div>

              {/* โหมดแบนเนอร์ */}
              <div className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                <Label>โหมดแบนเนอร์</Label>
                <Select
                  value={form.bannerMode}
                  onValueChange={(v) => updateForm('bannerMode', v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ไม่ใช้ (แสดงเป็นสี)</SelectItem>
                    <SelectItem value="image">รูปภาพ</SelectItem>
                    <SelectItem value="color">สี/Gradient</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* แบนเนอร์ตามโหมด */}
              {form.bannerMode === 'image' && (
                <div className="col-span-12">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <Button asChild variant="outline" className="gap-2 cursor-pointer">
                      <label>
                        <ImageIcon className="h-4 w-4" />
                        เลือกรูปส่วนหัว
                        <input
                          hidden
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            updateForm('bannerFile', file as any);
                            if (file) updateForm('bannerUrl', URL.createObjectURL(file) as any);
                          }}
                        />
                      </label>
                    </Button>

                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        if (form.activityName.trim()) {
                          setMagnificPrompt(`A beautiful premium promotional banner for university activity: ${form.activityName.trim()}`);
                        } else {
                          setMagnificPrompt('A beautiful premium modern abstract banner for a university science activity');
                        }
                        setMagnificRatio('widescreen_16_9');
                        setMagnificOpen(true);
                      }}
                    >
                      <SparklesIcon className="h-4 w-4" />
                      สร้างรูปด้วย Magnific AI
                    </Button>


                    {form.bannerUrl && (
                      <div className="flex flex-row items-center gap-2">
                        <img src={form.bannerUrl} alt="banner-preview" style={{ height: 60, borderRadius: 8 }} />
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={upscaling}
                          onClick={handleUpscaleBanner}
                        >
                          {upscaling ? <Spinner size="sm" /> : <SparklesIcon className="h-4 w-4" />}
                          {upscaling ? 'กำลังปรับความคมชัด...' : 'เพิ่มความคมชัด (AI Upscale)'}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            updateForm('bannerUrl', undefined as any);
                            updateForm('bannerFile', null as any);
                          }}
                        >
                          <ClearIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {upscaleError && (
                    <span className="block mt-1 text-xs text-destructive">
                      {upscaleError}
                    </span>
                  )}
                </div>
              )}

              {(form.bannerMode === 'color' || form.bannerMode === 'none') && (
                <div className="col-span-12">
                  <ColorPickerField
                    label="สีแบนเนอร์"
                    value={form.bannerColor}
                    onChange={(v) => updateForm('bannerColor', v as any)}
                    placeholder="#0ea5e9 หรือเลือกโหมดไล่สี"
                    allowCssGradient
                  />
                </div>
              )}

              {/* สีทับ + ความทึบ */}
              <div className="col-span-12 md:col-span-7">
                <ColorPickerField
                  label="สีทับ (Tint) — ทับบนรูป / สีหลัก"
                  value={form.bannerTintColor}
                  onChange={(v) => updateForm('bannerTintColor', v as any)}
                  placeholder="#0ea5e9"
                />
              </div>

              <div className="col-span-12 md:col-span-5">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold">
                    ความทึบของสีทับ: {(form.bannerTintOpacity * 100).toFixed(0)}%
                  </p>
                  <input
                    type="range"
                    className="w-full accent-primary"
                    value={Math.round(form.bannerTintOpacity * 100)}
                    onChange={(e) => {
                      const pct = Number(e.target.value);
                      updateForm('bannerTintOpacity', (Math.max(0, Math.min(100, pct)) / 100) as any);
                    }}
                    step={1}
                    min={0}
                    max={100}
                  />
                </div>
              </div>

              {/* คำอธิบาย/สถานที่ */}
              <div className="col-span-12">
                <p className="mb-2 text-sm text-muted-foreground font-medium">
                  รายละเอียดกิจกรรม (คำอธิบาย)
                </p>
                <QuillEditor
                  value={form.description}
                  onChange={(val) => updateForm('description', val as any)}
                  placeholder="เขียนรายละเอียดกิจกรรม และจัดรูปแบบได้ที่นี่..."
                  onUploadImage={uploadDescriptionImage}
                />
              </div>

              <div className="col-span-12">
                <GooglePlaceAutocomplete
                  value={form.location || ''}
                  isLoaded={isGoogleMapsLoaded}
                  onChange={(address, lat, lng) => {
                    updateForm('location', address as any);
                    if (lat !== undefined && lng !== undefined) {
                      updateForm('latitude', lat as any);
                      updateForm('longitude', lng as any);
                    }
                  }}
                />
              </div>

              {/* แผนที่ */}
              <div className="col-span-12">
                <GeofenceMap
                  center={{
                    lat: typeof form.latitude === 'number' ? form.latitude : 13.7563,
                    lng: typeof form.longitude === 'number' ? form.longitude : 100.5018,
                  }}
                  radius={form.checkInRadius || 100}
                  title="กำหนดจุดกิจกรรม"
                  editable
                  onCenterChange={(pos) => {
                    updateForm('latitude', pos.lat as any);
                    updateForm('longitude', pos.lng as any);
                    void reverseGeocodeToPlaceName(pos.lat, pos.lng);
                  }}
                  onUseCurrentLocation={useCurrentLocation}
                />
                <div className="flex flex-row items-center gap-2 mt-2">
                  <MyLocationIcon className="h-4 w-4" />
                  <span className="text-xs text-muted-foreground">
                    กด “ตำแหน่งปัจจุบัน” เพื่อบันทึกจุดอย่างรวดเร็ว
                  </span>
                </div>
              </div>

              {/* เลือกระยะ */}
              <div className="col-span-12">
                <p className="mb-1 text-sm font-bold">
                  รัศมีเช็คอิน (เมตร): {form.checkInRadius}
                </p>
                <input
                  type="range"
                  className="w-full accent-primary"
                  value={form.checkInRadius}
                  onChange={(e) => updateForm('checkInRadius', Number(e.target.value) as any)}
                  step={10}
                  min={10}
                  max={2000}
                />
              </div>

              {/* เวลา */}
              <div className="col-span-12 md:col-span-6">
                <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'inherit', colorPrimary: '#0f172a', borderRadius: 4 } }}>
                  <DatePicker
                    showTime
                    placeholder="วันที่และเวลาเริ่มต้น"
                    style={{ width: '100%', height: '56px' }}
                    format="DD/MM/YYYY HH:mm"
                    value={form.startDateTime}
                    onChange={(value: any) => updateForm('startDateTime', value as any)}
                    getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
                  />
                </ConfigProvider>
              </div>

              <div className="col-span-12 md:col-span-6">
                <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'inherit', colorPrimary: '#0f172a', borderRadius: 4 } }}>
                  <DatePicker
                    showTime
                    placeholder="วันที่และเวลาสิ้นสุด"
                    style={{ width: '100%', height: '56px' }}
                    format="DD/MM/YYYY HH:mm"
                    value={form.endDateTime}
                    onChange={(value: any) => updateForm('endDateTime', value as any)}
                    getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
                  />
                </ConfigProvider>
              </div>

              {/* options */}
              <div className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                <Label>จำนวนสูงสุด (เว้นว่าง = ไม่จำกัด)</Label>
                <Input
                  value={form.maxParticipants ?? ''}
                  onChange={(e) => updateForm('maxParticipants', (e.target.value === '' ? undefined : Math.max(0, Number(e.target.value))) as any)}
                  placeholder="เช่น 300"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-2 h-full flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Switch checked={form.isActive} onCheckedChange={(c) => updateForm('isActive', c as any)} />
                    <span>สถานะเผยแพร่ (ใช้ปุ่มด้านบนบันทึก/เผยแพร่จะทับค่านี้)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Switch checked={form.scanEnabled} onCheckedChange={(c) => updateForm('scanEnabled', c as any)} />
                    <span>เปิดให้สแกน QR</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Switch
                      checked={form.requiresUniversityLogin}
                      onCheckedChange={(c) => updateForm('requiresUniversityLogin', c as any)}
                    />
                    <span>ต้องลงชื่อเข้าใช้มหาวิทยาลัย</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Switch checked={form.singleUserMode} onCheckedChange={(c) => updateForm('singleUserMode', c as any)} />
                    <span>Single-user mode</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Switch checked={form.dynamicQREnabled} onCheckedChange={(c) => updateForm('dynamicQREnabled', c as any)} />
                    <span>เปิดใช้งาน Dynamic QR (จอ Rolling QR หน้างาน)</span>
                  </label>
                  <span className="block pl-10 -mt-1 text-xs text-muted-foreground">
                    QR หมุนตามเวลาทุก 45 วินาที (HMAC) — ภาพสแกนเก่าใช้ต่อไม่ได้ แต่ยังรับช่วงก่อนหน้าได้
                  </span>
                  {form.dynamicQREnabled && (
                    <div className="w-full space-y-1.5 pt-1">
                      <Label htmlFor="onsite-reg-point">จุดลงทะเบียนหน้างาน (แสดงตอน QR หมดอายุ)</Label>
                      <Input
                        id="onsite-reg-point"
                        value={form.onsiteRegistrationPoint}
                        onChange={(e) => updateForm('onsiteRegistrationPoint', e.target.value as any)}
                        placeholder="เช่น โต๊ะลงทะเบียน หน้าหอประชุม / จุดเช็กอิน ลานกิจกรรม"
                      />
                      <p className="text-xs text-muted-foreground">
                        ผู้เข้าร่วมที่สแกน QR เก่าจะเห็นข้อความให้ไปสแกนใหม่ที่จุดนี้ — ถ้าเว้นว่างจะใช้ชื่อสถานที่กิจกรรมแทน
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ✅ Registration code series */}
              {RegistrationSeriesSection()}
              {SessionsSection()}
              {SurveyConfigSection()}
              {MainActivityFilesSection()}

              {/* พรีวิว QR */}
              <div className="col-span-12">
                <Separator className="my-2" />
                <p className="mb-2 text-sm font-medium">
                  พรีวิว QR & รายละเอียด
                </p>
                <div className="rounded-2xl overflow-hidden border border-border bg-background max-w-[420px]">
                  <QrPreviewCard
                    title={form.activityName || 'กิจกรรม'}
                    code={form.activityCode}
                    qr={form.qrDataUrl}
                    dept={deptLabelOf(currentAdmin.department)}
                    when={`${fmt(form.startDateTime)} - ${fmt(form.endDateTime)}`}
                    place={form.location || ''}
                    scanEnabled={form.scanEnabled}
                    bannerUrl={form.bannerUrl}
                    bannerColor={form.bannerColor}
                  />
                </div>
              </div>
            </div>
          </>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* พรีวิวหน้าลงทะเบียน (mock) */}
      <Dialog open={openPreview} onOpenChange={(o) => { if (!o) setOpenPreview(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-row items-center gap-2">
              <PreviewIcon className="h-5 w-5" /> พรีวิวหน้าลงทะเบียน
            </DialogTitle>
          </DialogHeader>

          {/* แบนเนอร์พรีวิว */}
          {(() => {
            const tint = form.bannerTintColor || '#0ea5e9';
            const op = Math.max(0, Math.min(1, form.bannerTintOpacity));
            const hasImage = form.bannerMode === 'image' && !!form.bannerUrl;
            const bannerStyle: React.CSSProperties = hasImage
              ? {
                  backgroundImage: `url(${form.bannerUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  height: 160,
                }
              : form.bannerMode === 'color' && form.bannerColor
              ? { background: form.bannerColor, height: 120 }
              : { background: tint, height: 120 };
            return (
              <div className="rounded-lg overflow-hidden mb-4 relative" style={bannerStyle}>
                {hasImage && (
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${
                        op ? 'rgba(0,0,0,' + (op * 0.15).toFixed(2) + ')' : 'transparent'
                      } 35%, ${tint})`,
                      mixBlendMode: 'multiply',
                      opacity: op,
                    }}
                  />
                )}
              </div>
            );
          })()}

          <h2 className="text-2xl font-extrabold mb-2">
            {form.activityName || 'กิจกรรม'}
          </h2>
          {form.headerTitle && (
            <p className="text-muted-foreground mb-2">
              {form.headerTitle}
            </p>
          )}

          <div className="flex flex-row flex-wrap gap-2 mb-2">
            <Badge variant="secondary">{`สังกัด: ${deptLabelOf(currentAdmin.department)}`}</Badge>
            <Badge variant="secondary">{`${fmt(form.startDateTime)} - ${fmt(form.endDateTime)}`}</Badge>
            {form.location && (
              <Badge variant="secondary" className="gap-1">
                <PlaceIcon className="h-3 w-3" />
                {form.location}
              </Badge>
            )}
            <Badge variant={form.isActive ? 'success' : 'secondary'}>{form.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</Badge>
            <Badge variant={form.scanEnabled ? 'success' : 'warning'}>{form.scanEnabled ? 'สแกนได้' : 'ปิดการสแกน'}</Badge>
          </div>

          <GeofenceMap
            center={{
              lat: typeof form.latitude === 'number' ? form.latitude : 13.7563,
              lng: typeof form.longitude === 'number' ? form.longitude : 100.5018,
            }}
            radius={form.checkInRadius || 100}
            title={form.activityName || 'จุดกิจกรรม'}
          />

          <div className="mt-4 max-w-[420px] mx-auto rounded-2xl overflow-hidden border border-border bg-background">
            <QrPreviewCard
              title={form.activityName || 'กิจกรรม'}
              code={form.activityCode}
              qr={form.qrDataUrl}
              dept={deptLabelOf(currentAdmin.department)}
              when={`${fmt(form.startDateTime)} - ${fmt(form.endDateTime)}`}
              place={form.location || ''}
              scanEnabled={form.scanEnabled}
              bannerUrl={form.bannerUrl}
              bannerColor={form.bannerColor}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPreview(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== Edit Dialog ===================== */}
      <Dialog open={openEdit} onOpenChange={(o) => { if (!o) handleCloseEdit(); }}>
        <DialogContent
          className={cn(
            '!fixed !inset-0 !left-0 !top-0 z-50 !flex !h-[100dvh] !w-screen !max-h-none !max-w-none !flex-col',
            '!translate-x-0 !translate-y-0 !rounded-none !border-0 !p-0 !gap-0 overflow-hidden',
            'data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100',
            'data-[state=closed]:slide-out-to-left-0 data-[state=open]:slide-in-from-left-0',
            'data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-top-0',
            '[&>button]:hidden'
          )}
        >
          <div className="z-20 flex w-full shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-3 sm:px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <Button size="icon" variant="ghost" onClick={handleCloseEdit} aria-label="close" className="shrink-0">
                <CloseIcon className="h-5 w-5" />
              </Button>
              <DialogTitle className="truncate font-semibold text-[0.95rem] sm:text-[1.15rem]">
                แก้ไขกิจกรรม
              </DialogTitle>
            </div>
            <div className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 whitespace-nowrap"
                onClick={openVersionsDialog}
                disabled={editing || !qrDocId}
                title="ประวัติเวอร์ชัน"
              >
                <HistoryIcon className="h-4 w-4" />
                <span className="hidden md:inline">ย้อนเวอร์ชัน</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 whitespace-nowrap"
                onClick={() => handleEditSubmit('draft')}
                disabled={editing}
              >
                {editing && saveAction === 'draft' ? <Spinner size="sm" /> : <EditIcon className="h-4 w-4" />}
                บันทึกข้อมูล
              </Button>
              <Button
                autoFocus
                size="sm"
                className="gap-2 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleEditSubmit('publish')}
                disabled={editing}
              >
                {editing && saveAction === 'publish' ? <Spinner size="sm" /> : null}
                เผยแพร่
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 w-full flex-1 flex-col md:flex-row bg-muted/30">
            {/* เมนูหมวดหมู่ — มือถือ */}
            <div className="md:hidden shrink-0 border-b border-border bg-background px-3 py-2 overflow-x-auto">
              <div className="flex gap-1.5 min-w-max">
                {EDIT_SECTIONS.map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    size="sm"
                    variant={editSection === s.id ? 'default' : 'outline'}
                    className="whitespace-nowrap"
                    onClick={() => setEditSection(s.id)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* เมนูหมวดหมู่ — เดสก์ท็อป */}
            <nav className="hidden md:flex w-56 lg:w-64 shrink-0 flex-col gap-1 border-r border-border bg-background p-3 overflow-y-auto">
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                หมวดการตั้งค่า
              </p>
              {EDIT_SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setEditSection(s.id)}
                  className={cn(
                    'rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                    editSection === s.id
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
              <div className="mx-auto w-full max-w-5xl rounded-2xl border border-border bg-background p-4 md:p-6">
                {errMsg && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{errMsg}</AlertDescription>
                  </Alert>
                )}

                <h3 className="mb-4 text-base font-semibold">
                  {EDIT_SECTIONS.find((s) => s.id === editSection)?.label}
                </h3>

                {editSection === 'basics' && (
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 md:col-span-8 flex flex-col gap-1.5">
                      <Label>ชื่อกิจกรรม *</Label>
                      <Input
                        value={form.activityName}
                        onChange={(e) => updateForm('activityName', e.target.value as any)}
                      />
                    </div>
                    <div className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
                      <Label>รหัสกิจกรรม</Label>
                      <Input value={form.activityCode} disabled />
                    </div>
                    <div className="col-span-12 flex flex-col gap-1.5">
                      <Label>ส่วนหัว</Label>
                      <Input
                        value={form.headerTitle}
                        onChange={(e) => updateForm('headerTitle', e.target.value as any)}
                      />
                    </div>
                  </div>
                )}

                {editSection === 'banner' && (
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 md:col-span-5 flex flex-col gap-1.5">
                      <Label>โหมดแบนเนอร์</Label>
                      <Select value={form.bannerMode} onValueChange={(v) => updateForm('bannerMode', v as any)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">ไม่ใช้ (แสดงเป็นสี)</SelectItem>
                          <SelectItem value="image">รูปภาพ</SelectItem>
                          <SelectItem value="color">สี/Gradient</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(form.bannerMode === 'none' || form.bannerMode === 'color') && (
                      <div className="col-span-12">
                        <ColorPickerField
                          label="สีแบนเนอร์"
                          value={form.bannerColor}
                          onChange={(v) => updateForm('bannerColor', v as any)}
                          placeholder="#0ea5e9 หรือ linear-gradient(...)"
                          allowCssGradient
                        />
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          เลือกจากจานสี หรือพิมพ์ hex / CSS gradient ได้
                        </p>
                      </div>
                    )}

                    {form.bannerMode === 'image' && (
                      <div className="col-span-12 space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center gap-3 flex-wrap">
                          <Button asChild variant="outline" className="gap-2 cursor-pointer">
                            <label>
                              <ImageIcon className="h-4 w-4" />
                              เปลี่ยนรูปส่วนหัว
                              <input
                                hidden
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  updateForm('bannerFile', file as any);
                                  if (file) updateForm('bannerUrl', URL.createObjectURL(file) as any);
                                }}
                              />
                            </label>
                          </Button>
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => {
                              if (form.activityName.trim()) {
                                setMagnificPrompt(
                                  `A beautiful premium promotional banner for university activity: ${form.activityName.trim()}`
                                );
                              } else {
                                setMagnificPrompt(
                                  'A beautiful premium modern abstract banner for a university science activity'
                                );
                              }
                              setMagnificRatio('widescreen_16_9');
                              setMagnificOpen(true);
                            }}
                          >
                            <SparklesIcon className="h-4 w-4" />
                            สร้างรูปด้วย Magnific AI
                          </Button>
                          {form.bannerUrl ? (
                            <div className="flex flex-row items-center gap-2 flex-wrap">
                              <img
                                src={form.bannerUrl}
                                alt="banner-preview"
                                className="h-[60px] rounded-lg object-cover"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                disabled={upscaling}
                                onClick={handleUpscaleBanner}
                              >
                                {upscaling ? <Spinner size="sm" /> : <SparklesIcon className="h-4 w-4" />}
                                {upscaling ? 'กำลังปรับความคมชัด...' : 'เพิ่มความคมชัด (AI Upscale)'}
                              </Button>
                              <Button
                                variant="ghost"
                                className="gap-2 text-destructive"
                                onClick={async () => {
                                  await deleteBannerIfOwned(form.bannerUrl);
                                  updateForm('bannerUrl', undefined as any);
                                  updateForm('bannerFile', null as any);
                                }}
                              >
                                <ClearIcon className="h-4 w-4" />
                                ลบรูป
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">ไม่มีรูปส่วนหัว</span>
                          )}
                        </div>
                        {upscaleError && (
                          <span className="block text-xs text-destructive">{upscaleError}</span>
                        )}
                      </div>
                    )}

                    <div className="col-span-12 md:col-span-7">
                      <ColorPickerField
                        label="สีทับ (Tint) — ทับบนรูป / สีหลัก"
                        value={form.bannerTintColor}
                        onChange={(v) => updateForm('bannerTintColor', v as any)}
                        placeholder="#0ea5e9"
                      />
                    </div>
                    <div className="col-span-12 md:col-span-5 flex flex-col gap-2 justify-end">
                      <p className="text-sm font-semibold">
                        ความทึบของสีทับ: {(form.bannerTintOpacity * 100).toFixed(0)}%
                      </p>
                      <input
                        type="range"
                        className="w-full accent-primary"
                        value={Math.round(form.bannerTintOpacity * 100)}
                        onChange={(e) => {
                          const pct = Number(e.target.value);
                          updateForm('bannerTintOpacity', (Math.max(0, Math.min(100, pct)) / 100) as any);
                        }}
                        step={1}
                        min={0}
                        max={100}
                      />
                      <div
                        className="mt-1 h-16 w-full rounded-xl border border-border overflow-hidden relative"
                        style={{
                          background:
                            form.bannerMode === 'image' && form.bannerUrl
                              ? `url(${form.bannerUrl}) center/cover`
                              : form.bannerColor || '#0ea5e9',
                        }}
                      >
                        <div
                          className="absolute inset-0"
                          style={{
                            background: form.bannerTintColor || '#0ea5e9',
                            opacity: form.bannerTintOpacity,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {editSection === 'content' && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">รายละเอียดกิจกรรม (คำอธิบาย)</p>
                    <QuillEditor
                      value={form.description}
                      onChange={(val) => updateForm('description', val as any)}
                      placeholder="เขียนรายละเอียดกิจกรรม และจัดรูปแบบได้ที่นี่..."
                      onUploadImage={uploadDescriptionImage}
                    />
                  </div>
                )}

                {editSection === 'location' && (
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12">
                      <GooglePlaceAutocomplete
                        value={form.location || ''}
                        isLoaded={isGoogleMapsLoaded}
                        onChange={(address, lat, lng) => {
                          updateForm('location', address as any);
                          if (lat !== undefined && lng !== undefined) {
                            updateForm('latitude', lat as any);
                            updateForm('longitude', lng as any);
                          }
                        }}
                      />
                    </div>
                    <div className="col-span-12">
                      <GeofenceMap
                        center={{
                          lat: typeof form.latitude === 'number' ? form.latitude : 13.7563,
                          lng: typeof form.longitude === 'number' ? form.longitude : 100.5018,
                        }}
                        radius={form.checkInRadius || 100}
                        title="ปรับตำแหน่งกิจกรรม"
                        editable
                        onCenterChange={(pos) => {
                          updateForm('latitude', pos.lat as any);
                          updateForm('longitude', pos.lng as any);
                          void reverseGeocodeToPlaceName(pos.lat, pos.lng);
                        }}
                        onUseCurrentLocation={useCurrentLocation}
                      />
                    </div>
                    <div className="col-span-12">
                      <p className="mb-1 text-sm font-bold">รัศมีเช็คอิน (เมตร): {form.checkInRadius}</p>
                      <input
                        type="range"
                        className="w-full accent-primary"
                        value={form.checkInRadius}
                        onChange={(e) => updateForm('checkInRadius', Number(e.target.value) as any)}
                        step={10}
                        min={10}
                        max={2000}
                      />
                    </div>
                  </div>
                )}

                {editSection === 'schedule' && (
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 md:col-span-6">
                      <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'inherit', colorPrimary: '#0f172a', borderRadius: 4 } }}>
                        <DatePicker
                          showTime
                          placeholder="วันที่และเวลาเริ่มต้น"
                          style={{ width: '100%', height: '56px' }}
                          format="DD/MM/YYYY HH:mm"
                          value={form.startDateTime}
                          onChange={(value: any) => updateForm('startDateTime', value as any)}
                          getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
                        />
                      </ConfigProvider>
                    </div>
                    <div className="col-span-12 md:col-span-6">
                      <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'inherit', colorPrimary: '#0f172a', borderRadius: 4 } }}>
                        <DatePicker
                          showTime
                          placeholder="วันที่และเวลาสิ้นสุด"
                          style={{ width: '100%', height: '56px' }}
                          format="DD/MM/YYYY HH:mm"
                          value={form.endDateTime}
                          onChange={(value: any) => updateForm('endDateTime', value as any)}
                          getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
                        />
                      </ConfigProvider>
                    </div>
                    <div className="col-span-12 md:col-span-6 flex flex-col gap-1.5">
                      <Label>จำนวนสูงสุด (เว้นว่าง = ไม่จำกัด)</Label>
                      <Input
                        value={form.maxParticipants ?? ''}
                        onChange={(e) =>
                          updateForm(
                            'maxParticipants',
                            (e.target.value === '' ? undefined : Math.max(0, Number(e.target.value))) as any
                          )
                        }
                      />
                    </div>
                    <div className="col-span-12 flex flex-wrap gap-2 mt-2">
                      <Button
                        variant={form.isActive ? 'default' : 'outline'}
                        className={form.isActive ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                        onClick={() => updateForm('isActive', !form.isActive as any)}
                        size="sm"
                      >
                        {form.isActive ? 'สถานะ: เผยแพร่' : 'สถานะ: ฉบับร่าง'}
                      </Button>
                      <Button
                        variant={form.scanEnabled ? 'default' : 'outline'}
                        onClick={() => updateForm('scanEnabled', !form.scanEnabled as any)}
                        size="sm"
                      >
                        เปิดให้สแกน QR
                      </Button>
                      <Button
                        variant={form.requiresUniversityLogin ? 'secondary' : 'outline'}
                        onClick={() =>
                          updateForm('requiresUniversityLogin', !form.requiresUniversityLogin as any)
                        }
                        size="sm"
                      >
                        บังคับ Login มหาลัย
                      </Button>
                      <Button
                        variant={form.singleUserMode ? 'default' : 'outline'}
                        className={form.singleUserMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                        onClick={() => updateForm('singleUserMode', !form.singleUserMode as any)}
                        size="sm"
                      >
                        Single-user mode
                      </Button>
                      <Button
                        variant={form.dynamicQREnabled ? 'default' : 'outline'}
                        className={form.dynamicQREnabled ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
                        onClick={() => updateForm('dynamicQREnabled', !form.dynamicQREnabled as any)}
                        size="sm"
                      >
                        Dynamic QR
                      </Button>
                    </div>
                    {form.dynamicQREnabled && (
                      <div className="col-span-12 space-y-1.5">
                        <Label htmlFor="onsite-reg-point-edit">จุดลงทะเบียนหน้างาน (แสดงตอน QR หมดอายุ)</Label>
                        <Input
                          id="onsite-reg-point-edit"
                          value={form.onsiteRegistrationPoint}
                          onChange={(e) => updateForm('onsiteRegistrationPoint', e.target.value as any)}
                          placeholder="เช่น โต๊ะลงทะเบียน หน้าหอประชุม / จุดเช็กอิน ลานกิจกรรม"
                        />
                        <p className="text-xs text-muted-foreground">
                          ผู้เข้าร่วมที่สแกน QR เก่าจะเห็นข้อความให้ไปสแกนใหม่ที่จุดนี้ — ถ้าเว้นว่างจะใช้ชื่อสถานที่กิจกรรมแทน
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {editSection === 'regcodes' && (
                  <div className="grid grid-cols-12 gap-4">{RegistrationSeriesSection()}</div>
                )}
                {editSection === 'sessions' && (
                  <div className="grid grid-cols-12 gap-4">{SessionsSection()}</div>
                )}
                {editSection === 'survey' && (
                  <div className="grid grid-cols-12 gap-4">{SurveyConfigSection()}</div>
                )}
                {editSection === 'files' && (
                  <div className="grid grid-cols-12 gap-4">{MainActivityFilesSection()}</div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===================== Activity Versions Dialog ===================== */}
      <Dialog open={openVersions} onOpenChange={(o) => { if (!o && !restoringVersionId) setOpenVersions(false); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0">
          <DialogHeader className="border-b border-border px-4 py-3 space-y-1 text-left">
            <DialogTitle className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5" />
              ประวัติเวอร์ชัน
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              เลือกเวอร์ชันเพื่อย้อนกลับ — เก็บไว้สูงสุด 20 รายการล่าสุด
            </p>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {versionsLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Spinner size="sm" /> กำลังโหลดประวัติ…
              </div>
            ) : versions.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                ยังไม่มีประวัติเวอร์ชัน — จะถูกสร้างเมื่อบันทึก/เผยแพร่ครั้งถัดไป
              </div>
            ) : (
              <ul className="space-y-2">
                {versions.map((v) => {
                  const when = v.savedAt
                    ? dayjs(v.savedAt).format('DD/MM/YYYY HH:mm:ss')
                    : 'ไม่ทราบเวลา';
                  const modeLabel =
                    v.mode === 'publish'
                      ? 'ก่อนเผยแพร่'
                      : v.mode === 'draft'
                        ? 'ก่อนบันทึกฉบับร่าง'
                        : v.mode === 'before_restore'
                          ? 'ก่อนย้อนเวอร์ชัน'
                          : v.mode;
                  return (
                    <li
                      key={v.id}
                      className="rounded-xl border border-border bg-card p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{v.label || 'กิจกรรม'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{when}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">{modeLabel}</Badge>
                          {typeof v.stateVersion !== 'undefined' && v.stateVersion !== null && (
                            <Badge variant="outline" className="text-[10px]">
                              v{String(v.stateVersion).slice(0, 12)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-2"
                        disabled={Boolean(restoringVersionId)}
                        onClick={() => handleRestoreVersion(v.id)}
                      >
                        {restoringVersionId === v.id ? <Spinner size="sm" /> : <HistoryIcon className="h-4 w-4" />}
                        ย้อนกลับ
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <DialogFooter className="border-t border-border px-4 py-3">
            <Button variant="outline" onClick={() => setOpenVersions(false)} disabled={Boolean(restoringVersionId)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================== Magnific AI Generation Dialog ===================== */}
      <Dialog
        open={magnificOpen}
        onOpenChange={(o) => { if (!o && !magnificLoading) setMagnificOpen(false); }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl [&>button]:hidden">
          <DialogHeader className="flex-row items-center justify-between border-b border-border pb-3 space-y-0 text-left">
            <DialogTitle className="flex flex-row items-center gap-2 font-bold">
              <SparklesIcon className="h-5 w-5 text-[#0071e3]" />
              สร้างรูปภาพส่วนหัวด้วย Magnific AI
            </DialogTitle>
            {!magnificLoading && (
              <Button size="icon" variant="ghost" onClick={() => setMagnificOpen(false)}>
                <CloseIcon className="h-4 w-4" />
              </Button>
            )}
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left side: Inputs */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label>คำอธิบายรูปภาพ (Prompt) *เป็นภาษาอังกฤษจะดีที่สุด*</Label>
                <Textarea
                  rows={4}
                  required
                  value={magnificPrompt}
                  onChange={(e) => setMagnificPrompt(e.target.value)}
                  placeholder="เช่น A futuristic science lab with glowing holographic UI, widescreen, hyperrealistic..."
                  disabled={magnificLoading || magnificStatus === 'CREATED' || magnificStatus === 'IN_PROGRESS'}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>สัดส่วนภาพ (Aspect Ratio)</Label>
                <Select
                  value={magnificRatio}
                  onValueChange={(v) => setMagnificRatio(v)}
                  disabled={magnificLoading || magnificStatus === 'CREATED' || magnificStatus === 'IN_PROGRESS'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="widescreen_16_9">16:9 (แนะนำสำหรับแบนเนอร์)</SelectItem>
                    <SelectItem value="square_1_1">1:1 (จัตุรัส)</SelectItem>
                    <SelectItem value="classic_4_3">4:3 (คลาสสิก)</SelectItem>
                    <SelectItem value="social_post_4_5">4:5 (โซเชียลแนวตั้ง)</SelectItem>
                    <SelectItem value="social_story_9_16">9:16 (สตอรี่)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>โมเดล AI (Model)</Label>
                <Select
                  value={magnificModel}
                  onValueChange={(v) => setMagnificModel(v)}
                  disabled={magnificLoading || magnificStatus === 'CREATED' || magnificStatus === 'IN_PROGRESS'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realism">Realism (ภาพถ่ายสมจริง)</SelectItem>
                    <SelectItem value="fluid">Fluid (จินตนาการ/อิง Prompt ดีที่สุด)</SelectItem>
                    <SelectItem value="zen">Zen (เรียบง่าย/สะอาดตา)</SelectItem>
                    <SelectItem value="flexible">Flexible (สีสันสดใส/อาร์ต)</SelectItem>
                    <SelectItem value="super_real">Super Real (เน้นความคมชัดสูงสุด)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {magnificError && (
                <Alert variant="destructive">
                  <AlertDescription>{magnificError}</AlertDescription>
                </Alert>
              )}

              <Button
                size="lg"
                className="gap-2 font-semibold"
                disabled={!magnificPrompt.trim() || magnificLoading || magnificStatus === 'CREATED' || magnificStatus === 'IN_PROGRESS'}
                onClick={handleGenerateImage}
              >
                {magnificLoading ? <Spinner size="sm" /> : <SparklesIcon className="h-4 w-4" />}
                {magnificStatus === 'CREATED' || magnificStatus === 'IN_PROGRESS' ? 'กำลังส่งข้อมูล...' : 'เริ่มสร้างรูปภาพ'}
              </Button>
            </div>

            {/* Right side: Preview and status */}
            <div className="flex flex-col justify-center items-center">
              <div className="w-full h-80 flex flex-col justify-center items-center bg-black rounded-2xl overflow-hidden relative border border-border">
                {magnificResultUrl ? (
                  <img
                    src={magnificResultUrl}
                    alt="Generated Banner"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4 text-[#a1a1a6] px-8 text-center">
                    {magnificStatus === 'CREATED' || magnificStatus === 'IN_PROGRESS' ? (
                      <>
                        <Spinner size="lg" className="text-[#0071e3]" />
                        <p className="text-white font-semibold">
                          กำลังประมวลผลโดย Magnific AI...
                        </p>
                        <span className="text-xs text-gray-400">
                          (อาจใช้เวลาประมาณ 10-30 วินาที ระบบกำลังอัปเดตสถานะอัตโนมัติ)
                        </span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-16 w-16 text-white/20" />
                        <p className="text-sm">
                          ยังไม่มีรูปภาพที่สร้างขึ้น กรุณากรอก Prompt และกดปุ่มเริ่มสร้างรูปภาพ
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setMagnificOpen(false);
                setMagnificResultUrl(null);
                setMagnificTaskId(null);
                setMagnificStatus('IDLE');
                setMagnificError('');
              }}
              disabled={magnificLoading}
            >
              ยกเลิก
            </Button>
            <Button
              className="gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!magnificResultUrl || magnificLoading}
              onClick={handleUseGeneratedImage}
            >
              {magnificLoading && <Spinner size="sm" />}
              ใช้รูปภาพนี้เป็นแบนเนอร์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default QRCodeAdminPanel;
