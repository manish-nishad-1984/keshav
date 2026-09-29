import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, ImageOff } from 'lucide-react';
import { apiClient, resolvePhotoUrl } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { usePermissions } from '../../hooks/use-permissions';
import type { ProductionEntry } from './production-entry-constants';

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
            <DialogTitle>Production Entry</DialogTitle>
          </DialogHeader>
          {entry ? (
            <DialogBody className="space-y-4">
              <div className="flex justify-center">
                <div className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground">
                  {photoUrl ? (
                    <img src={photoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageOff className="size-8" />
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Date" value={new Date(entry.date).toLocaleDateString()} />
                {entry.lotNumber ? <Field label="Lot Number" value={entry.lotNumber} /> : null}
                {entry.designNumber ? <Field label="Design Number" value={entry.designNumber} /> : null}
                <Field label="Work Type" value={entry.workType.name} />
                <Field label="Style No." value={entry.item.styleNo} />
                <Field label="Item Name" value={entry.item.itemName} />
              </div>

              <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
                <Field label="Carrier" value={`${entry.carrier.fullName} (${entry.carrier.code})`} />
                <Field label="Quantity" value={String(entry.carrierQuantity)} />
                <Field label="Rate (₹)" value={Number(entry.carrierRate).toFixed(2)} />
                <Field label="Total (₹)" value={Number(entry.carrierTotal).toFixed(2)} />
              </div>

              {entry.overlockCarrier ? (
                <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
                  <Field label="Overlock Carrier" value={`${entry.overlockCarrier.fullName} (${entry.overlockCarrier.code})`} />
                  <Field label="Rate (₹)" value={Number(entry.overlockRate ?? 0).toFixed(2)} />
                  <Field label="Total (₹)" value={Number(entry.overlockTotal ?? 0).toFixed(2)} />
                </div>
              ) : null}

              {entry.flatlockKarigar ? (
                <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
                  <Field label="Flatlock Karigar" value={`${entry.flatlockKarigar.fullName} (${entry.flatlockKarigar.code})`} />
                  <Field label="Rate (₹)" value={Number(entry.flatlockRate ?? 0).toFixed(2)} />
                  <Field label="Total (₹)" value={Number(entry.flatlockTotal ?? 0).toFixed(2)} />
                </div>
              ) : null}

              {entry.remarks ? <Field label="Remarks" value={entry.remarks} /> : null}
            </DialogBody>
          ) : null}
          <DialogFooter>
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
