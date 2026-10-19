import { z } from 'zod';

export const saveWhatsappConfigSchema = z.object({
  enabled: z.boolean(),
  apiUrl: z.string().trim().url().max(200),
  // Empty / missing keeps the token already saved.
  token: z.string().trim().max(200).optional(),
  device: z.string().trim().max(100).optional(),
});
export type SaveWhatsappConfigInput = z.infer<typeof saveWhatsappConfigSchema>;

const eventSettingSchema = z.object({
  enabled: z.boolean(),
  recipients: z.array(z.string().max(30)).max(10),
  // Extra numbers, comma or line separated (owner, manager).
  extraNumbers: z.string().trim().max(500).default(''),
  template: z.string().trim().min(1, 'Message text is required').max(1500),
});

export const saveEventSettingsSchema = z
  .object({
    DISTRIBUTION: eventSettingSchema,
    PRODUCTION: eventSettingSchema,
    ACCESSORY_ISSUE: eventSettingSchema,
    ACCESSORY_RETURN: eventSettingSchema,
    DELIVERY: eventSettingSchema,
  })
  .partial();

export const testMessageSchema = z.object({
  to: z.string().trim().min(8).max(20),
  message: z.string().trim().min(1).max(1000).optional(),
});

export const listMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED']).optional(),
});
