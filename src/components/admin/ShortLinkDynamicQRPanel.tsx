// components/admin/ShortLinkDynamicQRPanel.tsx
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Switch,
  CircularProgress,
  TextField,
  InputAdornment,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  OpenInNew as OpenInNewIcon,
  Check as CheckIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { Link2, MonitorPlay, QrCode, RefreshCw, Trash2, Plus, BarChart2, Settings2, MapPin, Smartphone, Monitor, Cpu, Globe, Activity as ActivityIcon, TrendingUp, BarChart3, Sparkles, ImageOff } from 'lucide-react';

import {
  subscribeActivities,
  toggleActivityLive,
  type Activity,
} from '../../lib/adminFirebase';
import { DEPARTMENT_LABELS, type AdminProfile, type AdminDepartment } from '../../types/admin';
import { PageHeader } from './shared/PageHeader';
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, where, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';
import { adminDb as db, adminStorage as storage } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import MagnificImageDialog from './MagnificImageDialog';
import { useConfirm } from '@/components/providers/ConfirmDialogProvider';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* ===================== URL Helpers ===================== */
const envBase = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || '').toString();

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.origin) {
    const origin = window.location.origin;
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('[::1]');
    if (isLocalhost && envBase) return envBase.replace(/\/$/, '');
    return origin.replace(/\/$/, '');
  }
  if (envBase) return envBase.replace(/\/$/, '');
  return '';
};

const makeShortUrl = (code: string) =>
  `${getBaseUrl()}/r/${encodeURIComponent(code.trim().toUpperCase())}`;
const makeRegisterUrl = (code: string) =>
  `${getBaseUrl()}/register?activity=${encodeURIComponent(code.trim().toUpperCase())}`;
const makeDynamicQrUrl = (code: string) =>
  `/admin/dynamic-qr/${encodeURIComponent(code.trim().toUpperCase())}`;

const randomSlug = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const bytes = new Uint8Array(6);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  }
  for (let i = 0; i < 6; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
};

const formatToDatetimeLocal = (date?: Date | any) => {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return '';
  const tzoffset = d.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
  return localISOTime;
};

/* ===================== QR Helpers ===================== */
const generateQrPng = async (text: string, size = 400) => {
  const QR = await import('qrcode');
  return QR.toDataURL(text, { margin: 1, width: size, errorCorrectionLevel: 'M' });
};

const downloadDataUrl = (dataUrl: string, filename: string) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

/* ===================== Status ===================== */
const statusOf = (a: Activity) => {
  const now = new Date();
  if (!a.isActive) return { label: 'ปิดใช้งาน', color: 'default' as const, dotColor: 'bg-slate-400' };
  if (a.startDateTime && now < a.startDateTime) return { label: 'รอเปิด', color: 'warning' as const, dotColor: 'bg-amber-400' };
  if (a.endDateTime && now > a.endDateTime) return { label: 'สิ้นสุดแล้ว', color: 'default' as const, dotColor: 'bg-slate-400' };
  return { label: 'เปิดใช้งาน', color: 'success' as const, dotColor: 'bg-emerald-500' };
};

/* ===================== Component ===================== */
interface CustomShortLink {
  id: string;
  customCode: string;
  targetUrl: string;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
  department: string;
  clicksCount?: number;
  linkEnabled?: boolean;
  linkStartAt?: any;
  linkEndAt?: any;
}

interface Props {
  currentAdmin: AdminProfile;
}

