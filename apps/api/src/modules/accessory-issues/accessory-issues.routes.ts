import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './accessory-issues.controller';

export const accessoryIssuesRouter = Router();

// Registered before /:id so these paths aren't read as an entry id.
accessoryIssuesRouter.get('/karigar-lots', requirePermission('accessory_issues:view'), asyncHandler(controller.karigarLots));
accessoryIssuesRouter.get('/position', requirePermission('accessory_issues:view'), asyncHandler(controller.position));
accessoryIssuesRouter.get('/balance', requirePermission('accessory_issues:view'), asyncHandler(controller.balance));

accessoryIssuesRouter.get('/', requirePermission('accessory_issues:view'), asyncHandler(controller.list));
accessoryIssuesRouter.get('/:id', requirePermission('accessory_issues:view'), asyncHandler(controller.get));
accessoryIssuesRouter.post('/', requirePermission('accessory_issues:create'), asyncHandler(controller.create));
accessoryIssuesRouter.patch('/:id', requirePermission('accessory_issues:update'), asyncHandler(controller.update));
accessoryIssuesRouter.delete('/:id', requirePermission('accessory_issues:delete'), asyncHandler(controller.remove));
