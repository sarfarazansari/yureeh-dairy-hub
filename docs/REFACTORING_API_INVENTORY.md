# Refactoring API, Query, State and Effect Inventory

Audit branch: `feature/refactor-engineering-standards`
Audit base: latest `master` at `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9`
Audit snapshot: `882b529e732c53a44a884206bf3dbb66ca3a3c46`
Date: 2026-10-16

## Scope and confidence

A recursive Git tree was retrieved without truncation. The snapshot contains 238 tracked files, including 141 TypeScript/JavaScript source files under `src/` and 60 Supabase migrations. All 141 source files were screened for Supabase calls, RPC calls, React effects, TanStack Query usage, fetch/axios patterns, state-store markers and cache invalidation. Key data-access files and query hooks were then read directly.

This is a static source audit. No local checkout was available in the execution environment, so build, typecheck, lint, tests, runtime behavior and remote database state were not executed. The inventory describes source patterns, not proof of runtime correctness.

## 1. Shared data and auth infrastructure

| File | Observed responsibility | Pattern / concern |
|---|---|---|
| `src/lib/supabase.ts` | Creates nullable Supabase client from public environment variables | Correct central client entrypoint; callers repeatedly handle missing configuration |
| `src/components/providers/QueryProvider.tsx` | Global TanStack Query provider; stale time 30 seconds, refetch on focus | Good shared foundation; no explicit default mutation/error policy observed |
| `src/app/auth-gate.tsx` | Session retrieval, auth subscription, sign-in/sign-up | Effects are appropriate for auth lifecycle; cleanup and auth error behavior should be reviewed in auth-focused pass |
| `src/components/layout/Sidebar.tsx` | Sign-out and navigation/mobile interaction state | Auth action in layout component is reasonable; effects should be classified by purpose |
| `src/lib/milk-entry-list.ts` | Milk-entry list/export data access and related transformations | Domain data access lives in generic lib; likely belongs under milk feature services during a safe migration |
| `src/app/(protected)/expenses/shared.tsx` | `ensureExpenseCategories(client)` reads defaults and inserts user categories | Data mutation helper in a route/shared UI file; potential concurrent first-use race should be assessed before moving/fixing |

## 2. Feature services and query hooks

### Buffaloes
- `src/features/buffaloes/services/buffalo.service.ts` — buffalo directory/details, profile/purchase/vendor edits, purchase payments, status history, sales, sale payments and disposal; uses table queries and RPCs.
- `src/features/buffaloes/hooks/use-buffaloes.ts` — TanStack Query queries and mutations; query-key factory exists. Shared mutation helper broadly invalidates `['buffaloes']`. Check downstream financial/report and production/milk invalidation in REF-006/REF-007.
- `src/features/buffaloes/components/BuffaloAcquisitionCostPanel.tsx` — **exception to service boundary**: direct Supabase reads for acquisition costs/eligible expenses and direct RPC mutation inside a UI component, with inline query keys.
- `src/features/buffaloes/BuffaloDetailPage.tsx`, `src/features/buffaloes/BuffaloesPage.tsx` and feature form/panel components — consume feature hooks/components; no direct DB calls detected in the source scan apart from the acquisition-cost panel above.

### Buffalo production
- `src/features/buffalo-production/services/buffalo-production.service.ts` — production sheet/range/history, active buffalo and pool-fat data; calls RPCs and queries tables.
- `src/features/buffalo-production/buffalo-production.queries.ts` — TanStack Query query/mutation hooks and key factory; saving production invalidates production and milk query roots.
- `src/features/buffalo-production/BuffaloAnalyticsPage.tsx` — service-backed data is loaded via React effects/local loading state rather than query hooks.
- `src/features/buffalo-production/DailyPerformancePage.tsx` — no direct Supabase call detected in scan; inspect integration/use of shared query hooks in REF-003.

### Customers
- `src/features/customers/services/customer.service.ts` — directory, detail, customer payments/pricing, create/update/activation and financial summary access; table queries and RPCs.
- `src/features/customers/customer.queries.ts` — TanStack Query hooks and key factory; mutations invalidate customer keys, and pricing/activation also invalidate milk.
- `src/features/customers/CustomersPage.tsx` — uses the query layer for directory data but calls `supabase.auth.getUser()` directly to obtain the current user for create flow.
- `src/features/customers/CustomerDetailPage.tsx` — query-hook consumer; error/retry UI is present.

