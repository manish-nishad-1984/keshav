import { z } from 'zod';

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  ownerName: z.string().optional(),
  gstNumber: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  logoUrl: z.string().nullable().optional(),
  currency: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).optional(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
