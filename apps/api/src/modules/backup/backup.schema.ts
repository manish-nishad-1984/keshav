import { z } from 'zod';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm 24-hour format');

export const updateAutoBackupSettingsSchema = z.object({
  autoBackupEnabled: z.boolean(),
  autoBackupTime: timeSchema.nullable().optional(),
});
export type UpdateAutoBackupSettingsInput = z.infer<typeof updateAutoBackupSettingsSchema>;

const backupPayloadSchema = z.object({
  version: z.literal(1),
  organizationId: z.string().uuid(),
  exportedAt: z.string(),
  data: z.object({
    workTypes: z.array(z.record(z.unknown())),
    itemCategories: z.array(z.record(z.unknown())),
    karigars: z.array(z.record(z.unknown())),
    items: z.array(z.record(z.unknown())),
    productionEntries: z.array(z.record(z.unknown())),
    payments: z.array(z.record(z.unknown())),
  }),
});
export type BackupPayload = z.infer<typeof backupPayloadSchema>;

// The uploaded file's content IS the request body — no wrapper object — matching what
// `POST /backups/export` itself returns, so a downloaded backup can be re-uploaded as-is.
export const restoreBackupSchema = backupPayloadSchema;
export type RestoreBackupInput = z.infer<typeof restoreBackupSchema>;
