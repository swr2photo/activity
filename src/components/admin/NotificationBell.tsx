import React, { useState, useEffect, useMemo } from 'react';
import { Bell } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { adminDb as db } from '@/lib/firebase';
import type { AdminProfile } from '@/types/admin';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type AdminNotif = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: any;
  departmentKey?: string;
  department?: string;
};

// Helper for department checks
const deptEquals = (d1: string, d2: string) => {
  if (!d1 || !d2) return false;
  return d1.toLowerCase().replace(/\s/g, '') === d2.toLowerCase().replace(/\s/g, '');
};

const NotificationBell: React.FC<{
  currentAdmin: AdminProfile;
}> = ({ currentAdmin }) => {
  const [items, setItems] = useState<AdminNotif[]>([]);
  const LS_KEY = useMemo(() => `admin_last_seen_notif_${currentAdmin.uid}`, [currentAdmin.uid]);
  const [lastSeen, setLastSeen] = useState<number>(0);

  // Determine allowed department key based on role
  const allowedDeptKey = useMemo(() => {
    return currentAdmin.role === 'super_admin' ? 'all' : currentAdmin.department || 'all';
  }, [currentAdmin]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(LS_KEY);
    setLastSeen(raw ? Number(raw) : 0);
  }, [LS_KEY]);

  const markSeenNow = () => {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    window.localStorage.setItem(LS_KEY, String(now));
    setLastSeen(now);
  };

  const unseenCount = useMemo(() => {
    return items.filter((n) => {
      const t = n.createdAt instanceof Date ? n.createdAt.getTime() : (n.createdAt as any)?.toMillis?.() ?? 0;
      return t > lastSeen;
    }).length;
  }, [items, lastSeen]);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    const watch = (colName: string) => {
      const q = query(collection(db, colName), orderBy('createdAt', 'desc'), limit(20));
      const un = onSnapshot(q, (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        const filtered = arr.filter((n) => {
          if (allowedDeptKey === 'all') return true;
          const dep = n.departmentKey || n.department;
          return dep === 'all' || deptEquals(dep as any, allowedDeptKey as any);
        });
        setItems((prev) => {
          const map = new Map();
          [...filtered, ...prev].forEach((x) => map.set(x.id, x));
          return Array.from(map.values())
            .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
            .slice(0, 50);
        });
      }, (err) => {
        // ไม่มีสิทธิ์อ่าน/คอลเลกชันยังไม่มี — ปิดกระดิ่งเงียบ ๆ ไม่ต้อง crash console
        console.warn(`NotificationBell: ไม่สามารถฟัง ${colName}`, err?.code || err);
      });
      unsubscribers.push(un);
    };
    watch('adminNotifications');
    return () => unsubscribers.forEach((u) => u());
  }, [allowedDeptKey]);

  return (
    <DropdownMenu onOpenChange={(open) => open && markSeenNow()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-slate-600 hover:bg-slate-100">
          <Bell className="h-5 w-5" />
          {unseenCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
              {unseenCount > 99 ? '99+' : unseenCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>การแจ้งเตือน</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">ไม่มีการแจ้งเตือน</div>
          ) : (
            items.slice(0, 10).map((n) => (
              <DropdownMenuItem key={n.id} className="flex flex-col items-start p-3 gap-1 whitespace-normal">
                <span className="font-semibold text-sm">{n.title}</span>
                <span className="text-xs text-muted-foreground">{n.message}</span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
