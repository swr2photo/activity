// src/components/admin/SystemSettingsPanel.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Save, Settings, AlertTriangle } from 'lucide-react';

import type { AdminProfile } from '../../types/admin';
import {
  subscribeSystemSettings,
  updateSystemSettings,
  type SystemSettings,
  logAdminEvent,
} from '../../lib/adminFirebase';
import { PageHeader } from './shared/PageHeader';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  currentAdmin: AdminProfile;
};

const defaults: SystemSettings = {
  maintenanceEnabled: false,
  maintenanceMessage: '',
  maintenanceWhitelist: [],
  bannerStandardWidth: 1600,
  bannerStandardHeight: 600,
  bannerFit: 'cover',
};

const toCSV = (arr: string[]) => arr.join(', ');

const parseWhitelist = (v: string) =>
  v.split(/,|\n/).map((s) => s.trim()).filter(Boolean);

export default function SystemSettingsPanel({ currentAdmin }: Props) {
  const [settings, setSettings] = useState<SystemSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'destructive'; text: string } | null>(null);

  useEffect(() => {
    const unsub = subscribeSystemSettings((s) => {
      setSettings((prev) => ({ ...prev, ...s }));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const whitelistText = useMemo(
    () => toCSV(settings.maintenanceWhitelist || []),
    [settings.maintenanceWhitelist]
  );

  const handleSave = async () => {
    if (Number(settings.bannerStandardWidth) < 100 || Number(settings.bannerStandardHeight) < 100) {
      setMsg({ type: 'destructive', text: 'ขนาดแบนเนอร์ต้องไม่ต่ำกว่า 100px' });
      return;
    }

    try {
      setSaving(true);
      const patch: Partial<SystemSettings> = {
        maintenanceEnabled: !!settings.maintenanceEnabled,
        maintenanceMessage: settings.maintenanceMessage || 'ระบบกำลังปิดปรับปรุงชั่วคราว',
        maintenanceWhitelist: Array.isArray(settings.maintenanceWhitelist)
          ? settings.maintenanceWhitelist
          : [],
        bannerStandardWidth: Number(settings.bannerStandardWidth || 1600),
        bannerStandardHeight: Number(settings.bannerStandardHeight || 600),
        bannerFit: settings.bannerFit === 'contain' ? 'contain' : 'cover',
      };

      await updateSystemSettings(patch);
      await logAdminEvent(
        'SYSTEM_SETTINGS_UPDATED',
        { patch },
        { uid: currentAdmin.uid, email: currentAdmin.email }
      );
      setMsg({ type: 'success', text: 'บันทึกการตั้งค่าเรียบร้อยแล้ว' });
    } catch (e: any) {
      console.error(e);
      setMsg({ type: 'destructive', text: e?.message || 'บันทึกล้มเหลว กรุณาลองใหม่' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardContent className="p-8 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 relative w-full min-w-0 max-w-full overflow-x-hidden">
      <PageHeader 
        title="ตั้งค่าระบบส่วนกลาง"
        subtitle="จัดการการแสดงผล โหมดซ่อมบำรุง และค่ามาตรฐานอื่นๆ ของระบบ"
        icon={<Settings className="h-6 w-6" />}
      />

      {/* Feedback */}
      {msg && (
        <Alert variant={msg.type === 'success' ? 'success' : 'destructive'} className="animate-in fade-in-50 duration-300">
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 space-y-8">
          {/* Maintenance Mode */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              <h3 className="font-semibold text-rose-600">โหมดปิดปรับปรุง (Maintenance Mode)</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              เมื่อเปิดใช้งาน ผู้ใช้ทั่วไปจะไม่สามารถเข้าสู่ระบบได้ ยกเว้นผู้ที่มีรายชื่อใน Whitelist
            </p>

            <div className={`rounded-xl border p-5 space-y-4 transition-colors ${
              settings.maintenanceEnabled ? 'bg-rose-50/50 border-rose-200' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <Label htmlFor="maintenance-switch" className={settings.maintenanceEnabled ? 'font-bold text-rose-700' : ''}>
                  {settings.maintenanceEnabled ? 'กำลังเปิดใช้งานโหมดปิดปรับปรุง' : 'ปิดใช้งาน (ปกติ)'}
                </Label>
                <Switch
                  id="maintenance-switch"
                  checked={!!settings.maintenanceEnabled}
                  onCheckedChange={(checked) =>
                    setSettings((s) => ({ ...s, maintenanceEnabled: checked }))
                  }
                  className={settings.maintenanceEnabled ? 'data-[state=checked]:bg-rose-500' : ''}
                />
              </div>

              <div className={`space-y-4 transition-opacity ${settings.maintenanceEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <div className="space-y-2">
                  <Label>ข้อความแจ้งเตือน (Maintenance Message)</Label>
                  <Textarea
                    placeholder="เช่น ระบบกำลังปิดปรับปรุงชั่วคราว คาดว่าจะเสร็จเวลา..."
                    value={settings.maintenanceMessage || ''}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, maintenanceMessage: e.target.value }))
                    }
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Whitelist (Email หรือ UID)</Label>
                  <Textarea
                    placeholder="admin@psu.ac.th, 6410110xxx"
                    value={whitelistText}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        maintenanceWhitelist: parseWhitelist(e.target.value),
                      }))
                    }
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    คั่นด้วยเครื่องหมายจุลภาค (,) รองรับทั้ง Email และ UID
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Banner Settings */}
          <div className="space-y-4">
            <h3 className="font-semibold">มาตรฐานรูปภาพกิจกรรม (Banner)</h3>
            <p className="text-sm text-muted-foreground">
              กำหนดขนาดมาตรฐานของรูปภาพหน้าปกกิจกรรม เพื่อให้การแสดงผลในหน้าเว็บสวยงามและสม่ำเสมอ
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ความกว้าง (Width)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={settings.bannerStandardWidth || 1600}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, bannerStandardWidth: Number(e.target.value) }))
                    }
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">px</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>ความสูง (Height)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={settings.bannerStandardHeight || 600}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, bannerStandardHeight: Number(e.target.value) }))
                    }
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">px</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>รูปแบบการแสดงผล (Object Fit)</Label>
              <select
                value={settings.bannerFit || 'cover'}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    bannerFit: e.target.value === 'contain' ? 'contain' : 'cover',
                  }))
                }
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="cover">Cover (ตัดส่วนเกินให้เต็มกรอบ)</option>
                <option value="contain">Contain (แสดงภาพครบ แต่อาจมีขอบขาว)</option>
              </select>
            </div>
          </div>

          <Separator />

          {/* Save */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:min-w-[150px] gap-2"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  บันทึกการตั้งค่า
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}