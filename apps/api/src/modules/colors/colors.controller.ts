import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { createColorSchema, updateColorSchema } from './colors.schema';
import * as service from './colors.service';

export const list = async (req: Request, res: Response) => {
  const colors = await service.listColors(req.auth!.organizationId);
  ok(res, colors);
};

export const create = async (req: Request, res: Response) => {
  const input = createColorSchema.parse(req.body);
  const color = await service.createColor(req.auth!.organizationId, input, req.auth!.userId);
  ok(res, color, 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updateColorSchema.parse(req.body);
  const color = await service.updateColor(req.auth!.organizationId, req.params.id, input, req.auth!.userId);
  ok(res, color);
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteColor(req.auth!.organizationId, req.params.id);
  ok(res, { deleted: true });
};
