// components/admin/QRCodeAdminPanel.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Grid from '@mui/material/Grid';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  IconButton,
  Paper,
  Tooltip,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Slider,
  Menu,
  ListItemIcon,
  ListItemText,
  Tabs,
  Tab,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';

import {
  QrCode2 as QrCodeIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Image as ImageIcon,
  Clear as ClearIcon,
  ColorLens as ColorIcon,
  Shuffle as ShuffleIcon,
  ContentCopy as CopyIcon,
  Preview as PreviewIcon,
  Place as PlaceIcon,
  Download as DownloadIcon,
  People as PeopleIcon,
  GridView as GridIcon,
  TableRows as TableIcon,
  MyLocation as MyLocationIcon,
  Badge as BadgeIcon,
} from '@mui/icons-material';

import dayjs, { Dayjs } from 'dayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import {
  getAllActivities,
  getActivitiesByDepartment,
  subscribeActivities,
  toggleActivityLive,
  createActivity,
  type Activity,
} from '../../lib/adminFirebase';
import { DEPARTMENT_LABELS, type AdminProfile, type AdminDepartment } from '../../types/admin';

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
} from 'firebase/firestore';
import { db, storage } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

import GeofenceMap from '../maps/GeofenceMap';

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
  isActive: true,
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
  regCodeTotal: 92,
  regCodeNext: 1,
  regCodeAssigned: 0,
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

