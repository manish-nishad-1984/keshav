import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { createBookSchema, updateBookSchema } from './books.schema';
import * as service from './books.service';

export const list = async (req: Request, res: Response) => {
  ok(res, await service.listBooks(req.auth!.organizationId));
};

export const nextLotNumber = async (req: Request, res: Response) => {
  ok(res, await service.getNextLotNumber(req.auth!.organizationId, req.params.id));
};

export const create = async (req: Request, res: Response) => {
  const input = createBookSchema.parse(req.body);
  ok(res, await service.createBook(req.auth!.organizationId, input, req.auth!.userId), 201);
};

export const update = async (req: Request, res: Response) => {
  const input = updateBookSchema.parse(req.body);
  ok(res, await service.updateBook(req.auth!.organizationId, req.params.id, input, req.auth!.userId));
};

export const remove = async (req: Request, res: Response) => {
  await service.deleteBook(req.auth!.organizationId, req.params.id);
  ok(res, { deleted: true });
};
