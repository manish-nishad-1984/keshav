import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './payments.controller';

export const paymentsRouter = Router();

// Registered before /:id below so "/payments/ledger" resolves here, not as a payment id.
paymentsRouter.get('/ledger', requirePermission('payments:view'), asyncHandler(controller.ledger));

paymentsRouter.get('/', requirePermission('payments:view'), asyncHandler(controller.list));
paymentsRouter.get('/:id', requirePermission('payments:view'), asyncHandler(controller.get));
paymentsRouter.post('/', requirePermission('payments:create'), asyncHandler(controller.create));
paymentsRouter.patch('/:id', requirePermission('payments:update'), asyncHandler(controller.update));
paymentsRouter.delete('/:id', requirePermission('payments:delete'), asyncHandler(controller.remove));
