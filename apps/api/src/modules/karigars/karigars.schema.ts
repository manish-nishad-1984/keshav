import { z } from 'zod';

export const listKarigarsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  workTypeId: z.string().uuid().optional(),
});
export type ListKarigarsQuery = z.infer<typeof listKarigarsQuerySchema>;

// ID proofs: at most one each of Aadhaar front/back and PAN, any number of named other proofs.
const documentsSchema = z
  .array(
    z.object({
      type: z.enum(['AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN', 'OTHER']),
      label: z.string().trim().max(60).nullable().optional(),
      fileUrl: z.string().min(1),
    }),
  )
  .max(20)
  .refine(
    (docs) => ['AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN'].every((t) => docs.filter((d) => d.type === t).length <= 1),
    { message: 'Only one Aadhaar front, Aadhaar back and PAN photo each' },
  )
  .refine((docs) => docs.every((d) => d.type !== 'OTHER' || Boolean(d.label?.trim())), {
    message: 'Give each other proof a name (e.g. Voter ID)',
  });
export type KarigarDocumentInput = z.infer<typeof documentsSchema>[number];

export const createKarigarSchema = z.object({
  fullName: z.string().min(1),
  mobile: z.string().min(1),
  workTypeId: z.string().uuid(),
  photoUrl: z.string().optional(),
  joinDate: z.coerce.date().optional(),
  address: z.string().optional(),
  remarks: z.string().optional(),
  documents: documentsSchema.optional(),
});
export type CreateKarigarInput = z.infer<typeof createKarigarSchema>;

export const updateKarigarSchema = z.object({
  fullName: z.string().min(1).optional(),
  mobile: z.string().min(1).optional(),
  workTypeId: z.string().uuid().optional(),
  photoUrl: z.string().nullable().optional(),
  joinDate: z.coerce.date().nullable().optional(),
  address: z.string().optional(),
  remarks: z.string().optional(),
  isActive: z.boolean().optional(),
  documents: documentsSchema.optional(),
});
export type UpdateKarigarInput = z.infer<typeof updateKarigarSchema>;