/* ===================== Main ===================== */
const QRCodeAdminPanel: React.FC<Props> = ({ currentAdmin }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  // view mode: การ์ด / ตาราง
  const [view, setView] = useState<'cards' | 'table'>('cards');

  // create
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [openPreview, setOpenPreview] = useState(false);

  // edit
  const [openEdit, setOpenEdit] = useState(false);
  const [editActivityId, setEditActivityId] = useState<string | null>(null);
  const [qrDocId, setQrDocId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

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
    if (!a.isActive) return { label: 'ปิดใช้งาน', color: 'default' as const };
    if (a.startDateTime && now < a.startDateTime) return { label: 'รอเปิด', color: 'warning' as const };
    if (a.endDateTime && now > a.endDateTime) return { label: 'สิ้นสุดแล้ว', color: 'default' as const };
    return { label: 'เปิดใช้งาน', color: 'success' as const };
  };

  const handleToggle = async (a: Activity) => {
    await toggleActivityLive(a.id, !a.isActive, { uid: currentAdmin.uid, email: currentAdmin.email });
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
    setForm({
      ...defaultForm,
      activityCode: ac,
      userCode: randomUserCode(),
      startDateTime: dayjs().startOf('minute'),
      endDateTime: dayjs().add(2, 'hour').startOf('minute'),
      targetUrl: makeRegisterUrl(ac),

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
        updateForm('latitude', pos.coords.latitude as any);
        updateForm('longitude', pos.coords.longitude as any);
        setErrMsg('');
      },
      () => setErrMsg('ไม่สามารถอ่านตำแหน่งได้ กรุณาลองใหม่'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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

  const handleCreateSubmit = async () => {
    try {
      setErrMsg('');
      if (!form.activityName.trim()) return setErrMsg('กรุณากรอกชื่อกิจกรรม');
      if (!form.activityCode.trim()) return setErrMsg('กรุณากรอกรหัสกิจกรรม');

      const code = form.activityCode.trim().toUpperCase();

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
      } else if (form.bannerMode === 'color') {
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

      const userCode = (form.userCode || '').trim();
      const targetUrl = makeRegisterUrl(code);

      // QR ใช้ short URL เสมอ (กันข้อมูลเยอะเกิน)
      const qrDataUrl = await generateQrPng(makeShortUrl(code), 600);

      setSaving(true);

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
        startDateTime: form.startDateTime?.toDate(),
        endDateTime: form.endDateTime?.toDate(),
        isActive: form.isActive,
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
        regCodeNext: shouldSaveReg ? regStart : p.regCodeNext,
        regCodeAssigned: shouldSaveReg ? 0 : p.regCodeAssigned,
      }));

      setOpenCreate(false);
      await load();
    } catch (e: any) {
      setErrMsg(e?.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Edit ---------- */
  const openEditDialog = async (a: Activity) => {
    try {
      setErrMsg('');
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
      });

      setOpenEdit(true);
    } catch (e: any) {
      setErrMsg(e?.message || 'ไม่สามารถเปิดหน้าต่างแก้ไขได้');
    }
  };

  const handleCloseEdit = () => {
    if (!editing) setOpenEdit(false);
  };

  const handleEditSubmit = async () => {
    if (!editActivityId) return;
    try {
      setEditing(true);
      setErrMsg('');

      const code = form.activityCode.trim().toUpperCase();
      const radius = clamp(Number(form.checkInRadius || 0) || 100, 10, 2000);
      const max = typeof form.maxParticipants === 'number' ? clamp(form.maxParticipants, 0, 1_000_000) : 0;
      const lat = typeof form.latitude === 'number' ? form.latitude : undefined;
      const lng = typeof form.longitude === 'number' ? form.longitude : undefined;

      let newBannerUrl = form.bannerUrl;
      let bannerColor: string | undefined = form.bannerMode === 'color' ? (form.bannerColor || '').trim() || undefined : undefined;

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

      // legacy
      try {
        await updateDoc(
          doc(db, 'activities', editActivityId),
          clean({
            activityName: form.activityName,
            description: form.description || undefined,
            location: form.location,
            startDateTime: form.startDateTime?.toDate(),
            endDateTime: form.endDateTime?.toDate(),
            checkInRadius: radius,
            maxParticipants: max || 0,
            isActive: form.isActive,
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

      // primary
      if (qrDocId) {
        const updates: any = clean({
          activityName: form.activityName,
          headerTitle: form.headerTitle,
          location: form.location,
          latitude: lat,
          longitude: lng,
          checkInRadius: radius,
          startDateTime: form.startDateTime?.toDate(),
          endDateTime: form.endDateTime?.toDate(),
          isActive: form.isActive,
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

      setOpenEdit(false);
      await load();
    } catch (e: any) {
      setErrMsg(e?.message || 'เกิดข้อผิดพลาดในการบันทึกการแก้ไข');
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteActivity = async (a: Activity) => {
    const confirmed = window.confirm(`ต้องการลบกิจกรรม "${a.activityName}" และ QR ที่เกี่ยวข้องหรือไม่?`);
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
    } catch (e) {
      alert('ลบ/ปิดกิจกรรมไม่สำเร็จ (ตรวจสอบสิทธิ์และ rules)');
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
      <Paper
        elevation={2}
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          maxWidth: 380,
          mx: 'auto',
        }}
      >
        <Box sx={{ height: 90, ...style }} />
        <Box sx={{ p: 2 }}>
          <Stack spacing={1} alignItems="center">
            <Typography variant="subtitle2" color="text.secondary">
              {dept}
            </Typography>
            <Typography variant="h6" fontWeight={800} textAlign="center">
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {when}
            </Typography>
            {place && (
              <Typography variant="caption" color="text.secondary">
                <PlaceIcon fontSize="inherit" sx={{ mr: 0.5 }} />
                {place}
              </Typography>
            )}
            <Box
              sx={{
                mt: 1.5,
                p: 1,
                borderRadius: 2,
                border: '1px dashed',
                borderColor: 'divider',
                position: 'relative',
              }}
            >
              {qr ? <img src={qr} alt="QR" style={{ width: 200, height: 200 }} /> : <Box sx={{ width: 200, height: 200, bgcolor: 'grey.100' }} />}
              {!scanEnabled && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    bgcolor: 'rgba(255,255,255,.65)',
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Chip color="warning" label="ปิดการสแกนชั่วคราว" />
                </Box>
              )}
            </Box>
            <Chip size="small" label={`รหัสกิจกรรม: ${code}`} />
          </Stack>
        </Box>
      </Paper>
    );
  };

  const RegistrationSeriesSection: React.FC = () => {
    const enabled = !!form.regCodeEnabled;
    const invalidPrefix = enabled && !!form.regCodePrefix && !isValidPrefix(form.regCodePrefix);
    const invalidTotal = enabled && Number(form.regCodeTotal || 0) <= 0;

    const remaining =
      enabled && Number(form.regCodeTotal || 0) > 0
        ? Math.max(0, Number(form.regCodeTotal) - Number(form.regCodeAssigned || 0))
        : 0;

    return (
      <Grid size={{ xs: 12 }}>
        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          รหัสลงทะเบียน (เช่น CS01 - CS92)
        </Typography>

        <Stack spacing={1.25}>
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => updateForm('regCodeEnabled', e.target.checked as any)} />}
            label="เปิดใช้รหัสลงทะเบียนแบบ Prefix + เลขรัน"
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Prefix (ตัวอักษร)"
                fullWidth
                value={form.regCodePrefix}
                onChange={(e) => updateForm('regCodePrefix', e.target.value.toUpperCase() as any)}
                disabled={!enabled}
                helperText="A-Z 1-6 ตัว เช่น CS"
                error={!!invalidPrefix}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <BadgeIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="จำนวนหลักของเลข"
                fullWidth
                type="number"
                value={form.regCodeDigits}
                onChange={(e) => updateForm('regCodeDigits', Number(e.target.value) as any)}
                disabled={!enabled}
                helperText="เช่น 2 -> 01"
                inputProps={{ min: 1, max: 6 }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="เริ่มที่เลข"
                fullWidth
                type="number"
                value={form.regCodeStart}
                onChange={(e) => updateForm('regCodeStart', Number(e.target.value) as any)}
                disabled={!enabled}
                helperText="เช่น 1 -> CS01"
                inputProps={{ min: 1, max: 1_000_000 }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="จำนวนรหัสทั้งหมด"
                fullWidth
                type="number"
                value={form.regCodeTotal}
                onChange={(e) => updateForm('regCodeTotal', Number(e.target.value) as any)}
                disabled={!enabled}
                helperText="เช่น 92 -> CS01..CS92"
                error={!!invalidTotal}
                inputProps={{ min: 0, max: 1_000_000 }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    ช่วงรหัสที่จะเปิดให้แจก
                  </Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ mt: 0.5 }}>
                    {enabled
                      ? regRangeText(form.regCodePrefix, form.regCodeStart, form.regCodeTotal, form.regCodeDigits)
                      : '-'}
                  </Typography>

                  <Divider sx={{ my: 1 }} />

                  <Typography variant="body2" color="text.secondary">
                    สถานะการแจก (ระบบจะอัปเดตเมื่อมีการลงทะเบียนจริง)
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
                    <Chip size="small" label={`แจกแล้ว: ${Number(form.regCodeAssigned || 0)}`} />
                    <Chip size="small" label={`คงเหลือ: ${remaining}`} />
                    <Chip
                      size="small"
                      label={
                        enabled && isValidPrefix(form.regCodePrefix) && Number(form.regCodeTotal || 0) > 0
                          ? `ถัดไป: ${formatRegCode(form.regCodePrefix, Number(form.regCodeNext || form.regCodeStart || 1), clamp(Number(form.regCodeDigits || 2), 1, 6))}`
                          : 'ถัดไป: -'
                      }
                    />
                  </Stack>

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    หมายเหตุ: การแจกเลขต้องทำใน flow ลงทะเบียน (แนะนำให้ใช้ Firestore transaction เพื่อกันเลขซ้ำ)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Stack>
      </Grid>
    );
  };

  /* ===================== Render ===================== */
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box
        sx={{
          mb: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <QrCodeIcon /> จัดการ QR Code & กิจกรรม
          </Typography>
          <Chip size="small" label={`สังกัด: ${deptLabelOf(currentAdmin.department)}`} color="primary" variant="outlined" />
          <Chip size="small" label={`ฐาน: ${getBaseUrl()}`} variant="outlined" />
        </Stack>

        <Stack direction="row" spacing={1}>
          <Tabs
            value={view === 'cards' ? 0 : 1}
            onChange={(_, v) => setView(v === 0 ? 'cards' : 'table')}
            sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36 } }}
          >
            <Tab icon={<GridIcon />} label="การ์ด" />
            <Tab icon={<TableIcon />} label="ตาราง" />
          </Tabs>

          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
            สร้างกิจกรรมใหม่
          </Button>
        </Stack>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary">
                {activeCount}
              </Typography>
              <Typography>กิจกรรมที่เปิดอยู่</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="success.main">
                {activities.length}
              </Typography>
              <Typography>กิจกรรมทั้งหมด</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* List */}
      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : activities.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <QrCodeIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
              <Typography sx={{ mt: 1 }}>ยังไม่มีกิจกรรม</Typography>
              <Button sx={{ mt: 2 }} variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
                สร้างกิจกรรมใหม่
              </Button>
            </Box>
          ) : view === 'cards' ? (
            <Grid container spacing={2}>
              {activities.map((a) => {
                const st = statusOf(a);
                const when = `${fmt(a.startDateTime)} - ${fmt(a.endDateTime)}`;
                const bannerColor = (a as any).bannerColor as string | undefined;

                return (
                  <Grid key={a.id} size={{ xs: 12, sm: 6, md: 4 }}>
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

                    <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => handleToggle(a)}>
                        {a.isActive ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                      </Button>

                      <Tooltip title="แก้ไข">
                        <IconButton color="primary" size="small" onClick={() => openEditDialog(a)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="ดาวน์โหลด">
                        <IconButton color="secondary" size="small" onClick={(e) => openDownloadMenu(e, a)}>
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="รายชื่อผู้ลงทะเบียน">
                        <IconButton
                          color="info"
                          size="small"
                          onClick={() => window.open(`/admin/records?activity=${encodeURIComponent(a.activityCode)}`, '_blank')}
                        >
                          <PeopleIcon />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="ดูหน้าลงทะเบียน">
                        <IconButton color="info" size="small" onClick={() => window.open(makeRegisterUrl(a.activityCode), '_blank')}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="ลบ">
                        <IconButton color="error" size="small" onClick={() => handleDeleteActivity(a)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    <Box sx={{ mt: 1, textAlign: 'center' }}>
                      <Chip size="small" label={st.label} color={st.color} />
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>กิจกรรม</TableCell>
                    <TableCell>รหัส</TableCell>
                    <TableCell>ช่วงเวลา</TableCell>
                    <TableCell>สถานที่</TableCell>
                    <TableCell align="center">สถานะ</TableCell>
                    <TableCell align="right">จัดการ</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {activities.map((a) => {
                    const st = statusOf(a);
                    const when = `${fmt(a.startDateTime)} - ${fmt(a.endDateTime)}`;
                    const bannerColor = (a as any).bannerColor as string | undefined;

                    return (
                      <TableRow key={a.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box
                              sx={{
                                width: 40,
                                height: 28,
                                borderRadius: 1,
                                background: (a as any).bannerUrl
                                  ? `url(${(a as any).bannerUrl}) center/cover no-repeat`
                                  : bannerColor || 'linear-gradient(135deg,#4f46e5,#06b6d4)',
                              }}
                            />
                            <Box>
                              <Typography fontWeight={700}>{a.activityName || '-'}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {deptLabelOf((a as any).department ?? currentAdmin.department)}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>

                        <TableCell sx={{ fontFamily: 'monospace' }}>{a.activityCode}</TableCell>
                        <TableCell>{when}</TableCell>
                        <TableCell>{(a as any).location || '-'}</TableCell>
                        <TableCell align="center">
                          <Chip size="small" label={st.label} color={st.color} />
                        </TableCell>

                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" variant="outlined" onClick={() => handleToggle(a)}>
                              {a.isActive ? 'ปิด' : 'เปิด'}
                            </Button>
                            <IconButton size="small" color="primary" onClick={() => openEditDialog(a)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="secondary" onClick={(e) => openDownloadMenu(e, a)}>
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="info" onClick={() => window.open(makeRegisterUrl(a.activityCode), '_blank')}>
                              <ViewIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDeleteActivity(a)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* ====== เมนูดาวน์โหลด ====== */}
      <Menu anchorEl={dlMenu.anchorEl} open={Boolean(dlMenu.anchorEl)} onClose={closeDownloadMenu}>
        <MenuItem onClick={() => handleDownloadQr(512)}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="QR PNG (512px)" />
        </MenuItem>
        <MenuItem onClick={() => handleDownloadQr(1024)}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="QR PNG (1024px)" />
        </MenuItem>
        <MenuItem onClick={() => handleDownloadQr(2048)}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="QR PNG (2048px)" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleDownloadPoster('square')}>
          <ListItemIcon>
            <ImageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="โปสเตอร์ (สี่เหลี่ยมแนวตั้ง)" />
        </MenuItem>
        <MenuItem onClick={() => handleDownloadPoster('a4')}>
          <ListItemIcon>
            <ImageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="โปสเตอร์ (A4)" />
        </MenuItem>
      </Menu>

      {/* ===================== Create Dialog ===================== */}
      <Dialog open={openCreate} onClose={handleCloseCreate} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <QrCodeIcon />
            <Typography variant="h6">สร้างกิจกรรม & QR Code</Typography>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          {errMsg && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errMsg}
            </Alert>
          )}

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Grid container spacing={2}>
              {/* สังกัด */}
              <Grid size={{ xs: 12 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    สังกัดที่จะบันทึก:
                  </Typography>
                  <Chip size="small" color="primary" variant="outlined" label={deptLabelOf(currentAdmin.department)} />
                </Stack>
              </Grid>

              {/* ชื่อ/รหัสกิจกรรม + สุ่ม/คัดลอก */}
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  label="ชื่อกิจกรรม *"
                  fullWidth
                  value={form.activityName}
                  onChange={(e) => updateForm('activityName', e.target.value as any)}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    label="รหัสกิจกรรม *"
                    fullWidth
                    value={form.activityCode}
                    onChange={(e) => updateForm('activityCode', e.target.value.toUpperCase() as any)}
                    inputProps={{ maxLength: 64 }}
                  />
                  <Tooltip title="สุ่ม">
                    <IconButton onClick={() => updateForm('activityCode', randomActivityCode() as any)}>
                      <ShuffleIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="คัดลอก">
                    <IconButton
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(form.activityCode);
                        } catch {}
                      }}
                    >
                      <CopyIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Grid>

              {/* userCode */}
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    label="รหัสผู้ใช้ (userCode)"
                    fullWidth
                    value={form.userCode}
                    onChange={(e) => updateForm('userCode', e.target.value as any)}
                    placeholder="ว่างได้ / กดสุ่ม"
                  />
                  <Tooltip title="สุ่ม">
                    <IconButton onClick={() => updateForm('userCode', randomUserCode() as any)}>
                      <ShuffleIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="คัดลอก">
                    <IconButton
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(form.userCode);
                        } catch {}
                      }}
                    >
                      <CopyIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Grid>

              {/* ส่วนหัว */}
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  label="ส่วนหัว (จะแสดงบนหน้าลงทะเบียน)"
                  fullWidth
                  value={form.headerTitle}
                  onChange={(e) => updateForm('headerTitle', e.target.value as any)}
                  placeholder="เช่น ลงทะเบียนกิจกรรม Orientation"
                />
              </Grid>

              {/* โหมดแบนเนอร์ */}
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>โหมดแบนเนอร์</InputLabel>
                  <Select
                    label="โหมดแบนเนอร์"
                    value={form.bannerMode}
                    onChange={(e) => updateForm('bannerMode', e.target.value as any)}
                  >
                    <MenuItem value="none">ไม่ใช้ (แสดงเป็นสี)</MenuItem>
                    <MenuItem value="image">รูปภาพ</MenuItem>
                    <MenuItem value="color">สี/Gradient</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* แบนเนอร์ตามโหมด */}
              {form.bannerMode === 'image' && (
                <Grid size={{ xs: 12 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                    <Button component="label" startIcon={<ImageIcon />} variant="outlined">
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
                    </Button>

                    {form.bannerUrl && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <img src={form.bannerUrl} alt="banner-preview" style={{ height: 60, borderRadius: 8 }} />
                        <IconButton
                          color="error"
                          onClick={() => {
                            updateForm('bannerUrl', undefined as any);
                            updateForm('bannerFile', null as any);
                          }}
                        >
                          <ClearIcon />
                        </IconButton>
                      </Stack>
                    )}
                  </Stack>
                </Grid>
              )}

              {form.bannerMode === 'color' && (
                <Grid size={{ xs: 12 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      label="สี/Gradient (CSS)"
                      fullWidth
                      value={form.bannerColor}
                      onChange={(e) => updateForm('bannerColor', e.target.value as any)}
                      placeholder="เช่น #0ea5e9 หรือ linear-gradient(135deg,#4f46e5,#06b6d4)"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <ColorIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 1,
                        border: '1px solid rgba(0,0,0,.12)',
                        background: form.bannerColor,
                      }}
                    />
                  </Stack>
                </Grid>
              )}

              {/* สีทับ + ความทึบ */}
              <Grid size={{ xs: 12, md: 7 }}>
                <TextField
                  label="สีทับ (Tint) — ใช้ทับบนรูป/กำหนดสีหลัก"
                  fullWidth
                  value={form.bannerTintColor}
                  onChange={(e) => updateForm('bannerTintColor', e.target.value as any)}
                  placeholder="#0ea5e9 หรือ rgba(14,165,233,1)"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ColorIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 5 }}>
                <Stack spacing={0.5}>
                  <Typography variant="body2" fontWeight={600}>
                    ความทึบของสีทับ: {(form.bannerTintOpacity * 100).toFixed(0)}%
                  </Typography>
                  <Slider
                    value={Math.round(form.bannerTintOpacity * 100)}
                    onChange={(_, v) => {
                      const pct = Array.isArray(v) ? v[0] : v;
                      updateForm('bannerTintOpacity', (Math.max(0, Math.min(100, Number(pct))) / 100) as any);
                    }}
                    step={1}
                    min={0}
                    max={100}
                    valueLabelDisplay="auto"
                  />
                </Stack>
              </Grid>

              {/* คำอธิบาย/สถานที่ */}
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="คำอธิบาย"
                  fullWidth
                  multiline
                  minRows={2}
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value as any)}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  label="สถานที่"
                  fullWidth
                  value={form.location}
                  onChange={(e) => updateForm('location', e.target.value as any)}
                />
              </Grid>

              {/* แผนที่ */}
              <Grid size={{ xs: 12 }}>
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
                  }}
                  onUseCurrentLocation={useCurrentLocation}
                />
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <MyLocationIcon fontSize="small" />
                  <Typography variant="caption" color="text.secondary">
                    กด “ตำแหน่งปัจจุบัน” เพื่อบันทึกจุดอย่างรวดเร็ว
                  </Typography>
                </Stack>
              </Grid>

              {/* เลือกระยะ */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                  รัศมีเช็คอิน (เมตร): {form.checkInRadius}
                </Typography>
                <Slider
                  value={form.checkInRadius}
                  onChange={(_, v) => updateForm('checkInRadius', (Array.isArray(v) ? v[0] : Number(v)) as any)}
                  valueLabelDisplay="auto"
                  step={10}
                  min={10}
                  max={2000}
                />
              </Grid>

              {/* เวลา */}
              <Grid size={{ xs: 12, md: 6 }}>
                <DateTimePicker
                  label="เริ่มต้น"
                  value={form.startDateTime}
                  onChange={(value: any) => updateForm('startDateTime', value as any)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <DateTimePicker
                  label="สิ้นสุด"
                  value={form.endDateTime}
                  onChange={(value: any) => updateForm('endDateTime', value as any)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              {/* options */}
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="จำนวนสูงสุด (เว้นว่าง = ไม่จำกัด)"
                  fullWidth
                  value={form.maxParticipants ?? ''}
                  onChange={(e) => updateForm('maxParticipants', (e.target.value === '' ? undefined : Math.max(0, Number(e.target.value))) as any)}
                  placeholder="เช่น 300"
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  alignItems="center"
                  justifyContent="flex-end"
                  sx={{ height: '100%' }}
                >
                  <FormControlLabel
                    control={<Switch checked={form.isActive} onChange={(e) => updateForm('isActive', e.target.checked as any)} />}
                    label="เปิดใช้งาน"
                  />
                  <FormControlLabel
                    control={<Switch checked={form.scanEnabled} onChange={(e) => updateForm('scanEnabled', e.target.checked as any)} />}
                    label="เปิดให้สแกน QR"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.requiresUniversityLogin}
                        onChange={(e) => updateForm('requiresUniversityLogin', e.target.checked as any)}
                      />
                    }
                    label="ต้องลงชื่อเข้าใช้มหาวิทยาลัย"
                  />
                  <FormControlLabel
                    control={<Switch checked={form.singleUserMode} onChange={(e) => updateForm('singleUserMode', e.target.checked as any)} />}
                    label="Single-user mode"
                  />
                </Stack>
              </Grid>

              {/* ✅ Registration code series */}
              <RegistrationSeriesSection />

              {/* พรีวิว QR */}
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  พรีวิว QR & รายละเอียด
                </Typography>
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
              </Grid>
            </Grid>
          </LocalizationProvider>
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button
            startIcon={<PreviewIcon />}
            variant="outlined"
            onClick={async () => {
              const code = form.activityCode.trim();
              const url = code ? makeShortUrl(code) : '';
              const data = url ? await generateQrPng(url, 600) : '';
              updateForm('qrDataUrl', data as any);
              setOpenPreview(true);
            }}
          >
            พรีวิวหน้าลงทะเบียน
          </Button>

          <Box>
            <Button onClick={handleCloseCreate} disabled={saving} sx={{ mr: 1 }}>
              ยกเลิก
            </Button>
            <Button onClick={handleCreateSubmit} variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={18} /> : <AddIcon />}>
              บันทึก & สร้าง QR
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* พรีวิวหน้าลงทะเบียน (mock) */}
      <Dialog open={openPreview} onClose={() => setOpenPreview(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <PreviewIcon /> <Typography variant="h6">พรีวิวหน้าลงทะเบียน</Typography>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          {/* แบนเนอร์พรีวิว */}
          {(() => {
            const tint = form.bannerTintColor || '#0ea5e9';
            const op = Math.max(0, Math.min(1, form.bannerTintOpacity));
            const hasImage = form.bannerMode === 'image' && !!form.bannerUrl;
            return (
              <Box
                sx={{
                  borderRadius: 2,
                  overflow: 'hidden',
                  mb: 2,
                  position: 'relative',
                  ...(hasImage
                    ? {
                        backgroundImage: `url(${form.bannerUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        height: 160,
                      }
                    : form.bannerMode === 'color' && form.bannerColor
                    ? { background: form.bannerColor, height: 120 }
                    : { background: tint, height: 120 }),
                }}
              >
                {hasImage && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${
                        op ? 'rgba(0,0,0,' + (op * 0.15).toFixed(2) + ')' : 'transparent'
                      } 35%, ${tint})`,
                      mixBlendMode: 'multiply',
                      opacity: op,
                    }}
                  />
                )}
              </Box>
            );
          })()}

          <Typography variant="h5" fontWeight={800} gutterBottom>
            {form.activityName || 'กิจกรรม'}
          </Typography>
          {form.headerTitle && (
            <Typography color="text.secondary" gutterBottom>
              {form.headerTitle}
            </Typography>
          )}

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
            <Chip size="small" label={`สังกัด: ${deptLabelOf(currentAdmin.department)}`} />
            <Chip size="small" label={`${fmt(form.startDateTime)} - ${fmt(form.endDateTime)}`} />
            {form.location && <Chip size="small" icon={<PlaceIcon />} label={form.location} />}
            <Chip size="small" color={form.isActive ? 'success' : 'default'} label={form.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'} />
            <Chip size="small" color={form.scanEnabled ? 'success' : 'warning'} label={form.scanEnabled ? 'สแกนได้' : 'ปิดการสแกน'} />
          </Stack>

          <GeofenceMap
            center={{
              lat: typeof form.latitude === 'number' ? form.latitude : 13.7563,
              lng: typeof form.longitude === 'number' ? form.longitude : 100.5018,
            }}
            radius={form.checkInRadius || 100}
            title={form.activityName || 'จุดกิจกรรม'}
          />

          <Box sx={{ mt: 2 }}>
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
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenPreview(false)}>ปิด</Button>
        </DialogActions>
      </Dialog>

      {/* ===================== Edit Dialog ===================== */}
      <Dialog open={openEdit} onClose={handleCloseEdit} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EditIcon />
            <Typography variant="h6">แก้ไขกิจกรรม</Typography>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          {errMsg && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errMsg}
            </Alert>
          )}

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  label="ชื่อกิจกรรม *"
                  fullWidth
                  value={form.activityName}
                  onChange={(e) => updateForm('activityName', e.target.value as any)}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField label="รหัสกิจกรรม" fullWidth value={form.activityCode} disabled />
              </Grid>

              {/* userCode */}
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    label="รหัสผู้ใช้ (userCode)"
                    fullWidth
                    value={form.userCode}
                    onChange={(e) => updateForm('userCode', e.target.value as any)}
                  />
                  <Tooltip title="สุ่ม">
                    <IconButton onClick={() => updateForm('userCode', randomUserCode() as any)}>
                      <ShuffleIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="คัดลอก">
                    <IconButton
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(form.userCode);
                        } catch {}
                      }}
                    >
                      <CopyIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Grid>

              {/* ส่วนหัว */}
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField label="ส่วนหัว" fullWidth value={form.headerTitle} onChange={(e) => updateForm('headerTitle', e.target.value as any)} />
              </Grid>

              {/* แบนเนอร์ */}
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>โหมดแบนเนอร์</InputLabel>
                  <Select label="โหมดแบนเนอร์" value={form.bannerMode} onChange={(e) => updateForm('bannerMode', e.target.value as any)}>
                    <MenuItem value="none">ไม่ใช้ (แสดงเป็นสี)</MenuItem>
                    <MenuItem value="image">รูปภาพ</MenuItem>
                    <MenuItem value="color">สี/Gradient</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {form.bannerMode === 'image' && (
                <Grid size={{ xs: 12 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                    <Button component="label" startIcon={<ImageIcon />} variant="outlined">
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
                    </Button>

                    {form.bannerUrl ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <img src={form.bannerUrl} alt="banner-preview" style={{ height: 60, borderRadius: 8 }} />
                        <Button
                          color="error"
                          startIcon={<ClearIcon />}
                          onClick={async () => {
                            await deleteBannerIfOwned(form.bannerUrl);
                            updateForm('bannerUrl', undefined as any);
                            updateForm('bannerFile', null as any);
                          }}
                        >
                          ลบรูป
                        </Button>
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        ไม่มีรูปส่วนหัว
                      </Typography>
                    )}
                  </Stack>
                </Grid>
              )}

              {form.bannerMode === 'color' && (
                <Grid size={{ xs: 12 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      label="สี/Gradient (CSS)"
                      fullWidth
                      value={form.bannerColor}
                      onChange={(e) => updateForm('bannerColor', e.target.value as any)}
                      placeholder="เช่น #0ea5e9 หรือ linear-gradient(135deg,#4f46e5,#06b6d4)"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <ColorIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 1,
                        border: '1px solid rgba(0,0,0,.12)',
                        background: form.bannerColor,
                      }}
                    />
                  </Stack>
                </Grid>
              )}

              {/* สีทับ + ความทึบ */}
              <Grid size={{ xs: 12, md: 7 }}>
                <TextField
                  label="สีทับ (Tint) — ใช้ทับบนรูป/กำหนดสีหลัก"
                  fullWidth
                  value={form.bannerTintColor}
                  onChange={(e) => updateForm('bannerTintColor', e.target.value as any)}
                  placeholder="#0ea5e9 หรือ rgba(14,165,233,1)"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ColorIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 5 }}>
                <Stack spacing={0.5}>
                  <Typography variant="body2" fontWeight={600}>
                    ความทึบของสีทับ: {(form.bannerTintOpacity * 100).toFixed(0)}%
                  </Typography>
                  <Slider
                    value={Math.round(form.bannerTintOpacity * 100)}
                    onChange={(_, v) => {
                      const pct = Array.isArray(v) ? v[0] : v;
                      updateForm('bannerTintOpacity', (Math.max(0, Math.min(100, Number(pct))) / 100) as any);
                    }}
                    step={1}
                    min={0}
                    max={100}
                    valueLabelDisplay="auto"
                  />
                </Stack>
              </Grid>

              {/* คำอธิบาย/สถานที่ */}
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="คำอธิบาย"
                  fullWidth
                  multiline
                  minRows={2}
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value as any)}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField label="สถานที่" fullWidth value={form.location} onChange={(e) => updateForm('location', e.target.value as any)} />
              </Grid>

              {/* แผนที่ */}
              <Grid size={{ xs: 12 }}>
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
                  }}
                  onUseCurrentLocation={useCurrentLocation}
                />
              </Grid>

              {/* เลือกระยะ */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                  รัศมีเช็คอิน (เมตร): {form.checkInRadius}
                </Typography>
                <Slider
                  value={form.checkInRadius}
                  onChange={(_, v) => updateForm('checkInRadius', (Array.isArray(v) ? v[0] : Number(v)) as any)}
                  valueLabelDisplay="auto"
                  step={10}
                  min={10}
                  max={2000}
                />
              </Grid>

              {/* เวลา */}
              <Grid size={{ xs: 12, md: 6 }}>
                <DateTimePicker
                  label="เริ่มต้น"
                  value={form.startDateTime}
                  onChange={(value: any) => updateForm('startDateTime', value as any)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <DateTimePicker
                  label="สิ้นสุด"
                  value={form.endDateTime}
                  onChange={(value: any) => updateForm('endDateTime', value as any)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              {/* options */}
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="จำนวนสูงสุด (เว้นว่าง = ไม่จำกัด)"
                  fullWidth
                  value={form.maxParticipants ?? ''}
                  onChange={(e) => updateForm('maxParticipants', (e.target.value === '' ? undefined : Math.max(0, Number(e.target.value))) as any)}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  alignItems="center"
                  justifyContent="flex-end"
                  sx={{ height: '100%' }}
                >
                  <FormControlLabel
                    control={<Switch checked={form.isActive} onChange={(e) => updateForm('isActive', e.target.checked as any)} />}
                    label="เปิดใช้งาน"
                  />
                  <FormControlLabel
                    control={<Switch checked={form.scanEnabled} onChange={(e) => updateForm('scanEnabled', e.target.checked as any)} />}
                    label="เปิดให้สแกน QR"
                  />
                  <FormControlLabel
                    control={
                      <Switch checked={form.requiresUniversityLogin} onChange={(e) => updateForm('requiresUniversityLogin', e.target.checked as any)} />
                    }
                    label="ต้องลงชื่อเข้าใช้มหาวิทยาลัย"
                  />
                  <FormControlLabel
                    control={<Switch checked={form.singleUserMode} onChange={(e) => updateForm('singleUserMode', e.target.checked as any)} />}
                    label="Single-user mode"
                  />
                </Stack>
              </Grid>

              {/* ✅ Registration code series */}
              <RegistrationSeriesSection />
            </Grid>
          </LocalizationProvider>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseEdit} disabled={editing}>
            ยกเลิก
          </Button>
          <Button onClick={handleEditSubmit} variant="contained" disabled={editing} startIcon={editing ? <CircularProgress size={18} /> : <EditIcon />}>
            บันทึกการแก้ไข
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default QRCodeAdminPanel;
