import ActivitiesExplorer from "@/components/ActivitiesExplorer";
import { getInitialActivities } from "@/lib/activitiesServer";

/** Service account มีเฉพาะ runtime; ข้อมูลด้านในยัง cache 60 วินาที */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialActivities = await getInitialActivities();
  return <ActivitiesExplorer initialActivities={initialActivities} />;
}
