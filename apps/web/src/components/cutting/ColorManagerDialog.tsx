import { SimpleMasterManagerDialog } from '../common/SimpleMasterManagerDialog';

interface ColorManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ColorManagerDialog = ({ open, onOpenChange }: ColorManagerDialogProps) => (
  <SimpleMasterManagerDialog
    open={open}
    onOpenChange={onOpenChange}
    title="Manage colors"
    itemLabel="Color"
    apiBasePath="/cutting/colors"
    queryKey="colors"
    extraInvalidateQueryKeys={['cutting-entries']}
  />
);
