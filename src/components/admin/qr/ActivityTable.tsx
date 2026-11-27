import React, { useEffect, useState } from 'react';
import { Activity } from '../../../lib/adminFirebase';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Edit,
  Download,
  Users,
  Trash2,
  Link as LinkIcon,
  QrCode,
  MonitorPlay,
  LayoutGrid,
  Rows3,
  MapPin,
  FlaskConical,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import { DEPARTMENT_LABELS } from '../../../types/admin';
import dayjs from 'dayjs';
import { cn } from '@/lib/utils';
import { formatThai } from '@/lib/datetime';
import { enqueueSnackbar } from '@/lib/toast';

interface ActivityTableProps {
  activities: Activity[];
  onToggleStatus: (activity: Activity) => void;
  onReopenEnded?: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
  onDownload: (e: React.MouseEvent<HTMLElement>, activity: Activity) => void;
  onViewParticipants: (activityCode: string) => void;
  onViewRegistration: (activityCode: string) => void;
  isSuperAdmin: boolean;
  currentDept: string;
}

type ViewMode = 'cards' | 'table';
const VIEW_KEY = 'admin:activityView';

const statusOf = (a: Activity) => {
  const now = new Date();
  if (!a.isActive) return { key: 'draft', label: 'ฉบับร่าง', variant: 'warning' as const };
  if (a.startDateTime && now < a.startDateTime) return { key: 'upcoming', label: 'รอเปิด', variant: 'info' as const };
  if (a.endDateTime && now > a.endDateTime) return { key: 'ended', label: 'สิ้นสุดแล้ว', variant: 'secondary' as const };
  return { key: 'live', label: 'เผยแพร่แล้ว', variant: 'success' as const };
};

const fmtDate = (v: any) => {
  if (!v) return '-';
  const d = typeof v.toDate === 'function' ? v.toDate() : v;
  return dayjs(d).isValid() ? dayjs(d).format('DD MMM YYYY HH:mm') : '-';
};

const deptLabel = (d?: string) =>
  (d && DEPARTMENT_LABELS[d as keyof typeof DEPARTMENT_LABELS]) || d || '-';

type ActionProps = {
  a: Activity;
  canManage: boolean;
  onViewParticipants: (activityCode: string) => void;
  onViewRegistration: (activityCode: string) => void;
  onDownload: (e: React.MouseEvent<HTMLElement>, activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
  compact?: boolean;
};

/** ปุ่มจัดการแบบไอคอนเคลื่อนไหว (เล่นตอน hover/focus) */
const ActivityActionButtons = React.memo(function ActivityActionButtons({
  a,
  canManage,
  onViewParticipants,
  onViewRegistration,
  onDownload,
  onEdit,
  onDelete,
  compact,
}: ActionProps) {
  const btn = cn('motion-trigger h-9 w-9 rounded-xl', compact && 'h-8 w-8');
  return (
    <div className="flex flex-wrap items-center justify-end gap-0.5">
      <Button variant="ghost" size="icon" className={btn} onClick={() => onViewParticipants(a.activityCode)} title="ดูผู้เข้าร่วม" aria-label="ดูผู้เข้าร่วม">
        <Users className="mi mi-pop h-4 w-4 text-sky-600 dark:text-sky-400" />
      </Button>
      <Button variant="ghost" size="icon" className={btn} onClick={() => onViewRegistration(a.activityCode)} title="ดูหน้าลงทะเบียน" aria-label="ดูหน้าลงทะเบียน">
        <LinkIcon className="mi mi-nudge h-4 w-4 text-blue-500" />
      </Button>
      {(a as any).dynamicQREnabled && (
        <Button
          variant="ghost"
          size="icon"
          className={btn}
          onClick={() => window.open(`/admin/dynamic-qr/${a.activityCode}`, '_blank')}
          title="เปิดจอ Dynamic QR"
          aria-label="เปิดจอ Dynamic QR"
        >
          <MonitorPlay className="mi mi-pulse h-4 w-4 text-purple-500" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className={btn} onClick={(e) => onDownload(e, a)} title="ดาวน์โหลด QR/รูป" aria-label="ดาวน์โหลด QR/รูป">
        <Download className="mi mi-bounce h-4 w-4 text-emerald-500" />
      </Button>
      {canManage && (
        <>
          <Button variant="ghost" size="icon" className={btn} onClick={() => onEdit(a)} title="แก้ไข" aria-label="แก้ไข">
            <Edit className="mi mi-wiggle h-4 w-4 text-amber-500" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(btn, 'hover:bg-rose-500/10')}
            onClick={() => onDelete(a)}
            title="ลบ"
            aria-label="ลบ"
          >
            <Trash2 className="mi mi-shake h-4 w-4 text-destructive" />
          </Button>
        </>
      )}
    </div>
  );
});

function StatusControl({
  a,
  canManage,
  onToggleStatus,
  onReopenEnded,
}: {
  a: Activity;
  canManage: boolean;
  onToggleStatus: (activity: Activity) => void;
  onReopenEnded?: (activity: Activity) => void;
}) {
  const s = statusOf(a);
  if (s.key === 'ended' && onReopenEnded && canManage) {
    return (
      <Button
        size="sm"
        className="motion-trigger h-8 gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700"
        onClick={() => onReopenEnded(a)}
      >
        <RotateCcw className="mi mi-spin-back h-3.5 w-3.5" />
        เปิดใหม่
      </Button>
    );
  }
  return (
    <Switch
      checked={a.isActive}
      onCheckedChange={() => canManage && onToggleStatus(a)}
      disabled={!canManage}
      aria-label={a.isActive ? 'ปิดรับสมัคร' : 'เปิดรับสมัคร'}
    />
  );
}

function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setDone(true);
          enqueueSnackbar(`คัดลอกรหัส ${code} แล้ว`, { variant: 'success', autoHideDuration: 2000 });
          window.setTimeout(() => setDone(false), 1600);
        } catch {
          enqueueSnackbar('คัดลอกไม่สำเร็จ', { variant: 'error' });
        }
      }}
      className="motion-trigger group/copy inline-flex max-w-full items-center gap-1.5 rounded-lg bg-muted/70 px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
      title="คัดลอกรหัสกิจกรรม"
    >
      <QrCode className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{code}</span>
      {done ? <Check className="h-3.5 w-3.5 shrink-0 animate-pop-in text-emerald-500" /> : <Copy className="mi mi-pop h-3.5 w-3.5 shrink-0 opacity-60" />}
    </button>
  );
}

