'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  Grid,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  Tooltip,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  FormHelperText,
  CardMedia,
  useTheme,
  useMediaQuery,
  Avatar
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  VisibilityOff as DisableIcon,
  Visibility as EnableIcon,
  ExpandMore as ExpandMoreIcon,
  AccessTime as TimeIcon,
  LocationOn as LocationIcon,
  QrCode as QrCodeIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Map as MapIcon,
  CloudUpload as UploadIcon,
  Image as ImageIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { GoogleMap, MarkerF, CircleF, useLoadScript } from '@react-google-maps/api';
import QRCode from 'qrcode';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { storage } from '../lib/firebase';

interface ActivityData {
  id?: string;
  activityCode: string;
  activityName: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  checkInRadius: number; // เมตร
  userCode: string;
  startDateTime: Date;
  endDateTime: Date;
  isActive: boolean;
  qrUrl: string;
  targetUrl: string;
  bannerUrl?: string;
  bannerFileName?: string;
  createdAt?: any;
  updatedAt?: any;
  maxParticipants?: number;
  currentParticipants?: number;
}

interface LocationPickerProps {
  location: { latitude: number; longitude: number };
  radius: number;
  onLocationChange: (lat: number, lng: number) => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '250px', // ลดความสูงสำหรับมือถือ
};

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ['places'];

const LocationPicker: React.FC<LocationPickerProps> = ({ location, radius, onLocationChange }) => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const [markerPos, setMarkerPos] = useState({
    lat: location.latitude,
    lng: location.longitude,
  });

  useEffect(() => {
    setMarkerPos({
      lat: location.latitude,
      lng: location.longitude,
    });
  }, [location.latitude, location.longitude]);

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setMarkerPos({ lat, lng });
          onLocationChange(lat, lng);
        },
        (error) => {
          let errorMessage = 'ไม่สามารถดึงตำแหน่งปัจจุบันได้: ';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'ผู้ใช้ปฏิเสธการเข้าถึงตำแหน่ง';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'ไม่สามารถระบุตำแหน่งได้';
              break;
            case error.TIMEOUT:
              errorMessage += 'หมดเวลาในการขอตำแหน่ง';
              break;
            default:
              errorMessage += 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
              break;
          }
          alert(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    } else {
      alert('เบราว์เซอร์ของคุณไม่รองรับการเข้าถึงตำแหน่ง');
    }
  };

  const onMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      setMarkerPos({ lat, lng });
      onLocationChange(lat, lng);
    }
  }, [onLocationChange]);

  const onMarkerDragEnd = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      setMarkerPos({ lat, lng });
      onLocationChange(lat, lng);
    }
  }, [onLocationChange]);

  if (loadError) {
    return (
      <div style={{ color: 'red', padding: '10px' }}>
        โหลดแผนที่ล้มเหลว: {loadError.message}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ padding: '10px', textAlign: 'center' }}>
        กำลังโหลดแผนที่...
      </div>
    );
  }

  return (
    <>
      <Box sx={{ mb: 1, textAlign: 'right' }}>
        <Button variant="contained" size="small" onClick={handleUseCurrentLocation}>
          ใช้ตำแหน่งปัจจุบัน
        </Button>
      </Box>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={15}
        center={markerPos}
        onClick={onMapClick}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          scaleControl: true,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: true,
        }}
      >
        <MarkerF
          position={markerPos}
          draggable={true}
          onDragEnd={onMarkerDragEnd}
        />
        <CircleF
          center={markerPos}
          radius={radius}
          options={{
            fillColor: '#1976d2',
            fillOpacity: 0.2,
            strokeColor: '#1976d2',
            strokeOpacity: 0.5,
            strokeWeight: 2,
          }}
        />
      </GoogleMap>
    </>
  );
};

