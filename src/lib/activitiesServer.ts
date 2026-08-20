import { unstable_cache } from "next/cache";
import { getAdminDb } from "@/lib/firebaseAdmin";
import {
  ACTIVITY_LIST_FIELDS,
  type ActivityListItem,
  toActivityListItem,
} from "@/lib/activitiesList";

const COLLECTION = "activityQRCodes";
const MAX_ITEMS = 200;

const loadActivities = async (): Promise<ActivityListItem[]> => {
  const snapshot = await getAdminDb()
    .collection(COLLECTION)
    .select(...ACTIVITY_LIST_FIELDS)
    .limit(MAX_ITEMS)
    .get();

  return snapshot.docs.flatMap((document) => {
    const item = toActivityListItem(
      document.id,
      document.data() as Record<string, unknown>
    );
    return item ? [item] : [];
  });
};

export const getCachedActivities = unstable_cache(
  loadActivities,
  ["public-activities-v1"],
  { revalidate: 60 }
);

export async function getInitialActivities(): Promise<
  ActivityListItem[] | null
> {
  try {
    return await getCachedActivities();
  } catch (error) {
    console.error("[activities] initial load failed", error);
    return null;
  }
}
