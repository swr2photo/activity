import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { adminDb as db } from '@/lib/firebaseAdminClient';
import type { AdminProfile } from '@/types/admin';
import { notify } from '@/lib/notify';
import NotificationCenter, { type FeedItem } from '@/components/notifications/NotificationCenter';

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

const toMillis = (v: any): number =>
  v instanceof Date ? v.getTime() : v?.toMillis?.() ?? (typeof v?.seconds === 'number' ? v.seconds * 1000 : 0);

/**
 * ศูนย์แจ้งเตือนของแอดมิน
 * - ฟัง adminNotifications (ล่าสุด 20 รายการ) แบบเรียลไทม์
 * - รายการใหม่ที่เข้ามาระหว่างใช้งาน → ขึ้นที่แถบสถานะด้วย (ไม่เด้ง popup)
 */
const NotificationBell: React.FC<{ currentAdmin: AdminProfile }> = ({ currentAdmin }) => {
  const [items, setItems] = useState<AdminNotif[]>([]);
  const LS_KEY = useMemo(() => `admin_last_seen_notif_${currentAdmin.uid}`, [currentAdmin.uid]);
  const [lastSeen, setLastSeen] = useState<number>(0);
  const seenIds = useRef<Set<string> | null>(null);

  const allowedDeptKey = useMemo(
    () => (currentAdmin.role === 'super_admin' ? 'all' : currentAdmin.department || 'all'),
    [currentAdmin.role, currentAdmin.department]
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      setLastSeen(raw ? Number(raw) : 0);
    } catch {}
  }, [LS_KEY]);

  const markSeenNow = () => {
    const now = Date.now();
    try {
      window.localStorage.setItem(LS_KEY, String(now));
    } catch {}
    setLastSeen(now);
  };

  useEffect(() => {
    seenIds.current = null;
    const q = query(collection(db, 'adminNotifications'), orderBy('createdAt', 'desc'), limit(20));
    const un = onSnapshot(
      q,
      (snap) => {
        const arr = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as AdminNotif))
          .filter((n) => {
            if (allowedDeptKey === 'all') return true;
            const dep = n.departmentKey || n.department;
            return dep === 'all' || deptEquals(dep as any, allowedDeptKey as any);
          });

        // ครั้งแรก = โหลดของเดิม (ไม่แจ้ง) / ครั้งต่อไป = ของใหม่จริง → ขึ้นแถบสถานะ
        if (seenIds.current) {
          arr
            .filter((n) => !seenIds.current!.has(n.id))
            .slice(0, 3)
            .reverse()
            .forEach((n) =>
              notify({ title: n.title, description: n.message, variant: 'info', source: 'admin' })
            );
        }
        seenIds.current = new Set(arr.map((n) => n.id));
        setItems(arr);
      },
      (err) => {
        // ไม่มีสิทธิ์อ่าน/คอลเลกชันยังไม่มี — ปิดเงียบ ๆ ไม่ต้อง crash console
        console.warn('NotificationBell: ไม่สามารถฟัง adminNotifications', err?.code || err);
      }
    );
    return () => un();
  }, [allowedDeptKey]);

  const feed: FeedItem[] = useMemo(
    () =>
      items.map((n) => {
        const at = toMillis(n.createdAt);
        return { id: n.id, title: n.title, message: n.message, at, unread: at > lastSeen };
      }),
    [items, lastSeen]
  );
  const feedUnread = useMemo(() => feed.filter((f) => f.unread).length, [feed]);

  return <NotificationCenter feed={feed} feedUnread={feedUnread} onClose={markSeenNow} />;
};

export default NotificationBell;
