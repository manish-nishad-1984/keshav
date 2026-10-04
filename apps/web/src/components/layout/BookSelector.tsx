import * as SelectPrimitive from '@radix-ui/react-select';
import { BookOpen, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SelectContent, SelectItem } from '../ui/select';
import { useSelectedBook } from '../../hooks/use-selected-book';
import { usePermissions } from '../../hooks/use-permissions';

// Header control for the working book (lot-number series). Every new cutting lot is numbered in
// this book, and Daily Production Entry looks lot numbers up in it.
export const BookSelector = () => {
  const { canRead, activeBooks, selectedBook, setSelectedBookId, isLoading } = useSelectedBook();
  const { hasPermission, isSuperAdmin } = usePermissions();

  if (!canRead || isLoading) return null;

  if (!selectedBook) {
    // No active book yet: point people who can create one at Book Master.
    return isSuperAdmin || hasPermission('books:create') ? (
      <Link
        to="/books"
        className="flex h-9 items-center gap-1.5 rounded-md border border-dashed border-primary-foreground/50 px-2.5 text-xs font-medium text-primary-foreground/90 hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
      >
        <BookOpen className="size-4" strokeWidth={1.75} />
        Add book
      </Link>
    ) : null;
  }

  return (
    <SelectPrimitive.Root value={selectedBook.id} onValueChange={setSelectedBookId}>
      <SelectPrimitive.Trigger
        aria-label="Working book"
        title="Working book — new lot numbers are created in this series"
        className="flex h-9 max-w-[9.5rem] items-center gap-1.5 rounded-md border border-primary-foreground/25 bg-primary-foreground/10 pl-2 pr-1.5 text-sm text-primary-foreground transition-colors duration-150 hover:bg-primary-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70 data-[state=open]:bg-primary-foreground/20 sm:max-w-none"
      >
        <BookOpen className="size-4 shrink-0 text-primary-foreground/80" strokeWidth={1.75} />
        <span className="hidden text-2xs uppercase tracking-wider text-primary-foreground/70 sm:inline">Book</span>
        <span className="truncate font-semibold">
          <SelectPrimitive.Value />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-primary-foreground/80" strokeWidth={1.75} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectContent align="start">
        {activeBooks.map((book) => (
          <SelectItem key={book.id} value={book.id}>
            {book.name}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectPrimitive.Root>
  );
};
