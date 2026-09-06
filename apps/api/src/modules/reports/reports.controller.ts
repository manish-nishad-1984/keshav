import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { reportDateRangeQuerySchema } from './reports.schema';
import * as service from './reports.service';

export const karigarSummary = async (req: Request, res: Response) => {
  const query = reportDateRangeQuerySchema.parse(req.query);
  ok(res, await service.getKarigarSummary(req.auth!.organizationId, query));
};

export const itemSummary = async (req: Request, res: Response) => {
  const query = reportDateRangeQuerySchema.parse(req.query);
  ok(res, await service.getItemSummary(req.auth!.organizationId, query));
};

export const monthlySummary = async (req: Request, res: Response) => {
  const query = reportDateRangeQuerySchema.parse(req.query);
  ok(res, await service.getMonthlySummary(req.auth!.organizationId, query));
};
