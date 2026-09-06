import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './auth.controller';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(controller.login));
authRouter.post('/refresh', asyncHandler(controller.refresh));
authRouter.post('/logout', asyncHandler(controller.logout));
authRouter.post('/forgot-password', asyncHandler(controller.forgotPassword));
authRouter.post('/reset-password', asyncHandler(controller.resetPassword));

authRouter.get('/me', authenticate, asyncHandler(controller.me));
authRouter.post('/logout-everywhere', authenticate, asyncHandler(controller.logoutEverywhere));
