// Phone and tablet cameras take 4-12 MB photos, which are slow to send over mobile data and can be
// refused by the server. Before uploading, big photos are scaled down (longest side 1800 px) and
// saved as a JPEG; that is still sharp enough to read an ID card or compare a design.
const MAX_SIDE = 1800;
const SKIP_BELOW_BYTES = 1_200_000;
const QUALITY = 0.82;
const KEEP_AS_IS = ['image/jpeg', 'image/png', 'image/webp'];

export const prepareImageForUpload = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
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
    // Format the browser can't read (e.g. HEIC on some devices): send as is, the server says if it can't take it.
    return file;
  }
};
