/**
 * Activity QR poster composer (canvas)
 * Layout: full-bleed hero + scan gate content zone
 */

import dayjs from 'dayjs';
import type { Activity } from '@/lib/adminFirebase';
import { DEPARTMENT_LABELS } from '@/types/admin';

export type PosterVariant = 'square' | 'a4';

export type ActivityPosterInput = Pick<
  Activity,
  'activityCode' | 'activityName' | 'department' | 'startDateTime' | 'endDateTime' | 'location'
> & {
  bannerUrl?: string;
  bannerColor?: string;
  bannerTintColor?: string;
  bannerTintOpacity?: number;
};

const POSTER_SIZE: Record<PosterVariant, { w: number; h: number }> = {
  square: { w: 1080, h: 1350 },
  a4: { w: 1240, h: 1754 },
};

/** Ink / stone / citrus — campus event, not purple/cream defaults */
const THEME = {
  ink: '#071A24',
  inkSoft: '#123040',
  stone: '#EDE8DE',
  stoneDeep: '#D9D1C3',
  paper: '#F8F4EC',
  citrus: '#D6F25C',
  citrusDeep: '#A8C92E',
  white: '#FFFFFF',
  muted: '#5C6B73',
  line: 'rgba(7, 26, 36, 0.12)',
};

const FONT =
  'Geist, "Be Vietnam Pro", "Noto Sans Thai", Sarabun, "Segoe UI", system-ui, sans-serif';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const deptLabelOf = (dept: string | undefined | null) =>
  (DEPARTMENT_LABELS as Record<string, string>)[String(dept ?? '')] ?? String(dept ?? '');

const resolveSolidColor = (input?: string, fallback = THEME.inkSoft): string => {
  if (!input) return fallback;
  const s = String(input).trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
  if (/^rgba?\(/i.test(s)) return s;
  const hex = s.match(/#([0-9a-f]{3,8})\b/i);
  if (hex) return `#${hex[1]}`;
  const rgb = s.match(/rgba?\([^)]+\)/i);
  if (rgb) return rgb[0];
  return fallback;
};

const fmtRange = (start?: Date | null, end?: Date | null) => {
  const s = start ? dayjs(start) : null;
  const e = end ? dayjs(end) : null;
  const sOk = s?.isValid();
  const eOk = e?.isValid();
  if (sOk && eOk) {
    if (s!.isSame(e!, 'day')) {
      return `${s!.format('D MMM YYYY')} · ${s!.format('HH:mm')}–${e!.format('HH:mm')}`;
    }
    return `${s!.format('D MMM YYYY HH:mm')} – ${e!.format('D MMM YYYY HH:mm')}`;
  }
  if (sOk) return s!.format('D MMM YYYY HH:mm');
  if (eOk) return e!.format('D MMM YYYY HH:mm');
  return '';
};

const loadImageSafe = async (src: string, timeoutMs = 12000): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    try {
      const img = new Image();
      if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        resolve(ok && img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null);
      };
      const t = setTimeout(() => finish(false), timeoutMs);
      img.onload = () => {
        clearTimeout(t);
        finish(true);
      };
      img.onerror = () => {
        clearTimeout(t);
        finish(false);
      };
      img.src = src;
    } catch {
      resolve(null);
    }
  });

const drawCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dWidth: number,
  dHeight: number
) => {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const ir = iw / ih;
  const tr = dWidth / dHeight;
  let sx = 0;
  let sy = 0;
  let sw = iw;
  let sh = ih;
  if (ir > tr) {
    const newW = ih * tr;
    sx = Math.round((iw - newW) / 2);
    sw = Math.round(newW);
  } else {
    const newH = iw / tr;
    sy = Math.round((ih - newH) / 2);
    sh = Math.round(newH);
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dWidth, dHeight);
};

