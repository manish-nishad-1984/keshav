import type { Response } from 'express';
import type { Paginated, PaginationMeta } from '@ckfast/types';

export const ok = <T>(res: Response, data: T, status = 200) =>
  res.status(status).json({ success: true, data });

export const buildPagination = (page: number, pageSize: number, total: number): PaginationMeta => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

export const okList = <T>(res: Response, items: T[], page: number, pageSize: number, total: number) => {
  const payload: Paginated<T> = { items, pagination: buildPagination(page, pageSize, total) };
  return ok(res, payload);
};
