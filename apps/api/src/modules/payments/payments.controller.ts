import type { Request, Response } from 'express';
import { ok, okList } from '../../lib/response';
import { createPaymentSchema, listPaymentsQuerySchema, updatePaymentSchema } from './payments.schema';
import * as service from './payments.service';

export const list = async (req: Request, res: Response) => {
  const query = listPaymentsQuerySchema.parse(req.query);
  const { items, total } = await service.listPayments(req.auth!.organizationId, query);
  okList(res, items, query.page, query.pageSize, total);
};

export const ledger = async (req: Request, res: Response) => {
  const rows = await service.getLedger(req.auth!.organizationId);
  ok(res, rows);
};

export const get = async (req: Request, res: Response) => {
  const payment = await service.getPayment(req.auth!.organizationId, req.params.id);
  ok(res, payment);
};

export const create = async (req: Request, res: Response) => {
  const input = createPaymentSchema.parse(req.body);
  const payment = await service.createPayment(req.auth!.organizationId, input, req.auth!.userId);
  ok(res, payment, 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updatePaymentSchema.parse(req.body);
  const payment = await service.updatePayment(req.auth!.organizationId, req.params.id, input, req.auth!.userId);
  ok(res, payment);
};

export const remove = async (req: Request, res: Response) => {
  await service.deletePayment(req.auth!.organizationId, req.params.id, req.auth!.userId);
  ok(res, { deleted: true });
};
