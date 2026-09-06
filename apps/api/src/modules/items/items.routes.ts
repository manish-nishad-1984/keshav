import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import { itemCategoriesRouter } from '../item-categories/item-categories.routes';
import * as controller from './items.controller';

export const itemsRouter = Router();

// Mounted before the /:id routes below so "/items/categories" resolves here, not as an item id.
itemsRouter.use('/categories', itemCategoriesRouter);

itemsRouter.get('/', requirePermission('items:view'), asyncHandler(controller.list));
itemsRouter.get('/:id', requirePermission('items:view'), asyncHandler(controller.get));
itemsRouter.post('/', requirePermission('items:create'), asyncHandler(controller.create));
itemsRouter.patch('/:id', requirePermission('items:update'), asyncHandler(controller.update));
itemsRouter.delete('/:id', requirePermission('items:delete'), asyncHandler(controller.remove));
