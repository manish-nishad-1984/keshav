import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { apiClient, ApiRequestError } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { LoadingState } from '../components/ui/loading-state';
import { ActionMenu, type ActionMenuItem } from '../components/common/ActionMenu';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { usePermissions } from '../hooks/use-permissions';
import { BOOKS_QUERY_KEY, useSelectedBook } from '../hooks/use-selected-book';
import { BookFormDialog } from '../components/books/BookFormDialog';
import type { Book } from '../components/books/book-constants';

export const BooksPage = () => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const { books, selectedBook, setSelectedBookId, isLoading } = useSelectedBook();
  const [formOpen, setFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canCreate = isSuperAdmin || hasPermission('books:create');
  const canUpdate = isSuperAdmin || hasPermission('books:update');
  const canDelete = isSuperAdmin || hasPermission('books:delete');

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/books/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BOOKS_QUERY_KEY });
      setDeleteTarget(null);
    },
    onError: (err) => setDeleteError(err instanceof ApiRequestError ? err.message : 'Could not delete this book.'),
  });

  const rowActions = (book: Book): ActionMenuItem[] => [
    {
      key: 'select',
      label: 'Work in this book',
      icon: <CheckCircle2 />,
      onSelect: () => setSelectedBookId(book.id),
      disabled: !book.isActive || book.id === selectedBook?.id,
    },
    {
      key: 'edit',
      label: 'Edit',
      icon: <Pencil />,
      onSelect: () => {
        setEditingBook(book);
        setFormOpen(true);
      },
      disabled: !canUpdate,
      separatorBefore: true,
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 />,
      onSelect: () => {
        setDeleteError(null);
        setDeleteTarget(book);
      },
      destructive: true,
      disabled: !canDelete || book.lotCount > 0,
      separatorBefore: true,
    },
  ];

  return (
    <PageLayout
      title="Book Master"
      description="Lot number series. The selected book in the header numbers every new cutting lot."
      actions={
        canCreate ? (
          <Button
            onClick={() => {
              setEditingBook(null);
              setFormOpen(true);
            }}
          >
            <Plus />
            Add Book
          </Button>
        ) : null
      }
    >
      <Card>
        {isLoading ? (
          <LoadingState variant="page" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left text-sm">
              <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Series Name</th>
                  <th className="px-4 py-2 font-medium text-right">Series Number</th>
                  <th className="px-4 py-2 font-medium text-right">Lots</th>
                  <th className="px-4 py-2 font-medium text-right">Next Lot</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {books.map((book) => (
                  <tr key={book.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium">
                      {book.name}
                      {book.id === selectedBook?.id ? (
                        <Badge variant="info" className="ml-2">
                          Selected
                        </Badge>
                      ) : null}
                    </td>
                    <td className="numeric px-4 py-2.5 text-right text-muted-foreground">{book.startNumber}</td>
                    <td className="numeric px-4 py-2.5 text-right text-muted-foreground">{book.lotCount}</td>
                    <td className="numeric px-4 py-2.5 text-right font-medium">{book.nextLotNumber}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={book.isActive ? 'success' : 'danger'}>{book.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <ActionMenu items={rowActions(book)} />
                    </td>
                  </tr>
                ))}
                {!books.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No books yet. Add one (e.g. 2025-26) to start numbering cutting lots.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <BookFormDialog open={formOpen} onOpenChange={setFormOpen} book={editingBook} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete book"
        description={
          <>
            Delete book "{deleteTarget?.name}"? This cannot be undone.
            {deleteError ? <span className="mt-2 block font-medium text-destructive">{deleteError}</span> : null}
          </>
        }
        confirmLabel="Delete"
        tone="destructive"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </PageLayout>
  );
};
