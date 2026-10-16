import type { Request, Response } from 'express';
import { ok, okList } from '../../lib/response';
import {
  closeLotSchema,
  createCuttingEntrySchema,
  listCuttingEntriesQuerySchema,
  lotLookupQuerySchema,
  updateCuttingEntrySchema,
} from './cutting.schema';
import * as service from './cutting.service';
import { getLotHistory } from './lot-history';

export const list = async (req: Request, res: Response) => {
  const query = listCuttingEntriesQuerySchema.parse(req.query);
  const { items, total } = await service.listCuttingEntries(req.auth!.organizationId, query);
  okList(res, items, query.page, query.pageSize, total);
};

export const get = async (req: Request, res: Response) => {
  const entry = await service.getCuttingEntry(req.auth!.organizationId, req.params.id);
  ok(res, entry);
};

export const getByLotNumber = async (req: Request, res: Response) => {
  const { bookId } = lotLookupQuerySchema.parse(req.query);
  const entry = await service.getCuttingEntryByLotNumber(req.auth!.organizationId, bookId, req.params.lotNumber);
  ok(res, entry);
};

export const colorPhotos = async (req: Request, res: Response) => {
  ok(res, await service.getLotColorPhotos(req.auth!.organizationId, req.params.cuttingEntryId));
};

export const lotHistory = async (req: Request, res: Response) => {
  const { bookId } = lotLookupQuerySchema.parse(req.query);
  ok(res, await getLotHistory(req.auth!.organizationId, bookId, req.params.lotNumber));
};

export const create = async (req: Request, res: Response) => {
  const input = createCuttingEntrySchema.parse(req.body);
  const entry = await service.createCuttingEntry(req.auth!.organizationId, input, req.auth!.userId);
  ok(res, entry, 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updateCuttingEntrySchema.parse(req.body);
  const entry = await service.updateCuttingEntry(req.auth!.organizationId, req.params.id, input, req.auth!.userId);
  ok(res, entry);
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteCuttingEntry(req.auth!.organizationId, req.params.id, req.auth!.userId);
  ok(res, { deleted: true });
};

export const deletionSummary = async (req: Request, res: Response) => {
  ok(res, await service.getLotDeletionSummary(req.auth!.organizationId, req.params.id));
};

export const removeWithEverything = async (req: Request, res: Response) => {
  ok(res, await service.deleteCuttingEntryWithEverything(req.auth!.organizationId, req.params.id));
};

export const close = async (req: Request, res: Response) => {
  const input = closeLotSchema.parse(req.body);
  ok(res, await service.closeCuttingEntry(req.auth!.organizationId, req.params.id, input, req.auth!.userId));
};

export const reopen = async (req: Request, res: Response) => {
  ok(res, await service.reopenCuttingEntry(req.auth!.organizationId, req.params.id, req.auth!.userId));
};
