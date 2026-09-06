import type { Request, Response } from 'express';
import { ok, okList } from '../../lib/response';
import { createRoleSchema, listRolesQuerySchema, updateRoleSchema } from './roles.schema';
import * as service from './roles.service';

export const list = async (req: Request, res: Response) => {
  const query = listRolesQuerySchema.parse(req.query);
  const { items, total } = await service.listRoles(req.auth!.organizationId, query.page, query.pageSize);
  okList(res, items, query.page, query.pageSize, total);
};

export const get = async (req: Request, res: Response) => {
  const role = await service.getRole(req.auth!.organizationId, req.params.id);
  ok(res, role);
};

export const create = async (req: Request, res: Response) => {
  const input = createRoleSchema.parse(req.body);
  const role = await service.createRole(req.auth!.organizationId, input, req.auth!.userId);
  ok(res, role, 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updateRoleSchema.parse(req.body);
  const role = await service.updateRole(req.auth!.organizationId, req.params.id, input, req.auth!.userId);
  ok(res, role);
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteRole(req.auth!.organizationId, req.params.id);
  ok(res, { deleted: true });
};

export const permissionCatalog = async (_req: Request, res: Response) => {
  ok(res, service.getPermissionCatalog());
};
