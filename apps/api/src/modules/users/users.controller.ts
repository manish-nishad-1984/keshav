import type { Request, Response } from 'express';
import { ok, okList } from '../../lib/response';
import { createUserSchema, listUsersQuerySchema, setUserStatusSchema, updateUserSchema } from './users.schema';
import * as service from './users.service';

export const list = async (req: Request, res: Response) => {
  const query = listUsersQuerySchema.parse(req.query);
  const { items, total } = await service.listUsers(req.auth!.organizationId, query.page, query.pageSize, query.search);
  okList(res, items, query.page, query.pageSize, total);
};

export const get = async (req: Request, res: Response) => {
  const user = await service.getUser(req.auth!.organizationId, req.params.id);
  ok(res, user);
};

export const create = async (req: Request, res: Response) => {
  const input = createUserSchema.parse(req.body);
  const user = await service.createUser(req.auth!.organizationId, input, req.auth!.userId);
  ok(res, user, 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updateUserSchema.parse(req.body);
  const user = await service.updateUser(req.auth!.organizationId, req.params.id, input, req.auth!.userId);
  ok(res, user);
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteUser(req.auth!.organizationId, req.params.id, req.auth!.userId);
  ok(res, { deleted: true });
};

export const setStatus = async (req: Request, res: Response) => {
  const input = setUserStatusSchema.parse(req.body);
  const user = await service.setStatus(req.auth!.organizationId, req.params.id, input, req.auth!.userId);
  ok(res, user);
};

export const resetPassword = async (req: Request, res: Response) => {
  const result = await service.resetPassword(req.auth!.organizationId, req.params.id);
  ok(res, result);
};
