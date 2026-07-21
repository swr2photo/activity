import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

/** ขนาดมาตรฐานของไอคอนทั้งแอป — เปิดไฟล์นี้เพื่อปรับ scale รวม */
export const ICON_SIZE = {
  xs: "h-3 w-3", // 12px — ใน badge เล็ก
  sm: "h-[13px] w-[13px]", // meta แถวเวลา/สถานที่
  md: "h-3.5 w-3.5", // 14px — badge / หัวข้อย่อย
  lg: "h-4 w-4", // 16px — ปุ่ม
  xl: "h-5 w-5", // 20px — search / toolbar
  "2xl": "h-[26px] w-[26px]", // thumbnail fallback
} as const;

export type IconSize = keyof typeof ICON_SIZE;

export type AppIconProps = Omit<LucideProps, "ref"> & {
  icon: LucideIcon;
  size?: IconSize;
};

/**
 * ตัวห่อ Lucide ให้ขนาด/stroke เดียวกันทั้งโปรเจกต์
 * ใช้ผ่าน semantic icons ในไฟล์ domain (เช่น history.tsx) จะสะดวกกว่า
 */
export function AppIcon({
  icon: Icon,
  size = "md",
  className,
  strokeWidth = 2,
  ...props
}: AppIconProps) {
  return (
    <Icon
      aria-hidden
      strokeWidth={strokeWidth}
      className={cn("shrink-0", ICON_SIZE[size], className)}
      {...props}
    />
  );
}
