import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FormAlert } from '../ui/form-alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { Accessory, DesignWithAccessories } from './accessory-constants';
import { ACCESSORY_DESIGNS_QUERY_KEY } from './accessory-constants';

interface DesignAccessoriesDialogProps {
  design: DesignWithAccessories | null;
  accessories: Accessory[];
  onOpenChange: (open: boolean) => void;
}

interface LineInput {
  key: number;
  accessoryId: string;
  quantityPerPiece: number | '';
}

let lineSeq = 0;

// What one piece of a design needs, e.g. 1 zip + 2 locks. Saved as the design's full list.
export const DesignAccessoriesDialog = ({ design, accessories, onOpenChange }: DesignAccessoriesDialogProps) => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<LineInput[]>([]);

  useEffect(() => {
    setError(null);
    setLines(
      design?.accessories.length
        ? design.accessories.map((a) => ({ key: ++lineSeq, accessoryId: a.accessoryId, quantityPerPiece: Number(a.quantityPerPiece) }))
        : [{ key: ++lineSeq, accessoryId: '', quantityPerPiece: '' }],
    );
  }, [design]);

  const used = new Set(design?.accessories.map((a) => a.accessoryId));
  const options = accessories.filter((a) => a.isActive || used.has(a.id));

  const save = useMutation({
    mutationFn: () =>
      apiClient.put(`/accessories/designs/${design!.id}`, {
        lines: lines
          .filter((l) => l.accessoryId && Number(l.quantityPerPiece) > 0)
          .map((l) => ({ accessoryId: l.accessoryId, quantityPerPiece: Number(l.quantityPerPiece) })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ACCESSORY_DESIGNS_QUERY_KEY });
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.'),
  });

  const update = (key: number, patch: Partial<LineInput>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const chosen = lines.map((l) => l.accessoryId).filter(Boolean);
  const duplicate = new Set(chosen).size !== chosen.length;

  return (
    <Dialog open={Boolean(design)} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Accessories per piece · {design?.itemName}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {error ? <FormAlert tone="error">{error}</FormAlert> : null}
          <p className="text-xs text-muted-foreground">
            What one piece of this design needs. A karigar's limit = pieces they took × this.
          </p>

          <div className="space-y-2">
            {lines.map((line) => {
              const unit = accessories.find((a) => a.id === line.accessoryId)?.unit;
              return (
                <div key={line.key} className="flex items-center gap-2">
                  <Select value={line.accessoryId} onValueChange={(v) => update(line.key, { accessoryId: v })}>
                    <SelectTrigger aria-label="Accessory" className="min-w-0 flex-1">
                      <SelectValue placeholder="Select accessory" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                          {a.isActive ? '' : ' (inactive)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step="0.001"
                    inputMode="decimal"
                    aria-label="Quantity per piece"
                    placeholder="Per piece"
                    className="numeric w-28 text-right"
                    value={line.quantityPerPiece}
                    onChange={(e) => update(line.key, { quantityPerPiece: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                  <span className="w-20 text-xs text-muted-foreground">{unit ? `${unit} / pc` : ''}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 hover:text-destructive"
                    aria-label="Remove accessory"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((prev) => [...prev, { key: ++lineSeq, accessoryId: '', quantityPerPiece: '' }])}
          >
            <Plus />
            Add Accessory
          </Button>
          {duplicate ? <FormAlert tone="error">Each accessory can be listed only once.</FormAlert> : null}
          {!options.length ? <FormAlert tone="error">Add accessories in the list first.</FormAlert> : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={save.isPending} disabled={duplicate} onClick={() => save.mutate()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
