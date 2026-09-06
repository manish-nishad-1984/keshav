# Adding your first real module

The whole point of this boilerplate is that auth, theming, and RBAC plumbing never need to
change when a new module is added. Follow this loop every time:

1. Add the module's actions to `MODULE_PERMISSIONS` in `packages/types/src/rbac.ts`.
2. Add its entry to `MODULES` in `packages/shared/src/modules.ts`.
3. Re-run `npm run -w apps/api db:seed` so the new `Permission` rows exist and get granted to
   whichever roles should have them (add the module's actions to the relevant `ROLE_SEEDS` entry
   in `apps/api/prisma/seed/access.ts` first — e.g. `only('your_module', 'view', 'create')`).
4. Build the API module under `apps/api/src/modules/your-module/` (schema/repository/service/
   controller/routes), guard every route with `requirePermission('your_module:action')`, and add
   it to the `protectedRoutes` array in `apps/api/src/routes/index.ts`.
5. Build the web page(s) and add the component to `MODULE_PAGES` in
   `apps/web/src/routes/module-routes.tsx`.

Nothing about the login flow, JWT/refresh handling, the sidebar, or the route guards should ever
need to change for a new module to show up correctly guarded in both the nav and the API — it's
driven entirely by the two registries in steps 1 and 2.
