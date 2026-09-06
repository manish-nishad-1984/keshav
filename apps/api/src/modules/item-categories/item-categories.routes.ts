import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './item-categories.controller';

export const itemCategoriesRouter = Router();

itemCategoriesRouter.get('/', requirePermission('items:view'), asyncHandler(controller.list));
itemCategoriesRouter.post('/', requirePermission('items:manage'), asyncHandler(controller.create));
itemCategoriesRouter.patch('/:id', requirePermission('items:manage'), asyncHandler(controller.update));
itemCategoriesRouter.delete('/:id', requirePermission('items:manage'), asyncHandler(controller.remove));