### Milk entries and milk pool
- `src/features/milk/services/milk-entry.service.ts` — create/update/delete milk entry through transactional RPCs and supporting entry query.
- `src/features/milk/services/milk-pool.service.ts` — reconciliation, pool movement, delivery context, production and pool-fat history access.
- `src/features/milk/milk.queries.ts` — query keys and query/mutation hooks for list/export/customers/pricing/duplicate checks/delivery context/pool reconciliation/fat/movement; successful writes broadly invalidate the milk root.
- `src/lib/milk-entry-list.ts` — list and export data access; duplicated domain ownership outside the feature tree.
- `src/features/milk/EntriesPage.tsx`, `src/features/milk/MilkPoolPage.tsx`, `src/features/milk/new-entry.tsx` — primarily query-hook consumers; list page includes explicit export retry on user action.
- `src/app/(protected)/entries/page.tsx`, `src/app/(protected)/new-entry/page.tsx`, `src/app/(protected)/milk-pool/page.tsx` — thin route wrappers.

### Dashboard and analytics
- `src/features/dashboard/services/dashboard.service.ts` — dashboard data queries and sales analytics aggregation RPC.
- `src/features/dashboard.tsx` — calls dashboard service from `useEffect` and manages fetch/loading state locally.
- `src/features/analytics/services/sales-analytics.service.ts` — sales analytics summary RPC and customer lookup.
- `src/features/analytics/SalesAnalyticsPage.tsx` — service-backed fetch in `useEffect`, local loading/error state.
- `src/app/(protected)/financial-reports/page.tsx` — direct RPC calls for farm financial summary and buffalo-sale financial summary in page-level effect; no feature service/query hook boundary.

## 3. Expenses: direct data access in route files

These files perform data access or transaction work directly in route/UI modules, bypassing a consistent TanStack Query + feature-service boundary:

- `src/app/(protected)/expenses/page.tsx` — overview/list data loading in effect.
- `src/app/(protected)/expenses/new/page.tsx` — reference lookups, auth lookup and expense insert.
- `src/app/(protected)/expenses/history/page.tsx` — paginated expense query, category/vendor/buffalo lookups, related payment/feed-purchase lookups, update and soft-delete paths; multiple effects.
- `src/app/(protected)/expenses/history/[id]/page.tsx` — expense/payment reads and `record_expense_payment` RPC.
- `src/app/(protected)/expenses/categories/page.tsx` — category list/CRUD and auth lookup.
- `src/app/(protected)/expenses/vendors/page.tsx` — vendor list, `get_expense_vendor_directory_summaries` RPC, create/update/activation.
- `src/app/(protected)/expenses/vendors/[id]/page.tsx` — vendor detail read.
- `src/app/(protected)/expenses/shared.tsx` — `ensureExpenseCategories` helper performs select/insert through a passed Supabase client.

These are high-value refactor candidates because data access, UI state, validation, error feedback and business rules are mixed in large route files. Before extraction, preserve filters, pagination, soft-delete behavior, payment accounting and expense/feed-purchase linkage.

## 4. Feed purchases, consumption, inventory, diet plans

### Feed purchases
- `src/app/(protected)/feeds/purchases/services.ts` — service boundary for create/edit/delete RPCs, purchase list/detail and related inventory movements.
- `src/app/(protected)/feeds/purchases/page.tsx` — effect loads feed/vendor options and paginated purchase data; delete invokes service.
- `src/app/(protected)/feeds/purchases/new/page.tsx` — direct client setup and effect-loaded feed/vendor options; service-backed purchase creation with request key/idempotency.
- `src/app/(protected)/feeds/purchases/edit/[id]/page.tsx` — effect-loaded options and purchase; service-backed edit.
- `src/app/(protected)/feeds/purchases/schema.ts` — validation schema.
- `src/app/(protected)/feeds/purchases/components/FeedPurchaseForm.tsx` — form-local effect/state logic.
- `src/app/(protected)/feeds/purchases/components/FeedPurchaseTable.tsx` — table-local pagination correction effect; not itself an API call.

