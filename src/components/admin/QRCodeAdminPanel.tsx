'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, Chip, IconButton, Paper, Tooltip,
  Container, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch,
  FormControlLabel, Stack, Divider, Alert, CircularProgress, InputAdornment, MenuItem,
  Select, FormControl, InputLabel, Slider, Menu, ListItemIcon, ListItemText,
  Tabs, Tab, TableContainer, Table, TableHead, TableRow, TableCell, TableBody
} from '@mui/material';

import {
  QrCode2 as QrCodeIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, Visibility as ViewIcon, Image as ImageIcon,
  Clear as ClearIcon, ColorLens as ColorIcon, Shuffle as ShuffleIcon,
  ContentCopy as CopyIcon, Preview as PreviewIcon, Place as PlaceIcon,
  Download as DownloadIcon, People as PeopleIcon, GridView as GridIcon,
  TableRows as TableIcon, MyLocation as MyLocationIcon
} from '@mui/icons-material';

import dayjs, { Dayjs } from 'dayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import {
  getAllActivities,
  getActivitiesByDepartment,
  toggleActivityLive,
  createActivity,
  type Activity,
} from '../../lib/adminFirebase';
import { DEPARTMENT_LABELS, type AdminProfile, type AdminDepartment } from '../../types/admin';

import {
  addDoc, collection, getDocs, limit, query, serverTimestamp, where, doc,
  updateDoc, deleteDoc, deleteField
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
const envBase =
  (process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    '').toString();

const getBaseUrl = () => {
  if (envBase) return envBase.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
};

// สร้าง URL ที่จะ encode ลง QR (สั้น เพื่อไม่ให้ข้อมูลเยอะเกิน)
const makeShortUrl = (code: string) =>
  `${getBaseUrl()}/r/${encodeURIComponent(code.trim().toUpperCase())}`;

// URL หน้าลงทะเบียน (ไว้แสดง/เปิดดูหน้า)
const makeRegisterUrl = (code: string) =>
  `${getBaseUrl()}/register?activity=${encodeURIComponent(code.trim().toUpperCase())}`;

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
    .map(x => x.toString(16).padStart(2, '0'))
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

/* ===================== QR helpers ===================== */
// PNG DataURL
const generateQrPng = async (text: string, size = 600) => {
  const QR = await import('qrcode');
  // ใช้ errorCorrectionLevel 'M' ให้สแกนง่ายและไม่หนักเกินไป
  return QR.toDataURL(text, { margin: 1, width: size, errorCorrectionLevel: 'M' });
};

/* ===================== Types for local use ===================== */
type BannerMode = 'image' | 'color' | 'none';

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
  qrDataUrl: string;             // preview QR
  userCode: string;
  bannerMode: BannerMode;
  bannerUrl?: string;
  bannerFile?: File | null;
  bannerColor?: string;
  bannerTintColor?: string;
  bannerTintOpacity: number;     // 0..1
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
};

interface Props {
  currentAdmin: AdminProfile;
}

/* ===================== Poster (Canvas) ===================== */
// ---- Safe Day.js helpers (ต้องอยู่เหนือ buildPosterCanvas) ----
const INVALID_DJ = dayjs(new Date(NaN)); // อินสแตนซ์ invalid แบบพกพา
const toDay = (v: any | undefined) => {
  if (v == null) return INVALID_DJ;                    // แทน dayjs.invalid()
  const d = typeof v?.toDate === 'function' ? v.toDate() : v; // รองรับ Firestore Timestamp
  return dayjs(d);
};
// รูปแบบวันที่แบบปลอดภัย (ถ้าไม่ valid -> คืน "-")
const fmt = (v: any, f = 'DD MMM YYYY HH:mm') => {
  const d = toDay(v);
  return d.isValid() ? d.format(f) : '-';
};

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

type PosterVariant = 'square' | 'a4';

/**
 * สร้างโปสเตอร์ (Canvas) แบบสวยงาม
 * - ใช้ short URL ใน QR (ป้องกันข้อมูลเยอะเกิน)
 * - วางหัวเรื่อง / เวลา / สถานที่ / QR / โค้ด
 */
