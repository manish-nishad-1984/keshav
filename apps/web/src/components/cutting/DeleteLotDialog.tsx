import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FormAlert } from '../ui/form-alert';
import { LoadingState } from '../ui/loading-state';
import type { CuttingEntry } from './cutting-constants';

interface DeletionSummary {
  lotNumber: string;
  totalQuantity: number;
  distributions: { count: number; pieces: number };
  production: { count: number; pieces: number };
  accessories: { count: number };
  deliveries: { count: number; pieces: number; challans: number[] };
}

interface DeleteLotDialogProps {
  lot: CuttingEntry | null;
  // Admins (cutting:manage) can delete a lot together with everything entered against it.
  canManage: boolean;
  onClose: () => void;
}

export const DeleteLotDialog = ({ lot, canManage, onClose }: DeleteLotDialogProps) => {
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setTyped('');
    setError(null);
  }, [lot?.id]);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['cutting-entries', 'deletion-summary', lot?.id],
    queryFn: () => apiClient.get<DeletionSummary>(`/cutting/${lot?.id}/deletion-summary`),
    enabled: Boolean(lot && canManage),
    gcTime: 0,
  });

  const linked = summary
    ? [
        summary.distributions.count ? `${summary.distributions.count} distribution(s) to karigars — ${summary.distributions.pieces} pcs` : null,
        summary.production.count ? `${summary.production.count} production entr${summary.production.count === 1 ? 'y' : 'ies'} — ${summary.production.pieces} pcs` : null,
        summary.accessories.count ? `${summary.accessories.count} accessory issue/return entr${summary.accessories.count === 1 ? 'y' : 'ies'}` : null,
        summary.deliveries.count
          ? `${summary.deliveries.count} deliver${summary.deliveries.count === 1 ? 'y' : 'ies'} (challan ${summary.deliveries.challans.join(', ')}) — ${summary.deliveries.pieces} pcs`
          : null,
      ].filter((x): x is string => Boolean(x))
    : [];

  const mutation = useMutation({
    mutationFn: () => (canManage ? apiClient.delete(`/cutting/${lot?.id}/everything`) : apiClient.delete(`/cutting/${lot?.id}`)),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });

  const needsTyping = linked.length > 0;
  const ready = !needsTyping || typed.trim() === lot?.lotNumber;

  return (
    <Dialog open={Boolean(lot)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete lot {lot?.lotNumber}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3 text-sm">
          {error ? <FormAlert tone="error">{error}</FormAlert> : null}
          {canManage && isLoading ? (
            <LoadingState />
          ) : linked.length ? (
            <>
              <p className="flex items-start gap-2 font-medium text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Deleting this lot will also permanently remove everything entered against it. This cannot be undone.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {linked.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="text-muted-foreground">Karigar payments and press entries are not touched.</p>
              <div className="space-y-1">
                <label htmlFor="del-lot-confirm" className="text-xs font-medium">
                  Type the lot number <span className="numeric font-semibold">{lot?.lotNumber}</span> to confirm
                </label>
                <Input id="del-lot-confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
              </div>
            </>
          ) : (
            <p>
              {canManage
                ? 'Nothing has been entered against this lot. It will be deleted.'
                : 'This lot will be deleted. If it has distributions or production entries, remove those first or ask an admin.'}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" loading={mutation.isPending} disabled={!ready || (canManage && isLoading)} onClick={() => mutation.mutate()}>
            {linked.length ? 'Delete lot and everything' : 'Delete lot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