### Feed consumption
- `src/app/(protected)/feeds/consumption/services.ts` — create/edit/delete consumption RPCs and movement/feed/stock reads.
- `src/app/(protected)/feeds/consumption/page.tsx` — effect loads consumption list and manages local loading/error state.
- `src/app/(protected)/feeds/consumption/new/page.tsx` — effect loads feed items and stock; calls service for creation.
- `src/app/(protected)/feeds/consumption/edit/[id]/page.tsx` — effect loads feed items, stock and selected consumption; calls service for edit.
- `src/app/(protected)/feeds/consumption/schema.ts` — validation schema.
- `src/app/(protected)/feeds/consumption/components/FeedConsumptionForm.tsx` — form UI; no direct Supabase access detected.
- `src/app/(protected)/feeds/consumption/components/FeedConsumptionTable.tsx` — local page-boundary effect; no direct API call detected.

### Feed inventory
- `src/app/(protected)/feeds/inventory/services.ts` — stock and movement list reads.
- `src/app/(protected)/feeds/inventory/page.tsx` — invokes services from effects, manages independent stock and movement state/errors/pagination.
- `src/app/(protected)/feeds/inventory/components/FeedInventoryStockTable.tsx`, `FeedInventoryMovementTable.tsx` — presentation components.

### Feed items/master
- `src/app/(protected)/feeds/items/page.tsx` — direct list/count reads, auth lookup, create/update and activation writes in a route component.
- `src/app/(protected)/feeds/items/components/FeedItemEditDialog.tsx` — effect for form/dialog synchronization; no direct DB call detected.
- `src/app/(protected)/feeds/items/components/FeedItemForm.tsx`, `FeedItemTable.tsx` — presentation/form components.

### Diet plans and scheduler
- `src/app/(protected)/feeds/diet-plans/services.ts` — diet-plan list/detail, feed items, eligible buffaloes and save RPC.
- `src/app/(protected)/feeds/diet-plans/page.tsx` — effect-based list loading and local state.
- `src/app/(protected)/feeds/diet-plans/new/page.tsx` — effect-based feed and date-dependent buffalo lookups; service-backed save.
- `src/app/(protected)/feeds/diet-plans/edit/[id]/page.tsx` — effect-based plan/feed/buffalo lookups; service-backed save.
- `src/app/(protected)/feeds/diet-plans/schedule/page.tsx` — direct reads from schedule settings/feeding runs and direct RPCs for schedule save/retry inside the route component.
- `src/app/(protected)/feeds/diet-plans/schema.ts` — validation schema.
- `src/app/(protected)/feeds/diet-plans/components/DietPlanForm.tsx` — form-local effects/state; no direct Supabase call detected.

These modules have business-critical purchase/expense/stock/consumption/scheduler interactions. Refactoring must preserve idempotency, retry semantics, stock ledger and run-snapshot behavior.

## 5. Query hooks and direct data-access map

TanStack Query hooks/query-key factories confirmed:
- `src/features/buffaloes/hooks/use-buffaloes.ts`
- `src/features/buffalo-production/buffalo-production.queries.ts`
- `src/features/customers/customer.queries.ts`
- `src/features/milk/milk.queries.ts`
- `src/features/buffaloes/components/BuffaloAcquisitionCostPanel.tsx` (local, non-centralized useQuery/useMutation)

Query consumers include buffalo/customer/milk pages and the buffalo-sales archive. Many expense/feed/dashboard/analytics/report pages still use local `useEffect` loading instead of query hooks.

## 6. Effects: classify before migrating

