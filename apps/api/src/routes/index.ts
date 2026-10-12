import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authRouter } from '../modules/auth/auth.routes';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes';
import { usersRouter } from '../modules/users/users.routes';
import { rolesRouter } from '../modules/roles/roles.routes';
import { auditLogsRouter } from '../modules/audit-logs/audit-logs.routes';
import { karigarsRouter } from '../modules/karigars/karigars.routes';
import { itemsRouter } from '../modules/items/items.routes';
import { cuttingRouter } from '../modules/cutting/cutting.routes';
import { productionEntriesRouter } from '../modules/production-entries/production-entries.routes';
import { paymentsRouter } from '../modules/payments/payments.routes';
import { reportsRouter } from '../modules/reports/reports.routes';
import { backupRouter } from '../modules/backup/backup.routes';
import { organizationRouter } from '../modules/organization/organization.routes';
import { uploadsRouter } from '../modules/uploads/uploads.routes';
import { partiesRouter } from '../modules/parties/parties.routes';
import { booksRouter } from '../modules/books/books.routes';
import { cuttingDistributionRouter } from '../modules/cutting-distribution/cutting-distribution.routes';
import { deliveriesRouter } from '../modules/deliveries/deliveries.routes';
import { accessoriesRouter } from '../modules/accessories/accessories.routes';
import { accessoryIssuesRouter } from '../modules/accessory-issues/accessory-issues.routes';
import { pressEntriesRouter } from '../modules/press-entries/press-entries.routes';
import { sampleEntriesRouter } from '../modules/sample-entries/sample-entries.routes';

interface ProtectedRoute {
  path: string;
  router: Router;
}

// New modules register here — one entry, guarded by their own `requirePermission` calls inside
// the router — and never require touching anything else in this file.
const protectedRoutes: ProtectedRoute[] = [
  { path: '/dashboard', router: dashboardRouter },
  { path: '/users', router: usersRouter },
  { path: '/roles', router: rolesRouter },
  { path: '/audit-logs', router: auditLogsRouter },
  { path: '/karigars', router: karigarsRouter },
  { path: '/items', router: itemsRouter },
  { path: '/parties', router: partiesRouter },
  { path: '/books', router: booksRouter },
  { path: '/cutting', router: cuttingRouter },
  { path: '/cutting-distributions', router: cuttingDistributionRouter },
  { path: '/deliveries', router: deliveriesRouter },
  { path: '/accessories', router: accessoriesRouter },
  { path: '/accessory-issues', router: accessoryIssuesRouter },
  { path: '/production-entries', router: productionEntriesRouter },
  { path: '/press-entries', router: pressEntriesRouter },
  { path: '/sample-entries', router: sampleEntriesRouter },
  { path: '/payments', router: paymentsRouter },
  { path: '/reports', router: reportsRouter },
  { path: '/backups', router: backupRouter },
  { path: '/organization', router: organizationRouter },
  { path: '/uploads', router: uploadsRouter },
];

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));

apiRouter.use('/auth', authRouter);

for (const route of protectedRoutes) {
  apiRouter.use(route.path, authenticate, route.router);
}
