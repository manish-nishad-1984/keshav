import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Download, ImageOff } from 'lucide-react';
import { apiClient, resolvePhotoUrl } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { LoadingState } from '../components/ui/loading-state';
import { Pagination } from '../components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DatePicker } from '../components/ui/date-picker';
import { usePermissions } from '../hooks/use-permissions';
import { ProductionEntryViewDialog } from '../components/production-entries/ProductionEntryViewDialog';
import type { ProductionEntry } from '../components/production-entries/production-entry-constants';
import type { Karigar } from '../components/karigars/karigar-constants';
import type { Item } from '../components/items/item-constants';
import { formatDate, fileDateStamp } from '../lib/date';

const toCsvValue = (value: string) => `"${value.replace(/"/g, '""')}"`;

export const ProductionHistoryPage = () => {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canExport = isSuperAdmin || hasPermission('production_history:export');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [karigarId, setKarigarId] = useState('ALL');
  const [itemId, setItemId] = useState('ALL');
  const [page, setPage] = useState(1);
  const [viewEntry, setViewEntry] = useState<ProductionEntry | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { data: karigars } = useQuery({
    queryKey: ['karigars', 'options'],
    queryFn: () => apiClient.list<Karigar>('/karigars', { page: 1, pageSize: 100 }),
  });
  const { data: items } = useQuery({
    queryKey: ['items', 'options'],
    queryFn: () => apiClient.list<Item>('/items', { page: 1, pageSize: 100 }),
  });

  const filters = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    carrierId: karigarId === 'ALL' ? undefined : karigarId,
    itemId: itemId === 'ALL' ? undefined : itemId,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['production-entries', { page, ...filters }],
    queryFn: () => apiClient.list<ProductionEntry>('/production-entries', { page, pageSize: 8, ...filters }),
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const all = await apiClient.list<ProductionEntry>('/production-entries', { page: 1, pageSize: 1000, ...filters });
      const header = ['Date', 'Lot Number', 'Carrier', 'Code', 'Work Type', 'Style No', 'Item Name', 'Qty', 'Rate', 'Amount', 'Remarks'];
      const rows = all.items.map((entry) =>
        [
          formatDate(entry.date),
          entry.lotNumber ?? '',
          entry.carrier.fullName,
          entry.carrier.code,
          entry.workType.name,
          entry.item.styleNo,
          entry.item.itemName,
          String(entry.carrierQuantity),
          Number(entry.carrierRate).toFixed(2),
          Number(entry.carrierTotal).toFixed(2),
          entry.remarks ?? '',
        ].map(toCsvValue),
      );
      const csv = [header.map(toCsvValue), ...rows].map((r) => r.join(',')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `production-history-${fileDateStamp()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageLayout
      title="Production History"
      description="Search and review past production entries."
      actions={
        canExport ? (
          <Button variant="outline" onClick={handleExport} loading={isExporting}>
            <Download />
            Export
          </Button>
        ) : null
      }
    >
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <DatePicker
            aria-label="From date"
            className="w-full sm:w-40"
            max={dateTo || undefined}
            value={dateFrom}
            onChange={(value) => {
              setPage(1);
              setDateFrom(value);
            }}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <DatePicker
            aria-label="To date"
            className="w-full sm:w-40"
            min={dateFrom || undefined}
            value={dateTo}
            onChange={(value) => {
              setPage(1);
              setDateTo(value);
            }}
          />
          <Select
            value={karigarId}
            onValueChange={(v) => {
              setPage(1);
              setKarigarId(v);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Karigar</SelectItem>
              {karigars?.items.map((karigar) => (
                <SelectItem key={karigar.id} value={karigar.id}>
                  {karigar.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={itemId}
            onValueChange={(v) => {
              setPage(1);
              setItemId(v);
            }}
          >
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Item</SelectItem>
              {items?.items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.styleNo} — {item.itemName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <LoadingState variant="page" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left text-sm">
              <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Karigar</th>
                  <th className="px-4 py-2 font-medium">Style</th>
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 font-medium text-right">Qty</th>
                  <th className="px-4 py-2 font-medium text-right">Rate</th>
                  <th className="px-4 py-2 font-medium text-right">Amount</th>
                  <th className="px-4 py-2 font-medium">Photo</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {data?.items.map((entry) => {
                  const photoUrl = resolvePhotoUrl(entry.photoUrl);
                  return (
                    <tr key={entry.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(entry.date)}</td>
                      <td className="px-4 py-2.5 font-medium">{entry.carrier.fullName}</td>
                      <td className="numeric px-4 py-2.5 text-muted-foreground">{entry.item.styleNo}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{entry.item.itemName}</td>
                      <td className="numeric px-4 py-2.5 text-muted-foreground text-right">{entry.carrierQuantity}</td>
                      <td className="numeric px-4 py-2.5 text-muted-foreground text-right">{Number(entry.carrierRate).toFixed(2)}</td>
                      <td className="numeric px-4 py-2.5 font-medium text-right">{Number(entry.carrierTotal).toFixed(2)}</td>
                      <td className="px-4 py-2">
                        <div className="flex size-9 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground">
                          {photoUrl ? (
                            <img src={photoUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <ImageOff className="size-4" />
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <Button variant="ghost" size="icon" aria-label="View entry" onClick={() => setViewEntry(entry)}>
                          <Eye />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!data?.items.length ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      No production entries found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        {data ? <Pagination meta={data.pagination} onPageChange={setPage} className="border-t border-border" /> : null}
      </Card>

      <ProductionEntryViewDialog entry={viewEntry} onOpenChange={(open) => !open && setViewEntry(null)} onDeleted={() => setViewEntry(null)} />
    </PageLayout>
  );
};
