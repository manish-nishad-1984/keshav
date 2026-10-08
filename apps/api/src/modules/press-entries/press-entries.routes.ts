import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './press-entries.controller';

export const pressEntriesRouter = Router();

// Online / offline rates (Settings → General). Registered before /:id.
pressEntriesRouter.get('/rates', requirePermission('press_entries:view'), asyncHandler(controller.getRates));
pressEntriesRouter.put('/rates', requirePermission('company_settings:update'), asyncHandler(controller.saveRates));

pressEntriesRouter.get('/', requirePermission('press_entries:view'), asyncHandler(controller.list));
pressEntriesRouter.get('/:id', requirePermission('press_entries:view'), asyncHandler(controller.get));
pressEntriesRouter.post('/', requirePermission('press_entries:create'), asyncHandler(controller.create));
pressEntriesRouter.patch('/:id', requirePermission('press_entries:update'), asyncHandler(controller.update));
pressEntriesRouter.delete('/:id', requirePermission('press_entries:delete'), asyncHandler(controller.remove));
