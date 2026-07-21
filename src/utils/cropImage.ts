export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    // blob:/data: ไม่ต้อง CORS; remote URL อาจต้อง anonymous
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      image.setAttribute('crossOrigin', 'anonymous');
    }
    image.src = url;
  });

export type CompressOptions = {
  /** ขอบยาวสุด (px) */
  maxEdge?: number;
  /** JPEG quality 0–1 */
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/webp';
};

const DEFAULT_CROP_PREVIEW: CompressOptions = {
  maxEdge: 1200,
  quality: 0.82,
  mimeType: 'image/jpeg',
};

const DEFAULT_AVATAR_OUTPUT: CompressOptions = {
  maxEdge: 256,
  quality: 0.72,
  mimeType: 'image/jpeg',
};

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (file) => {
        if (file) resolve(file);
        else reject(new Error('Canvas is empty'));
      },
      mimeType,
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(blob);
  });
}

/** ย่อรูปจาก ImageBitmap / HTMLImageElement ลง canvas */
async function downscaleToBlob(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: CompressOptions
): Promise<Blob> {
  const maxEdge = options.maxEdge ?? 1200;
  const quality = options.quality ?? 0.82;
  const mimeType = options.mimeType ?? 'image/jpeg';

  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);

  return canvasToBlob(canvas, mimeType, quality);
}

/**
 * บีบอัดไฟล์ก่อนเข้า Cropper — กันรูปมือถือหลาย MB ค้างตอนเปิดตั้งค่าโปรไฟล์
 */
export async function compressImageFile(
  file: File,
  options: CompressOptions = DEFAULT_CROP_PREVIEW
): Promise<{ dataUrl: string; blob: Blob }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('กรุณาเลือกไฟล์รูปภาพ');
  }

  // จำกัดขนาดไฟล์ต้นทางที่รับ
  const MAX_INPUT_BYTES = 12 * 1024 * 1024;
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('ไฟล์รูปใหญ่เกินไป (สูงสุด 12MB)');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      /* fallback ด้านล่าง */
    }

    let blob: Blob;
    if (bitmap) {
      blob = await downscaleToBlob(bitmap, bitmap.width, bitmap.height, options);
      bitmap.close();
    } else {
      const image = await createImage(objectUrl);
      blob = await downscaleToBlob(image, image.naturalWidth, image.naturalHeight, options);
    }

    const dataUrl = await blobToDataUrl(blob);
    return { dataUrl, blob };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * ครอปแล้วบีบอัดเป็นรูปโปรไฟล์ขนาดเล็ก (ค่าเริ่มต้น 256px JPEG)
 */
export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { width: number; height: number; x: number; y: number },
  options: CompressOptions = DEFAULT_AVATAR_OUTPUT
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  const maxEdge = options.maxEdge ?? 256;
  const quality = options.quality ?? 0.72;
  const mimeType = options.mimeType ?? 'image/jpeg';

  const scale = Math.min(1, maxEdge / Math.max(pixelCrop.width, pixelCrop.height));
  const targetWidth = Math.max(1, Math.round(pixelCrop.width * scale));
  const targetHeight = Math.max(1, Math.round(pixelCrop.height * scale));

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return canvasToBlob(canvas, mimeType, quality);
}
