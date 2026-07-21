// components/profile/ProfileEditDialog.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Pencil,
  Save,
  User as PersonIcon,
  GraduationCap,
  Badge as BadgeIcon,
  Mail,
  Camera,
  CircleUser,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { optimizeAvatarUrl } from '@/utils/avatar';

import {
  UniversityUserProfile,
  parseStudentInfo,
  facultyMap,
  departmentMap,
  EDUCATION_LEVEL_OPTIONS,
  isUniversityEmail,
  isExternalUser,
} from '../../lib/firebaseAuth';
import dynamic from 'next/dynamic';
import getCroppedImg, { compressImageFile } from '../../utils/cropImage';
import {
  NAME_TITLE_OPTIONS,
  validateThaiName,
  validateNameTitle,
  filterThaiNameInput,
  formatThaiFullName,
} from '../../utils/validation';

const Cropper = dynamic(() => import('react-easy-crop'), { ssr: false }) as any;

const MAX_PROFILE_IMAGE_BYTES = 12 * 1024 * 1024;

const FACULTY_OPTIONS = Array.from(new Set(Object.values(facultyMap)));
const EDUCATION_OPTIONS = [...EDUCATION_LEVEL_OPTIONS];
const TITLE_OPTIONS = [...NAME_TITLE_OPTIONS];

/** Simple freeSolo-style combobox using input + datalist / filtered list */
function FreeSoloField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  helperText,
  error,
  icon,
  loading,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  helperText?: string;
  error?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  required?: boolean;
}) {
  const listId = `${id}-list`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </Label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        )}
        <Input
          id={id}
          list={listId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(icon && 'pl-10', error && 'border-destructive')}
          required={required}
        />
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </span>
        )}
      </div>
      <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
        {error || helperText}
      </p>
    </div>
  );
}

interface ProfileEditDialogProps {
  open: boolean;
  onClose: () => void;
  user: any;
  userData: UniversityUserProfile | null;
  onSave: (updatedData: Partial<UniversityUserProfile>) => Promise<void>;
  isFirstTimeSetup?: boolean;
}

