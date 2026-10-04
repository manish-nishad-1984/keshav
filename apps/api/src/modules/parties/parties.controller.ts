import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { createPartySchema, updatePartySchema } from './parties.schema';
import * as service from './parties.service';

export const list = async (req: Request, res: Response) => {
  ok(res, await service.listParties(req.auth!.organizationId));
};

export const create = async (req: Request, res: Response) => {
  const input = createPartySchema.parse(req.body);
  ok(res, await service.createParty(req.auth!.organizationId, input, req.auth!.userId), 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updatePartySchema.parse(req.body);
  ok(res, await service.updateParty(req.auth!.organizationId, req.params.id, input, req.auth!.userId));
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteParty(req.auth!.organizationId, req.params.id);
  ok(res, { deleted: true });
};
