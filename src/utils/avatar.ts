/** ปรับ URL รูปโปรไฟล์ให้เล็กและโหลดเร็วขึ้น */

export function optimizeAvatarUrl(url?: string | null, size = 96): string | undefined {
  const raw = (url || '').trim();
  if (!raw) return undefined;

  try {
    if (raw.includes('googleusercontent.com')) {
      const base = raw
        .replace(/=s\d+-?[a-z]*$/i, '')
        .replace(/=w\d+-h\d+-?[a-z]*$/i, '');
      return `${base}=s${size}-c`;
    }
  } catch {
    /* keep original */
  }

  return raw;
}

/** ใช้กับ MUI Avatar slotProps.img — โหลดทันที ไม่รอ lazy */
export const avatarImgSlotProps = {
  loading: 'eager' as const,
  decoding: 'async' as const,
  referrerPolicy: 'no-referrer' as const,
  fetchPriority: 'high' as const,
};
