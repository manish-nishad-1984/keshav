import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { createWorkTypeSchema, updateWorkTypeSchema } from './work-types.schema';
import * as service from './work-types.service';

export const list = async (req: Request, res: Response) => {
  const workTypes = await service.listWorkTypes(req.auth!.organizationId);
  ok(res, workTypes);
};

export const create = async (req: Request, res: Response) => {
  const input = createWorkTypeSchema.parse(req.body);
  const workType = await service.createWorkType(req.auth!.organizationId, input, req.auth!.userId);
  ok(res, workType, 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updateWorkTypeSchema.parse(req.body);
  const workType = await service.updateWorkType(req.auth!.organizationId, req.params.id, input, req.auth!.userId);
  ok(res, workType);
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteWorkType(req.auth!.organizationId, req.params.id);
  ok(res, { deleted: true });
};
