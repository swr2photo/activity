// components/alerts/StatusAlerts.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { User, Pencil, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// IP Restriction Alert Component
interface IPRestrictionAlertProps {
  remainingTime: number;
  onClose: () => void;
}

export const IPRestrictionAlert: React.FC<IPRestrictionAlertProps> = ({
  remainingTime,
  onClose,
}) => {
  const [timeLeft, setTimeLeft] = useState(remainingTime);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 60000);

    return () => clearInterval(timer);
  }, [onClose]);

  const progressValue = ((remainingTime - timeLeft) / remainingTime) * 100;

  return (
    <Alert
      variant="destructive"
      className="mb-6 border-[#fca5a5] bg-gradient-to-br from-[#fee2e2] to-[#fecaca] dark:from-red-950/40 dark:to-red-900/30"
    >
      <AlertTitle className="font-bold">ไม่สามารถเข้าสู่ระบบได้</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          IP นี้เพิ่งมีการเข้าสู่ระบบด้วยบัญชีอื่นแล้ว เพื่อความปลอดภัย คุณต้องรออีก{' '}
          <strong>{timeLeft} นาที</strong> ก่อนที่จะสามารถเข้าสู่ระบบได้
        </p>

        <div className="mb-1 mt-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">เวลาที่เหลือ</span>
            <span className="text-xs font-medium text-destructive">
              {timeLeft} นาที
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-red-500/20">
            <div
              className="h-full rounded-full bg-[#ef4444] transition-all"
              style={{ width: `${progressValue}%` }}
            />
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          มาตรการนี้ป้องกันการใช้งานบัญชีหลายบัญชีจาก IP เดียวกันในช่วงเวลาสั้นๆ
        </p>
      </AlertDescription>
    </Alert>
  );
};

