import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HardDriveDownload, Upload, Download, TriangleAlert } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { usePermissions } from '../../hooks/use-permissions';
import { formatDate, formatDateTime, localIsoDate } from '../../lib/date';

interface BackupHistoryRow {
  id: string;
  triggeredBy: 'MANUAL' | 'AUTO';
  sizeBytes: number;
  createdAt: string;
}

interface AutoBackupSettings {
  autoBackupEnabled: boolean;
  autoBackupTime: string | null;
}

const formatSize = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

const downloadJson = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const BackupRestoreTab = () => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canCreate = isSuperAdmin || hasPermission('backups:create');
  const canManage = isSuperAdmin || hasPermission('backups:manage');
  const canView = isSuperAdmin || hasPermission('backups:view');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: history } = useQuery({
    queryKey: ['backups', 'history'],
    queryFn: () => apiClient.get<BackupHistoryRow[]>('/backups/history'),
    enabled: canView,
  });

  const { data: settings } = useQuery({
    queryKey: ['backups', 'settings'],
    queryFn: () => apiClient.get<AutoBackupSettings>('/backups/settings'),
    enabled: canView,
  });

  const backupMutation = useMutation({
    mutationFn: () => apiClient.post('/backups/export'),
    onSuccess: (payload) => {
      downloadJson(`ckfast-backup-${formatDate(localIsoDate())}.json`, payload);
      setNotice('Backup created and downloaded.');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['backups', 'history'] });
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Could not create backup.'),
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected');
      const text = await selectedFile.text();
      const parsed = JSON.parse(text);
      return apiClient.post('/backups/restore', parsed);
    },
    onSuccess: () => {
      setRestoreConfirmOpen(false);
      setConfirmText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setNotice('Data restored from backup.');
      setError(null);
      void queryClient.invalidateQueries();
    },
    onError: (err) => {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof SyntaxError
            ? 'That file is not valid JSON.'
            : 'Could not restore from this backup.',
      );
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (id: string) => apiClient.get(`/backups/history/${id}`),
    onSuccess: (payload, id) => downloadJson(`ckfast-backup-${id}.json`, payload),
  });

  const settingsMutation = useMutation({
    mutationFn: (data: AutoBackupSettings) => apiClient.patch<AutoBackupSettings>('/backups/settings', data),
    onSuccess: (result) => {
      queryClient.setQueryData(['backups', 'settings'], result);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Could not save auto backup settings.'),
  });

  return (
    <div className="space-y-4">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {notice ? <FormAlert tone="success">{notice}</FormAlert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Backup Data</CardTitle>
          <CardDescription>Create a backup of your all data (Karigar, Production, Payment, etc.).</CardDescription>
        </CardHeader>
        <CardContent>
          {canCreate ? (
            <Button onClick={() => backupMutation.mutate()} loading={backupMutation.isPending}>
              <HardDriveDownload />
              Create Backup
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">You don't have permission to create backups.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Restore Data</CardTitle>
          <CardDescription>Restore from a previously saved backup file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!canManage}>
              Choose File
            </Button>
            <span className="text-sm text-muted-foreground">{selectedFile?.name ?? 'No file chosen'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            variant="destructive"
            disabled={!canManage || !selectedFile}
            onClick={() => setRestoreConfirmOpen(true)}
          >
            <Upload />
            Restore
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto Backup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-backup-enabled"
                disabled={!canManage}
                checked={settings?.autoBackupEnabled ?? false}
                onCheckedChange={(checked) =>
                  settingsMutation.mutate({
                    autoBackupEnabled: checked === true,
                    autoBackupTime: settings?.autoBackupTime ?? '23:00',
                  })
                }
              />
              <Label htmlFor="auto-backup-enabled" className="cursor-pointer font-normal">
                Enable auto backup (daily)
              </Label>
            </div>
            <FormField label="Backup Time" className="w-full sm:w-40">
              <Input
                type="time"
                disabled={!canManage || !settings?.autoBackupEnabled}
                value={settings?.autoBackupTime ?? '23:00'}
                onChange={(e) =>
                  settingsMutation.mutate({ autoBackupEnabled: settings?.autoBackupEnabled ?? false, autoBackupTime: e.target.value })
                }
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {canView ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent Backups</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {history?.length ? (
                history.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <div>
                      <p className="font-medium">{formatDateTime(row.createdAt)}</p>
                      <p className="text-2xs text-muted-foreground">
                        {row.triggeredBy === 'AUTO' ? 'Automatic' : 'Manual'} · {formatSize(row.sizeBytes)}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => downloadMutation.mutate(row.id)}>
                      <Download />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No backups yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={restoreConfirmOpen} onOpenChange={(open) => !open && setRestoreConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="size-4" />
              Restore data?
            </DialogTitle>
            <DialogDescription>
              This replaces all current Karigar, Item, Production, and Payment data with the contents of{' '}
              <strong>{selectedFile?.name}</strong>. This cannot be undone. Type <strong>RESTORE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type RESTORE to confirm"
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreConfirmOpen(false)} disabled={restoreMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== 'RESTORE'}
              loading={restoreMutation.isPending}
              onClick={() => restoreMutation.mutate()}
            >
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
