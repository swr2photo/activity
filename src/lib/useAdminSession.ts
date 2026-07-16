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
      // เช็คเซสชันล่าสุดก่อน — อาจถูกต่ออายุไปแล้ว (เช่นจากแท็บอื่น)
      const latest = getSession();
      if (latest && latest.expiresAt > Date.now()) {
        schedule(latest);
        return;
      }
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

    // การเข้าหน้าแอดมิน (รวมถึง auto-login จาก Firebase) ถือเป็นการใช้งาน
    // → เริ่มนับเวลาใหม่เสมอ ไม่ใช้เศษเวลาจากเซสชันเก่าใน localStorage
    const s = writeSession(minutes);
    schedule(s);

    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, minutes]);

  // ✅ Sliding session: ต่ออายุอัตโนมัติเมื่อมีการใช้งาน (คลิก/พิมพ์/เลื่อน/กลับมาที่แท็บ)
  // throttle ไว้ไม่เกิน 1 ครั้งต่อนาที เพื่อไม่ให้เขียน localStorage ถี่เกินไป
  useEffect(() => {
    if (!enabled) return;

    let lastRenew = 0;
    const onActivity = () => {
      if (document.hidden) return;
      const now = Date.now();
      if (now - lastRenew < 60_000) return;
      const s = getSession();
      // ถ้าเซสชันหมดไปแล้ว ปล่อยให้ timer เรียก onExpire ตามปกติ
      if (!s || s.expiresAt <= now) return;
      lastRenew = now;
      renew();
    };

    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onActivity);
    window.addEventListener('focus', onActivity);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onActivity);
      window.removeEventListener('focus', onActivity);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, minutes]);

  return useMemo(() => ({ remainingMs, renew, end }), [remainingMs]);
}