import type { Request, Response } from 'express';
import { ok, okList } from '../../lib/response';
import {
  createProductionEntrySchema,
  listProductionEntriesQuerySchema,
  updateProductionEntrySchema,
} from './production-entries.schema';
import * as service from './production-entries.service';

export const list = async (req: Request, res: Response) => {
  const query = listProductionEntriesQuerySchema.parse(req.query);
  const { items, total } = await service.listProductionEntries(req.auth!.organizationId, query);
  okList(res, items, query.page, query.pageSize, total);
};

export const get = async (req: Request, res: Response) => {
  const entry = await service.getProductionEntry(req.auth!.organizationId, req.params.id);
  ok(res, entry);
};

export const create = async (req: Request, res: Response) => {
  const input = createProductionEntrySchema.parse(req.body);
  const entry = await service.createProductionEntry(req.auth!.organizationId, input, req.auth!.userId);
  ok(res, entry, 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updateProductionEntrySchema.parse(req.body);
  const entry = await service.updateProductionEntry(req.auth!.organizationId, req.params.id, input, req.auth!.userId);
  ok(res, entry);
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteProductionEntry(req.auth!.organizationId, req.params.id, req.auth!.userId);
  ok(res, { deleted: true });
};
