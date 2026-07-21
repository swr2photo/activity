/**
 * จุดเข้าไอคอนของแอป
 *
 * โครงสร้าง:
 *   icons/AppIcon.tsx   → ขนาดมาตรฐาน + ตัวห่อ Lucide
 *   icons/history.tsx   → ไอคอนหน้าประวัติ (semantic)
 *   icons/index.ts      → re-export รวม
 *
 * เพิ่มหน้าใหม่: สร้างไฟล์ `icons/<page>.tsx` แล้ว export จากที่นี่
 */
export { AppIcon, ICON_SIZE, type AppIconProps, type IconSize } from "./AppIcon";
export { HistoryIcon, type HistoryIconName } from "./history";
