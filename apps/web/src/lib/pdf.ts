// Turns a block of the page (a challan) into an A4 PDF in the browser. The two libraries are big, so
// they load only when someone downloads or shares.
export const elementToPdf = async (element: HTMLElement): Promise<Blob> => {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    // Always the light look on paper, even when the app is in dark mode.
    onclone: (doc) => doc.documentElement.classList.remove('dark'),
  });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const margin = 8;
  const pageW = pdf.internal.pageSize.getWidth() - margin * 2;
  const pageH = pdf.internal.pageSize.getHeight() - margin * 2;
  const imgH = (canvas.height * pageW) / canvas.width;
  const image = canvas.toDataURL('image/jpeg', 0.92);

  // Taller than one page: the same image is placed again, shifted up, on each next page.
  let offset = 0;
  pdf.addImage(image, 'JPEG', margin, margin, pageW, imgH);
  while (imgH - offset > pageH + 0.5) {
    offset += pageH;
    pdf.addPage();
    pdf.addImage(image, 'JPEG', margin, margin - offset, pageW, imgH);
  }
  return pdf.output('blob');
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

// 10-digit Indian numbers get 91 in front, for wa.me links.
export const whatsappNumber = (raw: string | null | undefined) => {
  let digits = (raw ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 11 ? digits : '';
};
