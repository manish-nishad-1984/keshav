import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useUiStore } from '../store/ui.store';
import { usePermissions } from './use-permissions';
import type { Book } from '../components/books/book-constants';

export const BOOKS_QUERY_KEY = ['books'] as const;

// The working book (lot-number series) picked in the header. The saved choice is only honoured
// while that book still exists and is active; otherwise the newest active book is used (the API
// lists books by name, newest first — "2026-27" before "2025-26").
export const useSelectedBook = () => {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canRead =
    isSuperAdmin || hasPermission('books:view') || hasPermission('cutting:view') || hasPermission('production_entries:view');
  const selectedBookId = useUiStore((state) => state.selectedBookId);
  const setSelectedBookId = useUiStore((state) => state.setSelectedBookId);

  const { data: books, isLoading } = useQuery({
    queryKey: BOOKS_QUERY_KEY,
    queryFn: () => apiClient.get<Book[]>('/books'),
    enabled: canRead,
  });

  const activeBooks = books?.filter((b) => b.isActive) ?? [];
  const selectedBook = activeBooks.find((b) => b.id === selectedBookId) ?? activeBooks[0] ?? null;

  return { canRead, books: books ?? [], activeBooks, selectedBook, setSelectedBookId, isLoading };
};
