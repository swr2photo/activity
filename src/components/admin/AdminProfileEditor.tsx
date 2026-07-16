// src/components/admin/AdminProfileEditor.tsx
'use client';

import React, { useRef, useState } from 'react';
import {
  Upload, Link as LinkIcon, Image as ImageIcon, Trash2,
  Save, RotateCcw, Move, Crosshair, User,
} from 'lucide-react';
import { useSnackbar } from 'notistack';
import { updateProfile } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import type { AdminProfile } from '../../types/admin';
import { updateAdminUser, logAdminEvent } from '../../lib/adminFirebase';
import { PageHeader } from './shared/PageHeader';
import { adminAuth as auth, adminStorage as storage } from '../../lib/firebase';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type ImagePos = { x: number; y: number };
type Props = { currentAdmin: AdminProfile };

export default function AdminProfileEditor({ currentAdmin }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const [displayName, setDisplayName] = useState(currentAdmin.displayName || '');
  const [firstName, setFirstName] = useState(currentAdmin.firstName || '');
  const [lastName, setLastName] = useState(currentAdmin.lastName || '');
  const [photoURL, setPhotoURL] = useState(currentAdmin.profileImage || '');
  const [imgPos, setImgPos] = useState<ImagePos>({
    x: currentAdmin.profileImagePosX ?? 50,
    y: currentAdmin.profileImagePosY ?? 50,
  });

  const [saving, setSaving] = useState(false);
  const [photoMode, setPhotoMode] = useState<'upload' | 'link'>('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const hasImage = Boolean(photoURL);

  const resetChanges = () => {
    setDisplayName(currentAdmin.displayName || '');
    setFirstName(currentAdmin.firstName || '');
    setLastName(currentAdmin.lastName || '');
    setPhotoURL(currentAdmin.profileImage || '');
    setImgPos({ x: currentAdmin.profileImagePosX ?? 50, y: currentAdmin.profileImagePosY ?? 50 });
    setPhotoMode('upload');
    enqueueSnackbar('รีเซ็ตข้อมูลแล้ว', { variant: 'info' });
  };

  const clearPhoto = () => {
    setPhotoURL('');
    setImgPos({ x: 50, y: 50 });
    if (fileInputRef.current) fileInputRef.current.value = '';
    enqueueSnackbar('ลบรูปภาพแล้ว (กดบันทึกเพื่อยืนยัน)', { variant: 'warning' });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      enqueueSnackbar('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG)', { variant: 'error' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      enqueueSnackbar('ขนาดไฟล์เกิน 2MB กรุณาลดขนาดไฟล์', { variant: 'error' });
      return;
    }
    try {
      setUploading(true);
      setUploadProgress(10);
      const storagePath = `admin-profiles/${currentAdmin.uid}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(storageRef, file);
      setUploadProgress(70);
      const downloadURL = await getDownloadURL(snapshot.ref);
      setPhotoURL(downloadURL);
      setUploadProgress(100);
      enqueueSnackbar('อัปโหลดรูปสำเร็จ', { variant: 'success' });
      setImgPos({ x: 50, y: 50 });
    } catch (error: any) {
      console.error('Upload failed:', error);
      enqueueSnackbar(`อัปโหลดล้มเหลว: ${error.message}`, { variant: 'error' });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(null), 1000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      enqueueSnackbar('กรุณาระบุชื่อที่แสดง (Display Name)', { variant: 'warning' });
      return;
    }
    try {
      setSaving(true);
      const updates: Partial<AdminProfile> = {
        displayName: displayName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        profileImage: photoURL || undefined,
        profileImagePosX: photoURL ? Math.round(imgPos.x) : undefined,
        profileImagePosY: photoURL ? Math.round(imgPos.y) : undefined,
      };
      await updateAdminUser(currentAdmin.uid, updates);
      if (auth.currentUser && auth.currentUser.uid === currentAdmin.uid) {
        await updateProfile(auth.currentUser, {
          displayName: updates.displayName,
          photoURL: updates.profileImage,
        });
      }
      await logAdminEvent('ADMIN_PROFILE_UPDATED', { changes: Object.keys(updates) }, { uid: currentAdmin.uid, email: currentAdmin.email });
      enqueueSnackbar('บันทึกข้อมูลเรียบร้อยแล้ว', { variant: 'success' });
    } catch (error: any) {
      console.error('Save failed:', error);
      enqueueSnackbar(`บันทึกไม่สำเร็จ: ${error.message}`, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = () => hasImage && setDragging(true);
  const handleDragEnd = () => setDragging(false);
  const handleDragMove = (clientX: number, clientY: number) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setImgPos({ x, y });
  };

  return (
    <div className="space-y-6 relative">
      <PageHeader 
        title="แก้ไขโปรไฟล์"
        subtitle="อัปเดตข้อมูลส่วนตัวและรูปโปรไฟล์ของคุณ"
        icon={<User className="h-6 w-6" />}
      />
      <Card className="max-w-4xl border-0 shadow-sm mx-auto w-full">
        <CardContent className="p-6">


        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
          {/* Left: Image Preview */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">รูปโปรไฟล์ (1:1)</p>
            <div
              ref={containerRef}
              onMouseDown={handleDragStart}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
              onTouchStart={handleDragStart}
              onTouchEnd={handleDragEnd}
              onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
              className={cn(
                'w-full max-w-[200px] aspect-square rounded-2xl bg-muted border overflow-hidden relative flex items-center justify-center select-none',
                hasImage ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''
              )}
              style={{
                backgroundImage: hasImage ? `url("${photoURL}")` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: `${imgPos.x}% ${imgPos.y}%`,
                touchAction: 'none',
                transition: dragging ? 'none' : 'background-position 0.2s',
              }}
            >
              {!hasImage && (
                <div className="flex flex-col items-center text-muted-foreground gap-1">
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-xs">ไม่มีรูปภาพ</span>
                </div>
              )}
              {hasImage && !dragging && (
                <div className="absolute bottom-2 bg-black/60 text-white px-2 py-1 rounded-full text-[11px] flex items-center gap-1 pointer-events-none">
                  <Move className="h-3 w-3" /> ลากเพื่อจัดตำแหน่ง
                </div>
              )}
            </div>

            {/* Position Controls */}
            {hasImage && (
              <div className="mt-3 w-full max-w-[200px] space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs w-4">X</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={imgPos.x}
                    onChange={(e) => setImgPos((p) => ({ ...p, x: Number(e.target.value) }))}
                    className="flex-1 h-1.5 accent-primary"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-4">Y</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={imgPos.y}
                    onChange={(e) => setImgPos((p) => ({ ...p, y: Number(e.target.value) }))}
                    className="flex-1 h-1.5 accent-primary"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1"
                  onClick={() => setImgPos({ x: 50, y: 50 })}
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  จัดกึ่งกลาง
                </Button>
              </div>
            )}
          </div>

          {/* Right: Form */}
          <div className="space-y-5">
            <Card className="border">
              <CardContent className="p-5 space-y-5">
                {/* Photo Selection Tabs */}
                <div>
                  <div className="flex gap-1 mb-3 bg-muted p-1 rounded-lg">
                    <button
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors',
                        photoMode === 'upload' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                      onClick={() => setPhotoMode('upload')}
                    >
                      <Upload className="h-4 w-4" /> อัปโหลดไฟล์
                    </button>
                    <button
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors',
                        photoMode === 'link' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                      onClick={() => setPhotoMode('link')}
                    >
                      <LinkIcon className="h-4 w-4" /> ใช้ลิงก์ URL
                    </button>
                  </div>

                  {photoMode === 'upload' ? (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" asChild disabled={uploading}>
                        <label className="cursor-pointer gap-2">
                          <Upload className="h-4 w-4" />
                          เลือกรูปภาพ...
                          <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} />
                        </label>
                      </Button>
                      {uploading && <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
                      {hasImage && !uploading && (
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={clearPhoto}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        placeholder="https://example.com/image.jpg"
                        value={photoURL}
                        onChange={(e) => setPhotoURL(e.target.value)}
                      />
                      {hasImage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-destructive"
                          onClick={clearPhoto}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}

                  {uploading && uploadProgress !== null && (
                    <div className="mt-2">
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right mt-1">
                        กำลังอัปโหลด... {uploadProgress}%
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Text Fields */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>อีเมล (Email)</Label>
                    <Input value={currentAdmin.email} disabled />
                    <p className="text-xs text-muted-foreground">ไม่สามารถเปลี่ยนอีเมลได้</p>
                  </div>

                  <div className="space-y-2">
                    <Label>ชื่อที่แสดง (Display Name) <span className="text-destructive">*</span></Label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className={!displayName.trim() ? 'border-destructive' : ''}
                    />
                    <p className="text-xs text-muted-foreground">
                      {!displayName.trim() ? <span className="text-destructive">กรุณาระบุชื่อ</span> : 'ชื่อที่แสดงในระบบ'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>ชื่อจริง</Label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>นามสกุล</Label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={resetChanges} disabled={saving || uploading} className="gap-1">
                    <RotateCcw className="h-4 w-4" /> คืนค่าเดิม
                  </Button>
                  <Button onClick={handleSave} disabled={saving || uploading || !displayName.trim()} className="gap-1">
                    {saving ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        กำลังบันทึก...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" /> บันทึกการเปลี่ยนแปลง
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}