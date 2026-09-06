import type { Request, Response } from 'express';
import { ok, okList } from '../../lib/response';
import { createItemSchema, listItemsQuerySchema, updateItemSchema } from './items.schema';
import * as service from './items.service';

export const list = async (req: Request, res: Response) => {
  const query = listItemsQuerySchema.parse(req.query);
  const { items, total } = await service.listItems(req.auth!.organizationId, query);
  okList(res, items, query.page, query.pageSize, total);
};

export const get = async (req: Request, res: Response) => {
  const item = await service.getItem(req.auth!.organizationId, req.params.id);
  ok(res, item);
};

export const create = async (req: Request, res: Response) => {
  const input = createItemSchema.parse(req.body);
  const item = await service.createItem(req.auth!.organizationId, input, req.auth!.userId);
  ok(res, item, 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updateItemSchema.parse(req.body);
  const item = await service.updateItem(req.auth!.organizationId, req.params.id, input, req.auth!.userId);
  ok(res, item);
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteItem(req.auth!.organizationId, req.params.id, req.auth!.userId);
  ok(res, { deleted: true });
};
