import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './organization.controller';

export const organizationRouter = Router();

organizationRouter.get('/', requirePermission('company_settings:view'), asyncHandler(controller.get));
organizationRouter.patch('/', requirePermission('company_settings:update'), asyncHandler(controller.update));