// Component สำหรับอัปโหลดรูปภาพ
const ImageUploader: React.FC<{
  onImageChange: (file: File | null, previewUrl: string) => void;
  currentImageUrl?: string;
  disabled?: boolean;
}> = ({ onImageChange, currentImageUrl, disabled = false }) => {
  const [previewUrl, setPreviewUrl] = useState<string>(currentImageUrl || '');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // ตรวจสอบประเภทไฟล์
      if (!file.type.startsWith('image/')) {
        alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
        return;
      }
      
      // ตรวจสอบขนาดไฟล์ (สูงสุด 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('ขนาดไฟล์ต้องไม่เกิน 5MB');
        return;
      }

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      onImageChange(file, url);
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl('');
    onImageChange(null, '');
  };

  return (
    <Box>
      <input
        accept="image/*"
        style={{ display: 'none' }}
        id="banner-upload"
        type="file"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <label htmlFor="banner-upload">
        <Button
          variant="outlined"
          component="span"
          startIcon={<UploadIcon />}
          disabled={disabled}
          fullWidth
          sx={{ mb: 2 }}
        >
          เลือกรูป Banner (ไม่เกิน 5MB)
        </Button>
      </label>
      
      {previewUrl && (
        <Box sx={{ position: 'relative', mb: 2 }}>
          <img
            src={previewUrl}
            alt="Banner Preview"
            style={{
              width: '100%',
              height: '200px',
              objectFit: 'cover',
              borderRadius: '8px',
              border: '1px solid #ddd'
            }}
          />
          <IconButton
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.8)',
              }
            }}
            onClick={handleRemoveImage}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      )}
    </Box>
  );
};

