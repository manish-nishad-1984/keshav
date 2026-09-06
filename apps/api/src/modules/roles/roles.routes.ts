import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './roles.controller';

export const rolesRouter = Router();

rolesRouter.get('/', requirePermission('roles:view'), asyncHandler(controller.list));
rolesRouter.get('/permission-catalog', requirePermission('roles:view'), asyncHandler(controller.permissionCatalog));
rolesRouter.get('/:id', requirePermission('roles:view'), asyncHandler(controller.get));
rolesRouter.post('/', requirePermission('roles:create'), asyncHandler(controller.create));
rolesRouter.patch('/:id', requirePermission('roles:update'), asyncHandler(controller.update));
rolesRouter.delete('/:id', requirePermission('roles:delete'), asyncHandler(controller.remove));
