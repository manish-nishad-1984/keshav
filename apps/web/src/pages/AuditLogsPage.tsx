import { useQuery } from '@tanstack/react-query';
import type { Paginated } from '@ckfast/types';
import { apiClient } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { LoadingState } from '../components/ui/loading-state';
import { formatDateTime } from '../lib/date';

interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityLabel: string | null;
  actorEmail: string | null;
  createdAt: string;
}

export const AuditLogsPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', { page: 1 }],
    queryFn: () => apiClient.list<AuditLogRow>('/audit-logs', { page: 1, pageSize: 20 }),
  });

  return (
    <PageLayout title="Audit Log" description="Who did what, when.">
      <Card>
        {isLoading ? (
          <LoadingState variant="page" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Entity</th>
                  <th className="px-4 py-2 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody>
                {(data as Paginated<AuditLogRow> | undefined)?.items.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 numeric text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="info">{entry.action}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {entry.entityType}
                      {entry.entityLabel ? ` — ${entry.entityLabel}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{entry.actorEmail ?? 'System'}</td>
                  </tr>
                ))}
                {!data?.items.length ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No activity recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageLayout>
  );
};
