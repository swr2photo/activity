import * as React from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

export type IconMotion =
  | "ring"
  | "spin"
  | "spin-back"
  | "bounce"
  | "rise"
  | "nudge"
  | "pop"
  | "wiggle"
  | "flip"
  | "pulse"
  | "shake"
  | "draw";

type MotionIconProps = LucideProps & {
  icon: LucideIcon;
  /** ท่าเคลื่อนไหว */
  motion: IconMotion;
  /** เล่นวนตลอด (ไม่ต้องรอ hover) */
  loop?: boolean;
};

/**
 * ไอคอนเคลื่อนไหวด้วย CSS ล้วน (ไม่มี JS ต่อเฟรม)
 * เล่นเมื่อ element แม่ที่มี class `motion-trigger` ถูก hover / focus / เปิด / เป็นหน้าปัจจุบัน
 *
 * @example
 * <button className="motion-trigger"><MotionIcon icon={Bell} motion="ring" /></button>
 */
export function MotionIcon({ icon: Icon, motion, loop, className, ...props }: MotionIconProps) {
  return (
    <Icon
      aria-hidden
      className={cn("mi", `mi-${motion}`, loop && "mi-loop", className)}
      {...props}
    />
  );
}

export default MotionIcon;
