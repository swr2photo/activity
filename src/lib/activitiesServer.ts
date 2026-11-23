import { unstable_cache } from "next/cache";
import { getAdminDb } from "@/lib/firebaseAdmin";
import {
  ACTIVITY_LIST_FIELDS,
  type ActivityListItem,
  toActivityListItem,
  toMillis,
} from "@/lib/activitiesList";

const COLLECTION = "activityQRCodes";
const MAX_ITEMS = 200;

const loadActivities = async (): Promise<ActivityListItem[]> => {
  const col = getAdminDb().collection(COLLECTION);
  let snapshot;
  try {
    // เรียงกิจกรรมใหม่ขึ้นก่อน ไม่ให้กิจกรรมล่าสุดหลุดเมื่อเกิน 200 รายการ
    snapshot = await col
      .orderBy("startDateTime", "desc")
      .select(...ACTIVITY_LIST_FIELDS)
      .limit(MAX_ITEMS)
      .get();
  } catch {
    snapshot = await col
      .select(...ACTIVITY_LIST_FIELDS)
      .limit(MAX_ITEMS)
      .get();
  }

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
  ["public-activities-v2"],
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

export type ServerActivityDetail = {
  id: string;
  activityCode: string;
  activityName: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  checkInRadius: number;
  userCode: string;
  startDateTime: number | null;
  endDateTime: number | null;
  isActive: boolean;
  maxParticipants: number;
  currentParticipants: number;
  requiresUniversityLogin: boolean;
  bannerUrl?: string;
  bannerColor?: string;
  bannerTintColor?: string;
  bannerTintOpacity?: number;
  bannerAspect?: string;
  singleUserMode?: boolean;
  closeReason?: string;
  dynamicQREnabled?: boolean;
  onsiteRegistrationPoint?: string;
  sessions?: any[];
  surveyConfig?: any;
  department?: string;
};

function serializeTimestamps(value: any): any {
  if (value == null) return value;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) return value.map(serializeTimestamps);
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = serializeTimestamps(v);
    }
    return out;
  }
  return value;
}

/** Prefetch ข้อมูลกิจกรรมฝั่ง Server สำหรับหน้า /register (ตัด 2-step client waterfall) */
export async function getPublicActivityByCode(
  codeRaw: string
): Promise<ServerActivityDetail | null> {
  const code = (codeRaw || "").trim().toUpperCase();
  if (!code) return null;

  try {
    const db = getAdminDb();
    let snap = await db
      .collection(COLLECTION)
      .where("activityCode", "==", code)
      .limit(1)
      .get();

    if (snap.empty && code !== codeRaw.trim()) {
      snap = await db
        .collection(COLLECTION)
        .where("activityCode", "==", codeRaw.trim())
        .limit(1)
        .get();
    }

    if (snap.empty) return null;
    const d = snap.docs[0];
    const data = d.data() as Record<string, any>;

    return {
      id: d.id,
      activityCode: String(data.activityCode || code),
      activityName: String(data.activityName || code),
      description: String(data.description || ""),
      location: String(data.location || ""),
      latitude: typeof data.latitude === "number" ? data.latitude : 7.007373,
      longitude: typeof data.longitude === "number" ? data.longitude : 100.4925,
      checkInRadius: typeof data.checkInRadius === "number" ? data.checkInRadius : 100,
      userCode: String(data.userCode || ""),
      startDateTime: toMillis(data.startDateTime) ?? null,
      endDateTime: toMillis(data.endDateTime) ?? null,
      isActive: data.isActive !== false,
      maxParticipants: typeof data.maxParticipants === "number" ? data.maxParticipants : 0,
      currentParticipants: typeof data.currentParticipants === "number" ? data.currentParticipants : 0,
      requiresUniversityLogin: Boolean(data.requiresUniversityLogin),
      bannerUrl:
        typeof data.bannerUrl === "string" && !data.bannerUrl.startsWith("data:")
          ? data.bannerUrl
          : undefined,
      bannerColor: typeof data.bannerColor === "string" ? data.bannerColor : undefined,
      bannerTintColor: typeof data.bannerTintColor === "string" ? data.bannerTintColor : undefined,
      bannerTintOpacity:
        typeof data.bannerTintOpacity === "number" ? data.bannerTintOpacity : undefined,
      bannerAspect: typeof data.bannerAspect === "string" ? data.bannerAspect : "cover",
      singleUserMode: Boolean(data.singleUserMode),
      closeReason: typeof data.closeReason === "string" ? data.closeReason : "",
      dynamicQREnabled: Boolean(data.dynamicQREnabled),
      onsiteRegistrationPoint:
        typeof data.onsiteRegistrationPoint === "string" ? data.onsiteRegistrationPoint : "",
      sessions: Array.isArray(data.sessions) ? serializeTimestamps(data.sessions) : undefined,
      surveyConfig: data.surveyConfig ? serializeTimestamps(data.surveyConfig) : undefined,
      department: typeof data.department === "string" ? data.department : undefined,
    };
  } catch (err) {
    console.error("[activitiesServer] getPublicActivityByCode failed:", err);
    return null;
  }
}
