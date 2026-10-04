import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './books.controller';

export const booksRouter = Router();

// Reading books is also allowed to anyone who works with cutting lots or production entries:
// the header's book selector and the cutting form's lot preview need it.
const canReadBooks = requirePermission('books:view', 'cutting:view', 'production_entries:view');

booksRouter.get('/', canReadBooks, asyncHandler(controller.list));
booksRouter.get('/:id/next-lot', canReadBooks, asyncHandler(controller.nextLotNumber));
booksRouter.post('/', requirePermission('books:create'), asyncHandler(controller.create));
booksRouter.patch('/:id', requirePermission('books:update'), asyncHandler(controller.update));
booksRouter.delete('/:id', requirePermission('books:delete'), asyncHandler(controller.remove));
