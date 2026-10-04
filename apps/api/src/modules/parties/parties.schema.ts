import { z } from 'zod';

// Blank optional text fields are stored as null rather than "".
const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const createPartySchema = z.object({
  name: z.string().trim().min(1),
  mobile: optionalText,
  referenceName: optionalText,
  address: optionalText,
  isActive: z.boolean().optional(),
});
export type CreatePartyInput = z.infer<typeof createPartySchema>;

export const updatePartySchema = z.object({
  name: z.string().trim().min(1).optional(),
  mobile: optionalText,
  referenceName: optionalText,
  address: optionalText,
  isActive: z.boolean().optional(),
});
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
