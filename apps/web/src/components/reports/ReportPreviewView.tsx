import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer, Download, ImageOff } from 'lucide-react';
import { apiClient, resolvePhotoUrl } from '../../lib/api-client';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { LoadingState } from '../ui/loading-state';
import { DatePicker } from '../ui/date-picker';
import { REPORT_TYPES, formatMonthKey, type ReportKey } from './report-constants';
import type { ProductionEntry } from '../production-entries/production-entry-constants';
import type { LedgerRow } from '../payments/payment-constants';
import { formatDate, fileDateStamp } from '../../lib/date';

interface OrganizationDto {
  name: string;
}

interface KarigarSummaryRow {
  karigarId: string;
  karigarName: string;
  karigarCode: string;
  totalQuantity: number;
  totalAmount: number;
}

interface ItemSummaryRow {
  itemId: string;
  styleNo: string;
  itemName: string;
  totalQuantity: number;
  totalAmount: number;
}

interface MonthlySummaryRow {
  month: string;
  totalQuantity: number;
  totalAmount: number;
}

const toCsvValue = (value: string) => `"${value.replace(/"/g, '""')}"`;
const downloadCsv = (filename: string, header: string[], rows: string[][]) => {
  const csv = [header, ...rows].map((r) => r.map(toCsvValue).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

interface ReportPreviewViewProps {
  reportKey: ReportKey;
  onBack: () => void;
}

export const ReportPreviewView = ({ reportKey, onBack }: ReportPreviewViewProps) => {
  const definition = REPORT_TYPES.find((r) => r.key === reportKey)!;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const dateParams = { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };

  const { data: organization } = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiClient.get<OrganizationDto>('/organization'),
    retry: false,
  });

  const entriesQuery = useQuery({
    queryKey: ['production-entries', 'report', reportKey, dateParams],
    queryFn: () => apiClient.list<ProductionEntry>('/production-entries', { page: 1, pageSize: 1000, ...dateParams }),
    enabled: reportKey === 'daily-production' || reportKey === 'photo-report',
  });

  const karigarSummaryQuery = useQuery({
    queryKey: ['reports', 'karigar-summary', dateParams],
    queryFn: () => apiClient.get<KarigarSummaryRow[]>('/reports/karigar-summary', dateParams),
    enabled: reportKey === 'karigar-summary',
  });

  const itemSummaryQuery = useQuery({
    queryKey: ['reports', 'item-summary', dateParams],
    queryFn: () => apiClient.get<ItemSummaryRow[]>('/reports/item-summary', dateParams),
    enabled: reportKey === 'item-summary',
  });

  const monthlySummaryQuery = useQuery({
    queryKey: ['reports', 'monthly-summary', dateParams],
    queryFn: () => apiClient.get<MonthlySummaryRow[]>('/reports/monthly-summary', dateParams),
    enabled: reportKey === 'monthly-summary',
  });

  const ledgerQuery = useQuery({
    queryKey: ['payments', 'ledger'],
    queryFn: () => apiClient.get<LedgerRow[]>('/payments/ledger'),
    enabled: reportKey === 'payment-report',
  });

  const isLoading =
    entriesQuery.isLoading ||
    karigarSummaryQuery.isLoading ||
    itemSummaryQuery.isLoading ||
    monthlySummaryQuery.isLoading ||
    ledgerQuery.isLoading;

  const handleExport = () => {
    const today = fileDateStamp();
    if (reportKey === 'daily-production' || reportKey === 'photo-report') {
      const rows = (entriesQuery.data?.items ?? [])
        .filter((e) => reportKey === 'daily-production' || e.photoUrl)
        .map((e) => [
          formatDate(e.date),
          e.carrier.fullName,
          e.item.styleNo,
          e.item.itemName,
          String(e.carrierQuantity),
          Number(e.carrierRate).toFixed(2),
          Number(e.carrierTotal).toFixed(2),
        ]);
      downloadCsv(`${reportKey}-${today}.csv`, ['Date', 'Karigar', 'Style', 'Item', 'Qty', 'Rate', 'Amount'], rows);
    } else if (reportKey === 'karigar-summary') {
      const rows = (karigarSummaryQuery.data ?? []).map((r) => [
        r.karigarName,
        r.karigarCode,
        String(r.totalQuantity),
        r.totalAmount.toFixed(2),
      ]);
      downloadCsv(`karigar-summary-${today}.csv`, ['Karigar', 'Code', 'Total Qty', 'Total Amount'], rows);
    } else if (reportKey === 'item-summary') {
      const rows = (itemSummaryQuery.data ?? []).map((r) => [
        r.styleNo,
        r.itemName,
        String(r.totalQuantity),
        r.totalAmount.toFixed(2),
      ]);
      downloadCsv(`item-summary-${today}.csv`, ['Style No', 'Item Name', 'Total Qty', 'Total Amount'], rows);
    } else if (reportKey === 'monthly-summary') {
      const rows = (monthlySummaryQuery.data ?? []).map((r) => [
        formatMonthKey(r.month),
        String(r.totalQuantity),
        r.totalAmount.toFixed(2),
      ]);
      downloadCsv(`monthly-summary-${today}.csv`, ['Month', 'Total Qty', 'Total Amount'], rows);
    } else if (reportKey === 'payment-report') {
      const rows = (ledgerQuery.data ?? []).map((r) => [
        r.karigarName,
        r.totalAmount.toFixed(2),
        r.paidAmount.toFixed(2),
        r.pending.toFixed(2),
      ]);
      downloadCsv(`payment-report-${today}.csv`, ['Karigar', 'Total Amount', 'Paid Amount', 'Pending'], rows);
    }
  };

  const renderTable = () => {
    if (isLoading) return <LoadingState variant="page" />;

    if (reportKey === 'daily-production') {
      const items = entriesQuery.data?.items ?? [];
      const total = items.reduce((sum, e) => sum + Number(e.carrierTotal), 0);
      return (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Sr.</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Karigar</th>
              <th className="px-3 py-2 font-medium">Style</th>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium text-right">Qty</th>
              <th className="px-3 py-2 font-medium text-right">Rate</th>
              <th className="px-3 py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e, i) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2">{formatDate(e.date)}</td>
                <td className="px-3 py-2">{e.carrier.fullName}</td>
                <td className="numeric px-3 py-2">{e.item.styleNo}</td>
                <td className="px-3 py-2">{e.item.itemName}</td>
                <td className="numeric px-3 py-2 text-right">{e.carrierQuantity}</td>
                <td className="numeric px-3 py-2 text-right">{Number(e.carrierRate).toFixed(2)}</td>
                <td className="numeric px-3 py-2 text-right">{Number(e.carrierTotal).toFixed(2)}</td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No data for this range.
                </td>
              </tr>
            ) : null}
          </tbody>
          {items.length ? (
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td colSpan={7} className="px-3 py-2 text-right">
                  Total
                </td>
                <td className="numeric px-3 py-2 text-right">{total.toFixed(2)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      );
    }

    if (reportKey === 'photo-report') {
      const items = (entriesQuery.data?.items ?? []).filter((e) => e.photoUrl);
      return (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Sr.</th>
              <th className="px-3 py-2 font-medium">Photo</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Karigar</th>
              <th className="px-3 py-2 font-medium">Style</th>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium text-right">Qty</th>
              <th className="px-3 py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e, i) => {
              const photoUrl = resolvePhotoUrl(e.photoUrl);
              return (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex size-10 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground">
                      {photoUrl ? (
                        <img src={photoUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <ImageOff className="size-4" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">{formatDate(e.date)}</td>
                  <td className="px-3 py-2">{e.carrier.fullName}</td>
                  <td className="numeric px-3 py-2">{e.item.styleNo}</td>
                  <td className="px-3 py-2">{e.item.itemName}</td>
                  <td className="numeric px-3 py-2 text-right">{e.carrierQuantity}</td>
                  <td className="numeric px-3 py-2 text-right">{Number(e.carrierTotal).toFixed(2)}</td>
                </tr>
              );
            })}
            {!items.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No photos for this range.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      );
    }

    if (reportKey === 'karigar-summary') {
      const rows = karigarSummaryQuery.data ?? [];
      const total = rows.reduce((sum, r) => sum + r.totalAmount, 0);
      return (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Sr.</th>
              <th className="px-3 py-2 font-medium">Karigar</th>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium text-right">Total Qty</th>
              <th className="px-3 py-2 font-medium text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.karigarId} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2">{r.karigarName}</td>
                <td className="numeric px-3 py-2">{r.karigarCode}</td>
                <td className="numeric px-3 py-2 text-right">{r.totalQuantity}</td>
                <td className="numeric px-3 py-2 text-right">{r.totalAmount.toFixed(2)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No data for this range.
                </td>
              </tr>
            ) : null}
          </tbody>
          {rows.length ? (
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td colSpan={4} className="px-3 py-2 text-right">
                  Total
                </td>
                <td className="numeric px-3 py-2 text-right">{total.toFixed(2)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      );
    }

    if (reportKey === 'item-summary') {
      const rows = itemSummaryQuery.data ?? [];
      const total = rows.reduce((sum, r) => sum + r.totalAmount, 0);
      return (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Sr.</th>
              <th className="px-3 py-2 font-medium">Style No</th>
              <th className="px-3 py-2 font-medium">Item Name</th>
              <th className="px-3 py-2 font-medium text-right">Total Qty</th>
              <th className="px-3 py-2 font-medium text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.itemId} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="numeric px-3 py-2">{r.styleNo}</td>
                <td className="px-3 py-2">{r.itemName}</td>
                <td className="numeric px-3 py-2 text-right">{r.totalQuantity}</td>
                <td className="numeric px-3 py-2 text-right">{r.totalAmount.toFixed(2)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No data for this range.
                </td>
              </tr>
            ) : null}
          </tbody>
          {rows.length ? (
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td colSpan={4} className="px-3 py-2 text-right">
                  Total
                </td>
                <td className="numeric px-3 py-2 text-right">{total.toFixed(2)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      );
    }

    if (reportKey === 'monthly-summary') {
      const rows = monthlySummaryQuery.data ?? [];
      const total = rows.reduce((sum, r) => sum + r.totalAmount, 0);
      return (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Sr.</th>
              <th className="px-3 py-2 font-medium">Month</th>
              <th className="px-3 py-2 font-medium text-right">Total Qty</th>
              <th className="px-3 py-2 font-medium text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.month} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2">{formatMonthKey(r.month)}</td>
                <td className="numeric px-3 py-2 text-right">{r.totalQuantity}</td>
                <td className="numeric px-3 py-2 text-right">{r.totalAmount.toFixed(2)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No data for this range.
                </td>
              </tr>
            ) : null}
          </tbody>
          {rows.length ? (
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td colSpan={3} className="px-3 py-2 text-right">
                  Total
                </td>
                <td className="numeric px-3 py-2 text-right">{total.toFixed(2)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      );
    }

    // payment-report
    const rows = ledgerQuery.data ?? [];
    const totals = rows.reduce(
      (acc, r) => ({
        totalAmount: acc.totalAmount + r.totalAmount,
        paidAmount: acc.paidAmount + r.paidAmount,
        pending: acc.pending + r.pending,
      }),
      { totalAmount: 0, paidAmount: 0, pending: 0 },
    );
    return (
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Sr.</th>
            <th className="px-3 py-2 font-medium">Karigar</th>
            <th className="px-3 py-2 font-medium text-right">Total Amount</th>
            <th className="px-3 py-2 font-medium text-right">Paid Amount</th>
            <th className="px-3 py-2 font-medium text-right">Pending</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.karigarId} className="border-b border-border last:border-0">
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2">{r.karigarName}</td>
              <td className="numeric px-3 py-2 text-right">{r.totalAmount.toFixed(2)}</td>
              <td className="numeric px-3 py-2 text-right">{r.paidAmount.toFixed(2)}</td>
              <td className="numeric px-3 py-2 text-right">{r.pending.toFixed(2)}</td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                No karigars found.
              </td>
            </tr>
          ) : null}
        </tbody>
        {rows.length ? (
          <tfoot>
            <tr className="border-t border-border font-semibold">
              <td colSpan={2} className="px-3 py-2 text-right">
                Total
              </td>
              <td className="numeric px-3 py-2 text-right">{totals.totalAmount.toFixed(2)}</td>
              <td className="numeric px-3 py-2 text-right">{totals.paidAmount.toFixed(2)}</td>
              <td className="numeric px-3 py-2 text-right">{totals.pending.toFixed(2)}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    );
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft />
          Back to Reports
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {definition.usesDateRange ? (
            <>
              <DatePicker aria-label="From date" className="w-full sm:w-40" max={dateTo || undefined} value={dateFrom} onChange={setDateFrom} />
              <span className="text-xs text-muted-foreground">to</span>
              <DatePicker aria-label="To date" className="w-full sm:w-40" min={dateFrom || undefined} value={dateTo} onChange={setDateTo} />
            </>
          ) : null}
          <Button variant="outline" onClick={handleExport}>
            <Download />
            Export
          </Button>
          <Button onClick={() => window.print()}>
            <Printer />
            Print
          </Button>
        </div>
      </div>

      <Card className="print-area">
        <div className="space-y-1 border-b border-border p-4 text-center sm:p-6">
          <h2 className="text-lg font-semibold">{organization?.name ?? 'Company'}</h2>
          <p className="text-sm font-medium text-muted-foreground">{definition.title}</p>
          {definition.usesDateRange && (dateFrom || dateTo) ? (
            <p className="text-2xs text-muted-foreground">
              From: {formatDate(dateFrom) || '—'} To: {formatDate(dateTo) || '—'}
            </p>
          ) : null}
        </div>

        <div className="overflow-x-auto">{renderTable()}</div>

        <div className="grid grid-cols-3 gap-4 border-t border-border p-4 pt-10 text-center text-xs text-muted-foreground sm:p-6 sm:pt-10">
          <div className="border-t border-border pt-2">Prepared By</div>
          <div className="border-t border-border pt-2">Checked By</div>
          <div className="border-t border-border pt-2">Authorized Signatory</div>
        </div>
      </Card>
    </div>
  );
};
