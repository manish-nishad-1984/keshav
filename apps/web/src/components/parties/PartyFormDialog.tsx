import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import type { Party } from './party-constants';

export const PARTIES_QUERY_KEY = ['parties'] as const;

interface PartyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  party?: Party | null;
  /** Called with the saved party — the cutting form uses it to select a just-added party. */
  onSaved?: (party: Party) => void;
}

const emptyForm = { name: '', mobile: '', referenceName: '', address: '', isActive: true };

export const PartyFormDialog = ({ open, onOpenChange, party, onSaved }: PartyFormDialogProps) => {
  const queryClient = useQueryClient();
  const isEdit = Boolean(party);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      party
        ? {
            name: party.name,
            mobile: party.mobile ?? '',
            referenceName: party.referenceName ?? '',
            address: party.address ?? '',
            isActive: party.isActive,
          }
        : emptyForm,
    );
  }, [open, party]);

  const mutation = useMutation({
    mutationFn: () => (isEdit && party ? apiClient.patch<Party>(`/parties/${party.id}`, form) : apiClient.post<Party>('/parties', form)),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: PARTIES_QUERY_KEY });
      onSaved?.(saved);
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit party' : 'Add party'}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <DialogBody className="space-y-3">
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}

            <FormField label="Name" required htmlFor="party-name">
              <Input
                id="party-name"
                required
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </FormField>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Mobile No." htmlFor="party-mobile">
                <Input
                  id="party-mobile"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={form.mobile}
                  onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                />
              </FormField>
              <FormField label="Reference Name" htmlFor="party-reference">
                <Input
                  id="party-reference"
                  value={form.referenceName}
                  onChange={(e) => setForm((f) => ({ ...f, referenceName: e.target.value }))}
                />
              </FormField>
            </div>

            <FormField label="Address" htmlFor="party-address">
              <Textarea
                id="party-address"
                rows={2}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </FormField>

            <div className="flex items-center gap-2">
              <Checkbox
                id="party-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked === true }))}
              />
              <Label htmlFor="party-active" className="cursor-pointer">
                Active
              </Label>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending} disabled={!form.name.trim()}>
              {isEdit ? 'Save changes' : 'Add party'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
