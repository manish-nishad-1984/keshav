import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './users.controller';

export const usersRouter = Router();

usersRouter.get('/', requirePermission('users:view'), asyncHandler(controller.list));
usersRouter.get('/:id', requirePermission('users:view'), asyncHandler(controller.get));
usersRouter.post('/', requirePermission('users:create'), asyncHandler(controller.create));
usersRouter.patch('/:id', requirePermission('users:update'), asyncHandler(controller.update));
usersRouter.patch('/:id/status', requirePermission('users:update'), asyncHandler(controller.setStatus));
usersRouter.post('/:id/reset-password', requirePermission('users:update'), asyncHandler(controller.resetPassword));
usersRouter.delete('/:id', requirePermission('users:delete'), asyncHandler(controller.remove));
