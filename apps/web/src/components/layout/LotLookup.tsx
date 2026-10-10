import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Hash, Loader2 } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { usePermissions } from '../../hooks/use-permissions';
import { useSelectedBook } from '../../hooks/use-selected-book';

// Header box: type a lot number, press Enter, and see everything about that lot (in the working book).
// The lot is fetched here first: a lot that does not exist shows a message right under the box and
// the history page is never opened. A lot that exists lands in the query cache, so the page is instant.
export const LotLookup = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const { selectedBook } = useSelectedBook();
  const [value, setValue] = useState('');
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!selectedBook || !(isSuperAdmin || hasPermission('cutting:view'))) return null;
  const bookId = selectedBook.id;

  const lookup = async () => {
    const lot = value.trim();
    if (!lot || checking) return;
    setChecking(true);
    setMessage(null);
    try {
      await queryClient.fetchQuery({
        queryKey: ['lot-history', bookId, lot],
        queryFn: () => apiClient.get(`/cutting/history/${encodeURIComponent(lot)}`, { bookId }),
        staleTime: 30_000,
      });
      setValue('');
      navigate(`/lot-history?lot=${encodeURIComponent(lot)}`);
    } catch (err) {
      setMessage(
        err instanceof ApiRequestError && err.status === 404
          ? `Lot ${lot} does not exist in book ${selectedBook.name}.`
          : 'Could not check the lot. Please try again.',
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <form
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        void lookup();
      }}
    >
      {checking ? (
        <Loader2 className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 animate-spin text-primary-foreground/70" />
      ) : (
        <Hash className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-primary-foreground/70" strokeWidth={1.75} />
      )}
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setMessage(null);
        }}
        inputMode="numeric"
        aria-label="Lot number lookup"
        title="Type a lot number and press Enter to see its full history"
        placeholder="Lot no."
        className="h-9 w-20 rounded-md border border-primary-foreground/25 bg-primary-foreground/10 pl-7 pr-2 text-sm text-primary-foreground placeholder:text-primary-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70 sm:w-28"
      />
      {message ? (
        <div
          role="alert"
          className="absolute left-0 top-11 z-50 w-64 rounded-md border border-status-danger/40 bg-card px-3 py-2 text-sm font-medium text-status-danger shadow-lg"
        >
          {message}
        </div>
      ) : null}
    </form>
  );
};
