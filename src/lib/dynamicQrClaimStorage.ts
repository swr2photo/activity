import { dynamicQrClaimStorageKey } from './dynamicQrConstants';

export type StoredDynamicQrClaim = {
  dt: string;
  claim: string;
  expiresAt: number;
};

export function readDynamicQrClaim(activityCode: string): StoredDynamicQrClaim | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(dynamicQrClaimStorageKey(activityCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDynamicQrClaim;
    if (!parsed?.dt || !parsed?.claim || !parsed?.expiresAt) return null;
    if (Date.now() > Number(parsed.expiresAt)) {
      sessionStorage.removeItem(dynamicQrClaimStorageKey(activityCode));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeDynamicQrClaim(
  activityCode: string,
  payload: StoredDynamicQrClaim
): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(dynamicQrClaimStorageKey(activityCode), JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function clearDynamicQrClaim(activityCode: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(dynamicQrClaimStorageKey(activityCode));
  } catch {
    // ignore
  }
}
