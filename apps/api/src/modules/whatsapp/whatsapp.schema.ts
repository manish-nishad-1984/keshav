import { z } from 'zod';

export const saveWhatsappConfigSchema = z.object({
  enabled: z.boolean(),
  apiUrl: z.string().trim().url().max(200),
  // Empty / missing keeps the token already saved.
  token: z.string().trim().max(200).optional(),
  device: z.string().trim().max(100).optional(),
});
export type SaveWhatsappConfigInput = z.infer<typeof saveWhatsappConfigSchema>;

export const testMessageSchema = z.object({
  to: z.string().trim().min(8).max(20),
  message: z.string().trim().min(1).max(1000).optional(),
});

export const listMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED']).optional(),
});
