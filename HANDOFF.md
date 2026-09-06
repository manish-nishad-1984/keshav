# Session Handoff — ck-fast / GarmentTrack

**Snapshot:** 2026-09-06 22:15 IST
**Status:** Dashboard (screen 2) rebuilt with GarmentTrack-specific stats and charts — that's 12 of
16 mockup screens done. Since then, this round was pure UI polish/branding requested directly by
the user (sticky footer, gray form fields, "CK Fast" → "KESHAV Trading & Co." rename, navy
header) — no new screens. Only User Management (14) and a self-service Profile page (16) remain
unbuilt.

## What's done

**Generic ERP boilerplate** (pre-existing scaffold, then extended this session with sections 10–13 from the `erp-boilerplate` skill):
- Users CRUD: `apps/web/src/pages/UsersPage.tsx` + `apps/web/src/components/users/UserFormDialog.tsx` — search, create/edit modal with role checklist, reset-password (temp password shown once), suspend/reactivate, delete. Backend: `apps/api/src/modules/users/*` including `PATCH /users/:id/status` and `POST /users/:id/reset-password` (both added this session, revoke live refresh tokens).
- Roles CRUD: `apps/web/src/pages/RolesPage.tsx` + `apps/web/src/components/roles/RoleFormDialog.tsx` — permission matrix grouped by nav section. Backend: `apps/api/src/modules/roles/*` including `GET /roles/permission-catalog` (reads `MODULE_PERMISSIONS` from `@ckfast/types`, not the DB) and a delete guard blocking removal of roles still referenced by a `UserRole`.
- Theme toggle: `apps/web/src/store/ui.store.ts` (Zustand + persist, light/dark/system) + `apps/web/src/components/common/ThemeToggle.tsx` in the Topbar.
- Command palette: `apps/web/src/components/common/CommandPalette.tsx` (cmdk), Ctrl/Cmd+K or the Topbar search affordance, mounted in `AppLayout`.
- New shared UI primitives added: `ui/dialog.tsx`, `ui/dropdown-menu.tsx`, `common/ActionMenu.tsx`, `common/ConfirmDialog.tsx`.

