/**
 * ระบบแจ้งเตือนแบบ "แถบสถานะ" (status bar) — แทน toast ที่เด้งซ้อนกัน
 *
 * - แสดงทีละรายการในแถบเดียว (รายการถัดไปต่อคิว) ไม่บังเนื้อหา
 * - เก็บประวัติไว้ในศูนย์แจ้งเตือน (กดดูย้อนหลังได้) + จำนวนที่ยังไม่อ่าน
 * - store เล็ก ๆ ไม่พึ่งไลบรารี ใช้ร่วมกับ React ผ่าน useSyncExternalStore
 */
import { useSyncExternalStore } from "react";

export type NoticeVariant = "default" | "success" | "error" | "warning" | "info" | "loading";

export type Notice = {
  id: string;
  title: string;
  description?: string;
  variant: NoticeVariant;
  createdAt: number;
  /** มิลลิวินาทีที่แสดงในแถบ (0 = ค้างจนกว่าจะปิด) */
  duration: number;
  read: boolean;
  /** แหล่งที่มา เช่น "system" | "admin" — ใช้แสดงป้ายในศูนย์แจ้งเตือน */
  source?: string;
};

export type NotifyInput = {
  title: string;
  description?: string;
  variant?: NoticeVariant;
  duration?: number;
  source?: string;
  /** ถ้ามีรายการเดียวกันกำลังแสดงอยู่ จะไม่เพิ่มซ้ำ */
  dedupeKey?: string;
};

type State = {
  /** รายการที่รอ/กำลังแสดงในแถบ (ตัวแรก = กำลังแสดง) */
  queue: Notice[];
  /** ประวัติล่าสุด (ใหม่สุดก่อน) */
  history: Notice[];
  /** จำนวนแถบแบบ docked ที่ mount อยู่ (เช่นแถบล่างของแอดมิน) — แถบลอยจะซ่อนเมื่อ > 0 */
  docked: number;
};

const HISTORY_LIMIT = 40;
const DEFAULT_DURATION: Record<NoticeVariant, number> = {
  default: 4000,
  info: 4500,
  success: 3500,
  warning: 6000,
  error: 7000,
  loading: 0,
};

let state: State = { queue: [], history: [], docked: 0 };
const listeners = new Set<() => void>();
const dedupe = new Map<string, string>();
let seq = 0;

const emit = () => listeners.forEach((l) => l());
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  emit();
};

export function notify(input: NotifyInput | string): string {
  const opts: NotifyInput = typeof input === "string" ? { title: input } : input;
  if (opts.dedupeKey) {
    const existing = dedupe.get(opts.dedupeKey);
    if (existing && state.queue.some((n) => n.id === existing)) return existing;
  }
  const variant = opts.variant ?? "default";
  const notice: Notice = {
    id: `n${Date.now().toString(36)}${(seq++).toString(36)}`,
    title: opts.title,
    description: opts.description,
    variant,
    createdAt: Date.now(),
    duration: opts.duration ?? DEFAULT_DURATION[variant],
    read: false,
    source: opts.source,
  };
  if (opts.dedupeKey) dedupe.set(opts.dedupeKey, notice.id);
  // ข้อผิดพลาดแทรกคิวหน้าสุด (สำคัญกว่า) — นอกนั้นต่อท้าย
  const queue = variant === "error" ? [state.queue[0], notice, ...state.queue.slice(1)].filter(Boolean) as Notice[] : [...state.queue, notice];
  set({ queue, history: [notice, ...state.history].slice(0, HISTORY_LIMIT) });
  return notice.id;
}

/** ปิดรายการในแถบ (ไม่ระบุ id = ล้างคิวทั้งหมด) */
export function dismiss(id?: string) {
  if (!id) return set({ queue: [] });
  if (!state.queue.some((n) => n.id === id)) return;
  set({ queue: state.queue.filter((n) => n.id !== id) });
}

/** อัปเดตรายการ เช่น loading → success */
export function updateNotice(id: string, patch: Partial<Omit<NotifyInput, "dedupeKey">>) {
  const apply = (n: Notice): Notice =>
    n.id !== id
      ? n
      : {
          ...n,
          ...patch,
          variant: patch.variant ?? n.variant,
          duration: patch.duration ?? (patch.variant ? DEFAULT_DURATION[patch.variant] : n.duration),
          createdAt: Date.now(),
        };
  set({ queue: state.queue.map(apply), history: state.history.map(apply) });
}

/** แสดงสถานะระหว่างทำงาน แล้วเปลี่ยนเป็นสำเร็จ/ล้มเหลวอัตโนมัติ */
export async function notifyPromise<T>(
  promise: Promise<T>,
  msgs: { loading: string; success: string | ((v: T) => string); error: string | ((e: unknown) => string) }
): Promise<T> {
  const id = notify({ title: msgs.loading, variant: "loading" });
  try {
    const value = await promise;
    updateNotice(id, { title: typeof msgs.success === "function" ? msgs.success(value) : msgs.success, variant: "success" });
    return value;
  } catch (e) {
    updateNotice(id, { title: typeof msgs.error === "function" ? msgs.error(e) : msgs.error, variant: "error" });
    throw e;
  }
}

export function markAllRead() {
  if (!state.history.some((n) => !n.read)) return;
  set({ history: state.history.map((n) => (n.read ? n : { ...n, read: true })) });
}

export function clearHistory() {
  set({ history: [] });
}

/** แถบแบบ docked (เช่นแถบล่างของแอดมิน) ลงทะเบียนตัวเอง → แถบลอยทั่วไปจะหลบ */
export function registerDockedBar() {
  set({ docked: state.docked + 1 });
  return () => set({ docked: Math.max(0, state.docked - 1) });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;
const serverSnapshot: State = { queue: [], history: [], docked: 0 };
const getServerSnapshot = () => serverSnapshot;

export function useNotifications(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
