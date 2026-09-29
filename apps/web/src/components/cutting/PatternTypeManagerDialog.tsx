import { SimpleMasterManagerDialog } from '../common/SimpleMasterManagerDialog';

interface PatternTypeManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PatternTypeManagerDialog = ({ open, onOpenChange }: PatternTypeManagerDialogProps) => (
  <SimpleMasterManagerDialog
    open={open}
    onOpenChange={onOpenChange}
    title="Manage pattern types"
    itemLabel="Pattern type"
    apiBasePath="/cutting/pattern-types"
    queryKey="pattern-types"
    extraInvalidateQueryKeys={['cutting-entries']}
  />
);
