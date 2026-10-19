import type { Request, Response } from 'express';
import { ok, okList } from '../../lib/response';
import { notifyWhatsapp } from '../whatsapp/whatsapp.events';
import {
  availabilityQuerySchema,
  createDistributionSchema,
  listDistributionsQuerySchema,
  lotsQuerySchema,
  updateDistributionSchema,
} from './cutting-distribution.schema';
import * as service from './cutting-distribution.service';

export const list = async (req: Request, res: Response) => {
  const query = listDistributionsQuerySchema.parse(req.query);
  const { items, total } = await service.listDistributions(req.auth!.organizationId, query);
  okList(res, items, query.page, query.pageSize, total);
};

export const lots = async (req: Request, res: Response) => {
  const { bookId } = lotsQuerySchema.parse(req.query);
  ok(res, await service.listLots(req.auth!.organizationId, bookId));
};

export const availability = async (req: Request, res: Response) => {
  const { excludeId } = availabilityQuerySchema.parse(req.query);
  ok(res, await service.getAvailability(req.auth!.organizationId, req.params.cuttingEntryId, excludeId));
};

export const get = async (req: Request, res: Response) => {
  ok(res, await service.getDistribution(req.auth!.organizationId, req.params.id));
};

export const create = async (req: Request, res: Response) => {
  const input = createDistributionSchema.parse(req.body);
  const distribution = await service.createDistribution(req.auth!.organizationId, input, req.auth!.userId);
  ok(res, distribution, 201);
  notifyWhatsapp(req.auth!.organizationId, 'DISTRIBUTION', distribution.id);
};

export const update = async (req: Request, res: Response) => {
  const input = updateDistributionSchema.parse(req.body);
  ok(res, await service.updateDistribution(req.auth!.organizationId, req.params.id, input, req.auth!.userId));
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteDistribution(req.auth!.organizationId, req.params.id);
  ok(res, { deleted: true });
};
