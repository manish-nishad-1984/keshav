import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { createAccessorySchema, setDesignAccessoriesSchema, updateAccessorySchema } from './accessories.schema';
import * as service from './accessories.service';

export const list = async (req: Request, res: Response) => {
  ok(res, await service.listAccessories(req.auth!.organizationId));
};

export const create = async (req: Request, res: Response) => {
  const input = createAccessorySchema.parse(req.body);
  ok(res, await service.createAccessory(req.auth!.organizationId, input, req.auth!.userId), 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updateAccessorySchema.parse(req.body);
  ok(res, await service.updateAccessory(req.auth!.organizationId, req.params.id, input, req.auth!.userId));
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteAccessory(req.auth!.organizationId, req.params.id);
  ok(res, { deleted: true });
};

export const listDesigns = async (req: Request, res: Response) => {
  ok(res, await service.listDesigns(req.auth!.organizationId));
};

export const getDesign = async (req: Request, res: Response) => {
  ok(res, await service.getDesignAccessories(req.auth!.organizationId, req.params.itemId));
};

export const setDesign = async (req: Request, res: Response) => {
  const input = setDesignAccessoriesSchema.parse(req.body);
  ok(res, await service.setDesignAccessories(req.auth!.organizationId, req.params.itemId, input));
};
