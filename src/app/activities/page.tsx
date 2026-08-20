import type { Metadata } from "next";
import ActivitiesExplorer from "@/components/ActivitiesExplorer";
import { getInitialActivities } from "@/lib/activitiesServer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "กิจกรรมทั้งหมด | คณะวิทยาศาสตร์ ม.อ.",
  description: "ค้นหาและเรียกดูกิจกรรมที่เปิดรับสมัครทั้งหมด",
};

export default async function ActivitiesPage() {
  const initialActivities = await getInitialActivities();
  return <ActivitiesExplorer initialActivities={initialActivities} />;
}
