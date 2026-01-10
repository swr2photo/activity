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
  remainingMs: number | null;
  renew: () => void;
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

/** * ✅ เริ่ม/ต่ออายุเซสชันทันที (สำหรับเรียกหลังล็อกอิน)
 * - minutes คืออายุเซสชัน (เช่น 30)
 */
export function startSession(_unusedUid: string | number, minutes?: number) {
  const mins = typeof minutes === 'number' ? minutes : 30;
  writeSession(mins);
}

/* ------------- main hook ------------- */
export default function useAdminSession(opts: UseAdminSessionOpts): UseAdminSessionReturn {
  const { minutes, enabled, onExpire } = opts;

  const [remainingMs, setRemainingMs] = useState<number | null>(null);

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

    const existing = getSession();
    if (existing && existing.expiresAt > Date.now()) {
      schedule(existing);
    } else {
      const s = writeSession(minutes);
      schedule(s);
    }

    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, minutes]);

  // ต่ออายุเมื่อผู้ใช้กลับมาหน้าเว็บ (Auto-extend)
  useEffect(() => {
    const onVis = () => {
      if (!enabled) return;
      const s = getSession();
      if (!s) return;
      const left = s.expiresAt - Date.now();
      // ถ้าเหลือน้อยกว่า 1 นาที ให้ต่ออายุอัตโนมัติ
      if (left <= 60_000 && left > 0) {
        renew();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [enabled]);

  return useMemo(() => ({ remainingMs, renew, end }), [remainingMs]);
}