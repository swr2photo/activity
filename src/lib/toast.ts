/**
 * API เดิม (notistack/sonner) — ตอนนี้ส่งไปที่ "แถบสถานะแจ้งเตือน" แทน toast ที่เด้งขึ้น
 * ใช้ต่อได้เหมือนเดิม: enqueueSnackbar(msg, { variant: 'success' })
 */
import { dismiss, notify, type NoticeVariant } from "@/lib/notify";

export type SnackbarVariant = "default" | "success" | "error" | "warning" | "info";

export type EnqueueOptions = {
  variant?: SnackbarVariant;
  autoHideDuration?: number;
  preventDuplicate?: boolean;
  /** รายละเอียดบรรทัดที่สอง (ไม่บังคับ) */
  description?: string;
};

export function enqueueSnackbar(message: string, options?: EnqueueOptions) {
  return notify({
    title: message,
    description: options?.description,
    variant: (options?.variant ?? "default") as NoticeVariant,
    duration: options?.autoHideDuration,
    dedupeKey: options?.preventDuplicate ? message : undefined,
  });
}

export function closeSnackbar(id?: string | number) {
  dismiss(id === undefined ? undefined : String(id));
}

/** Drop-in for `const { enqueueSnackbar } = useSnackbar()` */
export function useSnackbar() {
  return { enqueueSnackbar, closeSnackbar };
}
