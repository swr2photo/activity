// src/components/admin/InvitesPanel.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Copy, Trash2, Ban } from 'lucide-react';
import { useSnackbar } from '@/lib/toast';
import { listInvites, deleteInvite, cancelInvite, type AdminInvite } from '@/lib/invitesApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function InvitesPanel() {
  const { enqueueSnackbar } = useSnackbar();
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | AdminInvite['status']>('all');

  const load = async () => {
    setLoading(true);
    try {
      const data = await listInvites(200);
      setInvites(data);
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'โหลดประวัติคำเชิญล้มเหลว', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return invites.filter((x) => {
      const okStatus = status === 'all' ? true : x.status === status;
      const okSearch =
        !s ||
        x.email.toLowerCase().includes(s) ||
        (x.role || '').toLowerCase().includes(s) ||
        (x.department || '').toLowerCase().includes(s);
      return okStatus && okSearch;
    });
  }, [invites, q, status]);

  const origin = process.env.NEXT_PUBLIC_SITE_URL || '';

  const copyLink = async (it: AdminInvite) => {
    if (!it.token || it.status !== 'pending') {
      enqueueSnackbar('คำเชิญนี้ไม่มีลิงก์หรือไม่ได้อยู่สถานะรอ', { variant: 'warning' });
      return;
    }
    const url = `${origin || window.location.origin}/api/invites/accept?token=${encodeURIComponent(it.token)}`;
    await navigator.clipboard.writeText(url);
    enqueueSnackbar('คัดลอกลิงก์ยืนยันแล้ว', { variant: 'success' });
  };

  const doCancel = async (it: AdminInvite) => {
    try {
      await cancelInvite(it.id);
      enqueueSnackbar('ยกเลิกคำเชิญแล้ว', { variant: 'success' });
      await load();
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'ยกเลิกไม่สำเร็จ', { variant: 'error' });
    }
  };

  const doDelete = async (it: AdminInvite) => {
    try {
      await deleteInvite(it.id);
      enqueueSnackbar('ลบประวัติคำเชิญแล้ว', { variant: 'success' });
      setInvites((prev) => prev.filter((x) => x.id !== it.id));
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'ลบไม่สำเร็จ', { variant: 'error' });
    }
  };

  const statusBadgeClass = (s: AdminInvite['status']) => {
    if (s === 'pending') return 'border-amber-200 bg-amber-50 text-amber-800';
    if (s === 'accepted') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    if (s === 'cancelled') return 'border-slate-200 bg-slate-50 text-slate-700';
    return 'border-rose-200 bg-rose-50 text-rose-800';
  };

  return (
    <TooltipProvider>
      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">ประวัติคำเชิญ</h2>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div className="relative min-w-full sm:min-w-[280px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="ค้นหาอีเมล/บทบาท/สังกัด"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="sr-only">สถานะ</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="สถานะ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="pending">รอ</SelectItem>
                    <SelectItem value="accepted">ยืนยันแล้ว</SelectItem>
                    <SelectItem value="expired">หมดอายุ</SelectItem>
                    <SelectItem value="cancelled">ยกเลิก</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={load} disabled={loading}>
                รีเฟรช
              </Button>
            </div>
          </div>

          <div className="mt-4">
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">
                {loading ? 'กำลังโหลด…' : 'ไม่มีประวัติคำเชิญ'}
              </p>
            ) : (
              <div className="space-y-2">
                {filtered.map((it) => (
                  <Card key={it.id} className="border shadow-none">
                    <CardContent className="flex flex-wrap items-center gap-4 py-4">
                      <div className="min-w-[240px]">
                        <p className="font-bold">{it.email}</p>
                        <p className="text-xs text-muted-foreground">
                          บทบาท: {it.role} • สังกัด: {it.department}
                        </p>
                      </div>

                      <Badge variant="outline" className={statusBadgeClass(it.status)}>
                        {it.status}
                      </Badge>

                      <div className="text-xs text-muted-foreground">
                        สร้างเมื่อ: {it.createdAt ? new Date(it.createdAt).toLocaleString('th-TH') : '-'}
                        {it.expiresAt ? ` • หมดอายุ: ${new Date(it.expiresAt).toLocaleString('th-TH')}` : ''}
                      </div>

                      <div className="flex-1" />

                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => copyLink(it)}
                                disabled={it.status !== 'pending' || !it.token}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>คัดลอกลิงก์ยืนยัน</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-amber-600 hover:text-amber-700"
                                onClick={() => doCancel(it)}
                                disabled={it.status !== 'pending'}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>ยกเลิกคำเชิญ (ทำให้ลิงก์ใช้ไม่ได้)</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => doDelete(it)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>ลบประวัติคำเชิญ</TooltipContent>
                        </Tooltip>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
