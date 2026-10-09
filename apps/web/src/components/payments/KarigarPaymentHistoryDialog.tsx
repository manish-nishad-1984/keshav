import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { LoadingState } from '../ui/loading-state';
import { PAYMENT_MODE_LABELS, type LedgerRow, type Payment } from './payment-constants';
import { formatDate } from '../../lib/date';
import { formatMoney } from '../../lib/format';

interface KarigarPaymentHistoryDialogProps {
  karigar: LedgerRow | null;
  onOpenChange: (open: boolean) => void;
}

export const KarigarPaymentHistoryDialog = ({ karigar, onOpenChange }: KarigarPaymentHistoryDialogProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ['payments', 'history', karigar?.karigarId],
    queryFn: () => apiClient.list<Payment>('/payments', { page: 1, pageSize: 100, karigarId: karigar!.karigarId }),
    enabled: Boolean(karigar),
  });

  return (
    <Dialog open={Boolean(karigar)} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{karigar ? `${karigar.karigarName} (${karigar.karigarCode})` : 'Payment history'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {karigar ? (
            <div className="mb-4 grid grid-cols-3 gap-3 rounded-md border border-border p-3 text-center">
              <div>
                <p className="text-2xs uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="numeric text-sm font-semibold">{formatMoney(karigar.totalAmount)}</p>
              </div>
              <div>
                <p className="text-2xs uppercase tracking-wider text-muted-foreground">Paid</p>
                <p className="numeric text-sm font-semibold">{formatMoney(karigar.paidAmount)}</p>
              </div>
              <div>
                <p className="text-2xs uppercase tracking-wider text-muted-foreground">Pending</p>
                <p className="numeric text-sm font-semibold">{formatMoney(karigar.pending)}</p>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <LoadingState variant="page" />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full text-left text-sm">
                <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                    <th className="px-3 py-2 font-medium">Mode</th>
                    <th className="px-3 py-2 font-medium">Salary details</th>
                    <th className="px-3 py-2 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((payment) => (
                    <tr key={payment.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatDate(payment.date)}
                        {payment.entryTime ? <span className="ml-1.5 text-2xs">{payment.entryTime}</span> : null}
                      </td>
                      <td className="numeric px-3 py-2 font-medium text-right">{formatMoney(payment.amount)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="muted">{PAYMENT_MODE_LABELS[payment.paymentMode]}</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {payment.salaryAmount
                          ? `${payment.presentDays ?? 0} present · ${payment.absentDays ?? 0} absent · ${Number(payment.overtimeHours ?? 0)} h OT`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{payment.remarks ?? '—'}</td>
                    </tr>
                  ))}
                  {!data?.items.length ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        No payments recorded yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
