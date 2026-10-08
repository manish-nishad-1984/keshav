import type { Request, Response } from 'express';
import { buildPagination, ok } from '../../lib/response';
import {
  createPressEntrySchema,
  listPressEntriesQuerySchema,
  pressRatesSchema,
  updatePressEntrySchema,
} from './press-entries.schema';
import * as service from './press-entries.service';

// The list also returns the filtered totals (pieces and amount) for the footer.
export const list = async (req: Request, res: Response) => {
  const query = listPressEntriesQuerySchema.parse(req.query);
  const { items, total, totals } = await service.listPressEntries(req.auth!.organizationId, query);
  ok(res, { items, totals, pagination: buildPagination(query.page, query.pageSize, total) });
};

export const get = async (req: Request, res: Response) => {
  ok(res, await service.getPressEntry(req.auth!.organizationId, req.params.id));
};

export const create = async (req: Request, res: Response) => {
  const input = createPressEntrySchema.parse(req.body);
  ok(res, await service.createPressEntry(req.auth!.organizationId, input, req.auth!.userId), 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updatePressEntrySchema.parse(req.body);
  ok(res, await service.updatePressEntry(req.auth!.organizationId, req.params.id, input, req.auth!.userId));
};

export const remove = async (req: Request, res: Response) => {
  await service.deletePressEntry(req.auth!.organizationId, req.params.id, req.auth!.userId);
  ok(res, { deleted: true });
};

export const getRates = async (req: Request, res: Response) => {
  ok(res, await service.getPressRates(req.auth!.organizationId));
};

export const saveRates = async (req: Request, res: Response) => {
  const rates = pressRatesSchema.parse(req.body);
  ok(res, await service.savePressRates(req.auth!.organizationId, rates));
};
