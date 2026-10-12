import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './sample-entries.controller';

export const sampleEntriesRouter = Router();

sampleEntriesRouter.get('/', requirePermission('sample_entries:view'), asyncHandler(controller.list));
sampleEntriesRouter.get('/:id', requirePermission('sample_entries:view'), asyncHandler(controller.get));
sampleEntriesRouter.post('/', requirePermission('sample_entries:create'), asyncHandler(controller.create));
sampleEntriesRouter.patch('/:id', requirePermission('sample_entries:update'), asyncHandler(controller.update));
sampleEntriesRouter.delete('/:id', requirePermission('sample_entries:delete'), asyncHandler(controller.remove));
