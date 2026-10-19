import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, MessageCircle, Printer } from 'lucide-react';
import { apiClient, resolvePhotoUrl } from '../../lib/api-client';
import { downloadBlob, elementToPdf, whatsappNumber } from '../../lib/pdf';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { FormAlert } from '../ui/form-alert';
import { LoadingState } from '../ui/loading-state';
import { formatDate } from '../../lib/date';
import type { Challan } from './delivery-constants';
import { useLotColorPhotos } from '../../hooks/use-lot-color-photos';
import { ColourThumb } from '../common/ColourThumb';
import { cellKey, DELIVERIES_QUERY_KEY } from './delivery-constants';

interface DeliveryChallanViewProps {
  deliveryId: string;
  onBack: () => void;
}

const formatQty = (value: number) => value.toLocaleString('en-IN');

// Printable delivery challan: company header, party, lot and the colour × size table.
export const DeliveryChallanView = ({ deliveryId, onBack }: DeliveryChallanViewProps) => {
  const { data, isLoading } = useQuery({
    queryKey: [...DELIVERIES_QUERY_KEY, 'challan', deliveryId],
    queryFn: () => apiClient.get<Challan>(`/deliveries/${deliveryId}/challan`),
  });

  // Hooks first: called before the loading return, or the screen breaks when the data arrives.
  const colorPhotos = useLotColorPhotos(data?.delivery.cuttingEntryId);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'pdf' | 'share' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !data) return <LoadingState variant="page" />;
  const { delivery, company } = data;
  const fileName = `Challan-${delivery.challanNumber}-Lot-${delivery.cuttingEntry.lotNumber}.pdf`;
  const shareText = `Delivery Challan No. ${delivery.challanNumber} — Lot ${delivery.cuttingEntry.lotNumber} (${delivery.cuttingEntry.item.itemName}), ${delivery.totalQuantity} pcs, ${formatDate(delivery.date)}. ${company?.name ?? ''}`.trim();

  const makePdf = async () => {
    if (!sheetRef.current) throw new Error('Challan not ready');
    return elementToPdf(sheetRef.current);
  };

  const download = async () => {
    setBusy('pdf');
    setError(null);
    try {
      downloadBlob(await makePdf(), fileName);
    } catch {
      setError('Could not make the PDF. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  // Phone / tablet: the share sheet opens with the PDF, pick WhatsApp. Computer: the PDF downloads and
  // WhatsApp opens with the party's chat, to attach it there.
  const shareWhatsapp = async () => {
    setBusy('share');
    setError(null);
    try {
      const file = new File([await makePdf()], fileName, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: fileName, text: shareText });
        } catch (err) {
          if ((err as Error).name !== 'AbortError') throw err;
        }
        return;
      }
      downloadBlob(file, fileName);
      const to = whatsappNumber(delivery.party.mobile);
      window.open(`https://wa.me/${to}?text=${encodeURIComponent(`${shareText}\n(PDF attached)`)}`, '_blank', 'noopener');
    } catch {
      setError('Could not share the challan. Use Download PDF and send it from WhatsApp.');
    } finally {
      setBusy(null);
    }
  };

  const sizes = [...new Map(delivery.quantities.map((q) => [q.sizeId, q.size])).values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  const colors = [...new Map(delivery.quantities.map((q) => [q.colorId, q.color])).values()];
  const qty = new Map(delivery.quantities.map((q) => [cellKey(q.colorId, q.sizeId), q.quantity]));
  const cell = (colorId: string, sizeId: string) => qty.get(cellKey(colorId, sizeId)) ?? 0;
  const sizeTotal = (sizeId: string) => colors.reduce((t, c) => t + cell(c.id, sizeId), 0);
  const colorTotal = (colorId: string) => sizes.reduce((t, s) => t + cell(colorId, s.id), 0);
  const photo = resolvePhotoUrl(delivery.cuttingEntry.item.photoUrl);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft />
          Back to Deliveries
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer />
            Print
          </Button>
          <Button variant="outline" onClick={() => void download()} loading={busy === 'pdf'} disabled={busy !== null}>
            <Download />
            Download PDF
          </Button>
          <Button onClick={() => void shareWhatsapp()} loading={busy === 'share'} disabled={busy !== null} className="bg-emerald-600 text-white hover:bg-emerald-700">
            <MessageCircle />
            WhatsApp
          </Button>
        </div>
      </div>
      {error ? (
        <div className="no-print">
          <FormAlert tone="error">{error}</FormAlert>
        </div>
      ) : null}

      <Card ref={sheetRef} className="print-area mx-auto max-w-3xl space-y-4 bg-card p-4 text-sm sm:p-6">
        <header className="space-y-0.5 border-b border-border pb-3 text-center">
          <h2 className="text-xl font-bold">{company?.name ?? 'Company'}</h2>
          {company?.addressLine1 ? <p className="text-xs">{company.addressLine1}</p> : null}
          <p className="text-xs">
            {company?.phone ? `Mobile: ${company.phone}` : null}
            {company?.phone && company?.gstNumber ? ' · ' : null}
            {company?.gstNumber ? `GSTIN: ${company.gstNumber}` : null}
          </p>
          <p className="pt-1.5 text-sm font-semibold uppercase tracking-widest">Delivery Challan</p>
        </header>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">To</p>
            <p className="text-base font-semibold">{delivery.party.name}</p>
            {delivery.party.address ? <p className="text-xs">{delivery.party.address}</p> : null}
            {delivery.party.mobile ? <p className="text-xs">Mobile: {delivery.party.mobile}</p> : null}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-right">
            <dt className="text-muted-foreground">Challan No.</dt>
            <dd className="numeric font-semibold">{delivery.challanNumber}</dd>
            {delivery.billNumber ? (
              <>
                <dt className="text-muted-foreground">Bill No.</dt>
                <dd className="numeric font-semibold">{delivery.billNumber}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Date</dt>
            <dd className="numeric">
              {formatDate(delivery.date)}
              {delivery.entryTime ? ` ${delivery.entryTime}` : ''}
            </dd>
            <dt className="text-muted-foreground">Lot No.</dt>
            <dd className="numeric font-semibold">{delivery.cuttingEntry.lotNumber}</dd>
            <dt className="text-muted-foreground">Design</dt>
            <dd className="font-medium">{delivery.cuttingEntry.item.itemName}</dd>
          </dl>
        </div>

        <div className="flex items-start gap-4">
          {photo ? (
            <img src={photo} alt={`Design ${delivery.cuttingEntry.item.itemName}`} className="size-24 shrink-0 rounded-md border border-border object-cover" />
          ) : null}
          <div className="min-w-0 flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-foreground/70">
                  <th className="px-2 py-1.5 text-left">Colour</th>
                  {sizes.map((s) => (
                    <th key={s.id} className="px-2 py-1.5 text-center">
                      {s.name}
                      {s.detail ? <span className="block text-2xs font-normal">{s.detail}</span> : null}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {colors.map((c) => (
                  <tr key={c.id} className="border-b border-border">
                    <td className="px-2 py-1.5 font-medium">
                      <span className="flex items-center gap-2">
                        <ColourThumb photoUrl={colorPhotos[c.id]} name={c.name} size={28} zoom={false} />
                        {c.name}
                      </span>
                    </td>
                    {sizes.map((s) => (
                      <td key={s.id} className="numeric px-2 py-1.5 text-center">
                        {cell(c.id, s.id) ? formatQty(cell(c.id, s.id)) : '—'}
                      </td>
                    ))}
                    <td className="numeric px-2 py-1.5 text-right font-semibold">{formatQty(colorTotal(c.id))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground/70 font-bold">
                  <td className="px-2 py-1.5">Total</td>
                  {sizes.map((s) => (
                    <td key={s.id} className="numeric px-2 py-1.5 text-center">
                      {formatQty(sizeTotal(s.id))}
                    </td>
                  ))}
                  <td className="numeric px-2 py-1.5 text-right">{formatQty(delivery.totalQuantity)} pcs</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {delivery.remarks ? (
          <p className="text-xs">
            <span className="font-semibold">Remarks:</span> {delivery.remarks}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-8 pt-12 text-center text-xs">
          <div className="border-t border-foreground/60 pt-1.5">Receiver&apos;s Signature</div>
          <div className="border-t border-foreground/60 pt-1.5">For {company?.name ?? 'Company'}</div>
        </div>
      </Card>
    </div>
  );
};
