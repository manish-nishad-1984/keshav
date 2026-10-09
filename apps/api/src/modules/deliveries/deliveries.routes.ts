import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './deliveries.controller';

export const deliveriesRouter = Router();

// Registered before /:id so these paths aren't read as a delivery id.
deliveriesRouter.get('/lots', requirePermission('deliveries:view'), asyncHandler(controller.lots));
deliveriesRouter.get('/availability/:cuttingEntryId', requirePermission('deliveries:view'), asyncHandler(controller.availability));

deliveriesRouter.get('/', requirePermission('deliveries:view'), asyncHandler(controller.list));
deliveriesRouter.get('/:id/challan', requirePermission('deliveries:view'), asyncHandler(controller.challan));
deliveriesRouter.get('/:id', requirePermission('deliveries:view'), asyncHandler(controller.get));
deliveriesRouter.post('/', requirePermission('deliveries:create'), asyncHandler(controller.create));
deliveriesRouter.patch('/:id', requirePermission('deliveries:update'), asyncHandler(controller.update));
deliveriesRouter.delete('/:id', requirePermission('deliveries:delete'), asyncHandler(controller.remove));
