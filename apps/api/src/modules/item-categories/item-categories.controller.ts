import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { createItemCategorySchema, updateItemCategorySchema } from './item-categories.schema';
import * as service from './item-categories.service';

export const list = async (req: Request, res: Response) => {
  const categories = await service.listItemCategories(req.auth!.organizationId);
  ok(res, categories);
};

export const create = async (req: Request, res: Response) => {
  const input = createItemCategorySchema.parse(req.body);
  const category = await service.createItemCategory(req.auth!.organizationId, input, req.auth!.userId);
  ok(res, category, 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updateItemCategorySchema.parse(req.body);
  const category = await service.updateItemCategory(req.auth!.organizationId, req.params.id, input, req.auth!.userId);
  ok(res, category);
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteItemCategory(req.auth!.organizationId, req.params.id);
  ok(res, { deleted: true });
};
