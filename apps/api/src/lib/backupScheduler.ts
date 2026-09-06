import cron, { type ScheduledTask } from 'node-cron';
import { prisma } from './prisma';
import * as repo from '../modules/backup/backup.repository';

let currentTask: ScheduledTask | null = null;

const runScheduledBackups = async () => {
  const organizations = await prisma.organization.findMany({
    where: { autoBackupEnabled: true },
    select: { id: true },
  });

  for (const org of organizations) {
    try {
      const payload = await repo.buildBackupPayload(org.id);
      await repo.recordBackup(org.id, 'AUTO', payload, null);
    } catch (err) {
      console.error(`Auto backup failed for organization ${org.id}:`, err);
    }
  }
};

// Re-reads the (single, in practice) organization's auto-backup setting and (re)schedules the
// daily cron job accordingly. Call this at server startup and again whenever the setting changes,
// so a running server always reflects the latest persisted schedule without needing a restart.
export const rescheduleAutoBackup = async () => {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  const org = await prisma.organization.findFirst({
    where: { autoBackupEnabled: true, autoBackupTime: { not: null } },
  });
  if (!org?.autoBackupTime) return;

  const [hour, minute] = org.autoBackupTime.split(':').map(Number);
  currentTask = cron.schedule(`${minute} ${hour} * * *`, () => {
    void runScheduledBackups();
  });
};
