import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Paginated } from '@ckfast/types';
import { apiClient } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { LoadingState } from '../components/ui/loading-state';
import { Pagination } from '../components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { formatDateTime } from '../lib/date';
import { cn } from '../lib/utils';

interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityLabel: string | null;
  actorEmail: string | null;
  changedFields: string[];
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_VARIANT: Record<string, 'success' | 'info' | 'danger' | 'neutral'> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
};

const ENTITIES = [
  'CuttingEntry',
  'CuttingDistribution',
  'ProductionEntry',
  'Delivery',
  'AccessoryTransaction',
  'PressEntry',
  'Payment',
  'Karigar',
  'Item',
  'Party',
  'Book',
  'User',
  'Role',
] as const;

const ALL = 'all';

const show = (value: unknown) => (typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '—'));

// A record's values (create / delete) or the before → after of the fields an edit changed.
const Details = ({ row }: { row: AuditLogRow }) => {
  if (row.action === 'UPDATE' && row.changedFields.length) {
    return (
      <ul className="space-y-0.5 text-sm">
        {row.changedFields.map((field) => (
          <li key={field}>
            <span className="font-medium">{field}</span>: <span className="text-muted-foreground">{show(row.oldValues?.[field])}</span> →{' '}
            <span className="font-medium">{show(row.newValues?.[field])}</span>
          </li>
        ))}
      </ul>
    );
  }
  const values = row.action === 'CREATE' ? row.newValues : row.oldValues;
  return (
    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-xs">{values ? JSON.stringify(values, null, 2) : '—'}</pre>
  );
};

export const AuditLogsPage = () => {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState<string>(ALL);
  const [open, setOpen] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', { page, entity }],
    queryFn: () => apiClient.list<AuditLogRow>('/audit-logs', { page, pageSize: 25, entityType: entity === ALL ? undefined : entity }),
  });
  const rows = (data as Paginated<AuditLogRow> | undefined)?.items ?? [];

  return (
    <PageLayout title="Audit Log" description="Who created, changed or deleted what, and when.">
      <Card>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-sm text-muted-foreground">Show</span>
          <Select
            value={entity}
            onValueChange={(v) => {
              setPage(1);
              setEntity(v);
            }}
          >
            <SelectTrigger className="w-56" aria-label="Record type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Everything</SelectItem>
              {ENTITIES.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isLoading ? (
          <LoadingState variant="page" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left text-sm">
              <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Record</th>
                  <th className="px-4 py-2 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => {
                  const isOpen = open === entry.id;
                  return (
                    <Fragment key={entry.id}>
                      <tr
                        className={cn('cursor-pointer border-b border-border hover:bg-muted/40', isOpen && 'bg-muted/40')}
                        onClick={() => setOpen(isOpen ? null : entry.id)}
                      >
                        <td className="px-2 py-2.5 text-muted-foreground">{isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</td>
                        <td className="numeric whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDateTime(entry.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={ACTION_VARIANT[entry.action] ?? 'neutral'}>{entry.action}</Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          {entry.entityType}
                          {entry.entityLabel ? ` — ${entry.entityLabel}` : ''}
                          {entry.action === 'UPDATE' && entry.changedFields.length ? (
                            <span className="ml-2 text-xs text-muted-foreground">({entry.changedFields.join(', ')})</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{entry.actorEmail ?? 'System'}</td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-b border-border bg-muted/20">
                          <td />
                          <td colSpan={4} className="px-4 py-2">
                            <Details row={entry} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                {!rows.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No activity recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
        {data ? <Pagination meta={(data as Paginated<AuditLogRow>).pagination} onPageChange={setPage} className="border-t border-border" /> : null}
      </Card>
    </PageLayout>
  );
};
