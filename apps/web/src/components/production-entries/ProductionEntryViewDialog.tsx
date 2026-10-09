import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, ImageOff } from 'lucide-react';
import { apiClient, resolvePhotoUrl } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { usePermissions } from '../../hooks/use-permissions';
import type { ProductionEntry } from './production-entry-constants';
import { ratePending } from './production-entry-constants';
import { formatDate } from '../../lib/date';
import { formatMoney } from '../../lib/format';

interface ProductionEntryViewDialogProps {
  entry: ProductionEntry | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="text-sm font-medium">{value}</p>
  </div>
);

export const ProductionEntryViewDialog = ({ entry, onOpenChange, onDeleted }: ProductionEntryViewDialogProps) => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canDelete = isSuperAdmin || hasPermission('production_entries:delete');
  const canUpdate = isSuperAdmin || hasPermission('production_entries:update');
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/production-entries/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['production-entries'] });
      setConfirmOpen(false);
      onOpenChange(false);
      onDeleted();
    },
  });

  const photoUrl = entry ? resolvePhotoUrl(entry.photoUrl) : null;

  return (
    <>
      <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Production Entry
              {entry && ratePending(entry) ? <Badge variant="warning">Rate pending</Badge> : null}
            </DialogTitle>
          </DialogHeader>
          {entry ? (
            <DialogBody className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
                <div className="flex size-28 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Production photo" className="size-full object-cover" />
                  ) : (
                    <ImageOff className="size-7" />
                  )}
                </div>
                <div className="grid grid-cols-2 content-start gap-x-4 gap-y-2.5 sm:grid-cols-3">
                  <Field label="Date" value={entry.entryTime ? `${formatDate(entry.date)} ${entry.entryTime}` : formatDate(entry.date)} />
                  {entry.lotNumber ? <Field label="Lot Number" value={entry.lotNumber} /> : null}
                  {entry.designNumber ? <Field label="Design Number" value={entry.designNumber} /> : null}
                  <Field label="Work Type" value={entry.workType.name} />
                  <Field label="Design Name" value={entry.item.itemName} />
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border border-border">
                <table className="data-table w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-2xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">Role</th>
                      <th className="px-3 py-1.5 font-medium">Karigar</th>
                      <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                      <th className="px-3 py-1.5 text-right font-medium">Rate (₹)</th>
                      <th className="px-3 py-1.5 text-right font-medium">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="px-3 py-2 text-muted-foreground">Stitching</td>
                      <td className="px-3 py-2 font-medium">{`${entry.carrier.fullName} (${entry.carrier.code})`}</td>
                      <td className="numeric px-3 py-2 text-right">{entry.carrierQuantity}</td>
                      <td className="numeric px-3 py-2 text-right">{entry.carrierRate ? formatMoney(entry.carrierRate) : '—'}</td>
                      <td className="numeric px-3 py-2 text-right font-medium">{formatMoney(entry.carrierTotal)}</td>
                    </tr>
                    {entry.flatlockKarigar ? (
                      <tr>
                        <td className="px-3 py-2 text-muted-foreground">Flatlock</td>
                        <td className="px-3 py-2 font-medium">{`${entry.flatlockKarigar.fullName} (${entry.flatlockKarigar.code})`}</td>
                        <td className="numeric px-3 py-2 text-right text-muted-foreground">{entry.carrierQuantity}</td>
                        <td className="numeric px-3 py-2 text-right">{entry.flatlockRate ? formatMoney(entry.flatlockRate) : '—'}</td>
                        <td className="numeric px-3 py-2 text-right font-medium">{formatMoney(entry.flatlockTotal ?? 0)}</td>
                      </tr>
                    ) : null}
                    {entry.overlockCarrier ? (
                      <tr>
                        <td className="px-3 py-2 text-muted-foreground">Overlock</td>
                        <td className="px-3 py-2 font-medium">{`${entry.overlockCarrier.fullName} (${entry.overlockCarrier.code})`}</td>
                        <td className="numeric px-3 py-2 text-right text-muted-foreground">{entry.carrierQuantity}</td>
                        <td className="numeric px-3 py-2 text-right">{entry.overlockRate ? formatMoney(entry.overlockRate) : '—'}</td>
                        <td className="numeric px-3 py-2 text-right font-medium">{formatMoney(entry.overlockTotal ?? 0)}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {entry.quantities?.length ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Pieces handed in, by size</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {entry.quantities.map((q) => (
                      <li key={q.id} className="rounded-md border border-border bg-muted/50 px-2 py-1 text-sm">
                        {q.color.name} · <span className="font-medium">{q.size.name}</span>:{' '}
                        <span className="numeric font-semibold">{q.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {entry.remarks ? <Field label="Remarks" value={entry.remarks} /> : null}
            </DialogBody>
          ) : null}
          <DialogFooter>
            {canUpdate && entry ? (
              <Button variant="outline" onClick={() => navigate(`/production-entries?edit=${entry.id}`)}>
                <Pencil />
                Edit
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                <Trash2 />
                Delete
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete production entry"
        description="This cannot be undone."
        confirmLabel="Delete"
        tone="destructive"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => entry && deleteMutation.mutate(entry.id)}
      />
    </>
  );
};