const ProfileEditDialog: React.FC<ProfileEditDialogProps> = ({
  open,
  onClose,
  user,
  userData,
  onSave,
  isFirstTimeSetup = false,
}) => {
  const initializedForOpenRef = useRef(false);

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    nameTitle: '',
    firstName: '',
    lastName: '',
    username: '',
    photoURL: '',
    department: '',
    faculty: '',
    studentId: '',
    institutionName: '',
    educationLevel: '',
  });

  const isExternal =
    isExternalUser(userData) ||
    (!!user?.email && !isUniversityEmail(user.email) && userData?.userType !== 'university');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [institutionOptions, setInstitutionOptions] = useState<string[]>([]);
  const [institutionLoading, setInstitutionLoading] = useState(false);
  const institutionSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchInstitutions = useCallback((q: string) => {
    if (institutionSearchRef.current) clearTimeout(institutionSearchRef.current);
    const query = q.trim();
    if (query.length < 1) {
      setInstitutionOptions([]);
      setInstitutionLoading(false);
      return;
    }
    setInstitutionLoading(true);
    institutionSearchRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/institutions/search?q=${encodeURIComponent(query)}&scope=th`);
        if (!res.ok) throw new Error('search failed');
        const data = await res.json();
        const names: string[] = Array.from(
          new Set(
            (data.items || [])
              .map((it: { name?: string }) => it.name)
              .filter((n: unknown): n is string => typeof n === 'string' && n.length > 0)
          )
        );
        setInstitutionOptions(names);
      } catch {
        setInstitutionOptions([]);
      } finally {
        setInstitutionLoading(false);
      }
    }, 280);
  }, []);

  useEffect(() => {
    return () => {
      if (institutionSearchRef.current) clearTimeout(institutionSearchRef.current);
    };
  }, []);

  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      initializedForOpenRef.current = false;
      return;
    }
    if (!user || initializedForOpenRef.current) return;
    initializedForOpenRef.current = true;

    const emailLocal = (user.email || '').split('@')[0] || '';
    const parsedInfo = parseStudentInfo(user.email || '');
    const rawDisplayName = userData?.displayName || user?.displayName || '';

    let derivedFirstName = userData?.firstName || '';
    let derivedLastName = userData?.lastName || '';
    let derivedTitle = userData?.nameTitle || '';

    if (
      !derivedFirstName ||
      derivedFirstName === 'ไม่ระบุ' ||
      derivedLastName.includes('(') ||
      derivedLastName.includes(')')
    ) {
      const thaiMatch = rawDisplayName.match(/\(([\u0E00-\u0E7F\s]+)\)/);
      if (thaiMatch?.[1]) {
        const nameParts = thaiMatch[1].trim().split(/\s+/);
        derivedFirstName = nameParts[0] || '';
        derivedLastName = nameParts.slice(1).join(' ') || '';
      } else if (rawDisplayName.trim()) {
        const nameParts = rawDisplayName.trim().split(/\s+/);
        derivedFirstName = nameParts[0] || '';
        derivedLastName = nameParts.slice(1).join(' ') || '';
      }
    }

    if (!validateThaiName(derivedFirstName)) derivedFirstName = '';
    if (!validateThaiName(derivedLastName)) derivedLastName = '';
    if (derivedTitle && !validateNameTitle(derivedTitle)) derivedTitle = '';

    const external =
      userData?.userType === 'external' ||
      (!!user.email && !isUniversityEmail(user.email) && userData?.userType !== 'university');

    setFormData({
      displayName: userData?.displayName || rawDisplayName || emailLocal,
      nameTitle: derivedTitle,
      firstName: derivedFirstName,
      lastName: derivedLastName,
      username: userData?.username || '',
      photoURL: userData?.photoURL || user?.photoURL || '',
      department:
        userData?.department && userData.department !== 'ไม่ระบุ'
          ? userData.department
          : !external && parsedInfo.department !== 'ไม่ระบุ'
            ? parsedInfo.department
            : '',
      faculty:
        userData?.faculty && userData.faculty !== 'ไม่ระบุ'
          ? userData.faculty
          : !external && parsedInfo.faculty !== 'ไม่ระบุ'
            ? parsedInfo.faculty
            : '',
      studentId: userData?.studentId || (!external ? parsedInfo.studentId || emailLocal : userData?.studentId || ''),
      institutionName: userData?.institutionName || '',
      educationLevel: userData?.educationLevel || userData?.degreeLevel || '',
    });
    setError('');
    setValidationErrors({});
    setSaving(false);
    setUploadingImage(false);
  }, [open, user, userData]);

  const availableDepartments = useMemo(() => {
    const facultyCode = Object.keys(facultyMap).find((key) => facultyMap[key] === formData.faculty);
    if (!facultyCode || !departmentMap[facultyCode]) return [] as string[];
    return Object.values(departmentMap[facultyCode]);
  }, [formData.faculty]);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.nameTitle.trim()) errors.nameTitle = 'กรุณาเลือกคำนำหน้าชื่อ';
    else if (!validateNameTitle(formData.nameTitle)) errors.nameTitle = 'คำนำหน้าชื่อไม่ถูกต้อง';

    if (!formData.firstName.trim()) errors.firstName = 'กรุณากรอกชื่อ';
    else if (!validateThaiName(formData.firstName)) {
      errors.firstName = 'ชื่อต้องเป็นภาษาไทยเท่านั้น (อย่างน้อย 2 ตัวอักษร)';
    }

    if (!formData.lastName.trim()) errors.lastName = 'กรุณากรอกนามสกุล';
    else if (!validateThaiName(formData.lastName)) {
      errors.lastName = 'นามสกุลต้องเป็นภาษาไทยเท่านั้น (อย่างน้อย 2 ตัวอักษร)';
    }

    if (formData.photoURL && formData.photoURL.trim()) {
      try {
        new URL(formData.photoURL);
      } catch {
        errors.photoURL = 'รูปแบบ URL ไม่ถูกต้อง';
      }
    }

    if (formData.username.trim() && formData.username.trim().length < 3) {
      errors.username = 'Username ต้องมีอย่างน้อย 3 ตัวอักษร';
    }

    if (isExternal) {
      if (!formData.institutionName.trim()) {
        errors.institutionName = 'กรุณากรอกชื่อสถานศึกษา / หน่วยงาน';
      }
      if (!formData.educationLevel.trim()) {
        errors.educationLevel = 'กรุณาเลือกระดับการศึกษา';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('กรุณาเลือกไฟล์รูปภาพ');
      return;
    }
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      setError('ไฟล์รูปใหญ่เกินไป (สูงสุด 12MB)');
      return;
    }

    try {
      setUploadingImage(true);
      setError('');
      const { dataUrl } = await compressImageFile(file, {
        maxEdge: 1200,
        quality: 0.82,
        mimeType: 'image/jpeg',
      });
      setImageToCrop(dataUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setCropModalOpen(true);
    } catch (err: any) {
      setError(err?.message || 'ไม่สามารถโหลดรูปภาพได้');
    } finally {
      setUploadingImage(false);
    }
  };

  const onCropComplete = useCallback((_croppedArea: any, pixels: any) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleCropConfirm = async () => {
    if (!imageToCrop || !user?.uid) return;

    try {
      setUploadingImage(true);
      setError('');

      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels, {
        maxEdge: 256,
        quality: 0.72,
        mimeType: 'image/jpeg',
      });
      const storageRef = ref(storage, `profiles/${user.uid}_${Date.now()}.jpg`);

      await uploadBytes(storageRef, croppedBlob, {
        contentType: 'image/jpeg',
        cacheControl: 'public,max-age=31536000',
      });
      const url = await getDownloadURL(storageRef);

      setFormData((prev) => ({ ...prev, photoURL: url }));
      setCropModalOpen(false);
      setImageToCrop(null);
    } catch (err: any) {
      setError('ไม่สามารถอัปโหลดรูปภาพได้: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleInputChange = useCallback((field: string, value: string) => {
    const nextValue =
      field === 'firstName' || field === 'lastName' ? filterThaiNameInput(value) : value;
    setFormData((prev) => ({ ...prev, [field]: nextValue }));
    setValidationErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleFacultyChange = useCallback((newValue: string) => {
    setFormData((prev) => ({ ...prev, faculty: newValue, department: '' }));
    setValidationErrors((prev) => {
      if (!prev.faculty && !prev.department) return prev;
      const next = { ...prev };
      delete next.faculty;
      delete next.department;
      return next;
    });
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      if (!validateForm()) {
        setSaving(false);
        return;
      }

      const fullDisplayName = formatThaiFullName(
        formData.nameTitle,
        formData.firstName,
        formData.lastName
      );
      const updatedData: Partial<UniversityUserProfile> = {
        displayName: fullDisplayName,
        nameTitle: formData.nameTitle.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        username:
          formData.username.trim() ||
          formData.studentId.trim() ||
          formData.institutionName.trim() ||
          fullDisplayName,
        photoURL: formData.photoURL.trim() || '',
        userType: isExternal ? 'external' : 'university',
      };

      if (isExternal) {
        updatedData.institutionName = formData.institutionName.trim();
        updatedData.educationLevel = formData.educationLevel.trim();
        updatedData.degreeLevel = formData.educationLevel.trim();
        updatedData.faculty = 'บุคคลภายนอก';
        updatedData.department = formData.institutionName.trim() || 'ไม่ระบุ';
        updatedData.studentId = formData.studentId.trim() || userData?.studentId || '';
      } else {
        updatedData.department = formData.department.trim() || 'ไม่ระบุ';
        updatedData.faculty = formData.faculty.trim() || 'ไม่ระบุ';
        updatedData.studentId = formData.studentId.trim();
      }

      await onSave(updatedData);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const getPreviewAvatar = () => optimizeAvatarUrl(formData.photoURL, 200) || null;
  const getPreviewAvatarLetter = () =>
    formData.username?.trim()?.charAt(0).toUpperCase() ||
    formData.firstName?.charAt(0).toUpperCase() ||
    'U';

  const isFormValid =
    validateNameTitle(formData.nameTitle) &&
    validateThaiName(formData.firstName) &&
    validateThaiName(formData.lastName) &&
    (!isExternal ||
      (!!formData.institutionName.trim() && !!formData.educationLevel.trim())) &&
    Object.keys(validationErrors).length === 0;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o && !isFirstTimeSetup) onClose();
        }}
      >
        <DialogContent
          className="max-h-[min(90dvh,90vh)] max-w-3xl overflow-y-auto rounded-xl p-0 sm:p-0"
          onEscapeKeyDown={(e) => isFirstTimeSetup && e.preventDefault()}
          onInteractOutside={(e) => isFirstTimeSetup && e.preventDefault()}
          onPointerDownOutside={(e) => isFirstTimeSetup && e.preventDefault()}
        >
          <DialogHeader className="flex flex-row items-center gap-2 space-y-0 border-b px-6 py-4 text-left">
            <Pencil className="h-5 w-5 shrink-0" />
            <div>
              <DialogTitle className="text-lg font-bold">
                {isFirstTimeSetup ? 'ยินดีต้อนรับ! กรุณากรอกข้อมูลส่วนตัว' : 'กรอกข้อมูลส่วนตัว'}
              </DialogTitle>
              <DialogDescription>
                {isFirstTimeSetup
                  ? 'คุณต้องกรอกข้อมูลให้ครบถ้วนก่อนดำเนินการต่อ'
                  : 'กรุณากรอกข้อมูลให้ครบถ้วนเพื่อใช้ในการลงทะเบียน'}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-6 px-6 py-4">
            {isFirstTimeSetup && (
              <Alert variant="warning">
                <AlertTitle>กรุณากรอกข้อมูลให้ครบถ้วนก่อนดำเนินการใดๆ</AlertTitle>
                <AlertDescription>
                  {isExternal
                    ? 'บัญชี Google นอก @psu.ac.th ถือเป็นบุคคลภายนอก — กรุณาระบุสถานศึกษาและระดับการศึกษา'
                    : 'ระบบจำเป็นต้องมีข้อมูลของคุณเพื่อใช้ในการลงทะเบียนกิจกรรม'}
                </AlertDescription>
              </Alert>
            )}
            {isExternal && (
              <Alert variant="info">
                <AlertDescription className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  คุณเข้าสู่ระบบในฐานะบุคคลภายนอก
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="text-center">
              <div className="relative inline-block">
                <Avatar className="mx-auto mb-4 h-24 w-24 border-4 border-white/80 text-2xl shadow-lg">
                  <AvatarImage src={getPreviewAvatar() || undefined} alt="" referrerPolicy="no-referrer" />
                  <AvatarFallback>{!getPreviewAvatar() && getPreviewAvatarLetter()}</AvatarFallback>
                </Avatar>
                <label
                  className={cn(
                    'absolute bottom-3 -right-2 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border bg-background shadow-md hover:bg-muted',
                    uploadingImage && 'pointer-events-none opacity-60'
                  )}
                >
                  <input hidden accept="image/*" type="file" onChange={handleImageSelect} />
                  {uploadingImage ? <Spinner size="sm" /> : <Camera className="h-4 w-4 text-primary" />}
                </label>
              </div>
              <p className="text-sm text-muted-foreground">ชื่อที่แสดงในระบบคือ Username (ไม่ใช่ชื่อ-นามสกุล)</p>
              <p className="mt-1 block text-xs text-muted-foreground">
                อัปโหลดรูปได้ไม่เกิน 12MB (ระบบจะย่อให้อัตโนมัติ)
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="space-y-1.5 sm:col-span-4">
                <Label>คำนำหน้าชื่อ *</Label>
                <Select
                  value={formData.nameTitle || undefined}
                  onValueChange={(v) => handleInputChange('nameTitle', v)}
                >
                  <SelectTrigger className={cn(validationErrors.nameTitle && 'border-destructive')}>
                    <SelectValue placeholder="เลือกคำนำหน้า" />
                  </SelectTrigger>
                  <SelectContent>
                    {TITLE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className={cn('text-xs', validationErrors.nameTitle ? 'text-destructive' : 'text-muted-foreground')}>
                  {validationErrors.nameTitle || 'เลือกคำนำหน้าชื่อภาษาไทย'}
                </p>
              </div>

              <div className="space-y-1.5 sm:col-span-4">
                <Label htmlFor="firstName">ชื่อ *</Label>
                <div className="relative">
                  <PersonIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="firstName"
                    lang="th"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className={cn('pl-10', validationErrors.firstName && 'border-destructive')}
                    required
                  />
                </div>
                <p className={cn('text-xs', validationErrors.firstName ? 'text-destructive' : 'text-muted-foreground')}>
                  {validationErrors.firstName || 'ชื่อจริงภาษาไทยเท่านั้น'}
                </p>
              </div>

              <div className="space-y-1.5 sm:col-span-4">
                <Label htmlFor="lastName">นามสกุล *</Label>
                <div className="relative">
                  <PersonIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="lastName"
                    lang="th"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className={cn('pl-10', validationErrors.lastName && 'border-destructive')}
                    required
                  />
                </div>
                <p className={cn('text-xs', validationErrors.lastName ? 'text-destructive' : 'text-muted-foreground')}>
                  {validationErrors.lastName || 'นามสกุลภาษาไทยเท่านั้น'}
                </p>
              </div>

              {isExternal ? (
                <>
                  <div className="sm:col-span-6">
                    <FreeSoloField
                      id="institutionName"
                      label="สถานศึกษา / หน่วยงาน"
                      required
                      value={formData.institutionName}
                      onChange={(v) => {
                        handleInputChange('institutionName', v);
                        searchInstitutions(v);
                      }}
                      options={institutionOptions}
                      placeholder="พิมพ์ค้นหา เช่น หาดใหญ่ / สงขลา / จุฬา"
                      helperText="ค้นชื่อสถานศึกษาภาษาไทย — หรือพิมพ์ชื่อเองได้"
                      error={validationErrors.institutionName}
                      icon={<GraduationCap className="h-4 w-4" />}
                      loading={institutionLoading}
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <FreeSoloField
                      id="educationLevel"
                      label="ระดับการศึกษา"
                      required
                      value={formData.educationLevel}
                      onChange={(v) => handleInputChange('educationLevel', v)}
                      options={EDUCATION_OPTIONS}
                      placeholder="เลือกหรือพิมพ์ระดับการศึกษา"
                      helperText="เช่น ม.ปลาย = นักเรียนโรงเรียน / ปริญญาตรี = มหาวิทยาลัย"
                      error={validationErrors.educationLevel}
                      icon={<BadgeIcon className="h-4 w-4" />}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="sm:col-span-6">
                    <FreeSoloField
                      id="faculty"
                      label="คณะ"
                      value={formData.faculty}
                      onChange={handleFacultyChange}
                      options={FACULTY_OPTIONS}
                      placeholder="เช่น วิทยาศาสตร์"
                      helperText="คณะที่คุณศึกษาหรือทำงาน"
                      icon={<GraduationCap className="h-4 w-4" />}
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <FreeSoloField
                      id="department"
                      label="สาขา/หน่วยงาน"
                      value={formData.department}
                      onChange={(v) => handleInputChange('department', v)}
                      options={availableDepartments}
                      placeholder="เช่น วิทยาการคอมพิวเตอร์"
                      helperText="สาขาวิชาหรือหน่วยงานที่สังกัด"
                      icon={<BadgeIcon className="h-4 w-4" />}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-6">
                    <Label htmlFor="studentId">รหัสนักศึกษา/รหัสพนักงาน</Label>
                    <div className="relative">
                      <PersonIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="studentId"
                        value={formData.studentId}
                        onChange={(e) => handleInputChange('studentId', e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">รหัสประจำตัวของคุณ</p>
                  </div>
                </>
              )}

              <div className="space-y-1.5 sm:col-span-6">
                <Label htmlFor="username">Username *</Label>
                <div className="relative">
                  <CircleUser className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder={formData.studentId || 'ตั้งชื่อผู้ใช้ของคุณ'}
                    className={cn('pl-10', validationErrors.username && 'border-destructive')}
                  />
                </div>
                <p className={cn('text-xs', validationErrors.username ? 'text-destructive' : 'text-muted-foreground')}>
                  {validationErrors.username || 'ใช้แสดงใน Navbar และระบบ (เว้นว่างจะใช้รหัสนักศึกษา)'}
                </p>
              </div>

              <div className="space-y-1.5 sm:col-span-12">
                <Label htmlFor="photoURL">URL รูปโปรไฟล์</Label>
                <Input
                  id="photoURL"
                  value={formData.photoURL}
                  onChange={(e) => handleInputChange('photoURL', e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className={cn(validationErrors.photoURL && 'border-destructive')}
                />
                <p className={cn('text-xs', validationErrors.photoURL ? 'text-destructive' : 'text-muted-foreground')}>
                  {validationErrors.photoURL || 'ลิงก์รูปภาพสำหรับโปรไฟล์ (ไม่บังคับ)'}
                </p>
              </div>
            </div>

            <Card className="border bg-background/60">
              <CardContent className="pt-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  ข้อมูลจากระบบ (ไม่สามารถแก้ไขได้)
                </p>
                <Separator className="my-2" />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    <strong>อีเมล:</strong> {user?.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>ชื่อที่แสดงในระบบ:</strong>{' '}
                    {formData.username.trim() || formData.studentId || 'ตั้ง Username เพื่อแสดงผล'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Alert variant="info">
              <AlertDescription>
                <strong>หมายเหตุ:</strong> Username จะใช้แสดงในแถบนำทาง ส่วนชื่อ-นามสกุลใช้สำหรับลงทะเบียนกิจกรรม
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="gap-2 border-t px-6 py-4">
            {!isFirstTimeSetup && (
              <Button variant="outline" size="lg" onClick={onClose} disabled={saving}>
                ยกเลิก
              </Button>
            )}
            <Button
              size="lg"
              onClick={handleSave}
              disabled={saving || !isFormValid}
              className="px-8"
            >
              {saving ? <Spinner size="sm" className="text-primary-foreground" /> : <Save className="h-4 w-4" />}
              {saving ? 'กำลังบันทึก...' : 'บันทึกและดำเนินการต่อ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cropModalOpen}
        onOpenChange={(o) => {
          if (!o && !uploadingImage) {
            setCropModalOpen(false);
            setImageToCrop(null);
          }
        }}
      >
        <DialogContent className="max-w-md p-0 sm:p-0">
          <DialogHeader className="px-6 py-4">
            <DialogTitle>ปรับขนาดรูปโปรไฟล์</DialogTitle>
          </DialogHeader>
          <div className="relative h-[400px] bg-[#333] p-0">
            {imageToCrop && (
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            )}
          </div>
          <DialogFooter className="gap-2 p-4">
            <Button
              variant="outline"
              onClick={() => {
                setCropModalOpen(false);
                setImageToCrop(null);
              }}
              disabled={uploadingImage}
            >
              ยกเลิก
            </Button>
            <Button onClick={handleCropConfirm} disabled={uploadingImage}>
              {uploadingImage && <Spinner size="sm" className="text-primary-foreground" />}
              {uploadingImage ? 'กำลังอัปโหลด...' : 'ยืนยันและอัปโหลด'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProfileEditDialog;
