import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { createPatternTypeSchema, updatePatternTypeSchema } from './pattern-types.schema';
import * as service from './pattern-types.service';

export const list = async (req: Request, res: Response) => {
  const patternTypes = await service.listPatternTypes(req.auth!.organizationId);
  ok(res, patternTypes);
};

export const create = async (req: Request, res: Response) => {
  const input = createPatternTypeSchema.parse(req.body);
  const patternType = await service.createPatternType(req.auth!.organizationId, input, req.auth!.userId);
  ok(res, patternType, 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updatePatternTypeSchema.parse(req.body);
  const patternType = await service.updatePatternType(
    req.auth!.organizationId,
    req.params.id,
    input,
    req.auth!.userId,
  );
  ok(res, patternType);
};

export const remove = async (req: Request, res: Response) => {
  await service.deletePatternType(req.auth!.organizationId, req.params.id);
  ok(res, { deleted: true });
};
