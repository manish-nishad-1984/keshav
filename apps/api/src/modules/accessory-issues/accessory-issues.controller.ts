import type { Request, Response } from 'express';
import { ok, okList } from '../../lib/response';
import {
  balanceQuerySchema,
  createTransactionSchema,
  karigarLotsQuerySchema,
  listTransactionsQuerySchema,
  pendingReturnsQuerySchema,
  positionQuerySchema,
  updateTransactionSchema,
} from './accessory-issues.schema';
import * as service from './accessory-issues.service';

export const list = async (req: Request, res: Response) => {
  const query = listTransactionsQuerySchema.parse(req.query);
  const { items, total } = await service.listTransactions(req.auth!.organizationId, query);
  okList(res, items, query.page, query.pageSize, total);
};

export const karigarLots = async (req: Request, res: Response) => {
  const { karigarId, bookId } = karigarLotsQuerySchema.parse(req.query);
  ok(res, await service.listKarigarLots(req.auth!.organizationId, karigarId, bookId));
};

export const position = async (req: Request, res: Response) => {
  const { karigarId, cuttingEntryId, excludeId } = positionQuerySchema.parse(req.query);
  ok(res, await service.getPosition(req.auth!.organizationId, karigarId, cuttingEntryId, excludeId));
};

export const balance = async (req: Request, res: Response) => {
  const { bookId, karigarId } = balanceQuerySchema.parse(req.query);
  ok(res, await service.getBalance(req.auth!.organizationId, bookId, karigarId));
};

export const pendingReturns = async (req: Request, res: Response) => {
  const scope = pendingReturnsQuerySchema.parse(req.query);
  ok(res, await service.getPendingReturns(req.auth!.organizationId, scope));
};

export const get = async (req: Request, res: Response) => {
  ok(res, await service.getTransaction(req.auth!.organizationId, req.params.id));
};

export const create = async (req: Request, res: Response) => {
  const input = createTransactionSchema.parse(req.body);
  ok(res, await service.createTransaction(req.auth!.organizationId, input, req.auth!.userId), 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updateTransactionSchema.parse(req.body);
  ok(res, await service.updateTransaction(req.auth!.organizationId, req.params.id, input, req.auth!.userId));
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteTransaction(req.auth!.organizationId, req.params.id);
  ok(res, { deleted: true });
};
