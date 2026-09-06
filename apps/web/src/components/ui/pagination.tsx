import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@ckfast/types';
import { Button } from './button';
import { cn } from '../../lib/utils';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  className?: string;
}

const pageWindow = (current: number, total: number): number[] => {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, Math.max(current + 2, 5));
  const pages: number[] = [];
  for (let p = Math.max(1, start); p <= Math.min(total, end); p += 1) pages.push(p);
  return pages;
};

export const Pagination = ({ meta, onPageChange, className }: PaginationProps) => {
  if (meta.totalPages <= 1) return null;

  return (
    <div className={cn('flex items-center justify-between gap-3 px-4 py-3', className)}>
      <p className="text-2xs text-muted-foreground">
        Showing {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total}{' '}
        entries
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={!meta.hasPrev}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pageWindow(meta.page, meta.totalPages).map((p) => (
          <Button
            key={p}
            variant={p === meta.page ? 'default' : 'outline'}
            size="icon"
            className="size-8"
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ))}
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={!meta.hasNext}
          onClick={() => onPageChange(meta.page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
};
