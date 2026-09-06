import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, ImageOff } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { usePermissions } from '../../hooks/use-permissions';
import type { ProductionEntry } from './production-entry-constants';

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/api\/v1\/?$/, '');
const resolvePhotoUrl = (url: string | null) => (url ? (url.startsWith('http') ? url : `${API_ORIGIN}${url}`) : null);

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
                <Field label="Karigar" value={`${entry.karigar.fullName} (${entry.karigar.code})`} />
                <Field label="Work Type" value={entry.workType.name} />
                <Field label="Style No." value={entry.item.styleNo} />
                <Field label="Item Name" value={entry.item.itemName} />
                <Field label="Quantity" value={String(entry.quantity)} />
                <Field label="Rate (₹)" value={Number(entry.rate).toFixed(2)} />
                <Field label="Total Amount (₹)" value={Number(entry.totalAmount).toFixed(2)} />
              </div>

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
