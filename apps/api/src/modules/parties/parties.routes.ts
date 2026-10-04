import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './parties.controller';

export const partiesRouter = Router();

// The cutting form's party dropdown needs the list too.
partiesRouter.get('/', requirePermission('parties:view', 'cutting:view'), asyncHandler(controller.list));
partiesRouter.post('/', requirePermission('parties:create'), asyncHandler(controller.create));
partiesRouter.patch('/:id', requirePermission('parties:update'), asyncHandler(controller.update));
partiesRouter.delete('/:id', requirePermission('parties:delete'), asyncHandler(controller.remove));
