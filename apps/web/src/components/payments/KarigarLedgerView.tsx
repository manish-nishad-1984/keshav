import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Eye, Plus } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { LoadingState } from '../ui/loading-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { KarigarPaymentHistoryDialog } from './KarigarPaymentHistoryDialog';
import type { LedgerRow } from './payment-constants';

interface KarigarLedgerViewProps {
  onAddPayment: () => void;
}

export const KarigarLedgerView = ({ onAddPayment }: KarigarLedgerViewProps) => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [historyTarget, setHistoryTarget] = useState<LedgerRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['payments', 'ledger'],
    queryFn: () => apiClient.get<LedgerRow[]>('/payments/ledger'),
  });

  const rows = (data ?? [])
    .filter((row) => row.karigarName.toLowerCase().includes(search.toLowerCase()))
    .filter((row) => (status === 'DUE' ? row.pending > 0 : status === 'SETTLED' ? row.pending <= 0 : true));

  const totals = rows.reduce(
    (acc, row) => ({
      totalAmount: acc.totalAmount + row.totalAmount,
      paidAmount: acc.paidAmount + row.paidAmount,
      pending: acc.pending + row.pending,
    }),
    { totalAmount: 0, paidAmount: 0, pending: 0 },
  );

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search karigar…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="DUE">Due</SelectItem>
                <SelectItem value="SETTLED">Settled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={onAddPayment}>
            <Plus />
            Add Payment
          </Button>
        </div>

        {isLoading ? (
          <LoadingState variant="page" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Karigar</th>
                  <th className="px-4 py-2 font-medium text-right">Total Amount</th>
                  <th className="px-4 py-2 font-medium text-right">Paid Amount</th>
                  <th className="px-4 py-2 font-medium text-right">Pending</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.karigarId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium">{row.karigarName}</td>
                    <td className="numeric px-4 py-2.5 text-right">{row.totalAmount.toFixed(2)}</td>
                    <td className="numeric px-4 py-2.5 text-right">{row.paidAmount.toFixed(2)}</td>
                    <td className="numeric px-4 py-2.5 font-medium text-right">{row.pending.toFixed(2)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={row.pending > 0 ? 'danger' : 'success'}>
                        {row.pending > 0 ? 'Due' : 'Settled'}
                      </Badge>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <Button variant="ghost" size="icon" aria-label={`Payment history for ${row.karigarName}`} onClick={() => setHistoryTarget(row)}>
                        <Eye />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No karigars found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              {rows.length ? (
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="numeric px-4 py-2.5 text-right">{totals.totalAmount.toFixed(2)}</td>
                    <td className="numeric px-4 py-2.5 text-right">{totals.paidAmount.toFixed(2)}</td>
                    <td className="numeric px-4 py-2.5 text-right">{totals.pending.toFixed(2)}</td>
                    <td />
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        )}
      </Card>

      <KarigarPaymentHistoryDialog karigar={historyTarget} onOpenChange={(open) => !open && setHistoryTarget(null)} />
    </>
  );
};
