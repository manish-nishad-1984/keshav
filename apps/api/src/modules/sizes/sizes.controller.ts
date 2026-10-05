import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { createSizeSchema, updateSizeSchema } from './sizes.schema';
import * as service from './sizes.service';

export const list = async (req: Request, res: Response) => {
  ok(res, await service.listSizes(req.auth!.organizationId));
};

export const create = async (req: Request, res: Response) => {
  const input = createSizeSchema.parse(req.body);
  ok(res, await service.createSize(req.auth!.organizationId, input, req.auth!.userId), 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updateSizeSchema.parse(req.body);
  ok(res, await service.updateSize(req.auth!.organizationId, req.params.id, input, req.auth!.userId));
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteSize(req.auth!.organizationId, req.params.id);
  ok(res, { deleted: true });
};
