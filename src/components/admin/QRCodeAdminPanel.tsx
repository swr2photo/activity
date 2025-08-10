// src/components/admin/QRCodeAdminPanel.tsx
'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Paper,
  Avatar,
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
  Slider,
  InputAdornment,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  QrCode2 as QrCodeIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Place as PlaceIcon,
  MyLocation as MyLocationIcon,
  Link as LinkIcon,
  Map as MapIcon,
  Image as ImageIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

import dayjs, { Dayjs } from 'dayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import {
  getAllActivities,
  getActivitiesByDepartment,
  toggleActivityStatus,
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
} from 'firebase/firestore';
import { db, storage } from '../../lib/firebase';

// Google Maps
import { GoogleMap, Marker, Circle, LoadScript } from '@react-google-maps/api';

// Firebase Storage
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/* ==============================
   Utilities
============================== */
const stripUndefined = <T extends Record<string, any>>(obj: T): T => {
  const out: any = {};
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (v !== undefined) out[k] = v;
  });
  return out;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const makeTargetUrl = (baseUrl: string, code: string) =>
  `${baseUrl.replace(/\/$/, '')}/register?activity=${encodeURIComponent(code.trim().toUpperCase())}`;

const pathFromStorageUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const i = url.indexOf('/o/');
  if (i === -1) return null;
  const after = url.substring(i + 3);
  const path = after.split('?')[0];
  return decodeURIComponent(path);
};

// แปลงค่าจาก DateTimePicker ให้เป็น Dayjs | null เสมอ
const toDayjs = (v: unknown): Dayjs | null =>
  v == null ? null : (dayjs.isDayjs(v) ? (v as Dayjs) : dayjs(v as any));

/* ==============================
   Google Map Picker
============================== */
type MapPickerProps = {
  lat?: number;
  lng?: number;
  radius: number;
  onChange: (val: { lat: number; lng: number; radius: number }) => void;
  height?: number;
};

const mapContainerStyle = { width: '100%', height: '320px' };

const MapPicker: React.FC<MapPickerProps> = ({ lat, lng, radius, onChange, height = 320 }) => {
  const center = useMemo(
    () => ({ lat: lat ?? 13.7563, lng: lng ?? 100.5018 }),
    [lat, lng]
  );

  const onMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      const p = e.latLng;
      if (!p) return;
      onChange({ lat: p.lat(), lng: p.lng(), radius });
    },
    [onChange, radius]
  );

  return (
    <Box sx={{ position: 'relative' }}>
      <GoogleMap
        mapContainerStyle={{ ...mapContainerStyle, height }}
        center={center}
        zoom={16}
        onClick={onMapClick}
        options={{
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
        }}
      >
        <Marker position={center} />
        <Circle
          center={center}
          radius={radius || 100}
          options={{
            strokeColor: '#1976d2',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#1976d2',
            fillOpacity: 0.15,
          }}
        />
      </GoogleMap>

      <Box
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          background: 'rgba(255,255,255,0.9)',
          borderRadius: 1,
          px: 1,
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          boxShadow: 1,
        }}
      >
        <MapIcon fontSize="small" />
        <Typography variant="caption">คลิกบนแผนที่เพื่อเปลี่ยนตำแหน่ง</Typography>
      </Box>
    </Box>
  );
};

/* ==============================
   Form state
============================== */
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
  requiresUniversityLogin: boolean;
  singleUserMode: boolean;
  maxParticipants?: number;
  targetUrl: string;
  qrDataUrl: string;
  userCode: string;
  bannerUrl?: string;
  bannerFile?: File | null;
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
  requiresUniversityLogin: true,
  singleUserMode: false,
  maxParticipants: undefined,
  targetUrl: '',
  qrDataUrl: '',
  userCode: '',
  bannerUrl: undefined,
  bannerFile: null,
};

/* ==============================
   Main
============================== */
interface Props {
  currentAdmin: AdminProfile;
  baseUrl: string;
}

