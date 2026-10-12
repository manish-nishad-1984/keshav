import type { Request, Response } from 'express';
import { buildPagination, ok } from '../../lib/response';
import { createSampleEntrySchema, listSampleEntriesQuerySchema, updateSampleEntrySchema } from './sample-entries.schema';
import * as service from './sample-entries.service';

// The list also returns the filtered totals (quantity and amount) for the footer.
export const list = async (req: Request, res: Response) => {
  const query = listSampleEntriesQuerySchema.parse(req.query);
  const { items, total, totals } = await service.listSampleEntries(req.auth!.organizationId, query);
  ok(res, { items, totals, pagination: buildPagination(query.page, query.pageSize, total) });
};

export const get = async (req: Request, res: Response) => {
  ok(res, await service.getSampleEntry(req.auth!.organizationId, req.params.id));
};

export const create = async (req: Request, res: Response) => {
  const input = createSampleEntrySchema.parse(req.body);
  ok(res, await service.createSampleEntry(req.auth!.organizationId, input, req.auth!.userId), 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updateSampleEntrySchema.parse(req.body);
  ok(res, await service.updateSampleEntry(req.auth!.organizationId, req.params.id, input, req.auth!.userId));
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteSampleEntry(req.auth!.organizationId, req.params.id, req.auth!.userId);
  ok(res, { deleted: true });
};
