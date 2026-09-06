import { badRequest, notFound } from '../../lib/httpError';
import { rescheduleAutoBackup } from '../../lib/backupScheduler';
import * as repo from './backup.repository';
import type { RestoreBackupInput, UpdateAutoBackupSettingsInput } from './backup.schema';

export const createManualBackup = async (organizationId: string, actorId: string | null) => {
  const payload = await repo.buildBackupPayload(organizationId);
  await repo.recordBackup(organizationId, 'MANUAL', payload, actorId);
  return payload;
};

export const listBackups = (organizationId: string) => repo.listBackups(organizationId);

export const getBackupPayload = async (organizationId: string, id: string) => {
  const backup = await repo.findBackupById(organizationId, id);
  if (!backup) throw notFound('Backup not found');
  return backup.payload;
};

export const restoreBackup = async (organizationId: string, input: RestoreBackupInput) => {
  if (input.organizationId !== organizationId) {
    throw badRequest('This backup file belongs to a different organization and cannot be restored here');
  }
  await repo.restoreBusinessData(organizationId, input.data);
};

export const getAutoBackupSettings = (organizationId: string) => repo.getAutoBackupSettings(organizationId);

export const updateAutoBackupSettings = async (organizationId: string, input: UpdateAutoBackupSettingsInput) => {
  if (input.autoBackupEnabled && !input.autoBackupTime) {
    throw badRequest('A backup time is required to enable auto backup');
  }
  const settings = await repo.updateAutoBackupSettings(organizationId, {
    autoBackupEnabled: input.autoBackupEnabled,
    autoBackupTime: input.autoBackupTime ?? null,
  });
  await rescheduleAutoBackup();
  return settings;
};
