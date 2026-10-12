import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FormAlert } from '../ui/form-alert';
import { LoadingState } from '../ui/loading-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { CuttingEntry } from './cutting-constants';

export const CLOSE_REASON_LABELS = {
  DAMAGED: 'Damaged / spoiled pieces',
  SHORTAGE: 'Shortage (pieces short)',
  RETURNED_BY_PARTY: 'Returned by party',
} as const;
type CloseReason = keyof typeof CLOSE_REASON_LABELS;

interface Summary {
  totalQuantity: number;
  alteration: number;
  deliveries: { pieces: number };
}

interface CloseLotDialogProps {
  lot: CuttingEntry | null;
  onClose: () => void;
}

// Admin: close a lot. Shows cut vs delivered and asks why the rest never reached the party.
export const CloseLotDialog = ({ lot, onClose }: CloseLotDialogProps) => {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<CloseReason | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setReason('');
    setNote('');
    setError(null);
  }, [lot?.id]);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['cutting-entries', 'deletion-summary', lot?.id, 'close'],
    queryFn: () => apiClient.get<Summary>(`/cutting/${lot?.id}/deletion-summary`),
    enabled: Boolean(lot),
    gcTime: 0,
  });
  const undelivered = summary ? Math.max(summary.totalQuantity - summary.deliveries.pieces, 0) : 0;
  const alteration = summary ? Math.min(summary.alteration, undelivered) : 0;
  const shortage = undelivered - alteration;

  const mutation = useMutation({
    mutationFn: () => apiClient.post(`/cutting/${lot?.id}/close`, { reason: reason || undefined, note: note.trim() || null }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });

  return (
    <Dialog open={Boolean(lot)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close lot {lot?.lotNumber}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3 text-sm">
          {error ? <FormAlert tone="error">{error}</FormAlert> : null}
          {isLoading || !summary ? (
            <LoadingState />
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-2 rounded-md bg-muted px-3 py-2 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Cut</dt>
                  <dd className="numeric text-base font-semibold">{summary.totalQuantity}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Delivered</dt>
                  <dd className="numeric text-base font-semibold">{summary.deliveries.pieces}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">In alteration</dt>
                  <dd className="numeric text-base font-semibold">{alteration}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Not accounted for</dt>
                  <dd className="numeric text-base font-semibold text-destructive">{shortage}</dd>
                </div>
              </dl>
              <p className="text-muted-foreground">
                After closing, nothing more can be added to this lot (distribution, production, delivery, accessories). An admin can reopen it.
              </p>
              {shortage > 0 ? (
                <div className="space-y-1">
                  <label htmlFor="close-reason" className="text-xs font-medium">
                    Why were {shortage} pieces not delivered? <span className="text-destructive">*</span>
                  </label>
                  <Select value={reason} onValueChange={(v) => setReason(v as CloseReason)}>
                    <SelectTrigger id="close-reason">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CLOSE_REASON_LABELS) as CloseReason[]).map((key) => (
                        <SelectItem key={key} value={key}>
                          {CLOSE_REASON_LABELS[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-1">
                <label htmlFor="close-note" className="text-xs font-medium">
                  Note (optional)
                </label>
                <Input id="close-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button loading={mutation.isPending} disabled={!summary || (shortage > 0 && !reason)} onClick={() => mutation.mutate()}>
            Close lot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