const buildPosterCanvas = async (a: Activity, variant: PosterVariant = 'square') => {
  const shortUrl = makeShortUrl(a.activityCode);
  const qrData = await generateQrPng(shortUrl, 1024);

  // ขนาด
  const size = variant === 'a4'
    ? { w: 1240, h: 1754 }   // A4 ~150dpi (ไฟล์ไม่ใหญ่)
    : { w: 1080, h: 1350 };  // สี่เหลี่ยมแนวตั้ง

  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d')!;

  // พื้นหลังไล่เฉดนุ่ม ๆ
  const grd = ctx.createLinearGradient(0, 0, 0, size.h);
  grd.addColorStop(0, '#e6efff');
  grd.addColorStop(1, '#dff4ff');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size.w, size.h);

  // หัวโปสเตอร์ (รูปหรือสี)
  const bannerColor = (a as any).bannerColor as string | undefined;
  const tintColor = (a as any).bannerTintColor as string | undefined;
  const tintOpacity = typeof (a as any).bannerTintOpacity === 'number'
    ? Number((a as any).bannerTintOpacity) : 0.42;

  const headerH = Math.round(size.h * 0.20);
  if ((a as any).bannerUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = (a as any).bannerUrl;
    await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });
    ctx.drawImage(img, 0, 0, size.w, headerH);
    if (tintColor && tintOpacity > 0) {
      ctx.fillStyle = tintColor;
      ctx.globalAlpha = clamp(tintOpacity, 0, 1);
      ctx.fillRect(0, 0, size.w, headerH);
      ctx.globalAlpha = 1;
    }
  } else {
    // ถ้าเป็น gradient css canvas ใช้ตรงๆไม่ได้ → ดึงสีหลักแทน
    const bg = (bannerColor || '').startsWith('linear-gradient') ? '#4f46e5' : (bannerColor || '#c7d2fe');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size.w, headerH);
  }

  // ข้อความหัว
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
  const tStartTxt = fmt(a.startDateTime);
  const tEndTxt   = fmt(a.endDateTime);
  ctx.fillText(`${tStartTxt} - ${tEndTxt}`, pad, Math.round(headerH - pad * 0.8));

  // โซน QR กล่องขาวมุมโค้ง
  const panelY = headerH + Math.round(size.h * 0.02);
  const panelH = size.h - panelY - Math.round(size.h * 0.05);
  const panelR = Math.round(size.w * 0.02);
  ctx.fillStyle = '#ffffff';
  // round rect
  const rr = new Path2D();
  rr.moveTo(pad + panelR, panelY);
  rr.arcTo(size.w - pad, panelY, size.w - pad, panelY + panelR, panelR);
  rr.arcTo(size.w - pad, panelY + panelH, size.w - pad - panelR, panelY + panelH, panelR);
  rr.arcTo(pad, panelY + panelH, pad, panelY + panelH - panelR, panelR);
  rr.arcTo(pad, panelY, pad + panelR, panelY, panelR);
  ctx.fill(rr);

  // QR
  const qrImg = new Image();
  qrImg.src = qrData;
  await new Promise<void>((resolve) => { qrImg.onload = () => resolve(); qrImg.onerror = () => resolve(); });
  const qrSize = Math.min(Math.round(panelH * 0.7), Math.round(size.w * 0.75));
  const qrX = Math.round((size.w - qrSize) / 2);
  const qrY = Math.round(panelY + panelH * 0.08);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // รหัสกิจกรรม
  ctx.fillStyle = '#111827';
  ctx.font = `800 ${Math.round(size.w * 0.045)}px Inter, "Noto Sans Thai", system-ui`;
  const codeText = `รหัสกิจกรรม: ${a.activityCode}`;
  const codeY = qrY + qrSize + Math.round(size.w * 0.08);
  ctx.fillText(codeText, pad, codeY);

  // สถานที่
  if ((a as any).location) {
    ctx.fillStyle = '#334155';
    ctx.font = `600 ${Math.round(size.w * 0.036)}px Inter, "Noto Sans Thai", system-ui`;
    wrapText(ctx, (a as any).location, pad, codeY + Math.round(size.w * 0.06), size.w - pad * 2, Math.round(size.w * 0.05));
  }

  // footer เล็ก ๆ
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
    anchorEl: null, activity: null,
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

  const load = async () => {
    setLoading(true);
    try {
      const data =
        currentAdmin.department === 'all'
          ? await getAllActivities()
          : await getActivitiesByDepartment(currentAdmin.department as AdminDepartment);
      setActivities(data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentAdmin.department]);

  /* ---------- Create ---------- */
  const handleOpenCreate = () => {
    setErrMsg('');
    const ac = randomActivityCode();
    setForm({
      ...defaultForm,
      activityCode: ac,
      userCode: randomUserCode(),
      startDateTime: dayjs().startOf('minute'),
      endDateTime: dayjs().add(2, 'hour').startOf('minute'),
      targetUrl: makeRegisterUrl(ac),
    });
    setOpenCreate(true);
  };
  const handleCloseCreate = () => { if (!saving) setOpenCreate(false); };

  const updateForm = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'activityCode') {
        const code = String(value || '').toUpperCase();
        next.targetUrl = code ? makeRegisterUrl(code) : '';
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
        updateForm('latitude', pos.coords.latitude);
        updateForm('longitude', pos.coords.longitude);
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'activityQRCodes'), qrPayload);

      // legacy (optional)
      const legacy = clean({
        activityName: form.activityName,
        activityCode: code,
        description: form.description,
        location: form.location,
        startDateTime: form.startDateTime?.toDate(),
        endDateTime: form.endDateTime?.toDate(),
        checkInRadius: radius,
        maxParticipants: max,
        isActive: form.isActive,
        qrUrl: qrDataUrl,
        department: currentAdmin.department,
        userCode: userCode || undefined,
        bannerUrl,
        bannerColor,
        bannerTintColor: form.bannerTintColor,
        bannerTintOpacity: form.bannerTintOpacity,
      });
      await createActivity(legacy);

      setForm((p) => ({ ...p, targetUrl, qrDataUrl, bannerUrl, bannerColor }));
      setOpenCreate(false);
      await load();
    } catch (e: any) {
      setErrMsg(e?.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally { setSaving(false); }
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

      setForm({
        activityName: a.activityName || qr?.activityName || '',
        activityCode: a.activityCode || '',
        headerTitle: qr?.headerTitle || '',
        description: a.description || qr?.description || '',
        location: (a as any).location || qr?.location || '',
        latitude: qr?.latitude,
        longitude: qr?.longitude,
        checkInRadius: a.checkInRadius ?? qr?.checkInRadius ?? 100,
        startDateTime: a.startDateTime
          ? dayjs(a.startDateTime)
          : qr?.startDateTime ? dayjs(qr.startDateTime.toDate?.() ?? qr.startDateTime) : dayjs(),
        endDateTime: a.endDateTime
          ? dayjs(a.endDateTime)
          : qr?.endDateTime ? dayjs(qr.endDateTime.toDate?.() ?? qr.endDateTime) : dayjs().add(2, 'hour'),
        isActive: a.isActive ?? true,
        scanEnabled: qr?.scanEnabled !== false,
        requiresUniversityLogin: qr?.requiresUniversityLogin ?? true,
        singleUserMode: qr?.singleUserMode ?? false,
        maxParticipants: a.maxParticipants || qr?.maxParticipants || undefined,
        targetUrl: makeRegisterUrl(a.activityCode),
        qrDataUrl: (a as any).qrUrl || qr?.qrUrl || '',
        userCode: (a as any).userCode || qr?.userCode || '',
        bannerMode: qr?.bannerUrl ? 'image' : qr?.bannerColor ? 'color' : 'none',
        bannerUrl: (a as any).bannerUrl || qr?.bannerUrl || undefined,
        bannerFile: null,
        bannerColor: qr?.bannerColor || '#0ea5e9',
        bannerTintColor: qr?.bannerTintColor || '#0ea5e9',
        bannerTintOpacity: typeof qr?.bannerTintOpacity === 'number' ? qr.bannerTintOpacity : 0.42,
      });
      setOpenEdit(true);
    } catch (e: any) {
      setErrMsg(e?.message || 'ไม่สามารถเปิดหน้าต่างแก้ไขได้');
    }
  };

  const handleCloseEdit = () => { if (!editing) setOpenEdit(false); };

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
      let bannerColor: string | undefined = (form.bannerMode === 'color')
        ? ((form.bannerColor || '').trim() || undefined)
        : undefined;

      if (form.bannerMode === 'image' && form.bannerFile) {
        if (form.bannerUrl) await deleteBannerIfOwned(form.bannerUrl);
        newBannerUrl = await uploadBannerIfNeeded(currentAdmin.department, code, form.bannerFile);
      }
      if (form.bannerMode !== 'image') {
        if (form.bannerUrl) await deleteBannerIfOwned(form.bannerUrl);
        newBannerUrl = undefined;
      }

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
          updatedAt: serverTimestamp(),
          stateVersion: Date.now(),
        });

        if ((form.description ?? '').trim() === '') {
          updates.description = deleteField();
        } else {
          updates.description = form.description.trim();
        }

        await updateDoc(doc(db, 'activityQRCodes', qrDocId), updates);
      }

      setOpenEdit(false);
      await load();
    } catch (e: any) {
      setErrMsg(e?.message || 'เกิดข้อผิดพลาดในการบันทึกการแก้ไข');
    } finally { setEditing(false); }
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
          await updateDoc(qd.ref, { isActive: false, scanEnabled: false, forceRefresh: true, updatedAt: serverTimestamp() });
        }
      } catch {}

      try { await updateDoc(doc(db, 'activities', a.id), { isActive: false, updatedAt: serverTimestamp() }); } catch {}
      try { await deleteDoc(doc(db, 'activities', a.id)); } catch {}

      if (!snap.empty) {
        const qd = snap.docs[0];
        const qdata = qd.data() as any;
        try { if (qdata?.bannerUrl) await deleteBannerIfOwned(qdata.bannerUrl); } catch {}
        try { await deleteDoc(qd.ref); } catch {}
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
    title: string; code: string; qr?: string; dept: string; when: string; place?: string; scanEnabled: boolean; bannerUrl?: string; bannerColor?: string;
  }> = ({ title, code, qr, dept, when, place, scanEnabled, bannerUrl, bannerColor }) => {
    const hasImg = Boolean(bannerUrl);
    const style: React.CSSProperties = hasImg
      ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : bannerColor
        ? { background: bannerColor }
        : { background: 'linear-gradient(135deg,#4f46e5,#06b6d4)' };

    return (
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', maxWidth: 380, mx: 'auto' }}>
        <Box sx={{ height: 90, ...style }} />
        <Box sx={{ p: 2 }}>
          <Stack spacing={1} alignItems="center">
            <Typography variant="subtitle2" color="text.secondary">{dept}</Typography>
            <Typography variant="h6" fontWeight={800} textAlign="center">{title}</Typography>
            <Typography variant="caption" color="text.secondary">{when}</Typography>
            {place && <Typography variant="caption" color="text.secondary"><PlaceIcon fontSize="inherit" sx={{ mr: .5 }} />{place}</Typography>}
            <Box sx={{ mt: 1.5, p: 1, borderRadius: 2, border: '1px dashed', borderColor: 'divider', position: 'relative' }}>
              {qr ? <img src={qr} alt="QR" style={{ width: 200, height: 200 }} /> : <Box sx={{ width: 200, height: 200, bgcolor: 'grey.100' }} />}
              {!scanEnabled && (
                <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,.65)', borderRadius: 2, display: 'grid', placeItems: 'center' }}>
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

  /* ===================== Render ===================== */
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <QrCodeIcon /> จัดการ QR Code & กิจกรรม
          </Typography>
          <Chip size="small" label={`สังกัด: ${deptLabelOf(currentAdmin.department)}`} color="primary" variant="outlined" />
          <Chip size="small" label={`ฐาน: ${getBaseUrl()}`} variant="outlined" />
        </Stack>

        <Stack direction="row" spacing={1}>
          <Tabs value={view === 'cards' ? 0 : 1} onChange={(_, v) => setView(v === 0 ? 'cards' : 'table')} sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36 } }}>
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
        <Grid item xs={12} sm={6} md={4}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color="primary">{activeCount}</Typography>
            <Typography>กิจกรรมที่เปิดอยู่</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h3" color="success.main">{activities.length}</Typography>
            <Typography>กิจกรรมทั้งหมด</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      {/* List */}
      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
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
                const when = `${a.startDateTime?.toLocaleString('th-TH') || '-'} - ${a.endDateTime?.toLocaleString('th-TH') || '-'}`;
                const bannerColor = (a as any).bannerColor as string | undefined;
                return (
                  <Grid item xs={12} sm={6} md={4} key={a.id}>
                    <QrPreviewCard
                      title={a.activityName || 'กิจกรรม'}
                      code={a.activityCode}
                      qr={(a as any).qrUrl}
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
                        <IconButton color="primary" size="small" onClick={() => openEditDialog(a)}><EditIcon /></IconButton>
                      </Tooltip>
                      <Tooltip title="ดาวน์โหลด">
                        <IconButton color="secondary" size="small" onClick={(e) => openDownloadMenu(e, a)}><DownloadIcon /></IconButton>
                      </Tooltip>
                      <Tooltip title="รายชื่อผู้ลงทะเบียน">
                        <IconButton color="info" size="small" onClick={() => window.open(`/admin/records?activity=${encodeURIComponent(a.activityCode)}`, '_blank')}><PeopleIcon /></IconButton>
                      </Tooltip>
                      <Tooltip title="ดูหน้าลงทะเบียน">
                        <IconButton color="info" size="small" onClick={() => window.open(makeRegisterUrl(a.activityCode), '_blank')}><ViewIcon /></IconButton>
                      </Tooltip>
                      <Tooltip title="ลบ">
                        <IconButton color="error" size="small" onClick={() => handleDeleteActivity(a)}><DeleteIcon /></IconButton>
                      </Tooltip>
                    </Stack>
                    <Box sx={{ mt: 1, textAlign: 'center' }}><Chip size="small" label={st.label} color={st.color} /></Box>
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
                    const when = `${a.startDateTime?.toLocaleString('th-TH') || '-'} - ${a.endDateTime?.toLocaleString('th-TH') || '-'}`;
                    const bannerColor = (a as any).bannerColor as string | undefined;
                    return (
                      <TableRow key={a.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box sx={{
                              width: 40, height: 28, borderRadius: 1,
                              background: (a as any).bannerUrl
                                ? `url(${(a as any).bannerUrl}) center/cover no-repeat`
                                : (bannerColor || 'linear-gradient(135deg,#4f46e5,#06b6d4)')
                            }} />
                            <Box>
                              <Typography fontWeight={700}>{a.activityName || '-'}</Typography>
                              <Typography variant="caption" color="text.secondary">{deptLabelOf((a as any).department ?? currentAdmin.department)}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{a.activityCode}</TableCell>
                        <TableCell>{when}</TableCell>
                        <TableCell>{(a as any).location || '-'}</TableCell>
                        <TableCell align="center"><Chip size="small" label={st.label} color={st.color} /></TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" variant="outlined" onClick={() => handleToggle(a)}>
                              {a.isActive ? 'ปิด' : 'เปิด'}
                            </Button>
                            <IconButton size="small" color="primary" onClick={() => openEditDialog(a)}><EditIcon fontSize="small" /></IconButton>
                            <IconButton size="small" color="secondary" onClick={(e) => openDownloadMenu(e, a)}><DownloadIcon fontSize="small" /></IconButton>
                            <IconButton size="small" color="info" onClick={() => window.open(makeRegisterUrl(a.activityCode), '_blank')}><ViewIcon fontSize="small" /></IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDeleteActivity(a)}><DeleteIcon fontSize="small" /></IconButton>
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
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="QR PNG (512px)" />
        </MenuItem>
        <MenuItem onClick={() => handleDownloadQr(1024)}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="QR PNG (1024px)" />
        </MenuItem>
        <MenuItem onClick={() => handleDownloadQr(2048)}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="QR PNG (2048px)" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleDownloadPoster('square')}>
          <ListItemIcon><ImageIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="โปสเตอร์ (สี่เหลี่ยมแนวตั้ง)" />
        </MenuItem>
        <MenuItem onClick={() => handleDownloadPoster('a4')}>
          <ListItemIcon><ImageIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="โปสเตอร์ (A4)" />
        </MenuItem>
      </Menu>

      {/* ===================== Create Dialog ===================== */}
      <Dialog open={openCreate} onClose={handleCloseCreate} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <QrCodeIcon /><Typography variant="h6">สร้างกิจกรรม & QR Code</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {errMsg && <Alert severity="error" sx={{ mb: 2 }}>{errMsg}</Alert>}

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Grid container spacing={2}>
              {/* สังกัด */}
              <Grid item xs={12}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="text.secondary">สังกัดที่จะบันทึก:</Typography>
                  <Chip size="small" color="primary" variant="outlined"
                    label={deptLabelOf(currentAdmin.department)} />
                </Stack>
              </Grid>

              {/* ชื่อ/รหัสกิจกรรม + สุ่ม/คัดลอก */}
              <Grid item xs={12} md={8}>
                <TextField label="ชื่อกิจกรรม *" fullWidth value={form.activityName}
                  onChange={(e) => updateForm('activityName', e.target.value)} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField label="รหัสกิจกรรม *" fullWidth value={form.activityCode}
                    onChange={(e) => updateForm('activityCode', e.target.value.toUpperCase())}
                    inputProps={{ maxLength: 64 }} />
                  <Tooltip title="สุ่ม"><IconButton onClick={() => updateForm('activityCode', randomActivityCode())}><ShuffleIcon /></IconButton></Tooltip>
                  <Tooltip title="คัดลอก"><IconButton onClick={async () => { try { await navigator.clipboard.writeText(form.activityCode); } catch {} }}><CopyIcon /></IconButton></Tooltip>
                </Stack>
              </Grid>

              {/* userCode */}
              <Grid item xs={12} md={4}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField label="รหัสผู้ใช้ (userCode)" fullWidth value={form.userCode}
                    onChange={(e) => updateForm('userCode', e.target.value)} placeholder="ว่างได้ / กดสุ่ม" />
                  <Tooltip title="สุ่ม"><IconButton onClick={() => updateForm('userCode', randomUserCode())}><ShuffleIcon /></IconButton></Tooltip>
                  <Tooltip title="คัดลอก"><IconButton onClick={async () => { try { await navigator.clipboard.writeText(form.userCode); } catch {} }}><CopyIcon /></IconButton></Tooltip>
                </Stack>
              </Grid>

              {/* ส่วนหัว */}
              <Grid item xs={12} md={8}>
                <TextField label="ส่วนหัว (จะแสดงบนหน้าลงทะเบียน)" fullWidth value={form.headerTitle}
                  onChange={(e) => updateForm('headerTitle', e.target.value)} placeholder="เช่น ลงทะเบียนกิจกรรม Orientation" />
              </Grid>

              {/* โหมดแบนเนอร์ */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>โหมดแบนเนอร์</InputLabel>
                  <Select label="โหมดแบนเนอร์" value={form.bannerMode}
                    onChange={(e) => updateForm('bannerMode', e.target.value as BannerMode)}>
                    <MenuItem value="none">ไม่ใช้ (แสดงเป็นสี)</MenuItem>
                    <MenuItem value="image">รูปภาพ</MenuItem>
                    <MenuItem value="color">สี/Gradient</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* แบนเนอร์ตามโหมด */}
              {form.bannerMode === 'image' && (
                <Grid item xs={12}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                    <Button component="label" startIcon={<ImageIcon />} variant="outlined">
                      เลือกรูปส่วนหัว
                      <input hidden type="file" accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          updateForm('bannerFile', file);
                          if (file) updateForm('bannerUrl', URL.createObjectURL(file));
                        }} />
                    </Button>
                    {form.bannerUrl && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <img src={form.bannerUrl} alt="banner-preview" style={{ height: 60, borderRadius: 8 }} />
                        <IconButton color="error" onClick={() => { updateForm('bannerUrl', undefined); updateForm('bannerFile', null); }}>
                          <ClearIcon />
                        </IconButton>
                      </Stack>
                    )}
                  </Stack>
                </Grid>
              )}
              {form.bannerMode === 'color' && (
                <Grid item xs={12}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      label="สี/Gradient (CSS)" fullWidth value={form.bannerColor}
                      onChange={(e) => updateForm('bannerColor', e.target.value)}
                      placeholder="เช่น #0ea5e9 หรือ linear-gradient(135deg,#4f46e5,#06b6d4)"
                      InputProps={{ startAdornment: (<InputAdornment position="start"><ColorIcon /></InputAdornment>) }}
                    />
                    <Box sx={{ width: 48, height: 48, borderRadius: 1, border: '1px solid rgba(0,0,0,.12)', background: form.bannerColor }} />
                  </Stack>
                </Grid>
              )}

              {/* สีทับ + ความทึบ */}
              <Grid item xs={12} md={7}>
                <TextField
                  label="สีทับ (Tint) — ใช้ทับบนรูป/กำหนดสีหลัก"
                  fullWidth
                  value={form.bannerTintColor}
                  onChange={(e) => updateForm('bannerTintColor', e.target.value)}
                  placeholder="#0ea5e9 หรือ rgba(14,165,233,1)"
                  InputProps={{ startAdornment: (<InputAdornment position="start"><ColorIcon /></InputAdornment>) }}
                />
              </Grid>
              <Grid item xs={12} md={5}>
                <Stack spacing={0.5}>
                  <Typography variant="body2" fontWeight={600}>
                    ความทึบของสีทับ: {(form.bannerTintOpacity * 100).toFixed(0)}%
                  </Typography>
                  <Slider
                    value={Math.round(form.bannerTintOpacity * 100)}
                    onChange={(_, v) => {
                      const pct = Array.isArray(v) ? v[0] : v;
                      updateForm('bannerTintOpacity', Math.max(0, Math.min(100, Number(pct))) / 100);
                    }}
                    step={1}
                    min={0}
                    max={100}
                    valueLabelDisplay="auto"
                  />
                </Stack>
              </Grid>

              {/* คำอธิบาย/สถานที่ */}
              <Grid item xs={12}>
                <TextField label="คำอธิบาย" fullWidth multiline minRows={2}
                  value={form.description} onChange={(e) => updateForm('description', e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField label="สถานที่" fullWidth value={form.location}
                  onChange={(e) => updateForm('location', e.target.value)} />
              </Grid>

              {/* แผนที่ */}
              <Grid item xs={12}>
                <GeofenceMap
                  center={{
                    lat: typeof form.latitude === 'number' ? form.latitude : 13.7563,
                    lng: typeof form.longitude === 'number' ? form.longitude : 100.5018,
                  }}
                  radius={form.checkInRadius || 100}
                  title="กำหนดจุดกิจกรรม"
                  editable
                  onCenterChange={(pos) => { updateForm('latitude', pos.lat); updateForm('longitude', pos.lng); }}
                  onUseCurrentLocation={useCurrentLocation}
                />
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <MyLocationIcon fontSize="small" />
                  <Typography variant="caption" color="text.secondary">
                    กดปุ่ม “แสดงเส้นทาง” เพื่อบันทึกจุดอย่างรวดเร็ว หรือใช้ “ตำแหน่งปัจจุบัน” ได้
                  </Typography>
                </Stack>
              </Grid>

              {/* เลือกระยะ */}
              <Grid item xs={12}>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                  รัศมีเช็คอิน (เมตร): {form.checkInRadius}
                </Typography>
                <Slider
                  value={form.checkInRadius}
                  onChange={(_, v) => updateForm('checkInRadius', Array.isArray(v) ? v[0] : Number(v))}
                  valueLabelDisplay="auto"
                  step={10}
                  min={10}
                  max={2000}
                />
              </Grid>

              {/* เวลา */}
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="เริ่มต้น"
                  value={form.startDateTime}
                  onChange={(value: any, _ctx) => updateForm('startDateTime', value as Dayjs | null)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="สิ้นสุด"
                  value={form.endDateTime}
                  onChange={(value: any, _ctx) => updateForm('endDateTime', value as Dayjs | null)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              {/* options */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="จำนวนสูงสุด (เว้นว่าง = ไม่จำกัด)" fullWidth value={form.maxParticipants ?? ''}
                  onChange={(e) => updateForm('maxParticipants', e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
                  placeholder="เช่น 300"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center" justifyContent="flex-end" sx={{ height: '100%' }}>
                  <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => updateForm('isActive', e.target.checked)} />} label="เปิดใช้งาน" />
                  <FormControlLabel control={<Switch checked={form.scanEnabled} onChange={(e) => updateForm('scanEnabled', e.target.checked)} />} label="เปิดให้สแกน QR" />
                  <FormControlLabel control={<Switch checked={form.requiresUniversityLogin} onChange={(e) => updateForm('requiresUniversityLogin', e.target.checked)} />} label="ต้องลงชื่อเข้าใช้มหาวิทยาลัย" />
                  <FormControlLabel control={<Switch checked={form.singleUserMode} onChange={(e) => updateForm('singleUserMode', e.target.checked)} />} label="Single-user mode" />
                </Stack>
              </Grid>

              {/* พรีวิว QR */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>พรีวิว QR & รายละเอียด</Typography>
                <QrPreviewCard
                  title={form.activityName || 'กิจกรรม'}
                  code={form.activityCode}
                  qr={form.qrDataUrl}
                  dept={deptLabelOf(currentAdmin.department)}
                  when={`${dayjs(form.startDateTime ?? undefined).format('DD MMM YYYY HH:mm')} - ${dayjs(form.endDateTime ?? undefined).format('DD MMM YYYY HH:mm')}`}
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
            <Button
              onClick={handleCreateSubmit}
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={18} /> : <AddIcon />}
            >
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
                    ? { backgroundImage: `url(${form.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', height: 160 }
                    : form.bannerMode === 'color' && form.bannerColor
                    ? { background: form.bannerColor, height: 120 }
                    : { background: tint, height: 120 }),
                }}
              >
                {hasImage && (
                  <Box sx={{
                    position: 'absolute', inset: 0,
                    background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${op ? 'rgba(0,0,0,' + (op*0.15).toFixed(2) + ')' : 'transparent'} 35%, ${tint})`,
                    mixBlendMode: 'multiply',
                    opacity: op,
                  }} />
                )}
              </Box>
            );
          })()}

          <Typography variant="h5" fontWeight={800} gutterBottom>{form.activityName || 'กิจกรรม'}</Typography>
          {form.headerTitle && <Typography color="text.secondary" gutterBottom>{form.headerTitle}</Typography>}
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
            <Chip size="small" label={`สังกัด: ${deptLabelOf(currentAdmin.department)}`} />
            <Chip size="small" label={`${dayjs(form.startDateTime ?? undefined).format('DD MMM YYYY HH:mm')} - ${dayjs(form.endDateTime ?? undefined).format('DD MMM YYYY HH:mm')}`} />
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
              when={`${dayjs(form.startDateTime ?? undefined).format('DD MMM YYYY HH:mm')} - ${dayjs(form.endDateTime ?? undefined).format('DD MMM YYYY HH:mm')}`}
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
            <EditIcon /><Typography variant="h6">แก้ไขกิจกรรม</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {errMsg && <Alert severity="error" sx={{ mb: 2 }}>{errMsg}</Alert>}

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <TextField label="ชื่อกิจกรรม *" fullWidth value={form.activityName}
                  onChange={(e) => updateForm('activityName', e.target.value)} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField label="รหัสกิจกรรม" fullWidth value={form.activityCode} disabled />
              </Grid>

              {/* userCode */}
              <Grid item xs={12} md={4}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField label="รหัสผู้ใช้ (userCode)" fullWidth value={form.userCode}
                    onChange={(e) => updateForm('userCode', e.target.value)} />
                  <Tooltip title="สุ่ม"><IconButton onClick={() => updateForm('userCode', randomUserCode())}><ShuffleIcon /></IconButton></Tooltip>
                  <Tooltip title="คัดลอก"><IconButton onClick={async () => { try { await navigator.clipboard.writeText(form.userCode); } catch {} }}><CopyIcon /></IconButton></Tooltip>
                </Stack>
              </Grid>

              {/* ส่วนหัว */}
              <Grid item xs={12} md={8}>
                <TextField label="ส่วนหัว" fullWidth value={form.headerTitle}
                  onChange={(e) => updateForm('headerTitle', e.target.value)} />
              </Grid>

              {/* แบนเนอร์ */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>โหมดแบนเนอร์</InputLabel>
                  <Select label="โหมดแบนเนอร์" value={form.bannerMode}
                    onChange={(e) => updateForm('bannerMode', e.target.value as BannerMode)}>
                    <MenuItem value="none">ไม่ใช้ (แสดงเป็นสี)</MenuItem>
                    <MenuItem value="image">รูปภาพ</MenuItem>
                    <MenuItem value="color">สี/Gradient</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {form.bannerMode === 'image' && (
                <Grid item xs={12}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                    <Button component="label" startIcon={<ImageIcon />} variant="outlined">
                      เปลี่ยนรูปส่วนหัว
                      <input hidden type="file" accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          updateForm('bannerFile', file);
                          if (file) updateForm('bannerUrl', URL.createObjectURL(file));
                        }} />
                    </Button>
                    {form.bannerUrl ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <img src={form.bannerUrl} alt="banner-preview" style={{ height: 60, borderRadius: 8 }} />
                        <Button color="error" startIcon={<ClearIcon />}
                          onClick={async () => { await deleteBannerIfOwned(form.bannerUrl); updateForm('bannerUrl', undefined); updateForm('bannerFile', null); }}>
                          ลบรูป
                        </Button>
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">ไม่มีรูปส่วนหัว</Typography>
                    )}
                  </Stack>
                </Grid>
              )}
              {form.bannerMode === 'color' && (
                <Grid item xs={12}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      label="สี/Gradient (CSS)" fullWidth value={form.bannerColor}
                      onChange={(e) => updateForm('bannerColor', e.target.value)}
                      placeholder="เช่น #0ea5e9 หรือ linear-gradient(135deg,#4f46e5,#06b6d4)"
                      InputProps={{ startAdornment: (<InputAdornment position="start"><ColorIcon /></InputAdornment>) }}
                    />
                    <Box sx={{ width: 48, height: 48, borderRadius: 1, border: '1px solid rgba(0,0,0,.12)', background: form.bannerColor }} />
                  </Stack>
                </Grid>
              )}

              {/* สีทับ + ความทึบ */}
              <Grid item xs={12} md={7}>
                <TextField
                  label="สีทับ (Tint) — ใช้ทับบนรูป/กำหนดสีหลัก"
                  fullWidth
                  value={form.bannerTintColor}
                  onChange={(e) => updateForm('bannerTintColor', e.target.value)}
                  placeholder="#0ea5e9 หรือ rgba(14,165,233,1)"
                  InputProps={{ startAdornment: (<InputAdornment position="start"><ColorIcon /></InputAdornment>) }}
                />
              </Grid>
              <Grid item xs={12} md={5}>
                <Stack spacing={0.5}>
                  <Typography variant="body2" fontWeight={600}>
                    ความทึบของสีทับ: {(form.bannerTintOpacity * 100).toFixed(0)}%
                  </Typography>
                  <Slider
                    value={Math.round(form.bannerTintOpacity * 100)}
                    onChange={(_, v) => {
                      const pct = Array.isArray(v) ? v[0] : v;
                      updateForm('bannerTintOpacity', Math.max(0, Math.min(100, Number(pct))) / 100);
                    }}
                    step={1}
                    min={0}
                    max={100}
                    valueLabelDisplay="auto"
                  />
                </Stack>
              </Grid>

              {/* คำอธิบาย/สถานที่ */}
              <Grid item xs={12}>
                <TextField label="คำอธิบาย" fullWidth multiline minRows={2}
                  value={form.description} onChange={(e) => updateForm('description', e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField label="สถานที่" fullWidth value={form.location}
                  onChange={(e) => updateForm('location', e.target.value)} />
              </Grid>

              {/* แผนที่ */}
              <Grid item xs={12}>
                <GeofenceMap
                  center={{
                    lat: typeof form.latitude === 'number' ? form.latitude : 13.7563,
                    lng: typeof form.longitude === 'number' ? form.longitude : 100.5018,
                  }}
                  radius={form.checkInRadius || 100}
                  title="ปรับตำแหน่งกิจกรรม"
                  editable
                  onCenterChange={(pos) => { updateForm('latitude', pos.lat); updateForm('longitude', pos.lng); }}
                  onUseCurrentLocation={useCurrentLocation}
                />
              </Grid>

              {/* เลือกระยะ */}
              <Grid item xs={12}>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                  รัศมีเช็คอิน (เมตร): {form.checkInRadius}
                </Typography>
                <Slider
                  value={form.checkInRadius}
                  onChange={(_, v) => updateForm('checkInRadius', Array.isArray(v) ? v[0] : Number(v))}
                  valueLabelDisplay="auto"
                  step={10}
                  min={10}
                  max={2000}
                />
              </Grid>

              {/* เวลา */}
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="เริ่มต้น"
                  value={form.startDateTime}
                  onChange={(value: any, _ctx) => updateForm('startDateTime', value as Dayjs | null)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="สิ้นสุด"
                  value={form.endDateTime}
                  onChange={(value: any, _ctx) => updateForm('endDateTime', value as Dayjs | null)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              {/* options */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="จำนวนสูงสุด (เว้นว่าง = ไม่จำกัด)" fullWidth value={form.maxParticipants ?? ''}
                  onChange={(e) =>
                    updateForm('maxParticipants', e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))
                  }
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center" justifyContent="flex-end" sx={{ height: '100%' }}>
                  <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => updateForm('isActive', e.target.checked)} />} label="เปิดใช้งาน" />
                  <FormControlLabel control={<Switch checked={form.scanEnabled} onChange={(e) => updateForm('scanEnabled', e.target.checked)} />} label="เปิดให้สแกน QR" />
                  <FormControlLabel control={<Switch checked={form.requiresUniversityLogin} onChange={(e) => updateForm('requiresUniversityLogin', e.target.checked)} />} label="ต้องลงชื่อเข้าใช้มหาวิทยาลัย" />
                  <FormControlLabel control={<Switch checked={form.singleUserMode} onChange={(e) => updateForm('singleUserMode', e.target.checked)} />} label="Single-user mode" />
                </Stack>
              </Grid>
            </Grid>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit} disabled={editing}>ยกเลิก</Button>
          <Button onClick={handleEditSubmit} variant="contained" disabled={editing}
            startIcon={editing ? <CircularProgress size={18} /> : <EditIcon />}>
            บันทึกการแก้ไข
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default QRCodeAdminPanel;