// Duplicate Registration Alert Component
export const DuplicateRegistrationAlert: React.FC = () => {
  return (
    <Alert
      variant="success"
      className="mb-6 border-[#10b981] bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5] dark:from-emerald-950/40 dark:to-emerald-900/30"
    >
      <AlertTitle className="font-bold">ลงทะเบียนเรียบร้อยแล้ว</AlertTitle>
      <AlertDescription>
        <p>บัญชีนี้บันทึกการเข้าร่วมกิจกรรมนี้ไว้แล้ว ไม่ต้องลงทะเบียนซ้ำ</p>
        <div className="mt-4 rounded-md bg-emerald-500/10 p-4">
          <p className="text-xs text-muted-foreground">
            ดูประวัติได้ที่เมนู «ประวัติ» — หากข้อมูลไม่ถูกต้อง กรุณาติดต่อผู้ดูแลกิจกรรม
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
};

// Profile Setup Alert Component
interface ProfileSetupAlertProps {
  onEditProfile: () => void;
}

export const ProfileSetupAlert: React.FC<ProfileSetupAlertProps> = ({
  onEditProfile,
}) => {
  return (
    <Card className="mb-8 border-2 border-[#f59e0b] bg-gradient-to-br from-[#fef3c7] to-[#fde68a] shadow-[0_8px_32px_rgba(245,158,11,0.2)] dark:from-amber-950/50 dark:to-amber-900/40">
      <CardContent className="p-8 text-center">
        <User className="mx-auto mb-4 h-16 w-16 text-amber-600 drop-shadow-md dark:text-amber-400" />

        <h2 className="mb-2 text-xl font-bold text-amber-800 dark:text-amber-300">
          กรุณากรอกข้อมูลส่วนตัวเพิ่มเติม
        </h2>

        <p className="mx-auto mb-6 max-w-md text-base text-muted-foreground">
          เพื่อดำเนินการลงทะเบียนกิจกรรม กรุณากรอกชื่อ-นามสกุล และข้อมูลเพิ่มเติม
          เพื่อให้ระบบสามารถประมวลผลการลงทะเบียนได้อย่างถูกต้อง
        </p>

        <Button
          size="lg"
          onClick={onEditProfile}
          className="bg-gradient-to-br from-[#f59e0b] to-[#d97706] px-8 font-bold text-white shadow-[0_4px_16px_rgba(245,158,11,0.4)] hover:from-[#d97706] hover:to-[#b45309] hover:shadow-[0_6px_20px_rgba(245,158,11,0.5)] hover:-translate-y-px"
        >
          <Pencil className="h-4 w-4" />
          กรอกข้อมูลส่วนตัว
        </Button>

        <div className="mt-6 rounded-md bg-amber-500/10 p-4">
          <p className="text-xs text-muted-foreground">
            <strong>ข้อมูลที่จำเป็น:</strong> ชื่อ-นามสกุล, คณะ, สาขา (หากมี)
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

// Success Message Alert
interface SuccessAlertProps {
  message: string;
  onClose?: () => void;
  autoHide?: boolean;
  duration?: number;
}

export const SuccessAlert: React.FC<SuccessAlertProps> = ({
  message,
  onClose,
  autoHide = true,
  duration = 3000,
}) => {
  useEffect(() => {
    if (autoHide && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, onClose, duration]);

  return (
    <Alert
      variant="success"
      className="relative mb-4 border-[#10b981] bg-gradient-to-br from-[#dcfce7] to-[#bbf7d0] dark:from-emerald-950/40 dark:to-emerald-900/30"
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-sm p-1 text-muted-foreground opacity-70 hover:opacity-100"
          aria-label="ปิด"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <AlertDescription>
        <p className="font-medium">{message}</p>
      </AlertDescription>
    </Alert>
  );
};

// Activity Status Alert
interface ActivityStatusAlertProps {
  status: 'inactive' | 'upcoming' | 'ended' | 'full';
  message: string;
  startTime?: Date;
  endTime?: Date;
}

export const ActivityStatusAlert: React.FC<ActivityStatusAlertProps> = ({
  status,
  message,
  startTime,
  endTime,
}) => {
  const getVariant = () => {
    switch (status) {
      case 'inactive':
        return 'destructive' as const;
      case 'upcoming':
        return 'warning' as const;
      case 'ended':
        return 'info' as const;
      case 'full':
        return 'destructive' as const;
      default:
        return 'info' as const;
    }
  };

  const variant = getVariant();

  const bgClass =
    variant === 'destructive'
      ? 'border-[#ef4444] bg-gradient-to-br from-[#fee2e2] to-[#fecaca] dark:from-red-950/40 dark:to-red-900/30'
      : variant === 'warning'
        ? 'border-[#f59e0b] bg-gradient-to-br from-[#fef3c7] to-[#fde68a] dark:from-amber-950/40 dark:to-amber-900/30'
        : 'border-[#3b82f6] bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] dark:from-blue-950/40 dark:to-blue-900/30';

  return (
    <Alert variant={variant} className={cn('mb-6', bgClass)}>
      <AlertTitle className="font-bold">
        {status === 'inactive' && 'กิจกรรมถูกปิดใช้งาน'}
        {status === 'upcoming' && 'กิจกรรมยังไม่เปิดให้ลงทะเบียน'}
        {status === 'ended' && 'กิจกรรมสิ้นสุดแล้ว'}
        {status === 'full' && 'กิจกรรมเต็มแล้ว'}
      </AlertTitle>
      <AlertDescription>
        <p>{message}</p>

        {(startTime || endTime) && (
          <div className="mt-4 rounded-md bg-black/5 p-4 dark:bg-white/5">
            {startTime && status === 'upcoming' && (
              <p className="block text-xs text-muted-foreground">
                <strong>เปิดลงทะเบียน:</strong>{' '}
                {startTime.toLocaleString('th-TH')}
              </p>
            )}
            {endTime && status === 'ended' && (
              <p className="block text-xs text-muted-foreground">
                <strong>สิ้นสุดเมื่อ:</strong> {endTime.toLocaleString('th-TH')}
              </p>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};