const STATUS_RING: Record<string, string> = {
  live: 'bg-emerald-500',
  upcoming: 'bg-sky-500',
  draft: 'bg-amber-500',
  ended: 'bg-slate-400',
};

/** การ์ดกิจกรรมของแอดมิน — แบนเนอร์ + สถานะ + จำนวนผู้เข้าร่วม + ปุ่มจัดการ */
function AdminActivityCard({
  a,
  index,
  canManage,
  ...handlers
}: {
  a: Activity;
  index: number;
  canManage: boolean;
} & Omit<ActivityTableProps, 'activities' | 'isSuperAdmin' | 'currentDept'>) {
  const s = statusOf(a);
  const start = a.startDateTime instanceof Date ? a.startDateTime : a.startDateTime ? new Date(a.startDateTime as any) : null;
  const max = Number(a.maxParticipants || 0);
  const cur = Number(a.currentParticipants || 0);
  const pct = max > 0 ? Math.min(100, Math.round((cur / max) * 100)) : 0;
  const [imgOk, setImgOk] = useState(true);

  return (
    <article
      style={{ '--i': index } as React.CSSProperties}
      className="card-lift group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
    >
      {/* แบนเนอร์ */}
      <div
        className="relative h-32 overflow-hidden"
        style={{
          background: a.bannerColor
            ? `linear-gradient(135deg, ${a.bannerColor}, color-mix(in srgb, ${a.bannerColor} 45%, #050914))`
            : 'linear-gradient(120deg, #0a6bcf, #06b6d4 60%, #10b981)',
        }}
      >
        {a.bannerUrl && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.bannerUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgOk(false)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
          />
        ) : (
          <FlaskConical className="absolute right-4 top-1/2 h-14 w-14 -translate-y-1/2 text-white/25 transition-transform duration-700 group-hover:rotate-[-12deg] group-hover:scale-110" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        <Badge variant={s.variant as any} className="absolute left-3 top-3 gap-1.5 border border-white/25 bg-white/90 text-[11px] font-bold shadow dark:bg-slate-950/80">
          <span className="relative flex h-2 w-2">
            {s.key === 'live' && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-60" />}
            <span className={cn('relative h-2 w-2 rounded-full', STATUS_RING[s.key])} />
          </span>
          {s.label}
        </Badge>
        <span className="absolute right-3 top-3 max-w-[45%] truncate rounded-full bg-black/35 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
          {deptLabel(a.department)}
        </span>

        {start && (
          <div className="absolute bottom-3 left-3 flex items-end gap-2 text-white">
            <div className="flex h-11 w-10 flex-col items-center justify-center overflow-hidden rounded-xl bg-white text-slate-900 shadow-lg transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:rotate-[-4deg]">
              <span className="w-full bg-brand-gradient py-0.5 text-center text-[9px] font-bold leading-none text-white">
                {formatThai(start, { month: 'short' })}
              </span>
              <span className="text-base font-black leading-tight">{formatThai(start, { day: 'numeric' })}</span>
            </div>
            <span className="pb-0.5 text-xs font-medium text-white/90 drop-shadow">
              {formatThai(start, { hour: '2-digit', minute: '2-digit' })} น.
            </span>
          </div>
        )}
      </div>

      {/* เนื้อหา */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[0.95rem] font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
            {a.activityName}
          </h3>
          {a.location && (
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{a.location}</span>
            </p>
          )}
        </div>

        <CopyCode code={a.activityCode} />

        {max > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground">ผู้เข้าร่วม</span>
              <span className="font-bold tabular-nums">
                {cur.toLocaleString('th-TH')}/{max.toLocaleString('th-TH')}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full origin-left animate-grow-x rounded-full',
                  pct >= 90 ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-[var(--brand-1)] via-[var(--brand-2)] to-[var(--brand-3)]'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <StatusControl a={a} canManage={canManage} onToggleStatus={handlers.onToggleStatus} onReopenEnded={handlers.onReopenEnded} />
            <span className="hidden text-[11px] font-semibold text-muted-foreground sm:inline">
              {a.isActive ? 'เปิดอยู่' : 'ปิดอยู่'}
            </span>
          </div>
          <ActivityActionButtons
            a={a}
            canManage={canManage}
            compact
            onViewParticipants={handlers.onViewParticipants}
            onViewRegistration={handlers.onViewRegistration}
            onDownload={handlers.onDownload}
            onEdit={handlers.onEdit}
            onDelete={handlers.onDelete}
          />
        </div>
      </div>
    </article>
  );
}

export const ActivityTable = React.memo(function ActivityTable({
  activities,
  onToggleStatus,
  onReopenEnded,
  onEdit,
  onDelete,
  onDownload,
  onViewParticipants,
  onViewRegistration,
  isSuperAdmin,
  currentDept,
}: ActivityTableProps) {
  const [view, setView] = useState<ViewMode>('cards');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === 'table' || saved === 'cards') setView(saved);
    } catch {}
  }, []);

  const changeView = (v: ViewMode) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  const handlers = { onToggleStatus, onReopenEnded, onEdit, onDelete, onDownload, onViewParticipants, onViewRegistration };

  return (
    <div className="space-y-3">
      {/* สลับมุมมอง */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted-foreground">
          {activities.length.toLocaleString('th-TH')} กิจกรรม
        </p>
        <div role="tablist" aria-label="มุมมองรายการ" className="inline-flex rounded-xl border border-border bg-muted/60 p-1">
          {(
            [
              { key: 'cards', label: 'การ์ด', icon: LayoutGrid },
              { key: 'table', label: 'ตาราง', icon: Rows3 },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              onClick={() => changeView(v.key)}
              className={cn(
                'motion-trigger flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                view === v.key ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <v.icon className="mi mi-pop h-3.5 w-3.5" />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          ไม่พบกิจกรรม
        </div>
      ) : view === 'cards' ? (
        <div key="cards" className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activities.map((a, i) => (
            <AdminActivityCard
              key={a.id}
              a={a}
              index={i}
              canManage={isSuperAdmin || a.department === currentDept}
              {...handlers}
            />
          ))}
        </div>
      ) : (
        <div key="table" className="animate-section overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[96px]">สถานะ</TableHead>
                  <TableHead>ข้อมูลกิจกรรม</TableHead>
                  <TableHead className="hidden lg:table-cell">เวลา</TableHead>
                  <TableHead className="hidden lg:table-cell">โค้ด/URL</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((a) => {
                  const s = statusOf(a);
                  const canManage = isSuperAdmin || a.department === currentDept;
                  return (
                    <TableRow key={a.id} className="group">
                      <TableCell>
                        <div className="flex flex-col items-center gap-2">
                          <StatusControl a={a} canManage={canManage} onToggleStatus={onToggleStatus} onReopenEnded={onReopenEnded} />
                          <Badge variant={s.variant as any} className="text-[10px] whitespace-nowrap">
                            {s.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-base break-words">{a.activityName}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{deptLabel(a.department)}</div>
                        {a.location && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            {a.location}
                          </div>
                        )}
                        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground lg:hidden">
                          <div>เริ่ม: {fmtDate(a.startDateTime)}</div>
                          <div>สิ้นสุด: {fmtDate(a.endDateTime)}</div>
                          <div className="flex items-center gap-1 pt-1 font-mono">
                            <QrCode className="h-3.5 w-3.5" />
                            {a.activityCode}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap lg:table-cell">
                        <div className="text-sm">เริ่ม: {fmtDate(a.startDateTime)}</div>
                        <div className="text-sm text-muted-foreground">สิ้นสุด: {fmtDate(a.endDateTime)}</div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <CopyCode code={a.activityCode} />
                        <div className="mt-1.5 flex items-center gap-2">
                          <LinkIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-xs text-muted-foreground">{a.userCode || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <ActivityActionButtons
                          a={a}
                          canManage={canManage}
                          onViewParticipants={onViewParticipants}
                          onViewRegistration={onViewRegistration}
                          onDownload={onDownload}
                          onEdit={onEdit}
                          onDelete={onDelete}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
});
