import type { Request, Response } from 'express';
import { ok, okList } from '../../lib/response';
import { notifyWhatsapp } from '../whatsapp/whatsapp.events';
import {
  availabilityQuerySchema,
  createDeliverySchema,
  listDeliveriesQuerySchema,
  lotsQuerySchema,
  updateDeliverySchema,
} from './deliveries.schema';
import * as service from './deliveries.service';

export const list = async (req: Request, res: Response) => {
  const query = listDeliveriesQuerySchema.parse(req.query);
  const { items, total } = await service.listDeliveries(req.auth!.organizationId, query);
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
  ok(res, await service.getDelivery(req.auth!.organizationId, req.params.id));
};

export const challan = async (req: Request, res: Response) => {
  ok(res, await service.getChallan(req.auth!.organizationId, req.params.id));
};

export const create = async (req: Request, res: Response) => {
  const input = createDeliverySchema.parse(req.body);
  const delivery = await service.createDelivery(req.auth!.organizationId, input, req.auth!.userId);
  ok(res, delivery, 201);
  notifyWhatsapp(req.auth!.organizationId, 'DELIVERY', delivery.id);
};

export const update = async (req: Request, res: Response) => {
  const input = updateDeliverySchema.parse(req.body);
  ok(res, await service.updateDelivery(req.auth!.organizationId, req.params.id, input, req.auth!.userId));
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteDelivery(req.auth!.organizationId, req.params.id);
  ok(res, { deleted: true });
};
