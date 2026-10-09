import type { Request, Response } from 'express';
import { z } from 'zod';
import { ok } from '../../lib/response';
import * as repo from './dashboard.repository';

export const summary = async (req: Request, res: Response) => {
  const organizationId = req.auth!.organizationId;

  const [counts, productionTrend, topKarigars, workTypeBreakdown] = await Promise.all([
    repo.getCounts(organizationId),
    repo.getProductionTrend(organizationId),
    repo.getTopKarigars(organizationId),
    repo.getWorkTypeBreakdown(organizationId),
  ]);

  ok(res, { ...counts, productionTrend, topKarigars, workTypeBreakdown });
};

const lotStatusQuerySchema = z.object({ bookId: z.string().uuid().optional() });

export const lotStatus = async (req: Request, res: Response) => {
  const { bookId } = lotStatusQuerySchema.parse(req.query);
  ok(res, await repo.getLotStatus(req.auth!.organizationId, bookId));
};
