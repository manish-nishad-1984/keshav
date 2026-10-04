import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { BOOKS_QUERY_KEY } from '../../hooks/use-selected-book';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import type { Book } from './book-constants';

interface BookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book?: Book | null;
}

// Suggest the current financial year (April–March) as the series name for a new book.
const currentFinancialYear = () => {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};

export const BookFormDialog = ({ open, onOpenChange, book }: BookFormDialogProps) => {
  const queryClient = useQueryClient();
  const isEdit = Boolean(book);
  const [form, setForm] = useState({ name: '', startNumber: 1 as number | '', isActive: true });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      book
        ? { name: book.name, startNumber: book.startNumber, isActive: book.isActive }
        : { name: currentFinancialYear(), startNumber: 1, isActive: true },
    );
  }, [open, book]);

  const mutation = useMutation({
    mutationFn: () => (isEdit && book ? apiClient.patch(`/books/${book.id}`, form) : apiClient.post('/books', form)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BOOKS_QUERY_KEY });
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });

  const hasLots = Boolean(book && book.lotCount > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit book' : 'Add book'}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <DialogBody className="space-y-3">
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Series Name" required htmlFor="book-name" hint="e.g. 2025-26">
                <Input
                  id="book-name"
                  required
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </FormField>
              <FormField
                label="Series Number"
                required
                htmlFor="book-start"
                hint={hasLots ? `Next lot: ${book?.nextLotNumber}` : 'First lot number in this book'}
              >
                <Input
                  id="book-start"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  required
                  className="numeric text-right"
                  value={form.startNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startNumber: e.target.value === '' ? '' : Number(e.target.value) }))
                  }
                />
              </FormField>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="book-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked === true }))}
              />
              <Label htmlFor="book-active" className="cursor-pointer">
                Active (shown in the header book selector)
              </Label>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending} disabled={!form.name.trim() || form.startNumber === ''}>
              {isEdit ? 'Save changes' : 'Add book'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
