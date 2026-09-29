import { z } from 'zod';

export const listProductionEntriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  carrierId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListProductionEntriesQuery = z.infer<typeof listProductionEntriesQuerySchema>;

export const createProductionEntrySchema = z.object({
  date: z.coerce.date(),
  // When set, the service resolves it to a CuttingEntry and derives itemId from that lot
  // server-side (authoritative — overrides whatever itemId the client also sent) rather than
  // trusting the client's own itemId for a lot-linked entry.
  lotNumber: z.string().min(1).optional(),
  designNumber: z.string().optional(),
  workTypeId: z.string().uuid(),
  // Required only when lotNumber isn't given — validated in the service, not here, since the
  // requirement is conditional on another field.
  itemId: z.string().uuid().optional(),

  carrierId: z.string().uuid(),
  carrierQuantity: z.coerce.number().int().positive(),
  carrierRate: z.coerce.number().positive(),

  overlockCarrierId: z.string().uuid().optional(),
  overlockRate: z.coerce.number().positive().optional(),

  flatlockKarigarId: z.string().uuid().optional(),
  flatlockRate: z.coerce.number().positive().optional(),

  photoUrl: z.string().optional(),
  remarks: z.string().optional(),
});
export type CreateProductionEntryInput = z.infer<typeof createProductionEntrySchema>;

export const updateProductionEntrySchema = z.object({
  date: z.coerce.date().optional(),
  designNumber: z.string().optional(),
  workTypeId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),

  carrierId: z.string().uuid().optional(),
  carrierQuantity: z.coerce.number().int().positive().optional(),
  carrierRate: z.coerce.number().positive().optional(),

  overlockCarrierId: z.string().uuid().nullable().optional(),
  overlockRate: z.coerce.number().positive().nullable().optional(),

  flatlockKarigarId: z.string().uuid().nullable().optional(),
  flatlockRate: z.coerce.number().positive().nullable().optional(),

  photoUrl: z.string().nullable().optional(),
  remarks: z.string().optional(),
});
export type UpdateProductionEntryInput = z.infer<typeof updateProductionEntrySchema>;