### Effects associated with remote data loading or auth
- `src/app/auth-gate.tsx` — auth session/subscription (legitimate external synchronization).
- `src/app/(protected)/expenses/categories/page.tsx`
- `src/app/(protected)/expenses/history/[id]/page.tsx`
- `src/app/(protected)/expenses/history/page.tsx`
- `src/app/(protected)/expenses/new/page.tsx`
- `src/app/(protected)/expenses/page.tsx`
- `src/app/(protected)/expenses/vendors/[id]/page.tsx`
- `src/app/(protected)/expenses/vendors/page.tsx`
- `src/app/(protected)/feeds/consumption/page.tsx`
- `src/app/(protected)/feeds/consumption/new/page.tsx`
- `src/app/(protected)/feeds/consumption/edit/[id]/page.tsx`
- `src/app/(protected)/feeds/diet-plans/page.tsx`
- `src/app/(protected)/feeds/diet-plans/new/page.tsx`
- `src/app/(protected)/feeds/diet-plans/edit/[id]/page.tsx`
- `src/app/(protected)/feeds/diet-plans/schedule/page.tsx`
- `src/app/(protected)/feeds/inventory/page.tsx`
- `src/app/(protected)/feeds/items/page.tsx`
- `src/app/(protected)/feeds/purchases/page.tsx`
- `src/app/(protected)/feeds/purchases/new/page.tsx`
- `src/app/(protected)/feeds/purchases/edit/[id]/page.tsx`
- `src/app/(protected)/financial-reports/page.tsx`
- `src/features/analytics/SalesAnalyticsPage.tsx`
- `src/features/buffalo-production/BuffaloAnalyticsPage.tsx`
- `src/features/dashboard.tsx`

### Effects that appear to be UI lifecycle/state synchronization (not automatic refactor targets)
- `src/components/layout/Sidebar.tsx` — auth/layout and responsive/navigation state.
- `src/components/ui/TimedNotice.tsx`, `src/components/ui/Toast.tsx` — timer/callback lifecycle.
- `src/components/ui/date-range-picker.tsx` — date-picker synchronization.
- `src/app/(protected)/feeds/consumption/components/FeedConsumptionTable.tsx`, `src/app/(protected)/feeds/purchases/components/FeedPurchaseTable.tsx` — keep current page within valid page count.
- `src/app/(protected)/feeds/items/components/FeedItemEditDialog.tsx`, `src/app/(protected)/feeds/diet-plans/components/DietPlanForm.tsx`, `src/app/(protected)/feeds/purchases/components/FeedPurchaseForm.tsx` — form/dialog synchronization; inspect before changing.
- `src/app/(protected)/buffalo-sales/page.tsx` — uses TanStack Query but also has effect/state logic; inspect exact effect purpose before migration.

This classification is based on static line inspection and should be revisited while each module is refactored. An effect is not a defect simply because it exists.

## 7. State management and dependencies

- TanStack Query v5 is installed and the provider is mounted via the application shell; adoption is partial, not project-wide.
- Query hooks/key factories are currently feature-level and use different naming/placement conventions (`hooks/use-buffaloes.ts` vs `*.queries.ts`).
- No Zustand dependency, Zustand store, or dedicated `store/` directory was found in the tracked source snapshot.
- Local `useState` is widely used for server results, loading/error state and form state in expense/feed/report pages; gradually move server-owned state to TanStack Query while retaining local UI state locally.
- `react-hook-form` is not listed in the inspected `package.json` dependencies. Zod is installed. Do not assume React Hook Form is available; decide whether to add it only after the form audit and explicit dependency/lockfile review.
- Package scripts include `build`, `lint`, and Prettier formatting/check; no test or standalone typecheck script was present in `package.json`. Next build generally type-checks but is not a substitute for focused tests.
- No axios or custom fetch-based API client was found in the scanned `src/` source. Supabase is the primary data client.

## 8. Initial priorities derived from this inventory

1. **P0 — Finish state/query audit (REF-003):** standardize query-key ownership and query hooks; identify where server data is stored in local state.
2. **P1 — Finish module/type ownership map (REF-004):** move toward feature-owned services, schemas, types and pure utilities without moving files for cosmetic reasons.
3. **P1 — Refactor route-level data access in Expenses and Feed Items/Scheduler:** services and hooks first, with behavior-preserving tests/checklists.
4. **P1 — Migrate effect-driven server reads in Feed Inventory, Feed Consumption, Feed Purchases and Diet Plans to query hooks, one task at a time.**
5. **P1 — Migrate dashboard/analytics/financial reports to query-backed service boundaries with complete invalidation.
6. **P1 — Inspect direct query logic in BuffaloAcquisitionCostPanel and move it behind a service/query module.
7. **P0/P1 — Trace transaction integrity before changing architecture:** expenses ↔ feed purchases/payments ↔ stock ledger ↔ consumption costs; production ↔ milk pool ↔ customer deliveries; buffalo sale/disposal ↔ financial reports.

Do not begin a bulk rewrite. Follow `docs/REFACTORING_TASKS.md`, preserve existing transactional RPCs and record checks per task.
