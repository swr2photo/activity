// src/lib/useAdminSession.ts
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const LS_KEY = 'adminSession';

type SessionPayload = {
  startedAt: number;   // ms epoch
  expiresAt: number;   // ms epoch
  minutes: number;     // อายุเซสชัน (นาที)
};

export type UseAdminSessionOpts = {
  minutes: number;           // อายุเซสชัน (นาที), เช่น 30
  enabled: boolean;          // true เมื่อผู้ใช้ล็อกอินแล้ว
  onExpire?: () => void;     // เรียกเมื่อหมดเวลา
};

export type UseAdminSessionReturn = {
  /** เวลาคงเหลือ (ms) ถ้าไม่เปิดใช้งานจะเป็น null */
  remainingMs: number | null;
  /** ต่ออายุ (เริ่มนับใหม่ตาม minutes เดิม) */
  renew: () => void;
  /** จบเซสชัน (ลบ localStorage และหยุดตัวจับเวลา) */
  end: () => void;
};

/* ------------- helpers (ใช้นอกฮุค) ------------- */
export function getSession(): SessionPayload | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as SessionPayload;
    if (!obj || typeof obj.expiresAt !== 'number') return null;
    return obj;
  } catch {
    return null;
  }
}

export function endSession(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}

/* สร้าง/ต่ออายุเซสชันใหม่ ตาม minutes */
function writeSession(minutes: number): SessionPayload {
  const now = Date.now();
  const payload: SessionPayload = {
    startedAt: now,
    expiresAt: now + minutes * 60 * 1000,
    minutes,
  };
  localStorage.setItem(LS_KEY, JSON.stringify(payload));
  return payload;
}

/* ------------- main hook ------------- */
export default function useAdminSession(opts: UseAdminSessionOpts): UseAdminSessionReturn {
  const { minutes, enabled, onExpire } = opts;

  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  // เก็บ id ของ interval/timeout แบบ number (หลีกเลี่ยง NodeJS.Timer type)
  const tickId = useRef<number | null>(null);
  const expireId = useRef<number | null>(null);

  const clearTimers = () => {
    if (tickId.current != null) {
      window.clearInterval(tickId.current);
      tickId.current = null;
    }
    if (expireId.current != null) {
      window.clearTimeout(expireId.current);
      expireId.current = null;
    }
  };

  const schedule = (sess: SessionPayload) => {
    clearTimers();
    const now = Date.now();
    const left = Math.max(0, sess.expiresAt - now);
    setRemainingMs(left);

    // อัปเดตหน้าปัดทุก 1 วินาที
    tickId.current = window.setInterval(() => {
      const s = getSession();
      const now2 = Date.now();
      const left2 = s ? Math.max(0, s.expiresAt - now2) : 0;
      setRemainingMs(s ? left2 : 0);
      if (!s || left2 <= 0) {
        // จบเอง (กัน race condition)
        clearTimers();
        endSession();
        setRemainingMs(0);
        onExpire?.();
      }
    }, 1000);

    // ตั้งเวลาหมดอายุเพื่อเรียก onExpire ตรงเวลา
    expireId.current = window.setTimeout(() => {
      clearTimers();
      endSession();
      setRemainingMs(0);
      onExpire?.();
    }, left);
  };

  const renew = () => {
    const s = writeSession(minutes);
    schedule(s);
  };

  const end = () => {
    clearTimers();
    endSession();
    setRemainingMs(null);
  };

  // เริ่ม/หยุดตาม enabled
  useEffect(() => {
    if (!enabled) {
      end();
      return;
    }

    // มีเซสชันเดิมอยู่ไหม
    const existing = getSession();
    if (existing && existing.expiresAt > Date.now()) {
      // ใช้ของเดิมต่อ (นับเวลาที่เหลือ)
      schedule(existing);
    } else {
      // สร้างใหม่
      const s = writeSession(minutes);
      schedule(s);
    }

    // cleanup
    return () => {
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, minutes]);

  // ต่ออายุเมื่อผู้ใช้กลับมาหน้าเว็บ (ตัวเลือก: ถ้าไม่ต้องการ auto-extend ให้คอมเมนต์ส่วนนี้)
  useEffect(() => {
    const onVis = () => {
      if (!enabled) return;
      const s = getSession();
      if (!s) return;
      // ถ้าเหลือน้อยกว่า 60 วิ ให้ต่ออายุให้
      const left = s.expiresAt - Date.now();
      if (left <= 60_000) {
        renew();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [enabled]); // minutes ไม่ต้อง เพราะเราเช็คจาก session ปัจจุบัน

  return useMemo(() => ({ remainingMs, renew, end }), [remainingMs]);
}

// --- ใส่เพิ่มใน src/lib/useAdminSession.ts ---

/** เริ่ม/ต่ออายุเซสชันทันที (สำหรับเรียกหลังล็อกอิน)
 *  - พารามิเตอร์แรกจะถูกมองข้าม (เผื่อคุณอยากส่ง uid)
 *  - minutes คืออายุเซสชัน (เช่น 30)
 *  - ตัว hook จะเป็นคนตั้ง timer เองเมื่อ enabled=true
 */
export function startSession(_: string | number, minutes?: number) {
  const mins = typeof minutes === 'number' ? minutes : 30;
  // ใช้ตัวช่วยเดิมในไฟล์เพื่อเขียนค่า session ลง localStorage
  // โดยไม่ตั้ง timer ที่นี่ (ให้ hook เป็นคนจัดการ)
  const now = Date.now();
  const payload = {
    startedAt: now,
    expiresAt: now + mins * 60 * 1000,
    minutes: mins,
  };
  try {
    localStorage.setItem('adminSession', JSON.stringify(payload));
  } catch {}
}
