// Whatever photo the user takes or picks, it is turned into something the server accepts (JPEG, PNG or
// WEBP) before uploading:
//  - big photos (phone / tablet cameras give 4-12 MB) are scaled down: longest side 1800 px, JPEG;
//  - other formats (HEIC from iPhone / iPad, GIF, BMP, AVIF, TIFF ...) are converted to JPEG.
// If the browser really can't read the file, it is sent as it is and the server says it can't take it.
const MAX_SIDE = 1800;
const SKIP_BELOW_BYTES = 1_200_000;
const QUALITY = 0.82;
const KEEP_AS_IS = ['image/jpeg', 'image/png', 'image/webp'];

const isHeic = (file: File) => /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

// HEIC (iPhone / iPad photos) can't be drawn by most browsers; this converts it. The converter is only
// downloaded the first time a HEIC file shows up.
const heicToJpeg = async (file: File): Promise<File> => {
  const { default: heic2any } = await import('heic2any');
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: QUALITY });
  const blob = Array.isArray(out) ? out[0] : out;
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, { type: 'image/jpeg' });
};

const looksLikeImage = (file: File) => file.type.startsWith('image/') || isHeic(file) || /\.(jpe?g|png|webp|gif|bmp|avif|tiff?)$/i.test(file.name);

export const prepareImageForUpload = async (input: File): Promise<File> => {
  if (!looksLikeImage(input)) return input;

  let file = input;
  if (isHeic(file)) {
    try {
      file = await heicToJpeg(file);
    } catch {
      // Safari can read HEIC itself; elsewhere give up and let the server explain.
      file = input;
    }
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const alreadySmall = scale === 1 && file.size <= SKIP_BELOW_BYTES && KEEP_AS_IS.includes(file.type);
    if (alreadySmall) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || (blob.size >= file.size && KEEP_AS_IS.includes(file.type))) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
};