/** Thai-friendly wrap: words first, then grapheme chunks for long tokens */
const measureLines = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 5
): string[] => {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const tokens = raw.split(/(\s+)/).filter((t) => t.length > 0);
  const lines: string[] = [];
  let line = '';

  const pushLine = (next: string) => {
    if (lines.length >= maxLines) return;
    lines.push(next);
  };

  const splitToken = (token: string): string[] => {
    if (ctx.measureText(token).width <= maxWidth) return [token];
    const parts: string[] = [];
    let chunk = '';
    for (const ch of Array.from(token)) {
      const test = chunk + ch;
      if (ctx.measureText(test).width > maxWidth && chunk) {
        parts.push(chunk);
        chunk = ch;
      } else {
        chunk = test;
      }
    }
    if (chunk) parts.push(chunk);
    return parts;
  };

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      if (line) line += token;
      continue;
    }
    for (const piece of splitToken(token)) {
      const test = line + piece;
      if (line && ctx.measureText(test).width > maxWidth) {
        pushLine(line.trimEnd());
        line = piece;
        if (lines.length >= maxLines) break;
      } else {
        line = test;
      }
    }
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) pushLine(line.trimEnd());
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (raw.length > last.length + 2) {
      let ell = last;
      while (ell.length > 1 && ctx.measureText(`${ell}…`).width > maxWidth) {
        ell = ell.slice(0, -1);
      }
      lines[maxLines - 1] = `${ell}…`;
    }
  }
  return lines.filter(Boolean);
};

const fillLines = (
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  align: CanvasTextAlign = 'left'
) => {
  ctx.textAlign = align;
  let yy = y;
  for (const line of lines) {
    ctx.fillText(line, x, yy);
    yy += lineHeight;
  }
  ctx.textAlign = 'left';
  return yy;
};

/** Viewfinder corner marks around QR */
const drawViewfinder = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  arm: number,
  stroke: number,
  color: string
) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = stroke;
  ctx.lineCap = 'square';
  const ends = [
    [x, y, 1, 1],
    [x + size, y, -1, 1],
    [x, y + size, 1, -1],
    [x + size, y + size, -1, -1],
  ] as const;
  for (const [cx, cy, dx, dy] of ends) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * arm);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * arm, cy);
    ctx.stroke();
  }
};

const drawStoneTexture = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // soft diagonal hatch
  ctx.strokeStyle = 'rgba(7, 26, 36, 0.045)';
  ctx.lineWidth = 1;
  const step = 28;
  for (let i = -h; i < w + h; i += step) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + h, y + h);
    ctx.stroke();
  }

  // sparse dots
  ctx.fillStyle = 'rgba(7, 26, 36, 0.06)';
  for (let i = 0; i < 48; i++) {
    const px = x + ((i * 97) % w);
    const py = y + ((i * 53) % h);
    ctx.beginPath();
    ctx.arc(px, py, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const drawHeroBackdrop = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  accent: string
) => {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, THEME.ink);
  g.addColorStop(0.55, THEME.inkSoft);
  g.addColorStop(1, resolveSolidColor(accent, THEME.inkSoft));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // orbital arcs (science motif)
  ctx.strokeStyle = 'rgba(214, 242, 92, 0.18)';
  ctx.lineWidth = Math.max(2, w * 0.004);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(w * 0.82, h * 0.18, w * (0.28 + i * 0.1), h * (0.22 + i * 0.08), -0.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = THEME.citrus;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(w * 0.12, h * 0.78, w * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
};

const ensureFonts = async () => {
  try {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]);
    }
  } catch {
    /* ignore */
  }
};

const generateQrPng = async (text: string, size = 1024) => {
  const QR = await import('qrcode');
  return QR.toDataURL(text, {
    margin: 1,
    width: size,
    errorCorrectionLevel: 'M',
    color: { dark: THEME.ink, light: THEME.white },
  });
};

export type BuildPosterOptions = {
  shortUrl: string;
  variant?: PosterVariant;
  brandHostLabel?: string;
};

/**
 * Compose a print-ready poster canvas.
 * Hero is full-bleed; QR sits in a stone “scan gate” with viewfinder marks.
 */
