import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash } from 'lucide-react';
import { usePermissions } from '../../hooks/use-permissions';
import { useSelectedBook } from '../../hooks/use-selected-book';

// Header box: type a lot number, press Enter, and see everything about that lot (in the working book).
export const LotLookup = () => {
  const navigate = useNavigate();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const { selectedBook } = useSelectedBook();
  const [value, setValue] = useState('');

  if (!selectedBook || !(isSuperAdmin || hasPermission('cutting:view'))) return null;

  return (
    <form
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        const lot = value.trim();
        if (!lot) return;
        navigate(`/lot-history?lot=${encodeURIComponent(lot)}`);
        setValue('');
      }}
    >
      <Hash className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-primary-foreground/70" strokeWidth={1.75} />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="numeric"
        aria-label="Lot number lookup"
        title="Type a lot number and press Enter to see its full history"
        placeholder="Lot no."
        className="h-9 w-20 rounded-md border border-primary-foreground/25 bg-primary-foreground/10 pl-7 pr-2 text-sm text-primary-foreground placeholder:text-primary-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70 sm:w-28"
      />
    </form>
  );
};
