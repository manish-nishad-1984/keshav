import { createApp } from './app';
import { env } from './lib/env';
import { rescheduleAutoBackup } from './lib/backupScheduler';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}${env.API_PREFIX}`);
});

// Restores the persisted auto-backup schedule (if any) on every server start/restart — without
// this, a previously-enabled schedule would silently stop firing after any restart until the
// setting was re-saved.
void rescheduleAutoBackup();