**GarmentTrack business module — Karigar Master (mockup screens 3 & 4):**
- Prisma: `Karigar` model + `WorkType` enum (`STITCHING`/`CUTTING`/`FINISHING`/`PACKING`) in `apps/api/prisma/schema.prisma`, migration `20260906113858_add_karigars` applied.
- Backend module: `apps/api/src/modules/karigars/*` (schema/repository/service/controller/routes), registered in `apps/api/src/routes/index.ts`. Auto-generates sequential `KRG-001`, `KRG-002`... codes via a new reusable helper `apps/api/src/lib/numberSequence.ts` (built on the boilerplate's `NumberSequence` table — atomic upsert, safe under concurrency).
- Generic photo upload: `apps/api/src/modules/uploads/uploads.routes.ts` (`POST /uploads`, multer 2.x, 5MB limit, jpg/png/webp only) + static serving of `apps/api/uploads/` mounted in `apps/api/src/app.ts`. **Reusable as-is** for Photo Gallery (screen 7) and Daily Production Entry's photo field (screen 5).
- Frontend: `apps/web/src/pages/KarigarsPage.tsx` switches between `components/karigars/KarigarListView.tsx` (search, work-type filter, avatar thumbnails, click-to-toggle Active/Inactive badge, pagination) and `KarigarFormView.tsx` (full-page form, not a modal — matches the mockup's screen 4 layout, unlike Users/Roles which use modals).
- New reusable components created along the way — check these exist before building new ones: `ui/pagination.tsx`, `common/PhotoUpload.tsx`, `ui/textarea.tsx`.
- RBAC: added `karigars` to `MODULE_PERMISSIONS` (`packages/types/src/rbac.ts`) and to `MODULES` nav registry (`packages/shared/src/modules.ts`, icon `Shirt`, group `general`, order 10). Seed re-run so `karigars:*` permission rows exist and are granted to super_admin/admin/viewer.

**GarmentTrack business module — Item / Design Master (mockup screen 8):**
- Prisma: `ItemCategory` model (name, prefix, isActive) + `Item` model (categoryId, styleNo, itemName, photoUrl, isActive) in `apps/api/prisma/schema.prisma`, migration `20260906120851_add_items` applied. `Item.styleNo` is unique per org and generated once at creation via `nextSequenceCode(organizationId, category.prefix)` — e.g. picking category "T-Shirt" (prefix `TS`) yields `TS-001`, `TS-002`... Changing an item's category later does **not** regenerate its style no.
- Backend modules: `apps/api/src/modules/items/*` (the item CRUD, 5-file pattern) and `apps/api/src/modules/item-categories/*` (category CRUD, same pattern). The categories router is mounted *inside* `items.routes.ts` at `/categories` (`itemsRouter.use('/categories', itemCategoriesRouter)`, registered before the `/:id` routes) rather than as a separate top-level entry in `routes/index.ts` — keeps `/items/categories/*` from being swallowed by the `/items/:id` route.
- RBAC: single `items` module added to `MODULE_PERMISSIONS` with actions `view/create/update/delete/export/manage` — `manage` guards category CRUD (create/rename/delete category), the CRUD actions guard the items themselves. No separate `item_categories` permission module — categories are always managed in service of items, not a standalone nav destination.
- Nav: `items` added to `MODULES` (`packages/shared/src/modules.ts`), label "Item / Design Master", icon `Layers`, group `general`, order 20 (after karigars' order 10).
- Frontend: `apps/web/src/pages/ItemsPage.tsx` — single list page (no full-page form like Karigar; mockup only shows one screen for this module) with search, category filter, "+ Add Item" opening `components/items/ItemFormDialog.tsx` (modal, matches the Users/Roles dialog pattern). Category management (add/rename/toggle-active/delete) lives in `components/items/CategoryManagerDialog.tsx`, opened either from the Items page toolbar ("Manage Categories" button, gated on `items:manage`) or inline from the category `<Select>` inside `ItemFormDialog` (gear icon next to the dropdown) — there's no separate Category nav screen in the 16-screen mockup, so this was a judgment call, confirmed with the user before building (fixed enum vs. separate master, and modal vs. full-page form were all explicitly confirmed, not guessed).
- Category `prefix` is immutable after creation (enforced by omitting it from `updateItemCategorySchema`) — only `name`/`isActive` can change, since existing style numbers already baked the old prefix in.
- Deleting a category is blocked (409 conflict) while **any** item still references it — including soft-deleted items, not just live ones (see gotcha below on why). Same guard pattern as Roles blocking deletion of a role still assigned to a user.
- **`ItemCategory` hard-deletes, unlike every other master in this app** (Karigar/Item/User/Role all soft-delete via `deletedAt`). This was a same-session bug fix, not the original design — see gotcha below. Don't copy the soft-delete pattern onto `ItemCategory` again.

**GarmentTrack business module — Settings (mockup screen 13):**
- Frontend: `apps/web/src/pages/SettingsPage.tsx` — a left vertical tab list (not the Users/Roles
  modal pattern, not Karigar's full-page-swap pattern; a *third* layout shape, because that's what
  this mockup screen shows) with 5 tabs, each its own component under
  `apps/web/src/components/settings/`:
  - `CompanyInfoTab.tsx` — Logo (reuses `PhotoUpload`), Company Name, Owner Name, GST Number,
    Mobile No., Email, Address. Backed by `Organization` columns directly (see below), not the
    generic `CompanySetting` key-value table — these are stable, always-present fields, so plain
    columns keep reads/writes simple and typed.
  - `WorkTypeTab.tsx` — full inline CRUD for the new `WorkType` master (add/rename/toggle-active/
    delete), gated on `karigars:manage`. Same list-row-with-inline-rename UI pattern as
    `CategoryManagerDialog.tsx`, just rendered directly in the tab instead of inside a `Dialog`.
  - `UserManagementTab.tsx` — **link-out only**: a short blurb + "Go to Users" button routing to
    `/users` (the existing, fully-built Users page). Confirmed with the user rather than duplicating
    the Users CRUD UI a second time.
  - `BackupRestoreTab.tsx` — **placeholder only**. Mockup screen 15 (the real Backup & Restore
    screen) hasn't been built yet, so this tab just explains that. Build screen 15 for real
    functionality here, then this tab can link out to it the same way User Management does.
  - `GeneralSettingsTab.tsx` — Currency, Timezone (plain text inputs), Fiscal Year Start Month
    (select). Backed by the `Organization.currency`/`timezone`/`fiscalYearStartMonth` columns that
    already existed unused in the schema from the boilerplate scaffold.
- Backend: new `apps/api/src/modules/organization/*` module (5-file pattern) — `GET /organization`
  and `PATCH /organization`, guarded by `company_settings:view`/`company_settings:update` (that
  permission module already existed from the boilerplate but had no route or nav entry until now).
  Reads/writes the single `Organization` row for the caller's org directly — no separate settings
  table.
- Schema: added `ownerName`/`gstNumber` columns to `Organization` (migration `20260906123428_org_owner_gst`,
  purely additive, no data loss).
- Nav: `company_settings` added to `MODULES` (`packages/shared/src/modules.ts`), label "Settings",
  icon `Settings`, group `general`, order 30.
- **Real company info was entered during verification and left in place, not cleaned up**: name
  "Keshav Trading & Co", owner "Jenish Akbari", GST `24BQOPA0044D1ZB`, phone `8866039996`, email
  `jenish@example.com`, address "Surat, Gujarat, India" — this is the actual client info shown in
  the mockup's Settings/Login screens, not placeholder test data, so it was kept rather than reverted.

**WorkType: converted from a fixed Prisma enum to a full manageable master**, explicitly requested
by the user (bigger-scope option offered alongside "read-only list" and "skip for now"). This
touched the already-shipped Karigar module and one real piece of user data:
- Schema: new `WorkType` model (`id`, `organizationId`, `name`, `isActive` — same hard-delete
  reasoning as `ItemCategory`, see above) replaces `enum WorkType`. `Karigar.workType` (enum column)
  became `Karigar.workTypeId` (FK to `WorkType`, `onDelete: Restrict`).
- **This required a hand-authored migration, not a plain `prisma migrate dev`**, because the
  environment is non-interactive (Prisma refuses to prompt for data-loss confirmation and just
  errors out — see gotcha below) and because there was one real Karigar row ("Man", Stitching) that
  had to survive with its work type intact. Migration `20260906123222_work_type_master` was scaffolded
  empty via `prisma migrate dev --create-only`, then hand-written to: create `work_types`, seed 4
  rows (Stitching/Cutting/Finishing/Packing) per existing organization, add a nullable `workTypeId`
  column, backfill it from the old enum value by name match, set it `NOT NULL`, drop the old
  `workType` column and enum type, then add the FK constraint — applied via `prisma migrate deploy`.
  Verified after the fact via raw SQL that "Man" correctly landed on the new "Stitching" row before
  regenerating the client. **If you need another enum→master conversion later (e.g. if Item
  Category's fixed set ever needs this treatment reversed, or a new enum shows up), copy this
  playbook — don't attempt it via a plain interactive-assuming `migrate dev` in this environment.**
- Backend: new `apps/api/src/modules/work-types/*` (5-file pattern), router nested inside
  `karigars.routes.ts` at `/karigars/work-types` (same nesting trick as items/item-categories, for
  the same reason — keeps `/karigars/work-types` from being swallowed by `/karigars/:id`).
- RBAC: added `manage` action to the existing `karigars` module permissions (`karigars: [...CRUD,
  'export', 'manage']`) — `manage` guards work-type CRUD, same convention as `items:manage` for
  item categories.
- Frontend: `karigar-constants.ts` now exports a `WorkType` interface instead of the old
  `WORK_TYPES`/`WORK_TYPE_LABELS` constants; `KarigarListView.tsx` and `KarigarFormView.tsx` both
  fetch `/karigars/work-types` live instead of using a hardcoded list. `KarigarFormView` defaults a
  *new* karigar to the first fetched work type once the list loads (there's no more fixed default
  like `'STITCHING'`).
- Delete guard: deleting a work type in use is blocked (409), counting soft-deleted karigars too —
  same FK-reality reasoning as `ItemCategory`'s guard. Verified: creating "Embroidery", deleting it
  clean (unused) succeeded; deleting "Stitching" (used by the real karigar) correctly 409'd.

**GarmentTrack business module — Daily Production Entry (mockup screen 5):**
- Prisma: `ProductionEntry` model in `apps/api/prisma/schema.prisma` — `date` (`@db.Date`),
  `karigarId`/`workTypeId`/`itemId` (all FK, `onDelete: Restrict` by default, no cascade),
  `quantity` (Int), `rate` (`Decimal(10,2)`), `totalAmount` (`Decimal(12,2)`, **always
  server-computed** from `quantity * rate`, never trusted from the client — see service below),
  `photoUrl`, `remarks`. Soft-deletes via `deletedAt` (unlike the master tables built earlier this
  project) — it's a transactional leaf record nothing else references back, so the hard-delete
  lesson from `ItemCategory`/`WorkType` doesn't apply here; soft-delete is the right, unproblematic
  default. Migration `20260906125710_add_production_entries`, purely additive.
- Backend: `apps/api/src/modules/production-entries/*` (5-file pattern). The service
  cross-validates `karigarId`/`workTypeId`/`itemId` by calling the other modules' own
  `getKarigar`/`getWorkType`/`getItem` service functions (not duplicating the lookup logic) before
  creating or updating, so a bad id 404s cleanly instead of hitting a raw FK constraint error at
  the database layer (same class of bug as the category/work-type incidents earlier this session —
  caught proactively here instead of by accident). `totalAmount` is recomputed from the *merged*
  quantity/rate (existing values filled in for whichever one wasn't part of a given `PATCH`) —
  verified: patching only `quantity` on an entry correctly recalculated the total using the
  existing `rate`.
- RBAC: new `production_entries` module, standard `view/create/update/delete/export` actions — no
  `manage` action needed since (unlike items/karigars) nothing about this module has a
  sub-resource-master to administer.
- Nav: `production_entries` added to `MODULES`, label "Daily Entry" (matches the mockup sidebar's
  own label, not the screen title), icon `ClipboardList`, group `general`, **order 15** — placed
  between Karigar Master (10) and Item Master (20) rather than appended at the end, to match the
  mockup's actual sidebar sequence rather than this project's build order.
- Frontend: `apps/web/src/pages/ProductionEntryPage.tsx` — a **third distinct list/form UI shape**
  in this app (Users/Roles use modals, Karigar uses full-page list↔form toggle, Settings uses tabs,
  and this one is a single-purpose form page with no list at all) because the mockup shows no
  history/list on this screen — that's screen 6 (Production History, not yet built). Karigar/Item/
  WorkType pickers are populated via the existing `/karigars`, `/items`, `/karigars/work-types`
  list endpoints (pageSize 100, filtered to `isActive` client-side — same lightweight pattern
  `UserFormDialog` already uses for its role checklist), not new dedicated "options" endpoints.
  Selecting a Karigar auto-fills Work Type from that karigar's assigned work type (still editable
  after). Selecting an Item shows its name in a disabled field next to the Style No. picker (mirrors
  Karigar's auto-generated-code disabled-field pattern). Total Amount is a disabled, live-computed
  field (`quantity × rate`) — purely a preview; the authoritative total is always the one the server
  computes on save. Three buttons match the mockup exactly: **Save Entry** (save, then reset the
  entire form), **Clear** (reset without saving), **Save & New** (save, then reset but keep the same
  `Date` — a judgment call for fast repeat entry, not shown explicitly in the mockup; revisit if the
  user wants different behavior here).
- Backend module CRUD is complete (`GET/POST/PATCH/DELETE`) even though today's frontend only ever
  calls create — Production History (screen 6) will need list/update/delete once it's built, and
  the API is already there for it.
- Verified end-to-end: created a real entry (Karigar "Man", Item "Shirt Linen", 125 pcs × ₹8 = ₹1000
  — matches the mockup's own sample numbers exactly, a good sign the field mapping is right),
  confirmed partial-update total recomputation, confirmed a bad `karigarId` 404s cleanly instead of
  crashing, then soft-deleted the test entry (safe here, unlike the master-table cleanups earlier).

**GarmentTrack business module — Production History (mockup screen 6):**
- No new backend needed — reuses the existing `GET /production-entries` with its `search`/
  `karigarId`/`itemId`/`dateFrom`/`dateTo` query params, built during the Daily Production Entry
  round specifically so this screen wouldn't need backend work.
- RBAC: **new, separate** `production_history` module (`view`/`export` only — no create/update),
  distinct from `production_entries`. This is deliberate: nav modules and their permission checks
  are 1:1 by `ModuleKey` (`packages/types/src/rbac.ts` keys double as `MODULES` nav keys in
  `packages/shared/src/modules.ts`, and `ModuleGuard` checks `MODULE_PERMISSIONS[moduleKey]`
  directly) — two different pages can't share one nav module key, so a second screen over the same
  data needs its own permission module even with zero new API surface. Someone can be granted "can
  see production history" without "can log new entries," or vice versa.
- Nav: `production_history`, label "Production History", icon `ScrollText` (not `History` — that's
  already used by Audit Log), group `general`, order 17 (between Daily Entry's 15 and Item
  Master's 20, matching the mockup sidebar's actual sequence).
- Frontend: `apps/web/src/pages/ProductionHistoryPage.tsx` — date-range + karigar + item filters
  (the mockup's separate "Style / Design" and "Item" filter dropdowns were consolidated into one
  Item filter, since both map to the same `Item` row in this schema — a deliberate simplification,
  not an oversight), table with a photo thumbnail column, and an eye-icon **View** action (not
  edit/delete inline in the row) that opens `components/production-entries/
  ProductionEntryViewDialog.tsx` — a read-only detail dialog (full photo + all fields) with a
  **Delete** button gated on `production_entries:delete`. **No edit UI was built** — the mockup
  itself shows only a view icon on this screen, and correcting a mistake via delete-and-recreate
  (screen 5) was judged sufficient for now; the backend's `PATCH` endpoint is still there if an
  edit form gets added later.
- Export: mockup says "Export" without specifying a format; no Excel library is installed yet (see
  open question below), so this implements a **client-side CSV download** instead — fetches up to
  1000 matching rows for the current filters, builds a CSV client-side, and downloads it via a Blob
  URL. No new dependency. Opens fine in Excel despite not being an `.xlsx` file.
- `ProductionEntryViewDialog` was built as a **shared component**, not History-specific — Photo
  Gallery (below) reuses it as-is for the same "click a thumbnail to see full detail + delete"
  interaction, so it lives under `components/production-entries/`, not `components/history/`.

**GarmentTrack business module — Photo Gallery (mockup screen 7):**
- No new backend either — same `GET /production-entries` endpoint, filtered client-side to entries
  where `photoUrl` is set (in practice this is nearly all of them, since Daily Production Entry
  requires a photo to save — the filter is a safety net for edge cases, not a real-world common
  case).
- RBAC: `photo_gallery: ['view']` — no `export` action, matching the mockup (no export button on
  this screen).
- Nav: `photo_gallery`, icon `Images`, order 18 (right after Production History's 17, before Item
  Master's 20).
- Frontend: `apps/web/src/pages/PhotoGalleryPage.tsx` — a responsive image grid (2/3/4 columns by
  breakpoint), each tile captioned with style no. + date, clicking a tile opens the same
  `ProductionEntryViewDialog` used by Production History. The mockup's single "All Dates" dropdown
  filter was implemented as one native date input (not a full from/to range like History) —
  selecting a date sends it as both `dateFrom` and `dateTo` to the same underlying API param pair,
  no new query shape needed.

**GarmentTrack business module — Payment / Ledger (mockup screens 9–10):**
- Prisma: new `PaymentMode` enum (`CASH`/`BANK_TRANSFER`/`UPI`/`CHEQUE`) — **deliberately a plain
  enum, not a manageable master like WorkType/ItemCategory.** Payment modes are a small, universal,
  non-client-specific classification (unlike work types or item categories, which genuinely vary
  per business) — this was a conscious choice, not an oversight, so don't "fix" it into a master
  table without the user asking. `Payment` model (date, karigarId FK, amount `Decimal(12,2)`,
  paymentMode, referenceNo, remarks) — soft-deletes normally, same as `ProductionEntry` (it's a
  transactional record nothing else references back). Migration `20260906131720_add_payments`,
  purely additive.
- Backend: `apps/api/src/modules/payments/*` (5-file pattern) plus one extra read endpoint,
  `GET /payments/ledger` — **not a stored table, computed on every request** via two Prisma
  `groupBy` aggregations (sum of `ProductionEntry.totalAmount` and sum of `Payment.amount`, each
  grouped by `karigarId`), merged with the full active-karigar list so every karigar appears even
  with zero activity (matches the mockup, which lists every karigar including one with `pending:
  0`). `/ledger` is registered *before* `/:id` in the same router (not a nested sub-router this
  time, just route order) so it isn't swallowed as a payment id. Verified the math directly:
  ₹1000 production total − ₹400 payment = ₹600 pending, exactly.
- RBAC: `payments: [view, create, update, delete]` — no `export` action; the mockup shows no export
  button on either screen 9 or 10.
- Nav: single `payments` module (not two, unlike Production Entry/History) — label "Payment /
  Ledger", icon `Wallet`, order 19. **This is a fourth distinct UI shape**: the mockup's screens 9
  and 10 are actually two tabs on *one* screen (a pill-style segmented control labeled "Karigar
  Ledger" / "Payment Entry" sits at the top of screen 9's own mockup image, and screen 10 is just
  what renders under the second tab) — not two separate nav destinations like Production
  Entry/History were. `apps/web/src/pages/PaymentsPage.tsx` implements this with local tab state,
  passing the pill control into `PageLayout`'s `tabs` prop.
- Frontend: `components/payments/KarigarLedgerView.tsx` (search + Due/Settled status filter +
  ledger table with a totals footer row, matching the mockup's own totals row) and `PaymentEntryView.tsx`
  (the screen-10 form — Date, Karigar, a disabled "Total Due Amount" that live-looks-up the
  selected karigar's `pending` value from the same ledger query, Payment Amount, Payment Mode,
  Reference No., Remarks). The ledger row's eye icon opens
  `KarigarPaymentHistoryDialog.tsx` — a per-karigar payment history list (not an edit form; same
  "view only, delete-and-recreate to correct" philosophy as Production History's dialog). An
  "Add Payment" button in the ledger toolbar switches to the Payment Entry tab (mockup doesn't show
  this button explicitly, but some way to reach the second tab was needed — a reasonable, low-risk
  addition).
- Full CRUD exists on the backend (`update`/`delete` included) even though the frontend only ever
  calls `create` today — same "build the API a future screen will need" approach as Production
  Entries.

**GarmentTrack business module — Reports (mockup screens 11–12):**
- Backend: new `apps/api/src/modules/reports/*` module, but **only 3 new endpoints** —
  `GET /reports/karigar-summary`, `/item-summary`, `/monthly-summary` (all accept optional
  `dateFrom`/`dateTo`). The other three report types on screen 11 needed **zero new backend**:
  Daily Production Report and Photo Report both reuse `GET /production-entries` directly (same as
  Production History/Photo Gallery already did), and Payment Report reuses `GET /payments/ledger`
  as-is.
- **Real timezone bug found and fixed during verification** — `monthly-summary` originally
  returned `date_trunc('month', "date")` as a raw Postgres `DATE`, and node-postgres parses a raw
  `$queryRaw` `DATE` result using the **server process's local timezone** (not UTC) when building
  the JS `Date` object — unlike Prisma's ORM-layer `@db.Date` handling elsewhere in this app, which
  is timezone-safe. This machine runs in IST, so testing showed `2026-09-01` come back as
  `"2026-08-31T18:30:00.000Z"` — correct-looking only because dev server and any IST browser cancel
  the offset out, but a real, silent wrong-month bug waiting for whenever this API is deployed to a
  non-IST server. **Fixed** by having the SQL cast the month to a plain string
  (`to_char(date_trunc('month', "date"), 'YYYY-MM')`) instead of returning a `DATE` at all — the
  frontend's `formatMonthKey()` in `components/reports/report-constants.ts` parses that string
  manually (split on `-`, index into a month-names array), never constructing a `Date` from it.
  **If any future raw `$queryRaw` needs to return a date/timestamp column, cast it to text in SQL
  rather than trusting node-postgres's raw date parsing** — this is a general gotcha, not specific
  to this one query, listed again under Known issues below.
- RBAC: `reports: ['view', 'export']`. Nav: `reports`, icon `FileBarChart`, order **20** — Item
  Master's order was bumped from 20 to **21** to make room (matches the mockup sidebar sequence:
  ...Payment/Ledger, Reports, Item/Design Master...).
- Frontend: `apps/web/src/pages/ReportsPage.tsx` (screen 11 — a clickable list of report types,
  icon + title + description + chevron, matching the mockup) toggles to
  `components/reports/ReportPreviewView.tsx` (screen 12 — one shared component handling all six
  report shapes via a switch on `reportKey`, rather than six near-duplicate page components, since
  they only differ in table columns/data source within an otherwise identical letterhead/print/export
  shell). Company name in the letterhead is fetched from `/organization` with `retry: false` and a
  `'Company'` fallback if that call 403s — deliberately tolerant of a `reports:view`-only user who
  lacks `company_settings:view`, rather than crashing or hard-requiring a second permission.
- **Print support added globally**: `apps/web/src/index.css` now has an `@media print` block that
  hides everything except elements with a `.print-area` class (and force-hides anything marked
  `.no-print`) — this is a general-purpose mechanism, not Reports-specific, so any future page
  needing clean print output (an invoice, a receipt) can reuse the same two classes rather than
  reinventing print isolation.
- Export: same dependency-free client-side CSV pattern as Production History, generated per report
  type in `ReportPreviewView`'s `handleExport`.

**GarmentTrack business module — Backup & Restore (mockup screen 15):**
- **Important placement note**: this is **not a top-level nav item**. The mockup's own sidebar
  (visible across screens 2/3) never lists "Backup & Restore" — it's only reachable as a tab inside
  Settings (screen 13), same as User Management. So this replaced the existing placeholder
  `apps/web/src/components/settings/BackupRestoreTab.tsx` in-place; **no new route/nav module was
  added**. If a future session is tempted to add a `/backups` nav entry, don't — check this section
  first.
- Schema: new `Backup` model (`triggeredBy: MANUAL|AUTO`, `payload: Json`, `sizeBytes`) — the full
  backup content is stored **in Postgres as JSON, not on the filesystem**. This app already keeps
  everything in the DB; a `Json` column sidesteps filesystem path/deployment concerns entirely for
  something written occasionally and read back rarely. Two new `Organization` columns,
  `autoBackupEnabled`/`autoBackupTime` (`"HH:mm"` string). Migration `20260906133742_add_backups`,
  purely additive.
- **Backup scope is deliberately business-data-only**: WorkType, ItemCategory, Karigar, Item,
  ProductionEntry, Payment. **Users, Roles, and Permissions are never included** — restoring an old
  backup must never be able to resurrect a deleted admin account, revert someone's password hash,
  or otherwise touch access control. This was a conscious safety boundary, matching the mockup's
  own description text ("Karigar, Production, Payment, etc.").
- Backend: `apps/api/src/modules/backup/*` (5-file pattern) — `POST /backups/export` (builds +
  records + returns a full payload for the browser to download), `POST /backups/restore` (validates
  the payload's `organizationId` matches the caller's own org — rejects with 400 otherwise, never a
  raw crash — then does a full delete-and-recreate of business tables **inside one Prisma
  `$transaction`**, so it's all-or-nothing), `GET /backups/history` (list, metadata only) +
  `GET /backups/history/:id` (download one), `GET`/`PATCH /backups/settings` (auto-backup config).
  New RBAC module `backups: [view, create, manage]` — `manage` gates both Restore and the
  auto-backup settings, since both are meaningfully more consequential than a manual export.
- **Verified the full destructive path for real**, not just individual pieces: exported the live
  database (real karigar "Man"/KRG-001, 4 work types, item ST-001), fed that exact export back into
  `/backups/restore`, and confirmed every record survived the delete-and-recreate cycle with
  identical ids/codes — this is the strongest possible test for a feature whose entire job is "make
  sure nothing gets lost." Also verified the safety guard rejects a backup with a mismatched
  `organizationId` (400, not a crash), and that invalid restore JSON is caught and reported instead
  of throwing. **One real backup record now exists in the `backups` table from this verification**
  (a genuine, valid snapshot of real data, not synthetic test data) — left in place rather than
  deleted, since it's harmless and arguably useful; don't be surprised to see it in "Recent Backups."
- **Auto Backup is a real, working scheduler, not just a UI toggle that does nothing**:
  `apps/api/src/lib/backupScheduler.ts` uses `node-cron` (new dependency — installed with
  `@types/node-cron`) to run a daily job at the configured time, calling the exact same backup-build
  logic as the manual "Create Backup" button and recording it with `triggeredBy: 'AUTO'`.
  `rescheduleAutoBackup()` is called both whenever the settings are updated *and* once at server
  startup (`apps/api/src/index.ts`) — without the startup call, a previously-enabled schedule would
  silently stop firing after any server restart until someone re-saved the setting. Verified the
  settings endpoint's validation (enabling without a time → 400; malformed time string → 400) and
  that toggling settings repeatedly doesn't crash the scheduler or the server.
- Frontend: the rebuilt `BackupRestoreTab.tsx` has four sections matching the mockup — Backup Data
  (Create Backup → downloads a `.json` file to the browser), Restore Data (Choose File + Restore,
  **gated behind a bespoke confirmation dialog requiring the user to type the literal word
  "RESTORE"** before the button becomes clickable — not the standard `ConfirmDialog` component,
  since this needed an embedded text input the standard one doesn't support), Auto Backup
  (checkbox + time input, persisted immediately on change), and a "Recent Backups" list with
  per-row download — **this last one isn't in the mockup at all**, added because Auto Backup
  would otherwise produce files nobody could ever retrieve through the UI.
- A pre-existing, unrelated `npm audit` moderate-severity warning (transitive `qs`/`body-parser`/
  `express`/`uuid` versions) appeared when installing `node-cron` — this was already present in the
  dependency tree beforehand, not introduced by this change; left alone as out of scope.

**2. Dashboard** — replaced the generic boilerplate (Total Users/Active Users/Roles tiles) with
GarmentTrack-specific content:
- Backend: `apps/api/src/modules/dashboard/dashboard.repository.ts` (new file; controller now
  calls it instead of querying `User`/`Role`). `GET /dashboard/summary` (same route, same
  `dashboard:view` permission as before) now returns: `totalKarigars` (active count),
  `todayPieces`/`todayAmount` (today's `ProductionEntry` aggregate), `pendingPayment`
  (organization-wide `sum(ProductionEntry.totalAmount) - sum(Payment.amount)`, clamped at 0),
  `productionTrend` (last 7 days, `{day, quantity, amount}[]`, zero-filled for days with no
  entries), `topKarigars` (top 5 this calendar month by `totalAmount`, via the same
  `groupBy`-then-lookup pattern as `reports.repository.ts`/`payments.repository.ts`'s ledger), and
  `workTypeBreakdown` (this month's pieces grouped by work type, for the pie chart).
- **Found and fixed a new variant of the timezone bug** (see "Known issues" below) while building
  this — not user-reported, caught by testing the endpoint against real data before calling it
  done.
- Frontend: `apps/web/src/pages/DashboardPage.tsx` rebuilt with 4 stat tiles, a 7-day production
  trend line chart, a work-type pie chart, and a "Top Karigars" ranked list with avatar photos
  (reusing the `resolvePhotoUrl` pattern from `ItemsPage.tsx`). **New dependency: `recharts`**
  (added to `apps/web/package.json`) — no chart library existed in the project before; this is the
  first screen that needed one. Colors for the pie slices are plain hex values, not theme tokens —
  the project's CSS variables only define `primary`/`accent`/`destructive`/`muted`, not a chart
  palette, and a pie legitimately needs several distinct colors.

**UI polish / branding round** (all user-requested, no new screens — touches shared layout/UI components used across every screen, so worth reading even if you're about to build screen 14 or 16 next):
- **Sticky footer fix**: `apps/web/src/layouts/AppLayout.tsx` — the root wrapper and the
  Topbar+main+footer column were both `min-h-full`, which only resolves to a real height if every
  ancestor (`html`/`body`/`#root`) also has an explicit height — they don't, so on any page shorter
  than the viewport the "KESHAV Trading & Co. © 2026" footer floated up right under the content
  instead of sitting at the bottom of the screen. **Fix:** changed both to `min-h-screen`
  (`100vh`-based, no ancestor chain needed). Footer now pins to the viewport bottom on short pages
  and scrolls after the content on tall ones (standard flex sticky-footer behavior) — this is not a
  literal `position: fixed` footer, and shouldn't be; a truly fixed footer would overlap page
  content on every scrollable table/list screen in this app.
- **Form field backgrounds**: `apps/web/src/components/ui/input.tsx`, `textarea.tsx`, `select.tsx`
  (the `SelectTrigger`) all changed their base background from `bg-card` (identical to the page/card
  behind them — zero visual separation) to `bg-muted` (a subtle gray in light mode, a distinguishable
  lighter-than-card shade in dark mode — reusing the existing `--muted` token, no new CSS variables
  added), switching to `bg-card` on focus/open (`focus-visible:bg-card` on Input/Textarea,
  `data-[state=open]:bg-card` on SelectTrigger) so active editing still visually pops. The previous
  `disabled:bg-muted` override was removed from Input/Textarea since the base is `bg-muted` now
  anyway — `disabled:opacity-70` alone still visually distinguishes disabled fields (they wash out
  against the page). **This is a global, systemic change** — every form on every screen picked this
  up automatically since they all go through these 3 shared components; no per-page edits were made
  or needed.
- **Brand rename, "CK Fast" → "KESHAV Trading & Co."**: updated every user-visible occurrence of the
  old placeholder product name — `apps/web/index.html` (`<title>`, HTML-entity-escaped as `&amp;`),
  `apps/web/src/layouts/AuthLayout.tsx` (login-page logo text + tagline sentence),
  `apps/web/src/layouts/AppLayout.tsx` (footer), `apps/web/src/components/layout/Sidebar.tsx`
  (sidebar header brand text — now wrapped in `min-w-0 truncate` with a `title` tooltip attribute
  since the new name is noticeably longer than "CK Fast" and the sidebar column is a fixed 16rem).
  **Deliberately left unchanged**: internal, non-user-visible identifiers like the `@ckfast/types`/
  `@ckfast/shared` npm workspace package names, the `ckfast-ui` localStorage key, the
  `ckfast:open-command-palette` window event name, and `ckfast-backup-*.json` download filenames —
  renaming those would be a much bigger, purely-cosmetic refactor with no user-visible benefit and
  real risk of breaking something. If the user ever asks to fully purge "ckfast" from the codebase,
  that's a distinct, larger task — flag it rather than assuming it's included in a UI-branding ask.
  Note: `Organization.name` in the DB was already "Keshav Trading & Co" from the Settings round
  earlier this session — this rename brought the hardcoded *app-chrome* branding (logo/footer/title)
  in line with the org's own already-correct name; they weren't in conflict, just two different
  strings that happened to both need to say the same thing.
- **Header color**: per a screenshot the user provided of the desired look, both the Topbar
  (`apps/web/src/components/layout/Topbar.tsx`) and the Sidebar's brand row
  (`apps/web/src/components/layout/Sidebar.tsx`, inside `SidebarContent` — shared by both the
  desktop-fixed and mobile-drawer renders, so one edit covers both) now use `bg-primary
  text-primary-foreground` (navy) instead of `bg-card` (white). Everything below the sidebar's brand
  row (the actual nav links) is untouched and stays on the light background. Follow-on adjustments
  needed because of that color swap, in case a similar change is ever needed elsewhere:
  - The Zap logo icon's own box changed from `bg-primary text-primary-foreground` (invisible against
    a now-same-colored header) to `bg-primary-foreground/15 text-primary-foreground` (translucent
    white badge on navy — same pattern `AuthLayout.tsx`'s feature-icon boxes already used).
  - Topbar's ghost icon buttons (sidebar-collapse toggle, mobile menu, `ThemeToggle`) got explicit
    `text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground` classes
    passed via `className` (merged over the `ghost` variant's default `hover:bg-accent` via
    `cn`/`tailwind-merge`, which resolves same-property class conflicts) — the default ghost hover
    (a light green accent tint) would have looked wrong against navy.
  - `ThemeToggle` (`apps/web/src/components/common/ThemeToggle.tsx`) gained a `className?: string`
    prop, forwarded to its internal `Button`, specifically so Topbar could apply the override above —
    it had no way to be styled contextually before this.
  - The user name/email block and the search-trigger pill and the logout button were **not**
    changed — the search pill and logout button are `bg-card` (white) regardless of variant, which
    already renders correctly as light pills against the new navy header (matches the reference
    screenshot); the user's name text has no explicit color class so it inherits `text-primary-foreground`
    from the header via normal CSS cascade, and only the email needed an explicit override
    (`text-primary-foreground/70`, since it previously had its own explicit `text-muted-foreground`).

## What's next

Remaining screens from the 16-screen client mockup (the user is steering "one by one" and does not
strictly follow mockup order):

- **14. User Management** — mostly covered by the existing Users page already; diff against the mockup if the client wants a simpler dedicated view. The Settings screen's "User Management" tab already links here.
- **16. Logout/Profile** — a "my profile" self-service page (change own password, update own name/email) doesn't exist yet; only admin-driven user management does.

## Conventions established (follow these, don't reinvent)

**Adding a new backend module** (5-file pattern, e.g. `apps/api/src/modules/karigars/`): `*.schema.ts` (zod), `*.repository.ts` (prisma queries), `*.service.ts` (business logic, calls repository), `*.controller.ts` (parses request, calls service), `*.routes.ts` (express Router, each route guarded with `requirePermission('module:action')`). Registration checklist:
1. Add the module's actions to `MODULE_PERMISSIONS` in `packages/types/src/rbac.ts`.
2. Add its nav entry to `MODULES` in `packages/shared/src/modules.ts`.
3. Re-run `npx tsx prisma/seed.ts` (from `apps/api/`) so new `Permission` rows exist and get granted.
4. Register the router in `apps/api/src/routes/index.ts`'s `protectedRoutes` array.
5. Add the page component to `MODULE_PAGES` in `apps/web/src/routes/module-routes.tsx`.

**Frontend list+form pattern**: Users/Roles use modal dialogs (`Dialog` from `ui/dialog.tsx`); Karigar Master uses a full-page form swap instead (a page component holding `mode: 'list' | 'form'` state) because that's what the client mockup shows for that screen. **Match whatever the current mockup screen shows** — don't force one pattern project-wide.

**Auto-numbered codes** (e.g. `KRG-001`, future item codes like `TS-105`): use `nextSequenceCode(organizationId, prefix, padTo)` from `apps/api/src/lib/numberSequence.ts`. It's an atomic Postgres upsert, safe under concurrent callers, non-fiscal-year-resetting.

**Photo uploads**: `POST /uploads` (multipart, field name `file`) returns `{ url: "/uploads/<uuid>.<ext>" }`; served statically from the API origin. Frontend: `apiClient.upload<{url:string}>('/uploads', file)` (in `lib/api-client.ts`) and the `PhotoUpload` component handles the UI (circular preview + "Change Photo" button — reused as-is for Karigar avatars, Item photos, Company logo, *and* Production Entry photos; it's visually a circular avatar-style widget in all four uses even though only the Karigar case is actually a person's photo — an accepted simplification, not a mismatch worth a bespoke component per module). URLs are relative (`/uploads/...`) — resolve against the API origin on the frontend (see `resolvePhotoUrl` helper duplicated in `PhotoUpload.tsx` and `KarigarListView.tsx`/`ItemsPage.tsx` — worth extracting to a shared util if a fourth place needs it). **Resolved:** no separate per-entity photo table (e.g. `ProductionPhoto`) was introduced — `ProductionEntry.photoUrl` is a single plain column, same shape as `Karigar.photoUrl`/`Item.photoUrl`/`Organization.logoUrl`. Photo Gallery (screen 7) should query `ProductionEntry` directly for its grid, not a separate photos table.

**Status badges for simple Active/Inactive booleans** (not a multi-value enum): don't rely on the generic `describeStatus()`/`StatusBadge` heuristic — it doesn't recognize the literal string "INACTIVE" as danger-toned. Build it directly: `<Badge variant={isActive ? 'success' : 'danger'}>{isActive ? 'Active' : 'Inactive'}</Badge>`.

**App branding is "KESHAV Trading & Co."**, not "CK Fast" — `CK Fast`/`ckfast` was only ever the boilerplate scaffold's placeholder name. If you add a new page/component with a hardcoded product name (a new empty-state, a new email template, a new print letterhead default), use the client's real name. The npm package names (`@ckfast/types`, `@ckfast/shared`) and other internal-only identifiers are unaffected and shouldn't be — see the UI polish round above for the full list of what was and wasn't renamed.

**Form fields default to `bg-muted` (subtle gray), not `bg-card`** — `Input`, `Textarea`, and `SelectTrigger` (`apps/web/src/components/ui/`) all follow this now, switching to `bg-card` on focus/open. Any new form control should match this rather than defaulting to `bg-card`, or it'll look flat/undifferentiated against the card panel it sits in.

**The Topbar and the Sidebar's brand row are `bg-primary`/navy, not `bg-card`/white** — a deliberate look-and-feel choice from a user-supplied reference screenshot. The rest of the Sidebar (nav links) stays light. If you add new controls to either of those two specific bars, style them for a dark background (see the header-color bullet above for the exact pattern: explicit `text-primary-foreground` + `hover:bg-primary-foreground/10` overrides on ghost buttons) — don't reflexively copy button styling from elsewhere in the app, most of which assumes a light background.

## Environment

- **API**: `http://localhost:4000` (health: `GET /api/v1/health`). Started via `tsx watch src/index.ts` from `apps/api/`. As of this session there is exactly **one** clean instance running (PID varies, restarts on save) — always `netstat -ano | grep :4000` before starting another (EADDRINUSE if you do); do not assume "check the port" is enough on its own — see gotcha below about duplicate instances.
- **Web**: dev server(s) already running on `5173` and `5174` (both pre-existing from earlier sessions, not started by Claude) — verify with a curl health-check before assuming a specific port; don't blindly start a third instance.
- **DB**: local Postgres, `postgresql://postgres:postgres@localhost:5432/ck_fast?schema=public` (from `apps/api/.env`).
- **Seeded admin login**: `admin@ckfast.local` / `ChangeMe123!` (from `apps/api/.env` `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`) — `mustChangePassword` is set, so first login should prompt a password change flow (note: no such self-service "change my password" UI exists yet — see screen 16 in "What's next").
- No git repo in this project (`git status` fails with "not a git repository") — nothing to commit/push; all changes are just on disk.

## Known issues / gotchas

- **Fixed this session — a second, JS-side variant of the timezone bug, in the new
  `dashboard.repository.ts`.** Building "today" via `new Date()` + `.setHours(0,0,0,0)` zeroes the
  clock in the **server process's local timezone**, producing a Date instant that's a different
  calendar day once compared against a `@db.Date` column whenever the server isn't running in UTC
  (on this IST machine, local midnight of "today" is `18:30` UTC the day before — off by one).
  This is the same root problem as the `getMonthlySummary` bug below, just triggered from plain JS
  `Date` math instead of a raw SQL result. **General rule, extended: never build a "today"/"N days
  ago" `Date` via `new Date()` + `setHours`/`setDate` for comparison against a `@db.Date` column.**
  Instead get the local calendar key first (`` `${y}-${m}-${d}` `` from `getFullYear`/`getMonth`/
  `getDate`) and construct the comparison `Date` from that key at UTC midnight (see `localDateKey`/
  `utcMidnight` helpers at the top of `dashboard.repository.ts`) — this matches how a plain
  `"YYYY-MM-DD"` input (e.g. from a date-only HTML `<input type="date">`) is parsed and stored
  elsewhere in the app (`ProductionEntry.date`, `Payment.date`), so the two stay comparable. Caught
  by testing the endpoint against real data (today's production entry was invisible from
  `todayPieces`/`todayAmount` and landed in the wrong trend bucket) before calling the Dashboard
  screen done — not user-reported.
- **Fixed this session — silent wrong-month bug in `reports.repository.ts`'s `getMonthlySummary`.**
  A raw `$queryRaw` returning a Postgres `DATE`/`TIMESTAMP` gets parsed by node-postgres using the
  **server process's local timezone**, not UTC — different from Prisma's own ORM-layer `@db.Date`
  handling (which is timezone-safe) used everywhere else in this app for `Karigar.joinDate`,
  `ProductionEntry.date`, `Payment.date`, etc. This only looked correct in dev because the machine
  runs in IST and any real user's browser does too — deploying the API to a non-IST server would
  silently attach production data to the wrong calendar month with no error thrown. **Fix and
  general rule: any raw `$queryRaw` that returns a date/timestamp column must cast it to text in
  SQL** (e.g. `to_char(..., 'YYYY-MM')`) and have the frontend parse that string manually — never
  let a raw date value round-trip through `$queryRaw` as an actual `Date`/timestamp type.
- **Fixed this session — crash "Slot failed to slot onto its children" on the Settings page.**
  Root cause was in the shared `Button` component (`apps/web/src/components/ui/button.tsx`), not
  in Settings itself: `Button` always rendered `{loading ? <Loader2/> : null}` as a sibling before
  `{children}`. When `asChild` is set, `Comp` becomes Radix's `Slot`, which requires
  `React.Children.count(children) === 1` — and `Children.count` does **not** ignore `null`
  children the way `Children.toArray` does (verified: `Children.count([null, el])` is `2`, not
  `1`), so `Slot` always saw two children and threw. This had been latent since the component was
  scaffolded; `UserManagementTab.tsx`'s `<Button asChild><Link to="/users">...</Link></Button>` was
  simply the first place in the codebase to ever pass `asChild`. **Fix:** `Button` now branches —
  when `asChild`, it renders `<Slot>{children}</Slot>` with nothing else alongside; the loading
  spinner sibling only exists in the plain `<button>` branch. **If you add `loading` support to any
  other `asChild`-capable component, make sure the extra UI (spinners, icons) never becomes a
  second child in the `asChild` branch — restructure with a real conditional branch, not just a
  conditional expression, since a JSX `{cond ? x : null}` slot is still a distinct array child even
  when it evaluates to `null`.**
- **`prisma migrate dev` cannot prompt for data-loss confirmation in this environment** — it just
  errors with "Prisma Migrate has detected that the environment is non-interactive, which is not
  supported" and refuses to proceed, for anything it considers destructive (dropping a column with
  non-null data, etc.), even with `--create-only`. Hit this converting the `WorkType` enum to a
  master table (see above). Workaround: `prisma migrate dev --create-only --name X` first to
  scaffold an (often empty) migration folder, hand-write the actual SQL yourself into that folder's
  `migration.sql` — including any backfill logic needed to preserve existing data — then apply with
  `prisma migrate deploy`. Postgres 18 here has `gen_random_uuid()` built in (no `pgcrypto` extension
  needed) if a hand-written migration needs to generate ids. Always verify the backfill with a raw
  query against the real rows before regenerating the client and moving on.
- **Fixed this session — "Internal server error" saving a category.** Root cause: `ItemCategory`
  originally soft-deleted (`deletedAt`) like every other master, but `name`/`prefix` carry hard DB
  `@@unique([organizationId, name/prefix])` constraints that don't exempt soft-deleted rows — so
  once a category was ever deleted, its name/prefix could never be reused, and the create endpoint
  threw an unhandled `PrismaClientKnownRequestError` (P2002) instead of a friendly error. Hit
  immediately in practice: leftover test data from this session's own verification pass ("T-Shirt"/
  "TS", soft-deleted during cleanup) blocked the user's very next real attempt to create that exact
  category. **Fix applied:** `ItemCategory` now hard-deletes (`deletedAt` column dropped via
  migration `20260906122214_item_category_hard_delete`); `deleteItemCategory` in
  `item-categories.repository.ts` does `prisma.itemCategory.delete()`, not a soft update. The
  service-level guard (`countItemsInCategory`) now deliberately counts **all** items referencing a
  category, soft-deleted ones included — because `Item.category` has no `onDelete: cascade/set-null`,
  so a soft-deleted item still holds a real FK to its category, and hard-deleting the category while
  that row exists fails at the Postgres level (`P2003`) exactly the same way. Net effect: a category
  can only ever be deleted once truly nothing (live or historical) points to it — verified with a
  full create → attach item → delete blocked (409) → delete item → delete category → recreate same
  name cycle, all clean, no 500s. **If you ever add another user-text-keyed lookup master (not an
  auto-generated-code master like Karigar), default it to hard-delete, not soft-delete, unless there's
  a specific reason to keep deleted rows around.**

- Typing `/handoff` prints `Unknown command: /handoff` as a stdout line first — that's cosmetic
  in this VSCode-extension environment; the command body still loads and runs correctly right
  after it (confirmed working), and it also now shows up as an invocable skill named "handoff".
  Ignore the "Unknown command" line.
- `npx prisma generate` can fail with `EPERM: operation not permitted, rename '...query_engine-windows.dll.node.tmp... '` on Windows if a running `tsx watch` process still has the old client loaded. **Update from this session:** simple retrying often does NOT resolve it, because leftover duplicate `tsx watch` processes from past sessions keep re-locking the DLL the instant one of them restarts. Found **4 separate stale `apps/api` dev-server process trees** this session (from past `/handoff` sessions never cleanly exiting) all fighting over port 4000 — only one could actually bind it at a time, and each file-save-triggered restart briefly freed then immediately re-locked the query engine DLL. Fix: enumerate with `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*ckfast*index.ts*' }` (PowerShell — bash `ps`/`wmic` don't reliably show the full tree on this box), `taskkill //PID <pid> //T //F` each one (confirm with the user first — killing processes is a "check before doing" action), confirm `netstat -ano | grep :4000` is empty, then `npx prisma generate` succeeds immediately. Only then start one fresh instance. **Worth checking for stale duplicates at the start of every future session**, not just when generate fails — they silently accumulate across sessions since nothing stops a background dev server when a session ends.
- No browser-automation tool is available in this environment — UI changes are verified via typecheck + `vite build` + forcing the dev server to transform each new file via `curl`, plus direct API testing via `curl`. Actual click-through testing in a browser has NOT been done by Claude — always ask the user to verify visually before considering a screen fully done.
- Test data created during backend verification (test karigars, test roles, test item categories/items, test work types, uploaded test images) has been cleaned up after each round — the dev DB should be in a clean state matching what a fresh `db:seed` produces, plus whatever real Karigar/Item records the user has created through the UI, plus the real company info entered into Settings this session (see above). Note: cleanup of a test row that references a category/work type must be a genuine hard delete (`prisma.<model>.deleteMany` directly), not the app's soft-delete endpoint — a soft-deleted row still holds its FK and will permanently block deleting the category/work type it points to (same lesson as the category bug fix above).

## Open questions

- All 16 mockup screens now have at least some coverage. What's left is polish, not new screens:
  a dedicated "my profile" self-service page (16 — change own password, update own name/email; see
  below) and confirming whether the client wants a simpler dedicated User Management view (14) or
  is happy with the existing full Users page. Ask which (if either) matters before building.
- Auto Backup's daily schedule is computed once per organization from a single `findFirst` query in
  `backupScheduler.ts` — correct for this app's actual single-tenant-per-deployment reality (the
  seed only ever creates one `Organization` row), but would need reworking (one cron task per
  enabled org) if this ever became genuinely multi-tenant. Not a concern today; flagging so nobody
  is surprised by that assumption later.
- No UI exists yet to restore or download a specific historical backup's *contents* for inspection
  before restoring — "Recent Backups" only offers a full-file download, not a preview. Low priority
  unless the user asks for it.
- No edit UI exists yet for a production entry or a payment after it's saved — both view dialogs
  only offer Delete (delete-and-recreate to correct a mistake). Backend `PATCH` endpoints exist for
  both already; adding edit forms is a small addition if the user wants it, not built because
  neither mockup screen showed an edit affordance.
- Reports (screens 11–12) will need a "per-karigar summary" and "monthly summary" — the ledger
  aggregation pattern from `payments.repository.ts`'s `getLedger()` (Prisma `groupBy` + merge,
  computed on read, not stored) is directly reusable/extendable for those report queries rather
  than building new aggregation logic from scratch.
- Item Master decisions made in an earlier session that a future session should NOT re-litigate unless the
  user raises it: Style No. auto-generates per-category prefix (not a single shared sequence, not
  manually typed); Category is its own manageable master table (not a fixed enum); Add/Edit Item
  is a modal dialog (not a full-page form). All three were explicit user choices, not defaults.
- Daily Production Entry's "Save & New keeps the Date field, clears everything else" behavior (see
  above) was Claude's own judgment call, not something the user specified — confirm it's actually
  the workflow they want once they've tried it; easy to change if not.