const QRCodeAdminPanel: React.FC<Props> = ({ currentAdmin, baseUrl }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  // create dialog
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  // edit dialog
  const [openEdit, setOpenEdit] = useState(false);
  const [editActivityId, setEditActivityId] = useState<string | null>(null); // activities doc id
  const [qrDocId, setQrDocId] = useState<string | null>(null); // activityQRCodes doc id (สำหรับแก้ไข)
  const [editing, setEditing] = useState(false);

  // load list
  const load = async () => {
    setLoading(true);
    try {
      const data =
        currentAdmin.department === 'all'
          ? await getAllActivities()
          : await getActivitiesByDepartment(currentAdmin.department as AdminDepartment);
      setActivities(data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAdmin.department]);

  const activeCount = useMemo(
    () => activities.filter((a) => a.isActive).length,
    [activities]
  );

  const statusOf = (a: Activity) => {
    const now = new Date();
    if (!a.isActive) return { label: 'ปิดใช้งาน', color: 'default' as const };
    if (a.startDateTime && now < a.startDateTime)
      return { label: 'รอเปิด', color: 'warning' as const };
    if (a.endDateTime && now > a.endDateTime)
      return { label: 'สิ้นสุดแล้ว', color: 'default' as const };
    return { label: 'เปิดใช้งาน', color: 'success' as const };
  };

  const handleToggle = async (a: Activity) => {
    await toggleActivityStatus(a.id, a.isActive);
    await load();
  };

  const handleOpenCreate = () => {
    setErrMsg('');
    setForm({
      ...defaultForm,
      startDateTime: dayjs().startOf('minute'),
      endDateTime: dayjs().add(2, 'hour').startOf('minute'),
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
        next.targetUrl = code ? makeTargetUrl(baseUrl, code) : '';
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

  const generateQrDataUrl = async (text: string): Promise<string> => {
    const QR = await import('qrcode'); // dynamic import
    return await QR.toDataURL(text, { margin: 1, scale: 6 });
  };

  const uploadBannerIfNeeded = async (
    dept: string,
    code: string,
    file?: File | null
  ): Promise<string | undefined> => {
    if (!file) return form.bannerUrl; // keep existing
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
    } catch {
      // ignore
    }
  };

  /* -----------------------------
     CREATE
  ----------------------------- */
  const handleCreateSubmit = async () => {
    try {
      setErrMsg('');
      if (!form.activityName.trim()) return setErrMsg('กรุณากรอกชื่อกิจกรรม');
      if (!form.activityCode.trim()) return setErrMsg('กรุณากรอกรหัสกิจกรรม');

      const code = form.activityCode.trim().toUpperCase();

      // กันโค้ดซ้ำใน activityQRCodes (เฉพาะสังกัดนี้)
      const qDup = query(
        collection(db, 'activityQRCodes'),
        where('activityCode', '==', code),
        where('department', '==', currentAdmin.department),
        limit(1)
      );
      const dupSnap = await getDocs(qDup);
      if (!dupSnap.empty) return setErrMsg('รหัสกิจกรรมนี้มีอยู่แล้วในสังกัดของคุณ');

      // ค่าพิกัด/รัศมี/จำนวน
      const lat = typeof form.latitude === 'number' ? form.latitude : undefined;
      const lng = typeof form.longitude === 'number' ? form.longitude : undefined;
      const radius = clamp(Number(form.checkInRadius || 0) || 100, 10, 2000);
      const max = typeof form.maxParticipants === 'number' ? clamp(form.maxParticipants, 0, 1000000) : 0;

      // banner
      const bannerUrl = await uploadBannerIfNeeded(currentAdmin.department, code, form.bannerFile);

      // userCode
      const userCode = form.userCode?.trim() || '';

      // URL + QR
      const targetUrl = makeTargetUrl(baseUrl, code);
      const qrDataUrl = await generateQrDataUrl(targetUrl);

      setSaving(true);

      // 1) activityQRCodes
      const qrPayload = stripUndefined({
        activityCode: code,
        activityName: form.activityName.trim(),
        description: form.description.trim() || undefined,
        headerTitle: form.headerTitle?.trim() || undefined,
        bannerUrl: bannerUrl || undefined,

        location: form.location.trim() || undefined,
        latitude: lat,
        longitude: lng,
        checkInRadius: radius,

        startDateTime: form.startDateTime?.toDate(),
        endDateTime: form.endDateTime?.toDate(),

        isActive: form.isActive,
        requiresUniversityLogin: form.requiresUniversityLogin,
        singleUserMode: form.singleUserMode,

        maxParticipants: max,
        currentParticipants: 0,

        userCode: userCode,
        qrUrl: qrDataUrl,
        targetUrl,

        department: currentAdmin.department,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'activityQRCodes'), qrPayload);

      // 2) activities
      const activityPayload = stripUndefined({
        activityName: form.activityName.trim(),
        activityCode: code,
        description: form.description.trim() || undefined,
        location: form.location.trim() || undefined,
        startDateTime: form.startDateTime?.toDate(),
        endDateTime: form.endDateTime?.toDate(),
        checkInRadius: radius,
        maxParticipants: max,
        isActive: form.isActive,
        qrUrl: qrDataUrl,
        department: currentAdmin.department,
        userCode: userCode,
        bannerUrl: bannerUrl || undefined,
      });
      await createActivity(activityPayload);

      // preview
      setForm((p) => ({ ...p, targetUrl, qrDataUrl, bannerUrl }));

      setOpenCreate(false);
      await load();
    } catch (e: any) {
      console.error(e);
      setErrMsg(e?.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  /* -----------------------------
     EDIT
  ----------------------------- */
  const openEditDialog = async (a: Activity) => {
    try {
      setErrMsg('');
      setEditActivityId(a.id);
      setQrDocId(null);

      // อ่านค่าแผนที่/เงื่อนไขจาก activityQRCodes (ของสังกัดเดียวกันเท่านั้น)
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
        activityName: a.activityName || '',
        activityCode: a.activityCode || '',
        headerTitle: qr?.headerTitle || '',
        description: a.description || qr?.description || '',
        location: a.location || qr?.location || '',
        latitude: qr?.latitude,
        longitude: qr?.longitude,
        checkInRadius: a.checkInRadius ?? qr?.checkInRadius ?? 100,
        startDateTime: a.startDateTime ? dayjs(a.startDateTime) : qr?.startDateTime ? dayjs(qr.startDateTime.toDate?.() ?? qr.startDateTime) : dayjs(),
        endDateTime: a.endDateTime ? dayjs(a.endDateTime) : qr?.endDateTime ? dayjs(qr.endDateTime.toDate?.() ?? qr.endDateTime) : dayjs().add(2, 'hour'),
        isActive: a.isActive ?? true,
        requiresUniversityLogin: qr?.requiresUniversityLogin ?? true,
        singleUserMode: qr?.singleUserMode ?? false,
        maxParticipants: a.maxParticipants || qr?.maxParticipants || undefined,
        targetUrl: makeTargetUrl(baseUrl, a.activityCode),
        qrDataUrl: a.qrUrl || qr?.qrUrl || '',
        userCode: (a as any).userCode || qr?.userCode || '',
        bannerUrl: a.bannerUrl || qr?.bannerUrl || undefined,
        bannerFile: null,
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

      const code = form.activityCode.trim().toUpperCase(); // ไม่อนุญาตแก้ code ใน UI แต่กันไว้
      const radius = clamp(Number(form.checkInRadius || 0) || 100, 10, 2000);
      const max = typeof form.maxParticipants === 'number' ? clamp(form.maxParticipants, 0, 1000000) : 0;
      const lat = typeof form.latitude === 'number' ? form.latitude : undefined;
      const lng = typeof form.longitude === 'number' ? form.longitude : undefined;

      // banner upload ใหม่ (ถ้ามี)
      let newBannerUrl = form.bannerUrl;
      if (form.bannerFile) {
        // ลบรูปเก่าถ้ามี
        if (form.bannerUrl) await deleteBannerIfOwned(form.bannerUrl);
        newBannerUrl = await uploadBannerIfNeeded(currentAdmin.department, code, form.bannerFile);
      }

      // update activities
      const aRef = doc(db, 'activities', editActivityId);
      await updateDoc(
        aRef,
        stripUndefined({
          activityName: form.activityName.trim(),
          description: form.description.trim() || undefined,
          location: form.location.trim() || undefined,
          startDateTime: form.startDateTime?.toDate(),
          endDateTime: form.endDateTime?.toDate(),
          checkInRadius: radius,
          maxParticipants: max || 0,
          isActive: form.isActive,
          userCode: form.userCode?.trim() || '',
          bannerUrl: newBannerUrl || null,
        })
      );

      // update activityQRCodes
      if (qrDocId) {
        const qRef = doc(db, 'activityQRCodes', qrDocId);
        await updateDoc(
          qRef,
          stripUndefined({
            activityName: form.activityName.trim(),
            description: form.description.trim() || undefined,
            headerTitle: form.headerTitle?.trim() || undefined,
            bannerUrl: newBannerUrl || null,
            location: form.location.trim() || undefined,
            latitude: lat,
            longitude: lng,
            checkInRadius: radius,
            startDateTime: form.startDateTime?.toDate(),
            endDateTime: form.endDateTime?.toDate(),
            isActive: form.isActive,
            requiresUniversityLogin: form.requiresUniversityLogin,
            singleUserMode: form.singleUserMode,
            maxParticipants: max || 0,
            userCode: form.userCode?.trim() || '',
            updatedAt: serverTimestamp(),
          })
        );
      }

      setOpenEdit(false);
      await load();
    } catch (e: any) {
      console.error(e);
      setErrMsg(e?.message || 'เกิดข้อผิดพลาดในการบันทึกการแก้ไข');
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteActivity = async (a: Activity) => {
    const confirmed = window.confirm(`ต้องการลบกิจกรรม "${a.activityName}" และ QR ที่เกี่ยวข้องหรือไม่?`);
    if (!confirmed) return;
    try {
      if ((a as any).bannerUrl) await deleteBannerIfOwned((a as any).bannerUrl);
      await deleteDoc(doc(db, 'activities', a.id));

      const qQr = query(
        collection(db, 'activityQRCodes'),
        where('activityCode', '==', a.activityCode),
        where('department', '==', currentAdmin.department),
        limit(1)
      );
      const snap = await getDocs(qQr);
      if (!snap.empty) {
        const qd = snap.docs[0];
        const qdata = qd.data() as any;
        if (qdata?.bannerUrl) await deleteBannerIfOwned(qdata.bannerUrl);
        await deleteDoc(qd.ref);
      }

      await load();
    } catch (e) {
      console.error(e);
      alert('ลบไม่สำเร็จ');
    }
  };

  /* ==============================
     Render
  ============================== */
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QrCodeIcon /> จัดการ QR Code และกิจกรรม
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          <Typography color="text.secondary">สังกัด:</Typography>
          <Chip
            size="small"
            label={(DEPARTMENT_LABELS as Record<string, string>)[currentAdmin.department] || currentAdmin.department}
            color="primary"
            variant="outlined"
          />
        </Stack>
      </Box>

      {/* Quick stats / actions */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary">
                {activeCount}
              </Typography>
              <Typography>กิจกรรมที่เปิดอยู่</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="success.main">
                {activities.length}
              </Typography>
              <Typography>กิจกรรมทั้งหมด</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
                สร้างกิจกรรมใหม่
              </Button>
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
          ) : (
            activities.map((a) => {
              const st = statusOf(a);
              return (
                <Accordion key={a.id} sx={{ mb: 1, '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        width: '100%',
                      }}
                    >
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {(a.activityName || 'A').charAt(0)}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1">{a.activityName || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          รหัส: {a.activityCode}
                        </Typography>
                      </Box>
                      <Chip label={st.label} color={st.color} />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={8}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {a.description || 'ไม่มีรายละเอียด'}
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              เริ่ม
                            </Typography>
                            <Typography>
                              {a.startDateTime?.toLocaleString('th-TH') || '-'}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              สิ้นสุด
                            </Typography>
                            <Typography>
                              {a.endDateTime?.toLocaleString('th-TH') || '-'}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              ผู้เข้าร่วม
                            </Typography>
                            <Typography>
                              {a.currentParticipants || 0}
                              {a.maxParticipants ? `/${a.maxParticipants}` : ''}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              รัศมีเช็คอิน
                            </Typography>
                            <Typography>{a.checkInRadius ?? 50} ม.</Typography>
                          </Grid>
                        </Grid>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="subtitle1" sx={{ mb: 1 }}>
                            QR Code
                          </Typography>
                          {a.qrUrl ? (
                            <img
                              src={a.qrUrl}
                              alt="QR"
                              style={{ width: 150, height: 150 }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              ยังไม่สร้าง QR
                            </Typography>
                          )}

                          <Box
                            sx={{
                              mt: 2,
                              display: 'flex',
                              gap: 1,
                              justifyContent: 'center',
                              flexWrap: 'wrap',
                            }}
                          >
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleToggle(a)}
                            >
                              {a.isActive ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                            </Button>
                            <Tooltip title="แก้ไข">
                              <IconButton color="primary" size="small" onClick={() => openEditDialog(a)}>
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="ลบ">
                              <IconButton color="error" size="small" onClick={() => handleDeleteActivity(a)}>
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="ดู">
                              <IconButton color="info" size="small" onClick={() => window.open(makeTargetUrl(baseUrl, a.activityCode), '_blank')}>
                                <ViewIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* =========================
          Create Activity Dialog
      ========================== */}
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
              <Grid item xs={12}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="text.secondary">สังกัดที่จะบันทึก:</Typography>
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={(DEPARTMENT_LABELS as Record<string, string>)[currentAdmin.department] || currentAdmin.department}
                  />
                </Stack>
              </Grid>

              {/* ชื่อ/รหัส */}
              <Grid item xs={12} md={8}>
                <TextField
                  label="ชื่อกิจกรรม *"
                  fullWidth
                  value={form.activityName}
                  onChange={(e) => updateForm('activityName', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="รหัสกิจกรรม *"
                  fullWidth
                  value={form.activityCode}
                  onChange={(e) => updateForm('activityCode', e.target.value.toUpperCase())}
                  inputProps={{ maxLength: 32 }}
                />
              </Grid>

              {/* userCode */}
              <Grid item xs={12} md={4}>
                <TextField
                  label="รหัสผู้ใช้ (userCode)"
                  fullWidth
                  value={form.userCode}
                  onChange={(e) => updateForm('userCode', e.target.value)}
                  placeholder="เช่น U001 (ถ้ามี)"
                />
              </Grid>

              {/* ส่วนหัว */}
              <Grid item xs={12} md={8}>
                <TextField
                  label="ส่วนหัว (จะแสดงบนหน้าลงทะเบียน)"
                  fullWidth
                  value={form.headerTitle}
                  onChange={(e) => updateForm('headerTitle', e.target.value)}
                  placeholder="เช่น ลงทะเบียนกิจกรรม Orientation 2025"
                />
              </Grid>

              {/* อัปโหลดรูปส่วนหัว */}
              <Grid item xs={12}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                  <Button
                    component="label"
                    startIcon={<ImageIcon />}
                    variant="outlined"
                  >
                    เลือกรูปส่วนหัว
                    <input
                      hidden
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        updateForm('bannerFile', file);
                        if (file) {
                          updateForm('bannerUrl', URL.createObjectURL(file));
                        }
                      }}
                    />
                  </Button>
                  {form.bannerUrl && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <img
                        src={form.bannerUrl}
                        alt="banner-preview"
                        style={{ height: 60, borderRadius: 8 }}
                      />
                      <IconButton
                        color="error"
                        onClick={() => {
                          updateForm('bannerUrl', undefined);
                          updateForm('bannerFile', null);
                        }}
                      >
                        <ClearIcon />
                      </IconButton>
                    </Stack>
                  )}
                </Stack>
              </Grid>

              {/* คำอธิบาย/สถานที่ */}
              <Grid item xs={12}>
                <TextField
                  label="คำอธิบาย"
                  fullWidth
                  multiline
                  minRows={2}
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="สถานที่"
                  fullWidth
                  value={form.location}
                  onChange={(e) => updateForm('location', e.target.value)}
                />
              </Grid>

              {/* Google Map Picker */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MapIcon /> เลือกตำแหน่งจากแผนที่
                </Typography>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string}>
                    <MapPicker
                      lat={form.latitude}
                      lng={form.longitude}
                      radius={form.checkInRadius}
                      onChange={({ lat, lng, radius }) => {
                        updateForm('latitude', lat);
                        updateForm('longitude', lng);
                        updateForm('checkInRadius', radius);
                      }}
                    />
                  </LoadScript>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
                    <TextField
                      label="Latitude"
                      value={form.latitude ?? ''}
                      onChange={(e) => updateForm('latitude', e.target.value === '' ? undefined : Number(e.target.value))}
                      InputProps={{ startAdornment: <InputAdornment position="start"><PlaceIcon /></InputAdornment> }}
                      fullWidth
                    />
                    <TextField
                      label="Longitude"
                      value={form.longitude ?? ''}
                      onChange={(e) => updateForm('longitude', e.target.value === '' ? undefined : Number(e.target.value))}
                      InputProps={{ startAdornment: <InputAdornment position="start"><PlaceIcon /></InputAdornment> }}
                      fullWidth
                    />
                  </Stack>

                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120 }}>รัศมีเช็คอิน</Typography>
                    <Slider
                      value={form.checkInRadius}
                      onChange={(_, v) => updateForm('checkInRadius', Array.isArray(v) ? v[0] : Number(v))}
                      valueLabelDisplay="auto"
                      step={10}
                      min={10}
                      max={2000}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="เมตร"
                      value={form.checkInRadius}
                      onChange={(e) => updateForm('checkInRadius', clamp(Number(e.target.value || 0), 10, 2000))}
                      type="number"
                      inputProps={{ min: 10, max: 2000 }}
                      sx={{ width: 130 }}
                    />
                  </Stack>

                  <Button
                    sx={{ mt: 2 }}
                    variant="outlined"
                    startIcon={<MyLocationIcon />}
                    onClick={useCurrentLocation}
                  >
                    ใช้ตำแหน่งปัจจุบัน
                  </Button>
                </Paper>
              </Grid>

              {/* วันเวลา */}
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="เริ่มต้น"
                  value={form.startDateTime}
                  onChange={(v) => updateForm('startDateTime', toDayjs(v))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="สิ้นสุด"
                  value={form.endDateTime}
                  onChange={(v) => updateForm('endDateTime', toDayjs(v))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              {/* options */}
              <Grid item xs={12} md={4}>
                <TextField
                  label="จำนวนสูงสุด (เว้นว่าง = ไม่จำกัด)"
                  fullWidth
                  value={form.maxParticipants ?? ''}
                  onChange={(e) =>
                    updateForm(
                      'maxParticipants',
                      e.target.value === '' ? undefined : Math.max(0, Number(e.target.value))
                    )
                  }
                  placeholder="เช่น 300"
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  alignItems="center"
                  justifyContent="flex-end"
                  sx={{ height: '100%' }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.isActive}
                        onChange={(e) => updateForm('isActive', e.target.checked)}
                      />
                    }
                    label="เปิดใช้งาน"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.requiresUniversityLogin}
                        onChange={(e) =>
                          updateForm('requiresUniversityLogin', e.target.checked)
                        }
                      />
                    }
                    label="ต้องลงชื่อเข้าใช้มหาวิทยาลัย"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.singleUserMode}
                        onChange={(e) => updateForm('singleUserMode', e.target.checked)}
                      />
                    }
                    label="Single-user mode"
                  />
                </Stack>
              </Grid>

              {/* Preview target url + QR (หลังสร้างสำเร็จ) */}
              {form.targetUrl && form.qrDataUrl && (
                <>
                  <Grid item xs={12}>
                    <Divider />
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <TextField
                      label="Target URL (สำหรับ QR)"
                      fullWidth
                      value={form.targetUrl}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LinkIcon />
                          </InputAdornment>
                        ),
                        readOnly: true,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        ตัวอย่าง QR
                      </Typography>
                      <img
                        src={form.qrDataUrl}
                        alt="QR Preview"
                        style={{ width: 140, height: 140 }}
                      />
                    </Paper>
                  </Grid>
                </>
              )}
            </Grid>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreate} disabled={saving}>
            ยกเลิก
          </Button>
          <Button
            onClick={async () => {
              await handleCreateSubmit();
            }}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={18} /> : <AddIcon />}
          >
            บันทึก & สร้าง QR
          </Button>
        </DialogActions>
      </Dialog>

      {/* =========================
          Edit Activity Dialog
      ========================== */}
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
              <Grid item xs={12} md={8}>
                <TextField
                  label="ชื่อกิจกรรม *"
                  fullWidth
                  value={form.activityName}
                  onChange={(e) => updateForm('activityName', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="รหัสกิจกรรม"
                  fullWidth
                  value={form.activityCode}
                  disabled
                />
              </Grid>

              {/* userCode */}
              <Grid item xs={12} md={4}>
                <TextField
                  label="รหัสผู้ใช้ (userCode)"
                  fullWidth
                  value={form.userCode}
                  onChange={(e) => updateForm('userCode', e.target.value)}
                />
              </Grid>

              {/* ส่วนหัว */}
              <Grid item xs={12} md={8}>
                <TextField
                  label="ส่วนหัว (จะแสดงบนหน้าลงทะเบียน)"
                  fullWidth
                  value={form.headerTitle}
                  onChange={(e) => updateForm('headerTitle', e.target.value)}
                />
              </Grid>

              {/* อัปโหลด/ลบรูปส่วนหัว */}
              <Grid item xs={12}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                  <Button component="label" startIcon={<ImageIcon />} variant="outlined">
                    เปลี่ยนรูปส่วนหัว
                    <input
                      hidden
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        updateForm('bannerFile', file);
                        if (file) {
                          updateForm('bannerUrl', URL.createObjectURL(file));
                        }
                      }}
                    />
                  </Button>

                  {form.bannerUrl ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <img
                        src={form.bannerUrl}
                        alt="banner-preview"
                        style={{ height: 60, borderRadius: 8 }}
                      />
                      <Button
                        color="error"
                        startIcon={<ClearIcon />}
                        onClick={async () => {
                          await deleteBannerIfOwned(form.bannerUrl);
                          updateForm('bannerUrl', undefined);
                          updateForm('bannerFile', null);
                        }}
                      >
                        ลบรูป
                      </Button>
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">ไม่มีรูปส่วนหัว</Typography>
                  )}
                </Stack>
              </Grid>

              {/* คำอธิบาย/สถานที่ */}
              <Grid item xs={12}>
                <TextField
                  label="คำอธิบาย"
                  fullWidth
                  multiline
                  minRows={2}
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="สถานที่"
                  fullWidth
                  value={form.location}
                  onChange={(e) => updateForm('location', e.target.value)}
                />
              </Grid>

              {/* Map */}
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MapIcon /> ปรับตำแหน่งจากแผนที่
                </Typography>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string}>
                    <MapPicker
                      lat={form.latitude}
                      lng={form.longitude}
                      radius={form.checkInRadius}
                      onChange={({ lat, lng, radius }) => {
                        updateForm('latitude', lat);
                        updateForm('longitude', lng);
                        updateForm('checkInRadius', radius);
                      }}
                    />
                  </LoadScript>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
                    <TextField
                      label="Latitude"
                      value={form.latitude ?? ''}
                      onChange={(e) => updateForm('latitude', e.target.value === '' ? undefined : Number(e.target.value))}
                      InputProps={{ startAdornment: <InputAdornment position="start"><PlaceIcon /></InputAdornment> }}
                      fullWidth
                    />
                    <TextField
                      label="Longitude"
                      value={form.longitude ?? ''}
                      onChange={(e) => updateForm('longitude', e.target.value === '' ? undefined : Number(e.target.value))}
                      InputProps={{ startAdornment: <InputAdornment position="start"><PlaceIcon /></InputAdornment> }}
                      fullWidth
                    />
                  </Stack>

                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120 }}>รัศมีเช็คอิน</Typography>
                    <Slider
                      value={form.checkInRadius}
                      onChange={(_, v) => updateForm('checkInRadius', Array.isArray(v) ? v[0] : Number(v))}
                      valueLabelDisplay="auto"
                      step={10}
                      min={10}
                      max={2000}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="เมตร"
                      value={form.checkInRadius}
                      onChange={(e) => updateForm('checkInRadius', clamp(Number(e.target.value || 0), 10, 2000))}
                      type="number"
                      inputProps={{ min: 10, max: 2000 }}
                      sx={{ width: 130 }}
                    />
                  </Stack>
                </Paper>
              </Grid>

              {/* วันเวลา */}
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="เริ่มต้น"
                  value={form.startDateTime}
                  onChange={(v) => updateForm('startDateTime', toDayjs(v))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="สิ้นสุด"
                  value={form.endDateTime}
                  onChange={(v) => updateForm('endDateTime', toDayjs(v))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              {/* options */}
              <Grid item xs={12} md={4}>
                <TextField
                  label="จำนวนสูงสุด (เว้นว่าง = ไม่จำกัด)"
                  fullWidth
                  value={form.maxParticipants ?? ''}
                  onChange={(e) =>
                    updateForm(
                      'maxParticipants',
                      e.target.value === '' ? undefined : Math.max(0, Number(e.target.value))
                    )
                  }
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  alignItems="center"
                  justifyContent="flex-end"
                  sx={{ height: '100%' }}
                >
                  <FormControlLabel
                    control={<Switch checked={form.isActive} onChange={(e) => updateForm('isActive', e.target.checked)} />}
                    label="เปิดใช้งาน"
                  />
                  <FormControlLabel
                    control={<Switch checked={form.requiresUniversityLogin} onChange={(e) => updateForm('requiresUniversityLogin', e.target.checked)} />}
                    label="ต้องลงชื่อเข้าใช้มหาวิทยาลัย"
                  />
                  <FormControlLabel
                    control={<Switch checked={form.singleUserMode} onChange={(e) => updateForm('singleUserMode', e.target.checked)} />}
                    label="Single-user mode"
                  />
                </Stack>
              </Grid>
            </Grid>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit} disabled={editing}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleEditSubmit}
            variant="contained"
            disabled={editing}
            startIcon={editing ? <CircularProgress size={18} /> : <EditIcon />}
          >
            บันทึกการแก้ไข
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default QRCodeAdminPanel;
