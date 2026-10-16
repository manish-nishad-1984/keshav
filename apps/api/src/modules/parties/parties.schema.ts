import { z } from 'zod';
import { nameSchema } from '../../lib/names';

// Blank optional text fields are stored as null rather than "".
const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const createPartySchema = z.object({
  name: nameSchema,
  mobile: optionalText,
  referenceName: optionalText,
  address: optionalText,
  isActive: z.boolean().optional(),
});
export type CreatePartyInput = z.infer<typeof createPartySchema>;

export const updatePartySchema = z.object({
  name: nameSchema.optional(),
  mobile: optionalText,
  referenceName: optionalText,
  address: optionalText,
  isActive: z.boolean().optional(),
});
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
