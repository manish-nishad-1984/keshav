import type { ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export const ActionMenu = ({ items }: { items: ActionMenuItem[] }) => {
  const visible = items.filter((item) => !item.disabled);
  if (visible.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Row actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {visible.map((item) => (
          <div key={item.key}>
            {item.separatorBefore ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem destructive={item.destructive} onSelect={item.onSelect}>
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