const QRCodeAdminPanel: React.FC<{ baseUrl: string }> = ({ baseUrl }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [formData, setFormData] = useState<Partial<ActivityData>>({
    activityCode: '',
    activityName: '',
    description: '',
    location: '',
    latitude: 13.7563, // Default to Bangkok
    longitude: 100.5018,
    checkInRadius: 100, // 100 meters
    userCode: '',
    startDateTime: new Date(),
    endDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours later
    maxParticipants: 0
  });
  
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string>('');
  const [editBannerFile, setEditBannerFile] = useState<File | null>(null);
  const [editBannerPreviewUrl, setEditBannerPreviewUrl] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [editingActivity, setEditingActivity] = useState<ActivityData | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [autoGenerateCode, setAutoGenerateCode] = useState(true);
  const [autoGenerateUserCode, setAutoGenerateUserCode] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadActivities = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'activityQRCodes'));
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          startDateTime: data.startDateTime?.toDate() || new Date(),
          endDateTime: data.endDateTime?.toDate() || new Date(),
          isActive: data.isActive !== undefined ? data.isActive : true,
          latitude: data.latitude || 13.7563,
          longitude: data.longitude || 100.5018,
          checkInRadius: data.checkInRadius || 100,
          userCode: data.userCode || ''
        } as ActivityData;
      });
      setActivities(list.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
    } catch (error) {
      console.error('Error loading activities:', error);
      setError('ไม่สามารถโหลดข้อมูลกิจกรรมได้');
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const generateActivityCode = () => {
    const timestamp = Date.now().toString().slice(-6);
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ACT${timestamp}${randomStr}`;
  };

  const generateUserCode = () => {
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `USER${randomStr}`;
  };

  const handleAutoGenerateToggle = () => {
    setAutoGenerateCode(!autoGenerateCode);
    if (!autoGenerateCode) {
      setFormData(prev => ({ ...prev, activityCode: generateActivityCode() }));
    } else {
      setFormData(prev => ({ ...prev, activityCode: '' }));
    }
  };

  const handleAutoGenerateUserCodeToggle = () => {
    setAutoGenerateUserCode(!autoGenerateUserCode);
    if (!autoGenerateUserCode) {
      setFormData(prev => ({ ...prev, userCode: generateUserCode() }));
    } else {
      setFormData(prev => ({ ...prev, userCode: '' }));
    }
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const handleBannerChange = (file: File | null, previewUrl: string) => {
    setBannerFile(file);
    setBannerPreviewUrl(previewUrl);
  };

  const handleEditBannerChange = (file: File | null, previewUrl: string) => {
    setEditBannerFile(file);
    setEditBannerPreviewUrl(previewUrl);
  };

  // Upload banner to Firebase Storage
  const uploadBanner = async (file: File, activityCode: string): Promise<string> => {
    const timestamp = Date.now();
    const fileName = `banners/${activityCode}_${timestamp}_${file.name}`;
    const storageRef = ref(storage, fileName);
    
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  };

  // Delete banner from Firebase Storage
  const deleteBanner = async (bannerUrl: string) => {
    try {
      const storageRef = ref(storage, bannerUrl);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error deleting banner:', error);
    }
  };

  const isActivityActive = (activity: ActivityData) => {
    const now = new Date();
    return activity.isActive && 
           now >= activity.startDateTime && 
           now <= activity.endDateTime;
  };

  const getActivityStatus = (activity: ActivityData) => {
    const now = new Date();
    if (!activity.isActive) return { status: 'ปิดใช้งาน', color: 'error' as const };
    if (now < activity.startDateTime) return { status: 'รอเปิด', color: 'warning' as const };
    if (now > activity.endDateTime) return { status: 'สิ้นสุดแล้ว', color: 'default' as const };
    return { status: 'เปิดใช้งาน', color: 'success' as const };
  };

  const generateQRCode = async () => {
    setError('');
    setSuccessMessage('');
    setQrCodeUrl('');
    setUploading(true);

    // Validation
    if (!formData.activityName?.trim()) {
      setError('กรุณาใส่ชื่อกิจกรรม');
      setUploading(false);
      return;
    }

    if (!formData.activityCode?.trim()) {
      setError('กรุณาใส่รหัสกิจกรรม');
      setUploading(false);
      return;
    }

    if (!formData.userCode?.trim()) {
      setError('กรุณาใส่รหัสผู้ใช้');
      setUploading(false);
      return;
    }

    if (!formData.startDateTime || !formData.endDateTime) {
      setError('กรุณาเลือกวันเวลาเปิด-ปิดกิจกรรม');
      setUploading(false);
      return;
    }

    if (formData.startDateTime >= formData.endDateTime) {
      setError('วันเวลาเริ่มต้องน้อยกว่าวันเวลาสิ้นสุด');
      setUploading(false);
      return;
    }

    if (!formData.latitude || !formData.longitude) {
      setError('กรุณาเลือกตำแหน่งที่ตั้ง');
      setUploading(false);
      return;
    }

    try {
      // Check for duplicate activity code
      const activityQuery = query(collection(db, 'activityQRCodes'), where('activityCode', '==', formData.activityCode.trim()));
      const activitySnapshot = await getDocs(activityQuery);

      if (!activitySnapshot.empty) {
        setError('รหัสกิจกรรมนี้ถูกใช้งานไปแล้ว');
        setUploading(false);
        return;
      }

      // Check for duplicate user code
      const userCodeQuery = query(collection(db, 'activityQRCodes'), where('userCode', '==', formData.userCode.trim()));
      const userCodeSnapshot = await getDocs(userCodeQuery);

      if (!userCodeSnapshot.empty) {
        setError('รหัสผู้ใช้นี้ถูกใช้งานไปแล้ว');
        setUploading(false);
        return;
      }

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      const url = `${baseUrl}/register?activity=${encodeURIComponent(formData.activityCode)}`;
      const qrUrl = await QRCode.toDataURL(url);

      let bannerUrl = '';
      let bannerFileName = '';
      
      // อัปโหลดรูป banner ถ้ามี
      if (bannerFile) {
        bannerUrl = await uploadBanner(bannerFile, formData.activityCode.trim());
        bannerFileName = bannerFile.name;
      }

      const activityData = {
        activityCode: formData.activityCode.trim(),
        activityName: formData.activityName.trim(),
        description: formData.description?.trim() || '',
        location: formData.location?.trim() || '',
        latitude: formData.latitude,
        longitude: formData.longitude,
        checkInRadius: formData.checkInRadius || 100,
        userCode: formData.userCode.trim(),
        startDateTime: Timestamp.fromDate(formData.startDateTime),
        endDateTime: Timestamp.fromDate(formData.endDateTime),
        maxParticipants: formData.maxParticipants || 0,
        currentParticipants: 0,
        qrUrl,
        targetUrl: url,
        bannerUrl,
        bannerFileName,
        createdAt: serverTimestamp(),
        isActive: true
      };

      await addDoc(collection(db, 'activityQRCodes'), activityData);

      setQrCodeUrl(qrUrl);
      setFormData({
        activityCode: autoGenerateCode ? generateActivityCode() : '',
        activityName: '',
        description: '',
        location: '',
        latitude: 13.7563,
        longitude: 100.5018,
        checkInRadius: 100,
        userCode: autoGenerateUserCode ? generateUserCode() : '',
        startDateTime: new Date(),
        endDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        maxParticipants: 0
      });
      setBannerFile(null);
      setBannerPreviewUrl('');
      setSuccessMessage('สร้างกิจกรรมและ QR Code เรียบร้อยแล้ว');
      loadActivities();
    } catch (error) {
      console.error('Error generating QR code:', error);
      setError('เกิดข้อผิดพลาดในการสร้าง QR Code');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ที่จะลบกิจกรรมนี้?')) return;
    
    try {
      const activity = activities.find(a => a.id === id);
      
      // ลบรูป banner ถ้ามี
      if (activity?.bannerUrl) {
        await deleteBanner(activity.bannerUrl);
      }
      
      await deleteDoc(doc(db, 'activityQRCodes', id));
      setSuccessMessage('ลบกิจกรรมเรียบร้อยแล้ว');
      loadActivities();
    } catch (error) {
      console.error('Error deleting activity:', error);
      setError('ไม่สามารถลบกิจกรรมได้');
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'activityQRCodes', id), { 
        isActive: !current,
        updatedAt: serverTimestamp()
      });
      
      const newStatus = !current ? 'เปิดใช้งาน' : 'ปิดใช้งาน';
      setSuccessMessage(`${newStatus}กิจกรรมเรียบร้อยแล้ว`);
      loadActivities();
    } catch (error) {
      console.error('Error toggling activity status:', error);
      setError('ไม่สามารถเปลี่ยนสถานะกิจกรรมได้');
    }
  };

  const handleEdit = (activity: ActivityData) => {
    setEditingActivity({ ...activity });
    setEditBannerPreviewUrl(activity.bannerUrl || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingActivity?.activityName?.trim()) {
      setError('กรุณาใส่ชื่อกิจกรรมที่ถูกต้อง');
      return;
    }

    if (!editingActivity?.activityCode?.trim()) {
      setError('กรุณาใส่รหัสกิจกรรมที่ถูกต้อง');
      return;
    }

    if (!editingActivity?.userCode?.trim()) {
      setError('กรุณาใส่รหัสผู้ใช้ที่ถูกต้อง');
      return;
    }

    if (!editingActivity?.startDateTime || !editingActivity?.endDateTime) {
      setError('กรุณาเลือกวันเวลาเปิด-ปิดกิจกรรม');
      return;
    }

    if (editingActivity.startDateTime >= editingActivity.endDateTime) {
      setError('วันเวลาเริ่มต้องน้อยกว่าวันเวลาสิ้นสุด');
      return;
    }

    setUploading(true);

    try {
      // Check for duplicate activity code
      if (editingActivity.activityCode.trim() !== activities.find(a => a.id === editingActivity.id)?.activityCode) {
        const activityQuery = query(
          collection(db, 'activityQRCodes'), 
          where('activityCode', '==', editingActivity.activityCode.trim())
        );
        const activitySnapshot = await getDocs(activityQuery);
        
        if (!activitySnapshot.empty) {
          setError('รหัสกิจกรรมนี้ถูกใช้งานไปแล้ว');
          setUploading(false);
          return;
        }
      }

      // Check for duplicate user code
      if (editingActivity.userCode.trim() !== activities.find(a => a.id === editingActivity.id)?.userCode) {
        const userCodeQuery = query(
          collection(db, 'activityQRCodes'), 
          where('userCode', '==', editingActivity.userCode.trim())
        );
        const userCodeSnapshot = await getDocs(userCodeQuery);
        
        if (!userCodeSnapshot.empty) {
          setError('รหัสผู้ใช้นี้ถูกใช้งานไปแล้ว');
          setUploading(false);
          return;
        }
      }

      let bannerUrl = editingActivity.bannerUrl || '';
      let bannerFileName = editingActivity.bannerFileName || '';

      // ถ้ามีการอัปโหลดรูปใหม่
      if (editBannerFile) {
        // ลบรูปเก่าถ้ามี
        if (editingActivity.bannerUrl) {
          await deleteBanner(editingActivity.bannerUrl);
        }
        
        // อัปโหลดรูปใหม่
        bannerUrl = await uploadBanner(editBannerFile, editingActivity.activityCode.trim());
        bannerFileName = editBannerFile.name;
      }

      const updateData = {
        activityCode: editingActivity.activityCode.trim(),
        activityName: editingActivity.activityName.trim(),
        description: editingActivity.description?.trim() || '',
        location: editingActivity.location?.trim() || '',
        latitude: editingActivity.latitude,
        longitude: editingActivity.longitude,
        checkInRadius: editingActivity.checkInRadius || 100,
        userCode: editingActivity.userCode.trim(),
        startDateTime: Timestamp.fromDate(editingActivity.startDateTime),
        endDateTime: Timestamp.fromDate(editingActivity.endDateTime),
        maxParticipants: editingActivity.maxParticipants || 0,
        bannerUrl,
        bannerFileName,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'activityQRCodes', editingActivity.id!), updateData);
      
      setEditDialogOpen(false);
      setEditingActivity(null);
      setEditBannerFile(null);
      setEditBannerPreviewUrl('');
      setSuccessMessage('แก้ไขข้อมูลกิจกรรมเรียบร้อยแล้ว');
      loadActivities();
    } catch (error) {
      console.error('Error updating activity:', error);
      setError('ไม่สามารถแก้ไขข้อมูลกิจกรรมได้');
    } finally {
      setUploading(false);
    }
  };

  const handleEditLocationChange = (lat: number, lng: number) => {
    if (editingActivity) {
      setEditingActivity({ ...editingActivity, latitude: lat, longitude: lng });
    }
  };

  // Helper function to convert Dayjs/Date to Date
  const convertToDate = (value: any): Date => {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    // If it's a Dayjs object, convert to Date
    if (value.toDate && typeof value.toDate === 'function') {
      return value.toDate();
    }
    // If it has a toJSDate method (Dayjs)
    if (value.toJSDate && typeof value.toJSDate === 'function') {
      return value.toJSDate();
    }
    // Fallback
    return new Date(value);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: isMobile ? 1 : 2 }}>
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <QrCodeIcon />
              สร้างกิจกรรมและ QR Code
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={isMobile ? 2 : 3}>
              {/* Banner Upload */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ImageIcon />
                  รูป Banner กิจกรรม
                </Typography>
                <Paper sx={{ p: 2 }}>
                  <ImageUploader 
                    onImageChange={handleBannerChange}
                    currentImageUrl={bannerPreviewUrl}
                    disabled={uploading}
                  />
                </Paper>
              </Grid>

              {/* ชื่อกิจกรรม */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="ชื่อกิจกรรม *"
                  value={formData.activityName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, activityName: e.target.value }))}
                  placeholder="เช่น: สัมมนาเทคโนโลยี 2024"
                />
              </Grid>

              {/* รหัสกิจกรรม */}
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="รหัสกิจกรรม *"
                  value={formData.activityCode || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, activityCode: e.target.value }))}
                  placeholder="เช่น: TECH2024"
                  disabled={autoGenerateCode}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', gap: 1, flexDirection: isMobile ? 'column' : 'row' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Switch
                      checked={autoGenerateCode}
                      onChange={handleAutoGenerateToggle}
                      color="primary"
                    />
                    <Typography variant="body2">สร้างรหัสอัตโนมัติ</Typography>
                  </Box>
                  {autoGenerateCode && (
                    <IconButton size="small" onClick={() => setFormData(prev => ({ ...prev, activityCode: generateActivityCode() }))}>
                      <RefreshIcon />
                    </IconButton>
                  )}
                </Box>
              </Grid>

              {/* รหัสผู้ใช้ */}
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="รหัสผู้ใช้ *"
                  value={formData.userCode || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, userCode: e.target.value }))}
                  placeholder="เช่น: USER123ABC"
                  disabled={autoGenerateUserCode}
                  InputProps={{
                    startAdornment: <PersonIcon sx={{ mr: 1, color: 'action.active' }} />
                  }}
                />
                <FormHelperText>รหัสนี้จะใช้สำหรับให้ผู้ใช้กรอกเมื่อลงทะเบียน</FormHelperText>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', gap: 1, flexDirection: isMobile ? 'column' : 'row' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Switch
                      checked={autoGenerateUserCode}
                      onChange={handleAutoGenerateUserCodeToggle}
                      color="primary"
                    />
                    <Typography variant="body2">สร้างรหัสอัตโนมัติ</Typography>
                  </Box>
                  {autoGenerateUserCode && (
                    <IconButton size="small" onClick={() => setFormData(prev => ({ ...prev, userCode: generateUserCode() }))}>
                      <RefreshIcon />
                    </IconButton>
                  )}
                </Box>
              </Grid>

              {/* รายละเอียด */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="รายละเอียดกิจกรรม"
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="อธิบายรายละเอียดของกิจกรรม..."
                />
              </Grid>

              {/* สถานที่ */}
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="สถานที่จัดงาน"
                  value={formData.location || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="เช่น: ห้องประชุมใหญ่ ชั้น 5"
                />
              </Grid>

              {/* รัศมีเช็คอิน */}
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="รัศมีเช็คอิน (เมตร)"
                  value={formData.checkInRadius || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, checkInRadius: parseInt(e.target.value) || 100 }))}
                  placeholder="100"
                  inputProps={{ min: 10, max: 1000 }}
                />
                <FormHelperText>ระยะทางที่อนุญาตให้เช็คอินได้ (10-1000 เมตร)</FormHelperText>
              </Grid>

              {/* จำนวนผู้เข้าร่วมสูงสุด */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="จำนวนผู้เข้าร่วมสูงสุด"
                  value={formData.maxParticipants || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxParticipants: parseInt(e.target.value) || 0 }))}
                  placeholder="0 = ไม่จำกัด"
                  inputProps={{ min: 0 }}
                />
              </Grid>

              {/* วันเวลาเริ่มกิจกรรม */}
              <Grid item xs={12} sm={6}>
                <DateTimePicker
                  label="วันเวลาเริ่มกิจกรรม *"
                  value={formData.startDateTime || null}
                  onChange={(newValue) => setFormData(prev => ({ ...prev, startDateTime: convertToDate(newValue) }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              {/* วันเวลาสิ้นสุด */}
              <Grid item xs={12} sm={6}>
                <DateTimePicker
                  label="วันเวลาสิ้นสุดกิจกรรม *"
                  value={formData.endDateTime || null}
                  onChange={(newValue) => setFormData(prev => ({ ...prev, endDateTime: convertToDate(newValue) }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              {/* ตำแหน่งที่ตั้ง */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MapIcon />
                  ตำแหน่งที่ตั้งกิจกรรม
                </Typography>
                <Paper sx={{ p: 2 }}>
                  <LocationPicker
                    location={{ 
                      latitude: formData.latitude || 13.7563, 
                      longitude: formData.longitude || 100.5018 
                    }}
                    radius={formData.checkInRadius || 100}
                    onLocationChange={handleLocationChange}
                  />
                  <Box sx={{ mt: 2, display: 'flex', gap: 2, flexDirection: isMobile ? 'column' : 'row' }}>
                    <TextField
                      label="ละติจูด"
                      value={formData.latitude?.toFixed(6) || ''}
                      size="small"
                      InputProps={{ readOnly: true }}
                      fullWidth={isMobile}
                    />
                    <TextField
                      label="ลองจิจูด"
                      value={formData.longitude?.toFixed(6) || ''}
                      size="small"
                      InputProps={{ readOnly: true }}
                      fullWidth={isMobile}
                    />
                  </Box>
                </Paper>
              </Grid>

              {/* ปุ่มสร้าง */}
              <Grid item xs={12}>
                <Button 
                  fullWidth 
                  variant="contained" 
                  onClick={generateQRCode}
                  size="large"
                  sx={{ py: 1.5 }}
                  disabled={uploading}
                >
                  {uploading ? 'กำลังสร้าง...' : 'สร้างกิจกรรมและ QR Code'}
                </Button>
              </Grid>
            </Grid>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {successMessage && <Alert severity="success" sx={{ mt: 2 }}>{successMessage}</Alert>}
          </CardContent>
        </Card>

        <Typography variant="h6" gutterBottom>
          รายการกิจกรรมทั้งหมด ({activities.length} กิจกรรม)
        </Typography>

        {activities.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                ยังไม่มีกิจกรรมที่สร้างไว้
              </Typography>
            </CardContent>
          </Card>
        ) : (
          activities.map((activity) => {
            const statusInfo = getActivityStatus(activity);
            const isLive = isActivityActive(activity);
            
            return (
              <Accordion key={activity.id} sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2, flexDirection: isMobile ? 'column' : 'row' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                      {activity.bannerUrl && (
                        <Avatar
                          src={activity.bannerUrl}
                          variant="rounded"
                          sx={{ width: 60, height: 40 }}
                        />
                      )}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontSize: isMobile ? '1rem' : '1.25rem' }}>
                          {activity.activityName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          รหัส: {activity.activityCode} | รหัสผู้ใช้: {activity.userCode}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip 
                      label={statusInfo.status}
                      color={statusInfo.color}
                      variant={isLive ? 'filled' : 'outlined'}
                      size={isMobile ? 'small' : 'medium'}
                    />
                  </Box>
                </AccordionSummary>
                
                <AccordionDetails>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={activity.bannerUrl ? 12 : 8}>
                      {/* Banner Image */}
                      {activity.bannerUrl && (
                        <Box sx={{ mb: 2 }}>
                          <CardMedia
                            component="img"
                            height={isMobile ? "150" : "200"}
                            image={activity.bannerUrl}
                            alt="Activity Banner"
                            sx={{ borderRadius: 2, objectFit: 'cover' }}
                          />
                        </Box>
                      )}
                      
                      <Stack spacing={2}>
                        {activity.description && (
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>รายละเอียด:</Typography>
                            <Typography variant="body2">{activity.description}</Typography>
                          </Box>
                        )}
                        
                        {activity.location && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LocationIcon color="action" fontSize="small" />
                            <Typography variant="body2">{activity.location}</Typography>
                          </Box>
                        )}
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TimeIcon color="action" fontSize="small" />
                          <Typography variant="body2">
                            เริ่ม: {activity.startDateTime.toLocaleString('th-TH')}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TimeIcon color="action" fontSize="small" />
                          <Typography variant="body2">
                            สิ้นสุด: {activity.endDateTime.toLocaleString('th-TH')}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <MapIcon color="action" fontSize="small" />
                          <Typography variant="body2">
                            ตำแหน่ง: {activity.latitude.toFixed(6)}, {activity.longitude.toFixed(6)} 
                            (รัศมี {activity.checkInRadius} ม.)
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PersonIcon color="action" fontSize="small" />
                          <Typography variant="body2">
                            รหัสผู้ใช้: <strong>{activity.userCode}</strong>
                          </Typography>
                        </Box>
                        
                        {(activity.maxParticipants && activity.maxParticipants > 0) && (
                          <Typography variant="body2">
                            ผู้เข้าร่วม: {activity.currentParticipants || 0}/{activity.maxParticipants} คน
                          </Typography>
                        )}
                        
                        <Typography variant="caption" color="text.secondary">
                          สร้างเมื่อ: {activity.createdAt?.toDate?.()?.toLocaleString('th-TH') || 'ไม่ทราบ'}
                          {activity.updatedAt && (
                            <> | แก้ไขล่าสุด: {activity.updatedAt.toDate().toLocaleString('th-TH')}</>
                          )}
                        </Typography>
                      </Stack>
                    </Grid>
                    
                    <Grid item xs={12} md={activity.bannerUrl ? 12 : 4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <img src={activity.qrUrl} alt="QR Code" width={isMobile ? 120 : 150} />
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1 }}>
                          <Tooltip title="แก้ไขข้อมูลกิจกรรม">
                            <IconButton onClick={() => handleEdit(activity)} color="primary" size={isMobile ? 'small' : 'medium'}>
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="ลบกิจกรรม">
                            <IconButton color="error" onClick={() => handleDelete(activity.id!)} size={isMobile ? 'small' : 'medium'}>
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title={activity.isActive ? 'ปิดใช้งานกิจกรรม' : 'เปิดใช้งานกิจกรรม'}>
                            <IconButton 
                              onClick={() => handleToggleActive(activity.id!, activity.isActive)}
                              color={activity.isActive ? 'warning' : 'success'}
                              size={isMobile ? 'small' : 'medium'}
                            >
                              {activity.isActive ? <DisableIcon /> : <EnableIcon />}
                            </IconButton>
                          </Tooltip>
                        </Box>
                        
                        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography variant="body2" sx={{ mr: 1 }}>
                            เปิดใช้งาน:
                          </Typography>
                          <Switch
                            checked={activity.isActive}
                            onChange={() => handleToggleActive(activity.id!, activity.isActive)}
                            color="success"
                            size={isMobile ? 'small' : 'medium'}
                          />
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            );
          })
        )}

        {/* Edit Dialog */}
        <Dialog 
          open={editDialogOpen} 
          onClose={() => setEditDialogOpen(false)} 
          maxWidth="lg" 
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle>แก้ไขข้อมูลกิจกรรม</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {/* Banner Upload for Edit */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ImageIcon />
                  รูป Banner กิจกรรม
                </Typography>
                <Paper sx={{ p: 2 }}>
                  <ImageUploader 
                    onImageChange={handleEditBannerChange}
                    currentImageUrl={editBannerPreviewUrl}
                    disabled={uploading}
                  />
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="ชื่อกิจกรรม"
                  value={editingActivity?.activityName || ''}
                  onChange={(e) => setEditingActivity(prev => ({ 
                    ...prev!, 
                    activityName: e.target.value 
                  }))}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="รหัสกิจกรรม"
                  value={editingActivity?.activityCode || ''}
                  onChange={(e) => setEditingActivity(prev => ({ 
                    ...prev!, 
                    activityCode: e.target.value 
                  }))}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="รหัสผู้ใช้"
                  value={editingActivity?.userCode || ''}
                  onChange={(e) => setEditingActivity(prev => ({ 
                    ...prev!, 
                    userCode: e.target.value 
                  }))}
                  InputProps={{
                    startAdornment: <PersonIcon sx={{ mr: 1, color: 'action.active' }} />
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="รายละเอียดกิจกรรม"
                  value={editingActivity?.description || ''}
                  onChange={(e) => setEditingActivity(prev => ({ 
                    ...prev!, 
                    description: e.target.value 
                  }))}
                />
              </Grid>
              
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="สถานที่จัดงาน"
                  value={editingActivity?.location || ''}
                  onChange={(e) => setEditingActivity(prev => ({ 
                    ...prev!, 
                    location: e.target.value 
                  }))}
                />
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="รัศมีเช็คอิน (เมตร)"
                  value={editingActivity?.checkInRadius || ''}
                  onChange={(e) => setEditingActivity(prev => ({ 
                    ...prev!, 
                    checkInRadius: parseInt(e.target.value) || 100 
                  }))}
                  inputProps={{ min: 10, max: 1000 }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="จำนวนผู้เข้าร่วมสูงสุด"
                  value={editingActivity?.maxParticipants || ''}
                  onChange={(e) => setEditingActivity(prev => ({ 
                    ...prev!, 
                    maxParticipants: parseInt(e.target.value) || 0 
                  }))}
                  inputProps={{ min: 0 }}
                />
              </Grid>

              {/* ตำแหน่งที่ตั้งในการแก้ไข */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MapIcon />
                  ตำแหน่งที่ตั้งกิจกรรม
                </Typography>
                <Paper sx={{ p: 2 }}>
                  {editingActivity && (
                    <>
                      <LocationPicker
                        location={{ 
                          latitude: editingActivity.latitude || 13.7563, 
                          longitude: editingActivity.longitude || 100.5018 
                        }}
                        radius={editingActivity.checkInRadius || 100}
                        onLocationChange={handleEditLocationChange}
                      />
                      <Box sx={{ mt: 2, display: 'flex', gap: 2, flexDirection: isMobile ? 'column' : 'row' }}>
                        <TextField
                          label="ละติจูด"
                          value={editingActivity.latitude?.toFixed(6) || ''}
                          size="small"
                          InputProps={{ readOnly: true }}
                          fullWidth={isMobile}
                        />
                        <TextField
                          label="ลองจิจูด"
                          value={editingActivity.longitude?.toFixed(6) || ''}
                          size="small"
                          InputProps={{ readOnly: true }}
                          fullWidth={isMobile}
                        />
                      </Box>
                    </>
                  )}
                </Paper>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <DateTimePicker
                  label="วันเวลาเริ่มกิจกรรม"
                  value={editingActivity?.startDateTime || null}
                  onChange={(newValue) => setEditingActivity(prev => ({ 
                    ...prev!, 
                    startDateTime: convertToDate(newValue)
                  }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <DateTimePicker
                  label="วันเวลาสิ้นสุดกิจกรรม"
                  value={editingActivity?.endDateTime || null}
                  onChange={(newValue) => setEditingActivity(prev => ({ 
                    ...prev!, 
                    endDateTime: convertToDate(newValue)
                  }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => {
              setEditDialogOpen(false);
              setEditingActivity(null);
              setEditBannerFile(null);
              setEditBannerPreviewUrl('');
            }}>
              ยกเลิก
            </Button>
            <Button onClick={handleSaveEdit} variant="contained" disabled={uploading}>
              {uploading ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default QRCodeAdminPanel;