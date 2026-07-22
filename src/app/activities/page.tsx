import type { Metadata } from "next";
import ActivitiesClient from "../page";

export const metadata: Metadata = {
  title: "กิจกรรมทั้งหมด | คณะวิทยาศาสตร์ ม.อ.",
  description: "ค้นหาและเรียกดูกิจกรรมที่เปิดรับสมัครทั้งหมด",
};

export default function ActivitiesPage() {
  return <ActivitiesClient />;
}
