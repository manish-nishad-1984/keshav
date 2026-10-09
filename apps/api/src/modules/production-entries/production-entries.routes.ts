import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './production-entries.controller';

export const productionEntriesRouter = Router();

// Registered before /:id so it isn't read as an entry id.
productionEntriesRouter.get('/karigar-lots', requirePermission('production_entries:view'), asyncHandler(controller.karigarLots));
productionEntriesRouter.get('/availability', requirePermission('production_entries:view'), asyncHandler(controller.availability));
productionEntriesRouter.get('/', requirePermission('production_entries:view'), asyncHandler(controller.list));
productionEntriesRouter.get('/:id', requirePermission('production_entries:view'), asyncHandler(controller.get));
productionEntriesRouter.post('/', requirePermission('production_entries:create'), asyncHandler(controller.create));
productionEntriesRouter.patch('/:id', requirePermission('production_entries:update'), asyncHandler(controller.update));
productionEntriesRouter.delete('/:id', requirePermission('production_entries:delete'), asyncHandler(controller.remove));
