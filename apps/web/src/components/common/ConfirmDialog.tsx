import type { ReactNode } from 'react';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: 'default' | 'destructive';
  isSubmitting?: boolean;
  onConfirm: () => void;
}

export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'default',
  isSubmitting,
  onConfirm,
}: ConfirmDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      {description ? (
        <DialogBody>
          <DialogDescription>{description}</DialogDescription>
        </DialogBody>
      ) : null}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant={tone === 'destructive' ? 'destructive' : 'default'} onClick={onConfirm} loading={isSubmitting}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
