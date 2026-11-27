"use client";

import { useEffect } from "react";
import NotificationStatusBar from "@/components/notifications/NotificationStatusBar";
import { dismiss, notify } from "@/lib/notify";

/** แจ้งสถานะการเชื่อมต่ออินเทอร์เน็ตผ่านแถบสถานะ (ออฟไลน์ค้างไว้จนกว่าจะกลับมา) */
function useConnectivityNotices() {
  useEffect(() => {
    let offlineId: string | null = null;
    const goOffline = () => {
      offlineId = notify({
        title: "ไม่มีการเชื่อมต่ออินเทอร์เน็ต",
        description: "ข้อมูลอาจไม่อัปเดต — ระบบจะลองใหม่อัตโนมัติ",
        variant: "warning",
        duration: 0,
        dedupeKey: "offline",
        source: "system",
      });
    };
    const goOnline = () => {
      if (!offlineId) return;
      dismiss(offlineId);
      offlineId = null;
      notify({ title: "กลับมาออนไลน์แล้ว", variant: "success", source: "system" });
    };
    if (!navigator.onLine) goOffline();
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);
}

/**
 * เดิมเป็น Toaster ของ sonner — ตอนนี้เป็น "แถบสถานะแจ้งเตือน" แบบเบา (ไม่มีไลบรารีเพิ่ม)
 * ชื่อคอมโพเนนต์คงไว้เพื่อไม่ต้องแก้ layout
 */
export default function ToastProvider({ children }: { children: React.ReactNode }) {
  useConnectivityNotices();
  return (
    <>
      {children}
      <NotificationStatusBar mode="floating" />
    </>
  );
}