export async function buildActivityPosterCanvas(
  activity: ActivityPosterInput,
  options: BuildPosterOptions
): Promise<HTMLCanvasElement> {
  await ensureFonts();

  const variant = options.variant || 'square';
  const size = POSTER_SIZE[variant];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d')!;

  const pad = Math.round(size.w * 0.055);
  const heroH = Math.round(size.h * 0.46);
  const accent = resolveSolidColor(activity.bannerColor || activity.bannerTintColor, THEME.inkSoft);
  const tintColor = activity.bannerTintColor ? resolveSolidColor(activity.bannerTintColor, accent) : accent;
  const tintOpacity =
    typeof activity.bannerTintOpacity === 'number' ? clamp(activity.bannerTintOpacity, 0, 1) : 0.35;

  // ---- Hero (full-bleed) ----
  let drewImage = false;
  if (activity.bannerUrl) {
    const img = await loadImageSafe(activity.bannerUrl);
    if (img) {
      drawCover(ctx, img, 0, 0, size.w, heroH);
      drewImage = true;
      ctx.fillStyle = tintColor;
      ctx.globalAlpha = tintOpacity;
      ctx.fillRect(0, 0, size.w, heroH);
      ctx.globalAlpha = 1;
    }
  }
  if (!drewImage) {
    drawHeroBackdrop(ctx, size.w, heroH, accent);
  }

  // bottom vignette for title legibility
  const vig = ctx.createLinearGradient(0, heroH * 0.35, 0, heroH);
  vig.addColorStop(0, 'rgba(7, 26, 36, 0)');
  vig.addColorStop(0.45, 'rgba(7, 26, 36, 0.35)');
  vig.addColorStop(1, 'rgba(7, 26, 36, 0.92)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, size.w, heroH);

  // citrus accent bar at hero bottom edge
  ctx.fillStyle = THEME.citrus;
  ctx.fillRect(0, heroH - Math.round(size.w * 0.012), size.w, Math.round(size.w * 0.012));

  // dept label
  const dept = deptLabelOf(activity.department);
  const deptSize = Math.round(size.w * 0.028);
  ctx.font = `600 ${deptSize}px ${FONT}`;
  const deptW = Math.ceil(ctx.measureText(dept.toUpperCase()).width) + Math.round(size.w * 0.04);
  const deptH = Math.round(size.w * 0.048);
  const deptX = pad;
  const deptY = pad;
  ctx.fillStyle = 'rgba(7, 26, 36, 0.55)';
  ctx.fillRect(deptX, deptY, deptW, deptH);
  ctx.fillStyle = THEME.citrus;
  ctx.fillRect(deptX, deptY, Math.round(size.w * 0.01), deptH);
  ctx.fillStyle = THEME.white;
  ctx.textBaseline = 'middle';
  ctx.fillText(dept.toUpperCase(), deptX + Math.round(size.w * 0.022), deptY + deptH / 2);

  // title
  const titleSize = Math.round(size.w * 0.072);
  const titleLh = Math.round(titleSize * 1.12);
  ctx.font = `800 ${titleSize}px ${FONT}`;
  ctx.fillStyle = THEME.white;
  ctx.textBaseline = 'alphabetic';
  const titleMaxW = size.w - pad * 2;
  const titleLines = measureLines(ctx, activity.activityName || 'กิจกรรม', titleMaxW, 3);
  const titleBlockH = titleLines.length * titleLh;
  const dateStr = fmtRange(activity.startDateTime as Date | undefined, activity.endDateTime as Date | undefined);
  const dateSize = Math.round(size.w * 0.032);
  const titleBottom = heroH - pad - (dateStr ? Math.round(size.w * 0.055) : 0);
  const titleStartY = titleBottom - titleBlockH + titleSize * 0.85;
  fillLines(ctx, titleLines, pad, titleStartY, titleLh, 'left');

  if (dateStr) {
    ctx.fillStyle = 'rgba(248, 244, 236, 0.82)';
    ctx.font = `500 ${dateSize}px ${FONT}`;
    ctx.fillText(dateStr, pad, heroH - pad * 0.85);
  }

  // ---- Content zone ----
  const contentY = heroH;
  const contentH = size.h - heroH;
  ctx.fillStyle = THEME.stone;
  ctx.fillRect(0, contentY, size.w, contentH);
  drawStoneTexture(ctx, 0, contentY, size.w, contentH);

  // left ink rail
  ctx.fillStyle = THEME.ink;
  ctx.fillRect(0, contentY, Math.round(size.w * 0.018), contentH);

  // QR plate
  const qrData = await generateQrPng(options.shortUrl, 1024);
  const qrImg = await loadImageSafe(qrData);
  const platePad = Math.round(size.w * 0.035);
  const qrSize = Math.min(Math.round(size.w * 0.52), Math.round(contentH * 0.58));
  const plateSize = qrSize + platePad * 2;
  const plateX = Math.round((size.w - plateSize) / 2);
  const plateY = contentY + Math.round(contentH * 0.08);

  // plate shadow (flat offset, not soft glow)
  ctx.fillStyle = 'rgba(7, 26, 36, 0.14)';
  ctx.fillRect(plateX + Math.round(size.w * 0.012), plateY + Math.round(size.w * 0.012), plateSize, plateSize);

  ctx.fillStyle = THEME.paper;
  ctx.fillRect(plateX, plateY, plateSize, plateSize);

  // inner ink frame
  ctx.strokeStyle = THEME.ink;
  ctx.lineWidth = Math.max(2, Math.round(size.w * 0.005));
  ctx.strokeRect(
    plateX + Math.round(platePad * 0.35),
    plateY + Math.round(platePad * 0.35),
    plateSize - Math.round(platePad * 0.7),
    plateSize - Math.round(platePad * 0.7)
  );

  const qrX = plateX + platePad;
  const qrY = plateY + platePad;
  if (qrImg) {
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  } else {
    ctx.fillStyle = THEME.stoneDeep;
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
    ctx.fillStyle = THEME.muted;
    ctx.font = `600 ${Math.round(size.w * 0.032)}px ${FONT}`;
    ctx.fillText('QR โหลดไม่สำเร็จ', qrX + 16, qrY + qrSize / 2);
  }

  drawViewfinder(
    ctx,
    qrX - Math.round(size.w * 0.012),
    qrY - Math.round(size.w * 0.012),
    qrSize + Math.round(size.w * 0.024),
    Math.round(size.w * 0.04),
    Math.max(3, Math.round(size.w * 0.007)),
    THEME.ink
  );

  // citrus corner ticks on viewfinder outer
  drawViewfinder(
    ctx,
    plateX + Math.round(size.w * 0.01),
    plateY + Math.round(size.w * 0.01),
    plateSize - Math.round(size.w * 0.02),
    Math.round(size.w * 0.028),
    Math.max(2, Math.round(size.w * 0.004)),
    THEME.citrusDeep
  );

  // SCAN label + code
  let metaY = plateY + plateSize + Math.round(size.w * 0.055);
  const labelSize = Math.round(size.w * 0.026);
  ctx.font = `700 ${labelSize}px ${FONT}`;
  ctx.fillStyle = THEME.ink;
  ctx.textAlign = 'center';
  ctx.fillText('สแกนเพื่อลงทะเบียน', size.w / 2, metaY);

  // accent underline under label
  const labelW = ctx.measureText('สแกนเพื่อลงทะเบียน').width;
  ctx.fillStyle = THEME.citrus;
  ctx.fillRect(
    size.w / 2 - labelW / 2,
    metaY + Math.round(size.w * 0.012),
    labelW,
    Math.round(size.w * 0.006)
  );

  metaY += Math.round(size.w * 0.055);
  const codeSize = Math.round(size.w * 0.048);
  ctx.font = `800 ${codeSize}px ${FONT}`;
  ctx.fillStyle = THEME.ink;
  ctx.fillText(String(activity.activityCode || '').toUpperCase(), size.w / 2, metaY);

  // location
  if (activity.location) {
    metaY += Math.round(size.w * 0.045);
    ctx.font = `500 ${Math.round(size.w * 0.028)}px ${FONT}`;
    ctx.fillStyle = THEME.muted;
    const locLines = measureLines(ctx, String(activity.location), size.w - pad * 2, 2);
    fillLines(ctx, locLines, size.w / 2, metaY, Math.round(size.w * 0.038), 'center');
  }

  // footer strip
  const footH = Math.round(size.w * 0.07);
  const footY = size.h - footH;
  ctx.fillStyle = THEME.ink;
  ctx.fillRect(0, footY, size.w, footH);
  ctx.fillStyle = THEME.citrus;
  ctx.fillRect(0, footY, Math.round(size.w * 0.02), footH);

  ctx.fillStyle = THEME.paper;
  ctx.font = `500 ${Math.round(size.w * 0.024)}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let footLabel = 'ระบบลงทะเบียนกิจกรรม';
  try {
    const u = new URL(options.shortUrl);
    footLabel = options.brandHostLabel || `${u.host}${u.pathname}`;
  } catch {
    if (options.brandHostLabel) footLabel = options.brandHostLabel;
  }
  ctx.fillText(footLabel, pad, footY + footH / 2);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(248, 244, 236, 0.55)';
  ctx.fillText('SCAN', size.w - pad, footY + footH / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  return canvas;
}

export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string) {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
