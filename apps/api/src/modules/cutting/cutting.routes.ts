import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import { patternTypesRouter } from '../pattern-types/pattern-types.routes';
import { colorsRouter } from '../colors/colors.routes';
import * as controller from './cutting.controller';

export const cuttingRouter = Router();

cuttingRouter.use('/pattern-types', patternTypesRouter);
cuttingRouter.use('/colors', colorsRouter);

// Registered before /:id so a lot number lookup isn't swallowed by the id route — used by
// Daily Production Entry to resolve a typed-in lot number to its cutting entry.
cuttingRouter.get('/lot/:lotNumber', requirePermission('production_entries:view'), asyncHandler(controller.getByLotNumber));

cuttingRouter.get('/', requirePermission('cutting:view'), asyncHandler(controller.list));
cuttingRouter.get('/:id', requirePermission('cutting:view'), asyncHandler(controller.get));
cuttingRouter.post('/', requirePermission('cutting:create'), asyncHandler(controller.create));
cuttingRouter.patch('/:id', requirePermission('cutting:update'), asyncHandler(controller.update));
cuttingRouter.delete('/:id', requirePermission('cutting:delete'), asyncHandler(controller.remove));
