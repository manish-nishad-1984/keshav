import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { updateOrganizationSchema } from './organization.schema';
import * as service from './organization.service';

export const get = async (req: Request, res: Response) => {
  const organization = await service.getOrganization(req.auth!.organizationId);
  ok(res, organization);
};

export const update = async (req: Request, res: Response) => {
  const input = updateOrganizationSchema.parse(req.body);
  const organization = await service.updateOrganization(req.auth!.organizationId, input, req.auth!.userId);
  ok(res, organization);
};
