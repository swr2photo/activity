import React from 'react';
import { Activity } from '../../../lib/adminFirebase';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Edit, Download, Users, Trash2, Link as LinkIcon, QrCode, MonitorPlay } from 'lucide-react';
import { DEPARTMENT_LABELS } from '../../../types/admin';
import dayjs from 'dayjs';

interface ActivityTableProps {
  activities: Activity[];
  onToggleStatus: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
  onDownload: (e: React.MouseEvent<HTMLElement>, activity: Activity) => void;
  onViewParticipants: (activityCode: string) => void;
  onViewRegistration: (activityCode: string) => void;
  isSuperAdmin: boolean;
  currentDept: string;
}

export function ActivityTable({
  activities,
  onToggleStatus,
  onEdit,
  onDelete,
  onDownload,
  onViewParticipants,
  onViewRegistration,
  isSuperAdmin,
  currentDept
}: ActivityTableProps) {
  
  const statusOf = (a: Activity) => {
    const now = new Date();
    if (!a.isActive) return { label: 'ปิดใช้งาน', variant: 'secondary' as const };
    if (a.startDateTime && now < a.startDateTime) return { label: 'รอเปิด', variant: 'warning' as const };
    if (a.endDateTime && now > a.endDateTime) return { label: 'สิ้นสุดแล้ว', variant: 'default' as const };
    return { label: 'เปิดใช้งาน', variant: 'success' as const };
  };

  const fmt = (v: any) => {
    if (!v) return '-';
    const d = typeof v.toDate === 'function' ? v.toDate() : v;
    return dayjs(d).isValid() ? dayjs(d).format('DD MMM YYYY HH:mm') : '-';
  };

  const ActionButtons = ({ a, canManage }: { a: Activity; canManage: boolean }) => (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => onViewParticipants(a.activityCode)}
        title="ดูผู้เข้าร่วม"
      >
        <Users className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => onViewRegistration(a.activityCode)}
        title="ดูหน้าลงทะเบียน"
      >
        <LinkIcon className="h-4 w-4 text-blue-500" />
      </Button>
      {(a as any).dynamicQREnabled && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => window.open(`/admin/dynamic-qr/${a.activityCode}`, '_blank')}
          title="เปิดจอ Dynamic QR"
        >
          <MonitorPlay className="h-4 w-4 text-purple-500" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={(e) => onDownload(e, a)}
        title="ดาวน์โหลด QR/รูป"
      >
        <Download className="h-4 w-4 text-emerald-500" />
      </Button>
      {canManage && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => onEdit(a)}
            title="แก้ไข"
          >
            <Edit className="h-4 w-4 text-amber-500" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => onDelete(a)}
            title="ลบ"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile: การ์ดรายการ */}
      <div className="md:hidden space-y-3">
        {activities.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">ไม่พบกิจกรรม</div>
        ) : (
          activities.map((a) => {
            const s = statusOf(a);
            const canManage = isSuperAdmin || a.department === currentDept;
            return (
              <div
                key={a.id}
                className="rounded-xl border border-border bg-card p-3 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-base leading-snug break-words">{a.activityName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {DEPARTMENT_LABELS[a.department as keyof typeof DEPARTMENT_LABELS] || a.department}
                    </p>
                    {a.location && (
                      <p className="text-xs text-muted-foreground mt-0.5">📍 {a.location}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <Switch
                      checked={a.isActive}
                      onCheckedChange={() => canManage && onToggleStatus(a)}
                      disabled={!canManage}
                    />
                    <Badge variant={s.variant as any} className="text-[10px] whitespace-nowrap">
                      {s.label}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1 text-sm">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <QrCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{a.activityCode}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmt(a.startDateTime)} — {fmt(a.endDateTime)}
                  </div>
                </div>

                <ActionButtons a={a} canManage={canManage} />
              </div>
            );
          })
        )}
      </div>

      {/* Desktop / tablet: ตาราง */}
      <div className="hidden md:block rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[88px]">สถานะ</TableHead>
                <TableHead>ข้อมูลกิจกรรม</TableHead>
                <TableHead className="hidden lg:table-cell">เวลา</TableHead>
                <TableHead className="hidden lg:table-cell">โค้ด/URL</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    ไม่พบกิจกรรม
                  </TableCell>
                </TableRow>
              ) : (
                activities.map((a) => {
                  const s = statusOf(a);
                  const canManage = isSuperAdmin || a.department === currentDept;

                  return (
                    <TableRow key={a.id} className="group">
                      <TableCell>
                        <div className="flex flex-col items-center gap-2">
                          <Switch
                            checked={a.isActive}
                            onCheckedChange={() => canManage && onToggleStatus(a)}
                            disabled={!canManage}
                          />
                          <Badge variant={s.variant as any} className="text-[10px]">
                            {s.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-base break-words">{a.activityName}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {DEPARTMENT_LABELS[a.department as keyof typeof DEPARTMENT_LABELS] || a.department}
                        </div>
                        {a.location && (
                          <div className="text-xs text-muted-foreground mt-1">
                            📍 {a.location}
                          </div>
                        )}
                        <div className="lg:hidden mt-2 space-y-0.5 text-xs text-muted-foreground">
                          <div>เริ่ม: {fmt(a.startDateTime)}</div>
                          <div>สิ้นสุด: {fmt(a.endDateTime)}</div>
                          <div className="font-mono flex items-center gap-1 pt-1">
                            <QrCode className="h-3.5 w-3.5" />
                            {a.activityCode}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell whitespace-nowrap">
                        <div className="text-sm">เริ่ม: {fmt(a.startDateTime)}</div>
                        <div className="text-sm text-muted-foreground">สิ้นสุด: {fmt(a.endDateTime)}</div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-2 mb-1">
                          <QrCode className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{a.activityCode}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <LinkIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-xs text-muted-foreground">
                            {a.userCode || '-'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <ActionButtons a={a} canManage={canManage} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
