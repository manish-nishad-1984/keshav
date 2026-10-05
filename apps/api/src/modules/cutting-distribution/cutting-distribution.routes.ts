import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './cutting-distribution.controller';

export const cuttingDistributionRouter = Router();

// Registered before /:id so these paths aren't read as a distribution id.
cuttingDistributionRouter.get('/lots', requirePermission('cutting_distribution:view'), asyncHandler(controller.lots));
cuttingDistributionRouter.get(
  '/availability/:cuttingEntryId',
  requirePermission('cutting_distribution:view'),
  asyncHandler(controller.availability),
);

cuttingDistributionRouter.get('/', requirePermission('cutting_distribution:view'), asyncHandler(controller.list));
cuttingDistributionRouter.get('/:id', requirePermission('cutting_distribution:view'), asyncHandler(controller.get));
cuttingDistributionRouter.post('/', requirePermission('cutting_distribution:create'), asyncHandler(controller.create));
cuttingDistributionRouter.patch('/:id', requirePermission('cutting_distribution:update'), asyncHandler(controller.update));
cuttingDistributionRouter.delete('/:id', requirePermission('cutting_distribution:delete'), asyncHandler(controller.remove));
