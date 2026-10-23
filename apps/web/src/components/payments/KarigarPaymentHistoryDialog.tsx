import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { FormAlert } from '../ui/form-alert';
import { LoadingState } from '../ui/loading-state';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { WhatsAppSendDialog } from '../common/WhatsAppSendDialog';
import { usePermissions } from '../../hooks/use-permissions';
import { PaymentEditDialog } from './PaymentEditDialog';
import { PaymentChangesDialog } from './PaymentChangesDialog';
import { PAYMENT_MODE_LABELS, type LedgerRow, type Payment } from './payment-constants';
import { formatDate } from '../../lib/date';
import { formatMoney } from '../../lib/format';

interface KarigarPaymentHistoryDialogProps {
  karigar: LedgerRow | null;
  onOpenChange: (open: boolean) => void;
}

// Edited = saved again a while after it was made (not the few ms between create and its own update).
const wasEdited = (p: Payment) => !p.deletedAt && new Date(p.updatedAt).getTime() - new Date(p.createdAt).getTime() > 5000;

export const KarigarPaymentHistoryDialog = ({ karigar, onOpenChange }: KarigarPaymentHistoryDialogProps) => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canUpdate = isSuperAdmin || hasPermission('payments:update');
  const canDelete = isSuperAdmin || hasPermission('payments:delete');
  const [showDeleted, setShowDeleted] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [toDelete, setToDelete] = useState<Payment | null>(null);
  const [whatsappId, setWhatsappId] = useState<string | null>(null);
  const [changesId, setChangesId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['payments', 'history', karigar?.karigarId, showDeleted],
    queryFn: () =>
      apiClient.list<Payment>('/payments', { page: 1, pageSize: 100, karigarId: karigar!.karigarId, includeDeleted: showDeleted ? 'true' : undefined }),
    enabled: Boolean(karigar),
  });
  // Totals from the live ledger, so they follow an edit or delete made here.
  const { data: ledger } = useQuery({ queryKey: ['payments', 'ledger'], queryFn: () => apiClient.get<LedgerRow[]>('/payments/ledger'), enabled: Boolean(karigar) });
  const totals = ledger?.find((r) => r.karigarId === karigar?.karigarId) ?? karigar;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/payments/${id}`),
    onSuccess: () => {
      setToDelete(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: (err) => {
      setToDelete(null);
      setError(err instanceof ApiRequestError ? err.message : 'Could not delete. Please try again.');
    },
  });

  return (
    <>
      <Dialog open={Boolean(karigar)} onOpenChange={onOpenChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{karigar ? `${karigar.karigarName} (${karigar.karigarCode})` : 'Payment history'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {totals ? (
              <div className="mb-4 grid grid-cols-3 gap-3 rounded-md border border-border p-3 text-center">
                <div>
                  <p className="text-2xs uppercase tracking-wider text-muted-foreground">Total</p>
                  <p className="numeric text-sm font-semibold">{formatMoney(totals.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-wider text-muted-foreground">Paid</p>
                  <p className="numeric text-sm font-semibold">{formatMoney(totals.paidAmount)}</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-wider text-muted-foreground">Pending</p>
                  <p className="numeric text-sm font-semibold">{formatMoney(totals.pending)}</p>
                </div>
              </div>
            ) : null}

            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
                Show deleted payments
              </label>
            </div>
            {error ? (
              <div className="mb-2">
                <FormAlert tone="error">{error}</FormAlert>
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
                      <th className="px-1 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {data?.items.map((payment) => {
                      const deleted = Boolean(payment.deletedAt);
                      return (
                        <tr key={payment.id} className={`border-b border-border last:border-0 ${deleted ? 'bg-muted/40 text-muted-foreground' : ''}`}>
                          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                            {formatDate(payment.date)}
                            {payment.entryTime ? <span className="ml-1.5 text-2xs">{payment.entryTime}</span> : null}
                            {deleted ? (
                              <Badge variant="danger" className="ml-1.5">
                                Deleted
                              </Badge>
                            ) : wasEdited(payment) ? (
                              <Badge variant="info" className="ml-1.5">
                                Edited
                              </Badge>
                            ) : null}
                          </td>
                          <td className={`numeric px-3 py-2 text-right font-medium ${deleted ? 'line-through' : ''}`}>{formatMoney(payment.amount)}</td>
                          <td className="px-3 py-2">
                            <Badge variant="muted">{PAYMENT_MODE_LABELS[payment.paymentMode]}</Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {payment.salaryAmount
                              ? `${payment.presentDays ?? 0} present · ${payment.absentDays ?? 0} absent · ${Number(payment.overtimeHours ?? 0)} h OT`
                              : payment.karigar?.salaryType === 'FIXED'
                                ? 'Upad (advance)'
                                : '—'}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{payment.remarks || '—'}</td>
                          <td className="whitespace-nowrap px-1 py-1">
                            {!deleted ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Send on WhatsApp"
                                aria-label="Send payment on WhatsApp"
                                className="hover:text-emerald-600"
                                onClick={() => setWhatsappId(payment.id)}
                              >
                                <MessageCircle />
                              </Button>
                            ) : null}
                            <Button variant="ghost" size="icon" title="History of this payment" aria-label="Payment history" onClick={() => setChangesId(payment.id)}>
                              <History />
                            </Button>
                            {!deleted && canUpdate ? (
                              <Button variant="ghost" size="icon" title="Edit" aria-label="Edit payment" onClick={() => setEditing(payment)}>
                                <Pencil />
                              </Button>
                            ) : null}
                            {!deleted && canDelete ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                aria-label="Delete payment"
                                className="hover:text-destructive"
                                onClick={() => {
                                  setError(null);
                                  setToDelete(payment);
                                }}
                              >
                                <Trash2 />
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                    {!data?.items.length ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
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

      <PaymentEditDialog payment={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <PaymentChangesDialog paymentId={changesId} onOpenChange={(o) => !o && setChangesId(null)} />
      <WhatsAppSendDialog event="PAYMENT" refId={whatsappId} title="Send payment on WhatsApp" onOpenChange={(o) => !o && setWhatsappId(null)} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete payment?"
        description={
          toDelete
            ? `${formatMoney(toDelete.amount)} paid on ${formatDate(toDelete.date)} (${PAYMENT_MODE_LABELS[toDelete.paymentMode]}) will be removed and the pending amount goes up. It stays in the history as "Deleted".`
            : undefined
        }
        confirmLabel="Delete"
        tone="destructive"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
      />
    </>
  );
};