export default function ShortLinkDynamicQRPanel({ currentAdmin }: Props) {
  const confirm = useConfirm();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrCache, setQrCache] = useState<Record<string, string>>({});
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [snack, setSnack] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Custom short link states (for Activities)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [savingCustomCode, setSavingCustomCode] = useState(false);

  // General custom links states (External links)
  const [activeTab, setActiveTab] = useState(0);
  const [customLinks, setCustomLinks] = useState<CustomShortLink[]>([]);
  const [customLinksLoading, setCustomLinksLoading] = useState(true);
  const [openGeneralDialog, setOpenGeneralDialog] = useState(false);
  const [editingGeneralLink, setEditingGeneralLink] = useState<CustomShortLink | null>(null);
  const [generalCodeInput, setGeneralCodeInput] = useState('');
  const [generalUrlInput, setGeneralUrlInput] = useState('');
  const [savingGeneralLink, setSavingGeneralLink] = useState(false);

  // Link settings & timer configurations
  const [openSettingsDialog, setOpenSettingsDialog] = useState(false);
  const [settingsTargetType, setSettingsTargetType] = useState<'activity' | 'general'>('activity');
  const [settingsDocId, setSettingsDocId] = useState('');
  const [settingsLinkName, setSettingsLinkName] = useState('');
  const [settingsLinkEnabled, setSettingsLinkEnabled] = useState(true);
  const [settingsLinkStartAt, setSettingsLinkStartAt] = useState('');
  const [settingsLinkEndAt, setSettingsLinkEndAt] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Analytics configurations
  const [openAnalyticsDialog, setOpenAnalyticsDialog] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [visitsData, setVisitsData] = useState<any[]>([]);
  const [selectedLinkName, setSelectedLinkName] = useState('');

  // Magnific AI background for Dynamic QR display screen
  const [bgTargetActivity, setBgTargetActivity] = useState<Activity | null>(null);
  const [removingBgId, setRemovingBgId] = useState<string | null>(null);

  // Upload the generated background to Storage, then save its URL on the activity doc
  const handleUseQrBackground = useCallback(async (file: File) => {
    if (!bgTargetActivity) return;
    const dept = bgTargetActivity.department || currentAdmin.department;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `banners/${dept}/qrbg_${bgTargetActivity.activityCode}_${Date.now()}.${ext}`;
    const r = ref(storage, path);
    await uploadBytes(r, file);
    const url = await getDownloadURL(r);

    await updateDoc(doc(db, 'activityQRCodes', bgTargetActivity.id), {
      dynamicQrBgUrl: url,
      updatedAt: serverTimestamp(),
    });
    setSnack({ message: `บันทึกพื้นหลังจอ Dynamic QR สำเร็จ: ${bgTargetActivity.activityName}`, type: 'success' });
    setBgTargetActivity(null);
  }, [bgTargetActivity, currentAdmin.department]);

  const handleRemoveQrBackground = useCallback(async (a: Activity) => {
    setRemovingBgId(a.id);
    try {
      await updateDoc(doc(db, 'activityQRCodes', a.id), {
        dynamicQrBgUrl: null,
        updatedAt: serverTimestamp(),
      });
      setSnack({ message: `ลบพื้นหลังจอ Dynamic QR แล้ว: ${a.activityName}`, type: 'success' });
    } catch (e: any) {
      setSnack({ message: `ลบพื้นหลังไม่สำเร็จ: ${e?.message || ''}`, type: 'error' });
    } finally {
      setRemovingBgId(null);
    }
  }, []);

  // Subscribe to activities
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeActivities(
      currentAdmin.department as AdminDepartment,
      (data) => {
        setActivities(data);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [currentAdmin.department]);

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return activities;
    const q = search.toLowerCase();
    return activities.filter(
      (a) =>
        a.activityName.toLowerCase().includes(q) ||
        a.activityCode.toLowerCase().includes(q) ||
        (a.customCode || '').toLowerCase().includes(q) ||
        (a.location || '').toLowerCase().includes(q)
    );
  }, [activities, search]);

  // Stats
  const stats = useMemo(() => ({
    total: activities.length,
    active: activities.filter((a) => a.isActive).length,
    dynamicQR: activities.filter((a) => a.dynamicQREnabled).length,
  }), [activities]);

  // Copy to clipboard
  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setSnack({ message: 'ไม่สามารถคัดลอกได้', type: 'error' });
    }
  }, []);

  // Generate / cache QR
  const getQr = useCallback(async (code: string) => {
    if (qrCache[code]) return qrCache[code];
    const url = makeShortUrl(code);
    const dataUrl = await generateQrPng(url, 600);
    setQrCache((prev) => ({ ...prev, [code]: dataUrl }));
    return dataUrl;
  }, [qrCache]);

  // Download QR
  const handleDownloadQr = useCallback(async (a: Activity) => {
    try {
      const codeToShow = a.customCode || a.activityCode;
      const dataUrl = await getQr(codeToShow);
      downloadDataUrl(dataUrl, `QR-${codeToShow}.png`);
      setSnack({ message: `ดาวน์โหลด QR สำเร็จ: ${a.activityName}`, type: 'success' });
    } catch {
      setSnack({ message: 'เกิดข้อผิดพลาดในการสร้าง QR', type: 'error' });
    }
  }, [getQr]);

  // Toggle dynamic QR
  const handleToggleDynamicQR = useCallback(async (a: Activity) => {
    const newVal = !a.dynamicQREnabled;
    setTogglingIds((prev) => new Set(prev).add(a.id));
    try {
      const ref = doc(db, 'activityQRCodes', a.id);
      await updateDoc(ref, {
        dynamicQREnabled: newVal,
        updatedAt: serverTimestamp(),
      });
      setSnack({
        message: newVal
          ? `เปิด Dynamic QR: ${a.activityName}`
          : `ปิด Dynamic QR: ${a.activityName}`,
        type: 'success',
      });
    } catch (e: any) {
      setSnack({ message: `อัปเดตไม่สำเร็จ: ${e?.message || ''}`, type: 'error' });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(a.id);
        return next;
      });
    }
  }, []);

  // Save Custom Short Link Code for Activities
  const handleSaveCustomCode = async () => {
    if (!editingActivity) return;
    setSavingCustomCode(true);
    try {
      const code = customCodeInput.trim().toUpperCase();
      
      if (code) {
        // Validation: English, Numbers, Dash, Underscore only
        if (!/^[A-Z0-9_-]+$/.test(code)) {
          setSnack({ message: 'รหัสลิงก์ย่อต้องเป็นภาษาอังกฤษ ตัวเลข หรือเครื่องหมาย - หรือ _ เท่านั้น', type: 'error' });
          setSavingCustomCode(false);
          return;
        }

        // Check uniqueness in activityQRCodes
        const q1 = query(
          collection(db, 'activityQRCodes'),
          where('customCode', '==', code)
        );
        const snap1 = await getDocs(q1);
        if (snap1.docs.some((d) => d.id !== editingActivity.id)) {
          setSnack({ message: 'รหัสลิงก์ย่อนี้ถูกใช้งานในกิจกรรมอื่นแล้ว กรุณาป้อนรหัสอื่น', type: 'error' });
          setSavingCustomCode(false);
          return;
        }

        // Check uniqueness in customShortLinks
        const q2 = query(
          collection(db, 'customShortLinks'),
          where('customCode', '==', code)
        );
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          setSnack({ message: 'รหัสลิงก์ย่อนี้ถูกใช้งานในลิงก์ทั่วไปแล้ว กรุณาป้อนรหัสอื่น', type: 'error' });
          setSavingCustomCode(false);
          return;
        }
      }

      // Update Firestore
      const ref = doc(db, 'activityQRCodes', editingActivity.id);
      await updateDoc(ref, {
        customCode: code || null, // remove if empty
        updatedAt: serverTimestamp(),
      });

      // Clear old QR cache to allow recreation
      setQrCache((prev) => {
        const next = { ...prev };
        delete next[editingActivity.activityCode];
        if (editingActivity.customCode) {
          delete next[editingActivity.customCode];
        }
        return next;
      });

      setSnack({
        message: code
          ? `บันทึกลิ้งก์ย่อกำหนดเองสำเร็จ: /r/${code}`
          : 'รีเซ็ตลิ้งก์ย่อเป็นค่าเริ่มต้นสำเร็จ',
        type: 'success',
      });
      setEditingActivity(null);
    } catch (e: any) {
      console.error(e);
      setSnack({ message: `เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${e.message || ''}`, type: 'error' });
    } finally {
      setSavingCustomCode(false);
    }
  };

  // Open Edit Dialog for Activities
  const openEditCustomCode = (a: Activity) => {
    setEditingActivity(a);
    setCustomCodeInput(a.customCode || '');
  };

  // Subscribe to general custom links (External links)
  useEffect(() => {
    setCustomLinksLoading(true);
    const colRef = collection(db, 'customShortLinks');
    const q = currentAdmin.department === 'all'
      ? colRef
      : query(colRef, where('department', '==', currentAdmin.department));
      
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as CustomShortLink[];
      setCustomLinks(data);
      setCustomLinksLoading(false);
    });
    return () => unsub();
  }, [currentAdmin.department]);

  // Save General Custom Short Link
  const handleSaveGeneralLink = async () => {
    setSavingGeneralLink(true);
    try {
      const code = generalCodeInput.trim().toUpperCase();
      const targetUrl = generalUrlInput.trim();

      if (!code || !targetUrl) {
        setSnack({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน', type: 'error' });
        setSavingGeneralLink(false);
        return;
      }

      // Validation slug format
      if (!/^[A-Z0-9_-]+$/.test(code)) {
        setSnack({ message: 'รหัสลิงก์ย่อต้องเป็นภาษาอังกฤษ ตัวเลข หรือเครื่องหมาย - หรือ _ เท่านั้น', type: 'error' });
        setSavingGeneralLink(false);
        return;
      }

      // Validation target URL format
      try {
        new URL(targetUrl);
      } catch {
        setSnack({ message: 'รูปแบบ URL ไม่ถูกต้อง กรุณากรอก URL เต็ม เช่น https://example.com', type: 'error' });
        setSavingGeneralLink(false);
        return;
      }

      // Check uniqueness in activityQRCodes
      const q1 = query(
        collection(db, 'activityQRCodes'),
        where('customCode', '==', code)
      );
      const snap1 = await getDocs(q1);
      if (!snap1.empty) {
        setSnack({ message: 'รหัสลิงก์ย่อนี้ถูกใช้งานในกิจกรรมแล้ว กรุณาป้อนรหัสอื่น', type: 'error' });
        setSavingGeneralLink(false);
        return;
      }

      // Check uniqueness in customShortLinks
      const q2 = query(
        collection(db, 'customShortLinks'),
        where('customCode', '==', code)
      );
      const snap2 = await getDocs(q2);
      if (snap2.docs.some((d) => d.id !== editingGeneralLink?.id)) {
        setSnack({ message: 'รหัสลิงก์ย่อนี้ถูกใช้งานแล้วในลิงก์ทั่วไปอื่น กรุณาป้อนรหัสอื่น', type: 'error' });
        setSavingGeneralLink(false);
        return;
      }

      const payload = {
        customCode: code,
        targetUrl: targetUrl,
        updatedAt: serverTimestamp(),
        createdBy: currentAdmin.uid,
        department: currentAdmin.department,
      };

      if (editingGeneralLink) {
        // Edit mode
        const ref = doc(db, 'customShortLinks', editingGeneralLink.id);
        await updateDoc(ref, payload);
        
        // Clear QR cache for old & new codes
        setQrCache((prev) => {
          const next = { ...prev };
          delete next[editingGeneralLink.customCode];
          delete next[code];
          return next;
        });
      } else {
        // Create mode
        const colRef = collection(db, 'customShortLinks');
        await addDoc(colRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      setSnack({
        message: editingGeneralLink ? 'แก้ไขลิงก์ย่อทั่วไปสำเร็จ' : 'สร้างลิงก์ย่อทั่วไปสำเร็จ',
        type: 'success',
      });
      setOpenGeneralDialog(false);
      setEditingGeneralLink(null);
      setGeneralCodeInput('');
      setGeneralUrlInput('');
    } catch (e: any) {
      console.error(e);
      setSnack({ message: `เกิดข้อผิดพลาด: ${e.message || ''}`, type: 'error' });
    } finally {
      setSavingGeneralLink(false);
    }
  };

  // Delete General Custom Short Link
  const handleDeleteGeneralLink = async (link: CustomShortLink) => {
    const ok = await confirm({
      title: 'ยืนยันลบลิงก์ย่อ',
      description: (
        <>
          ต้องการลบลิงก์ย่อ <b>/r/{link.customCode}</b> หรือไม่?
          <br /><br />
          การลบนี้ไม่สามารถย้อนกลับได้
        </>
      ),
      confirmText: 'ลบลิงก์',
      cancelText: 'ยกเลิก',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'customShortLinks', link.id));
      setQrCache((prev) => {
        const next = { ...prev };
        delete next[link.customCode];
        return next;
      });
      setSnack({ message: 'ลบลิงก์ย่อทั่วไปสำเร็จ', type: 'success' });
    } catch (e: any) {
      console.error(e);
      setSnack({ message: 'เกิดข้อผิดพลาดในการลบข้อมูล', type: 'error' });
    }
  };

  // Download General Link QR
  const handleDownloadGeneralQr = useCallback(async (link: CustomShortLink) => {
    try {
      const dataUrl = await getQr(link.customCode);
      downloadDataUrl(dataUrl, `QR-${link.customCode}.png`);
      setSnack({ message: `ดาวน์โหลด QR ลิงก์ย่อสำเร็จ: ${link.customCode}`, type: 'success' });
    } catch {
      setSnack({ message: 'เกิดข้อผิดพลาดในการสร้าง QR', type: 'error' });
    }
  }, [getQr]);

  // Open Create Dialog for General Link
  const openCreateGeneralLink = () => {
    setEditingGeneralLink(null);
    setGeneralCodeInput('');
    setGeneralUrlInput('');
    setOpenGeneralDialog(true);
  };

  // Open Edit Dialog for General Link
  const openEditGeneralLink = (link: CustomShortLink) => {
    setEditingGeneralLink(link);
    setGeneralCodeInput(link.customCode);
    setGeneralUrlInput(link.targetUrl);
    setOpenGeneralDialog(true);
  };

  // Open Settings Dialog (Timers & Status)
  const openSettings = (
    type: 'activity' | 'general',
    docId: string,
    name: string,
    enabled?: boolean,
    startAt?: any,
    endAt?: any
  ) => {
    setSettingsTargetType(type);
    setSettingsDocId(docId);
    setSettingsLinkName(name);
    setSettingsLinkEnabled(enabled !== false);
    setSettingsLinkStartAt(formatToDatetimeLocal(startAt));
    setSettingsLinkEndAt(formatToDatetimeLocal(endAt));
    setOpenSettingsDialog(true);
  };

  // Save Settings (Timers & Status)
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const colName = settingsTargetType === 'general' ? 'customShortLinks' : 'activityQRCodes';
      const ref = doc(db, colName, settingsDocId);
      
      const startAtDate = settingsLinkStartAt ? new Date(settingsLinkStartAt) : null;
      const endAtDate = settingsLinkEndAt ? new Date(settingsLinkEndAt) : null;

      if (startAtDate && endAtDate && startAtDate >= endAtDate) {
        setSnack({ message: 'เวลาเริ่มต้นต้องอยู่ก่อนเวลาหมดอายุ', type: 'error' });
        setSavingSettings(false);
        return;
      }

      await updateDoc(ref, {
        linkEnabled: settingsLinkEnabled,
        linkStartAt: startAtDate ? startAtDate : null,
        linkEndAt: endAtDate ? endAtDate : null,
        updatedAt: serverTimestamp(),
      });

      setSnack({ message: 'บันทึกการตั้งค่าเวลาและสถานะสำเร็จ', type: 'success' });
      setOpenSettingsDialog(false);
    } catch (e: any) {
      console.error(e);
      setSnack({ message: `เกิดข้อผิดพลาดในการบันทึก: ${e.message || ''}`, type: 'error' });
    } finally {
      setSavingSettings(false);
    }
  };

  // Open Analytics Dialog & Fetch logs
  const openAnalytics = async (id: string, name: string) => {
    setSelectedLinkName(name);
    setOpenAnalyticsDialog(true);
    setAnalyticsLoading(true);
    setVisitsData([]);
    try {
      const q = query(
        collection(db, 'shortLinkVisits'),
        where('linkId', '==', id)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => d.data());
      setVisitsData(list);
    } catch (err: any) {
      console.error('Failed to load analytics logs', err);
      setSnack({ message: 'ไม่สามารถโหลดข้อมูลสถิติได้', type: 'error' });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Auto-dismiss snackbar
  useEffect(() => {
    if (!snack) return;
    const t = setTimeout(() => setSnack(null), 3000);
    return () => clearTimeout(t);
  }, [snack]);

  // Filter general custom links
  const filteredCustomLinks = useMemo(() => {
    if (!search.trim()) return customLinks;
    const q = search.toLowerCase();
    return customLinks.filter(
      (l) =>
        l.customCode.toLowerCase().includes(q) ||
        l.targetUrl.toLowerCase().includes(q)
    );
  }, [customLinks, search]);

  // Pre-generate QR thumbnails for visible items
  useEffect(() => {
    if (activeTab === 0) {
      filtered.forEach((a) => {
        const codeToShow = a.customCode || a.activityCode;
        if (!qrCache[codeToShow]) {
          getQr(codeToShow);
        }
      });
    } else {
      filteredCustomLinks.forEach((l) => {
        if (!qrCache[l.customCode]) {
          getQr(l.customCode);
        }
      });
    }
  }, [filtered, filteredCustomLinks, qrCache, getQr, activeTab]);

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full overflow-x-hidden">
      {/* Header */}
      <PageHeader
        title="ลิงก์ย่อ & Dynamic QR"
        subtitle="จัดการลิงก์ย่อ, QR Code, และ Dynamic QR ในระบบ"
        icon={<Link2 className="h-6 w-6" />}
        actions={
          activeTab === 1 && (
            <Button onClick={openCreateGeneralLink} className="gap-2 bg-primary text-white hover:bg-primary/95 shadow-sm">
              <Plus className="h-4 w-4" />
              สร้างลิงก์ย่อทั่วไป
            </Button>
          )
        }
      />

      {/* Snackbar */}
      {snack && (
        <Alert
          severity={snack.type}
          onClose={() => setSnack(null)}
          sx={{ borderRadius: 3 }}
        >
          {snack.message}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', maxWidth: '100%', overflow: 'hidden' }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, val) => {
            setActiveTab(val);
            setSearch(''); // Clear search on tab switch
          }}
          textColor="primary"
          indicatorColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ minHeight: 48, maxWidth: '100%' }}
        >
          <Tab label="ลิงก์ย่อกิจกรรม" sx={{ fontWeight: 700, textTransform: 'none', minWidth: 'auto', px: 1.5 }} />
          <Tab label="ลิงก์ย่อทั่วไป" sx={{ fontWeight: 700, textTransform: 'none', minWidth: 'auto', px: 1.5 }} />
        </Tabs>
      </Box>

      {activeTab === 0 ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 rounded-xl">
                    <Link2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">ลิงก์ย่อทั้งหมด</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-100 rounded-xl">
                    <QrCode className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
                    <p className="text-xs text-muted-foreground">กิจกรรมเปิดใช้งาน</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-100 rounded-xl">
                    <MonitorPlay className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{stats.dynamicQR}</p>
                    <p className="text-xs text-muted-foreground">Dynamic QR เปิดอยู่</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" sx={{ fontSize: 20 }} />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อกิจกรรม, รหัส หรือลิงก์ย่อ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </CardContent>
          </Card>

          {/* Activity List */}
          {loading ? (
            <div className="flex justify-center py-16">
              <CircularProgress />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16">
                <div className="text-center text-muted-foreground">
                  <QrCode className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-semibold">
                    {search ? 'ไม่พบกิจกรรมที่ค้นหา' : 'ยังไม่มีกิจกรรม'}
                  </p>
                  <p className="text-sm mt-1">
                    {search ? 'ลองเปลี่ยนคำค้นหา' : 'สร้างกิจกรรมใหม่ได้ที่เมนู "สร้าง QR Code"'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((a) => {
                const st = statusOf(a);
                const codeToShow = a.customCode || a.activityCode;
                const shortUrl = makeShortUrl(codeToShow);
                const registerUrl = makeRegisterUrl(a.activityCode);
                const qrDataUrl = qrCache[codeToShow];

                return (
                  <Card key={a.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                      <div className="flex flex-col lg:flex-row">
                        {/* QR Thumbnail */}
                        <div className="lg:w-32 lg:h-auto flex-shrink-0 bg-slate-50 flex items-center justify-center p-4 lg:p-3 border-b lg:border-b-0 lg:border-r border-slate-100">
                          {qrDataUrl ? (
                            <img
                              src={qrDataUrl}
                              alt={`QR ${codeToShow}`}
                              className="w-24 h-24 lg:w-full lg:h-auto rounded-lg shadow-sm bg-white"
                            />
                          ) : (
                            <div className="w-24 h-24 flex items-center justify-center">
                              <CircularProgress size={24} />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-4 min-w-0">
                          {/* Top row: Name + Status */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-slate-900 truncate">
                                {a.activityName}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                  {a.activityCode}
                                </span>
                                {a.customCode && (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-blue-200 text-blue-700 bg-blue-50/50">
                                    ลิงก์ย่อ: {a.customCode}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-slate-200 text-slate-700 bg-slate-100 flex items-center gap-1">
                                  <BarChart2 className="h-3 w-3 text-slate-500" />
                                  สแกน: {a.clicksCount ?? 0} ครั้ง
                                </Badge>
                                {a.linkEnabled === false ? (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-rose-200 text-rose-700 bg-rose-50">
                                    ปิดใช้งานลิงก์
                                  </Badge>
                                ) : (a.linkStartAt || a.linkEndAt) ? (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-200 text-amber-700 bg-amber-50">
                                    มีกำหนดเวลา
                                  </Badge>
                                ) : null}
                                <span className="flex items-center gap-1 text-xs text-muted-foreground ml-1">
                                  <div className={`w-1.5 h-1.5 rounded-full ${st.dotColor}`} />
                                  {st.label}
                                </span>
                              </div>
                            </div>
                            {a.dynamicQREnabled && (
                              <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-[10px] shrink-0">
                                Dynamic QR
                              </Badge>
                            )}
                          </div>

                          {/* Short URL row */}
                          <div className="flex items-center gap-1.5 mb-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                            <Link2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <code className="text-xs text-blue-600 truncate flex-1 select-all">
                              {shortUrl}
                            </code>
                            <Tooltip title={copiedId === `short-${a.id}` ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์ย่อ'}>
                              <IconButton
                                size="small"
                                onClick={() => handleCopy(shortUrl, `short-${a.id}`)}
                                sx={{ p: 0.5 }}
                              >
                                {copiedId === `short-${a.id}` ? (
                                  <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
                                ) : (
                                  <CopyIcon sx={{ fontSize: 16 }} />
                                )}
                              </IconButton>
                            </Tooltip>
                          </div>

                          {/* Full URL row */}
                          <div className="flex items-center gap-1.5 mb-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                            <OpenInNewIcon sx={{ fontSize: 14, color: 'text.disabled' }} className="shrink-0" />
                            <code className="text-[11px] text-slate-500 truncate flex-1 select-all">
                              {registerUrl}
                            </code>
                            <Tooltip title={copiedId === `full-${a.id}` ? 'คัดลอกแล้ว!' : 'คัดลอก URL เต็ม'}>
                              <IconButton
                                size="small"
                                onClick={() => handleCopy(registerUrl, `full-${a.id}`)}
                                sx={{ p: 0.5 }}
                              >
                                {copiedId === `full-${a.id}` ? (
                                  <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
                                ) : (
                                  <CopyIcon sx={{ fontSize: 14 }} />
                                )}
                              </IconButton>
                            </Tooltip>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Download QR */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8"
                              onClick={() => handleDownloadQr(a)}
                            >
                              <DownloadIcon sx={{ fontSize: 14 }} />
                              ดาวน์โหลด QR
                            </Button>

                            {/* Edit Custom Link */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8 text-blue-700 border-blue-200 hover:bg-blue-50"
                              onClick={() => openEditCustomCode(a)}
                            >
                              <EditIcon sx={{ fontSize: 14 }} />
                              แก้ไขลิงก์ย่อ
                            </Button>

                            {/* Link Settings / Timers */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8 text-slate-700 border-slate-200 hover:bg-slate-50"
                              onClick={() => openSettings('activity', a.id, a.activityName, a.linkEnabled, a.linkStartAt, a.linkEndAt)}
                            >
                              <Settings2 className="h-3.5 w-3.5 text-slate-500" />
                              ตั้งเวลา/สถานะ
                            </Button>

                            {/* Analytics */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => openAnalytics(a.id, a.activityName)}
                            >
                              <BarChart2 className="h-3.5 w-3.5 text-emerald-600" />
                              สถิติการสแกน
                            </Button>

                            {/* View Register Page */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8"
                              onClick={() => window.open(registerUrl, '_blank')}
                            >
                              <ViewIcon sx={{ fontSize: 14 }} />
                              เปิดหน้าลงทะเบียน
                            </Button>

                            {/* Dynamic QR Toggle */}
                            <div className="flex items-center gap-1.5 ml-auto">
                              <span className="text-xs text-muted-foreground">Dynamic QR</span>
                              {togglingIds.has(a.id) ? (
                                <CircularProgress size={20} />
                              ) : (
                                <Switch
                                  size="small"
                                  checked={a.dynamicQREnabled ?? false}
                                  onChange={() => handleToggleDynamicQR(a)}
                                  color="secondary"
                                />
                              )}
                            </div>

                            {/* Open Dynamic QR Screen */}
                            {a.dynamicQREnabled && (
                              <Tooltip title="เปิดหน้าจอ Dynamic QR (Rolling QR)">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="gap-1.5 text-xs h-8 bg-purple-100 text-purple-700 hover:bg-purple-200"
                                  onClick={() => window.open(makeDynamicQrUrl(a.activityCode), '_blank')}
                                >
                                  <MonitorPlay className="h-3.5 w-3.5" />
                                  เปิดจอ Rolling QR
                                </Button>
                              </Tooltip>
                            )}

                            {/* AI Background for Dynamic QR Screen */}
                            {a.dynamicQREnabled && (
                              <Tooltip title="สร้างภาพพื้นหลังสำหรับจอ Rolling QR ด้วย Magnific AI">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-xs h-8 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-50"
                                  onClick={() => setBgTargetActivity(a)}
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  {a.dynamicQrBgUrl ? 'เปลี่ยนพื้นหลังจอ (AI)' : 'สร้างพื้นหลังจอ (AI)'}
                                </Button>
                              </Tooltip>
                            )}

                            {/* Remove AI Background */}
                            {a.dynamicQREnabled && a.dynamicQrBgUrl && (
                              <Tooltip title="ลบภาพพื้นหลังจอ Rolling QR (กลับไปใช้พื้นหลังปกติ)">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-xs h-8 text-rose-700 border-rose-200 hover:bg-rose-50"
                                  disabled={removingBgId === a.id}
                                  onClick={() => handleRemoveQrBackground(a)}
                                >
                                  {removingBgId === a.id ? (
                                    <CircularProgress size={14} />
                                  ) : (
                                    <ImageOff className="h-3.5 w-3.5" />
                                  )}
                                  ลบพื้นหลัง
                                </Button>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Footer hint */}
          {!loading && filtered.length > 0 && (
            <p className="text-center text-xs text-muted-foreground py-2">
              แสดง {filtered.length} จาก {activities.length} กิจกรรม
              {search ? ` (ค้นหา: "${search}")` : ''}
            </p>
          )}
        </>
      ) : (
        <>
          {/* Search bar for General Links */}
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" sx={{ fontSize: 20 }} />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อลิงก์ย่อ หรือ URL ปลายทาง..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </CardContent>
          </Card>

          {/* General Links List */}
          {customLinksLoading ? (
            <div className="flex justify-center py-16">
              <CircularProgress />
            </div>
          ) : filteredCustomLinks.length === 0 ? (
            <Card>
              <CardContent className="py-16">
                <div className="text-center text-muted-foreground">
                  <Link2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-semibold">
                    {search ? 'ไม่พบลิงก์ย่อที่ค้นหา' : 'ยังไม่มีลิงก์ย่อทั่วไป'}
                  </p>
                  <p className="text-sm mt-1">
                    {search ? 'ลองเปลี่ยนคำค้นหา' : 'คุณสามารถสร้างลิงก์ย่อชี้ไปยังเว็บภายนอก เช่น Google Forms, เว็บสโมสร ฯลฯ'}
                  </p>
                  {!search && (
                    <Button onClick={openCreateGeneralLink} className="mt-4 bg-primary text-white">
                      สร้างลิงก์ย่อทั่วไปตัวแรก
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredCustomLinks.map((l) => {
                const shortUrl = makeShortUrl(l.customCode);
                const qrDataUrl = qrCache[l.customCode];

                return (
                  <Card key={l.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                      <div className="flex flex-col lg:flex-row">
                        {/* QR Thumbnail */}
                        <div className="lg:w-32 lg:h-auto flex-shrink-0 bg-slate-50 flex items-center justify-center p-4 lg:p-3 border-b lg:border-b-0 lg:border-r border-slate-100">
                          {qrDataUrl ? (
                            <img
                              src={qrDataUrl}
                              alt={`QR ${l.customCode}`}
                              className="w-24 h-24 lg:w-full lg:h-auto rounded-lg shadow-sm bg-white"
                            />
                          ) : (
                            <div className="w-24 h-24 flex items-center justify-center">
                              <CircularProgress size={24} />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-4 min-w-0">
                          {/* Top row: Slug Name + Actions */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-slate-900 truncate">
                                /{l.customCode}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-[10px] text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded">
                                  ลิงก์ทั่วไป (ภายนอก)
                                </span>
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-slate-200 text-slate-700 bg-slate-100 flex items-center gap-1">
                                  <BarChart2 className="h-3 w-3 text-slate-500" />
                                  สแกน: {l.clicksCount ?? 0} ครั้ง
                                </Badge>
                                {l.linkEnabled === false ? (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-rose-200 text-rose-700 bg-rose-50">
                                    ปิดใช้งานลิงก์
                                  </Badge>
                                ) : (l.linkStartAt || l.linkEndAt) ? (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-200 text-amber-700 bg-amber-50">
                                    มีกำหนดเวลา
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                            <Stack direction="row" spacing={0.5}>
                              <Tooltip title="แก้ไข URL">
                                <IconButton size="small" onClick={() => openEditGeneralLink(l)}>
                                  <EditIcon sx={{ fontSize: 18 }} className="text-blue-600" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="ลบลิงก์ย่อ">
                                <IconButton size="small" onClick={() => handleDeleteGeneralLink(l)}>
                                  <DeleteIcon sx={{ fontSize: 18 }} className="text-rose-600" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </div>

                          {/* Short URL row */}
                          <div className="flex items-center gap-1.5 mb-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                            <Link2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <code className="text-xs text-blue-600 truncate flex-1 select-all">
                              {shortUrl}
                            </code>
                            <Tooltip title={copiedId === `short-${l.id}` ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์ย่อ'}>
                              <IconButton
                                size="small"
                                onClick={() => handleCopy(shortUrl, `short-${l.id}`)}
                                sx={{ p: 0.5 }}
                              >
                                {copiedId === `short-${l.id}` ? (
                                  <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
                                ) : (
                                  <CopyIcon sx={{ fontSize: 16 }} />
                                )}
                              </IconButton>
                            </Tooltip>
                          </div>

                          {/* Destination URL row */}
                          <div className="flex items-center gap-1.5 mb-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                            <OpenInNewIcon sx={{ fontSize: 14, color: 'text.disabled' }} className="shrink-0" />
                            <code className="text-[11px] text-slate-500 truncate flex-1 select-all">
                              {l.targetUrl}
                            </code>
                            <Tooltip title={copiedId === `full-${l.id}` ? 'คัดลอกแล้ว!' : 'คัดลอก URL ปลายทาง'}>
                              <IconButton
                                size="small"
                                onClick={() => handleCopy(l.targetUrl, `full-${l.id}`)}
                                sx={{ p: 0.5 }}
                              >
                                {copiedId === `full-${l.id}` ? (
                                  <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
                                ) : (
                                  <CopyIcon sx={{ fontSize: 14 }} />
                                )}
                              </IconButton>
                            </Tooltip>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Download QR */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8"
                              onClick={() => handleDownloadGeneralQr(l)}
                            >
                              <DownloadIcon sx={{ fontSize: 14 }} />
                              ดาวน์โหลด QR
                            </Button>

                            {/* Link Settings / Timers */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8 text-slate-700 border-slate-200 hover:bg-slate-50"
                              onClick={() => openSettings('general', l.id, `/${l.customCode}`, l.linkEnabled, l.linkStartAt, l.linkEndAt)}
                            >
                              <Settings2 className="h-3.5 w-3.5 text-slate-500" />
                              ตั้งเวลา/สถานะ
                            </Button>

                            {/* Analytics */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => openAnalytics(l.id, `/${l.customCode}`)}
                            >
                              <BarChart2 className="h-3.5 w-3.5 text-emerald-600" />
                              สถิติการสแกน
                            </Button>

                            {/* View Destination */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8"
                              onClick={() => window.open(l.targetUrl, '_blank')}
                            >
                              <ViewIcon sx={{ fontSize: 14 }} />
                              เปิดดูลิงก์ปลายทาง
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Footer hint */}
          {!customLinksLoading && filteredCustomLinks.length > 0 && (
            <p className="text-center text-xs text-muted-foreground py-2">
              แสดง {filteredCustomLinks.length} จาก {customLinks.length} ลิงก์ทั่วไป
              {search ? ` (ค้นหา: "${search}")` : ''}
            </p>
          )}
        </>
      )}

      {/* Edit Custom Code Dialog (For Activities) */}
      <Dialog open={!!editingActivity} onClose={() => setEditingActivity(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>กำหนดลิงก์ย่อแบบกำหนดเอง</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            ป้อนรหัสลิงก์ย่อที่ต้องการ (เช่น CS-CAMP) เมื่อผู้ใช้เข้าผ่านลิงก์ย่อ ระบบจะส่งต่อไปยังหน้าลงทะเบียนของกิจกรรมนี้โดยอัตโนมัติ (ทิ้งให้ว่างไว้หากต้องการใช้รหัสสุ่มเริ่มต้น)
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="รหัสลิงก์ย่อกำหนดเอง"
            value={customCodeInput}
            onChange={(e) => setCustomCodeInput(e.target.value.toUpperCase().trim())}
            placeholder="ตัวอย่าง: CS-CAMP"
            error={customCodeInput.length > 30}
            helperText={
              customCodeInput.length > 30 
                ? 'รหัสต้องไม่เกิน 30 ตัวอักษร'
                : 'รองรับภาษาอังกฤษ ตัวเลข เครื่องหมาย - และ _ เท่านั้น'
            }
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outline" onClick={() => setEditingActivity(null)} disabled={savingCustomCode}>
            ยกเลิก
          </Button>
          <Button 
            onClick={handleSaveCustomCode} 
            disabled={savingCustomCode || customCodeInput.length > 30}
            variant="default"
          >
            {savingCustomCode ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit General Short Link Dialog */}
      <Dialog open={openGeneralDialog} onClose={() => setOpenGeneralDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingGeneralLink ? 'แก้ไขลิงก์ย่อทั่วไป' : 'สร้างลิงก์ย่อทั่วไป (ลิงก์ภายนอก)'}
        </DialogTitle>
        <DialogContent className="space-y-4 pt-2">
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            สร้างลิงก์ย่อทั่วไปที่ไม่เกี่ยวข้องกับกิจกรรม เช่น ชี้ไปยัง Google Forms หรือเว็บไซต์อื่นๆ ของภาควิชา
          </Typography>
          
          <TextField
            fullWidth
            label="รหัสลิงก์ย่อ (Slug)"
            value={generalCodeInput}
            onChange={(e) => setGeneralCodeInput(e.target.value.toUpperCase().trim())}
            placeholder="ตัวอย่าง: GOOGLE-FORM"
            disabled={!!editingGeneralLink}
            error={generalCodeInput.length > 30}
            helperText={
              editingGeneralLink
                ? 'ไม่สามารถแก้ไข Slug ได้หลังจากสร้างแล้ว'
                : 'รองรับภาษาอังกฤษ ตัวเลข เครื่องหมาย - และ _ (ห้ามซ้ำกับรหัสอื่นๆ)'
            }
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <span className="text-sm font-semibold text-slate-400">/r/</span>
                  </InputAdornment>
                ),
                endAdornment: !editingGeneralLink && (
                  <InputAdornment position="end">
                    <Button 
                      variant="ghost" 
                      className="h-8 text-xs px-2 gap-1 text-slate-600 hover:text-slate-900"
                      onClick={() => setGeneralCodeInput(randomSlug())}
                      type="button"
                    >
                      <RefreshCw className="h-3.5 w-3.5 animate-spin-slow" />
                      สุ่มรหัส
                    </Button>
                  </InputAdornment>
                )
              }
            }}
          />

          <TextField
            fullWidth
            label="URL ปลายทาง"
            value={generalUrlInput}
            onChange={(e) => setGeneralUrlInput(e.target.value.trim())}
            placeholder="ตัวอย่าง: https://docs.google.com/forms/..."
            type="url"
            helperText="ลิงก์แบบเต็มที่ต้องการให้ส่งต่อผู้ใช้งานไป (เช่น https://...)"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outline" onClick={() => setOpenGeneralDialog(false)} disabled={savingGeneralLink}>
            ยกเลิก
          </Button>
          <Button 
            onClick={handleSaveGeneralLink} 
            disabled={savingGeneralLink || !generalCodeInput.trim() || !generalUrlInput.trim() || generalCodeInput.length > 30}
            variant="default"
          >
            {savingGeneralLink ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog (Status & Timers) */}
      <Dialog open={openSettingsDialog} onClose={() => setOpenSettingsDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>ตั้งเวลา & ควบคุมลิงก์ ({settingsLinkName})</DialogTitle>
        <DialogContent className="space-y-4 pt-2">
          {/* Toggle Switch */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 mt-2">
            <div>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>เปิดใช้งานลิงก์ย่อ</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>หากปิด ผู้ใช้จะไม่สามารถเข้าลิงก์นี้ได้</Typography>
            </div>
            <Switch
              checked={settingsLinkEnabled}
              onChange={(e) => setSettingsLinkEnabled(e.target.checked)}
              color="primary"
            />
          </div>

          {/* Date inputs */}
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">เวลาเริ่มต้นเปิดใช้งาน (Start Time)</label>
              <input
                type="datetime-local"
                value={settingsLinkStartAt}
                onChange={(e) => setSettingsLinkStartAt(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">ปล่อยว่างไว้หากต้องการให้ใช้งานได้ทันที</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">เวลาหมดอายุการใช้งาน (End Time)</label>
              <input
                type="datetime-local"
                value={settingsLinkEndAt}
                onChange={(e) => setSettingsLinkEndAt(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">ปล่อยว่างไว้หากไม่มีวันหมดอายุ</span>
            </div>
          </div>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outline" onClick={() => setOpenSettingsDialog(false)} disabled={savingSettings}>
            ยกเลิก
          </Button>
          <Button onClick={handleSaveSettings} disabled={savingSettings} variant="default">
            {savingSettings ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog 
        open={openAnalyticsDialog} 
        onClose={() => setOpenAnalyticsDialog(false)} 
        maxWidth="sm" 
        fullWidth
        sx={{ 
          '& .MuiDialog-paper': { 
            borderRadius: '24px', 
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
            border: '1px solid rgba(226,232,240,0.8)'
          } 
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1, pt: 3 }}>
          <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <Typography variant="h6" sx={{ fontWeight: 800, color: 'slate.900', lineHeight: 1.2 }}>
              วิเคราะห์สถิติมุมมองผู้ใช้
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              ลิงก์ย่อ: {selectedLinkName}
            </Typography>
          </div>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'slate.100', py: 3 }} className="space-y-6">
          {analyticsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="relative flex items-center justify-center">
                <CircularProgress size={44} thickness={4.5} className="text-indigo-600" />
                <ActivityIcon className="h-5 w-5 text-indigo-500 absolute animate-pulse" />
              </div>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>กำลังรวบรวมและวิเคราะห์ข้อมูลสถิติ...</Typography>
            </div>
          ) : visitsData.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <BarChart2 className="h-14 w-14 mx-auto mb-4 text-slate-300" />
              <p className="font-bold text-slate-800 text-base">ยังไม่มีประวัติการเข้าใช้งานลิงก์นี้</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">สถิติจะอัปเดตแบบเรียลไทม์เมื่อมีผู้ใช้งานสแกนคิวอาร์หรือเปิดใช้ลิงก์ย่อนี้</p>
            </div>
          ) : (() => {
            const total = visitsData.length;
            
            const provinces = visitsData.reduce((acc: Record<string, number>, curr) => {
              const val = curr.province || 'ไม่สามารถระบุได้';
              acc[val] = (acc[val] || 0) + 1;
              return acc;
            }, {});
            const sortedProvinces = Object.entries(provinces).sort((a, b) => b[1] - a[1]).slice(0, 5);

            const devices = visitsData.reduce((acc: Record<string, number>, curr) => {
              const val = curr.device || 'Desktop';
              acc[val] = (acc[val] || 0) + 1;
              return acc;
            }, {});

            const platforms = visitsData.reduce((acc: Record<string, number>, curr) => {
              const val = curr.os || 'Unknown';
              acc[val] = (acc[val] || 0) + 1;
              return acc;
            }, {});

            const browsers = visitsData.reduce((acc: Record<string, number>, curr) => {
              const val = curr.browser || 'Unknown';
              acc[val] = (acc[val] || 0) + 1;
              return acc;
            }, {});

            return (
              <div className="space-y-6">
                {/* Total Scans Card - Sleek Dark Gradient Banner */}
                <div className="relative overflow-hidden p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl border border-slate-800 shadow-lg text-center flex flex-col items-center justify-center">
                  {/* Decorative glowing backdrops */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                  
                  <span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    จำนวนการสแกนสะสมทั้งหมด
                  </span>
                  <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-emerald-300 to-cyan-300 font-mono tracking-tight my-1">
                    {total}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium block mt-1">
                    ครั้ง (อัปเดตแบบ Real-time จากฐานข้อมูลสำเร็จ)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Provinces Card */}
                  <div className="bg-slate-50/50 hover:bg-slate-50 transition-colors border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
                        📍 5 จังหวัดสูงสุด
                      </h4>
                      <div className="space-y-3.5">
                        {sortedProvinces.map(([name, count]) => {
                          const pct = Math.round((count / total) * 100);
                          return (
                            <div key={name} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                <span className="truncate pr-2">{name}</span>
                                <span className="font-mono text-slate-500 text-[11px]">{count} ครั้ง ({pct})</span>
                              </div>
                              <div className="w-full bg-slate-200/60 rounded-full h-2 overflow-hidden">
                                <div className="bg-gradient-to-r from-rose-400 to-rose-600 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Devices Card */}
                  <div className="bg-slate-50/50 hover:bg-slate-50 transition-colors border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <Smartphone className="h-4 w-4 text-purple-600 shrink-0" />
                        📱 อุปกรณ์ที่ใช้สแกน
                      </h4>
                      <div className="space-y-3.5">
                        {Object.entries(devices).map(([name, count]) => {
                          const pct = Math.round((count / total) * 100);
                          const isMobile = name.toLowerCase() === 'mobile';
                          return (
                            <div key={name} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                <span className="flex items-center gap-1.5 truncate">
                                  {isMobile ? <Smartphone className="h-3.5 w-3.5 text-purple-500" /> : <Monitor className="h-3.5 w-3.5 text-indigo-500" />}
                                  {name}
                                </span>
                                <span className="font-mono text-slate-500 text-[11px]">{count} ครั้ง ({pct})</span>
                              </div>
                              <div className="w-full bg-slate-200/60 rounded-full h-2 overflow-hidden">
                                <div className="bg-gradient-to-r from-purple-500 to-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Platforms (OS) Card */}
                  <div className="bg-slate-50/50 hover:bg-slate-50 transition-colors border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <Cpu className="h-4 w-4 text-blue-600 shrink-0" />
                        💻 ระบบปฏิบัติการ (OS)
                      </h4>
                      <div className="space-y-3.5">
                        {Object.entries(platforms).map(([name, count]) => {
                          const pct = Math.round((count / total) * 100);
                          return (
                            <div key={name} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                <span className="truncate">{name}</span>
                                <span className="font-mono text-slate-500 text-[11px]">{count} ครั้ง ({pct})</span>
                              </div>
                              <div className="w-full bg-slate-200/60 rounded-full h-2 overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-400 to-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Browsers Card */}
                  <div className="bg-slate-50/50 hover:bg-slate-50 transition-colors border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <Globe className="h-4 w-4 text-amber-500 shrink-0" />
                        🌐 อินเทอร์เน็ตบราวเซอร์
                      </h4>
                      <div className="space-y-3.5">
                        {Object.entries(browsers).map(([name, count]) => {
                          const pct = Math.round((count / total) * 100);
                          return (
                            <div key={name} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                <span className="truncate">{name}</span>
                                <span className="font-mono text-slate-500 text-[11px]">{count} ครั้ง ({pct})</span>
                              </div>
                              <div className="w-full bg-slate-200/60 rounded-full h-2 overflow-hidden">
                                <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button 
            onClick={() => setOpenAnalyticsDialog(false)}
            variant="default"
            className="rounded-xl px-5 h-10 shadow-sm border border-slate-200"
          >
            ปิดหน้าต่างสถิติ
          </Button>
        </DialogActions>
      </Dialog>

      {/* Magnific AI Background Dialog (Dynamic QR Screen) */}
      <MagnificImageDialog
        open={!!bgTargetActivity}
        onClose={() => setBgTargetActivity(null)}
        onUseImage={handleUseQrBackground}
        title={`สร้างพื้นหลังจอ Rolling QR: ${bgTargetActivity?.activityName || ''}`}
        useButtonLabel="ใช้เป็นพื้นหลังจอ Rolling QR"
        initialPrompt={
          bgTargetActivity
            ? `A beautiful elegant widescreen background for an event check-in display screen of university activity: ${bgTargetActivity.activityName}. Soft ambient light, space in the center for a QR code panel`
            : ''
        }
        initialRatio="widescreen_16_9"
      />
    </div>
  );
}
