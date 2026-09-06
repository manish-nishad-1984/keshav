import type { Request, Response } from 'express';
import { ok, okList } from '../../lib/response';
import { createKarigarSchema, listKarigarsQuerySchema, updateKarigarSchema } from './karigars.schema';
import * as service from './karigars.service';

export const list = async (req: Request, res: Response) => {
  const query = listKarigarsQuerySchema.parse(req.query);
  const { items, total } = await service.listKarigars(req.auth!.organizationId, query);
  okList(res, items, query.page, query.pageSize, total);
};

export const get = async (req: Request, res: Response) => {
  const karigar = await service.getKarigar(req.auth!.organizationId, req.params.id);
  ok(res, karigar);
};

export const create = async (req: Request, res: Response) => {
  const input = createKarigarSchema.parse(req.body);
  const karigar = await service.createKarigar(req.auth!.organizationId, input, req.auth!.userId);
  ok(res, karigar, 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updateKarigarSchema.parse(req.body);
  const karigar = await service.updateKarigar(req.auth!.organizationId, req.params.id, input, req.auth!.userId);
  ok(res, karigar);
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteKarigar(req.auth!.organizationId, req.params.id, req.auth!.userId);
  ok(res, { deleted: true });
};
