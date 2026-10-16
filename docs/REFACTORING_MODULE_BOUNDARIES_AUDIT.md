# Module Boundaries, Dependencies and Canonical Types Audit

Task: `REF-004`  
Branch: `feature/refactor-engineering-standards`  
Base: `master` at `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9`  
Date: 2026-10-16  
Method: static GitHub source inspection of feature types, services, query modules, shared libraries and routes. No local checkout/runtime was available.

## Executive summary

The application already has useful feature ownership in buffaloes, buffalo production, customers, milk, dashboard and sales analytics. Feed inventory/purchase/consumption/diet-plan types are centralized under `src/lib/*-types.ts`, but the corresponding data access services still live under `src/app/(protected)/feeds/*`. Expenses are mostly route/page-oriented with a shared route helper file. Some common domain vocabulary is centralized (`PricingType`, `Shift`, feed entities), while similar shapes and constants are repeated in feature services/types.

The goal is not to force every file into a folder diagram. The priority is to define canonical ownership for shared domain concepts and move boundaries only when it reduces real duplication or makes data flow safer. No source code was modified in REF-004.

## 1. Current module boundary map

| Domain / module | Current ownership | Dependencies / consumers | Boundary assessment |
|---|---|---|---|
| App shell / auth | `src/app`, `src/app/auth-gate.tsx`, `src/components/layout/*`, `src/lib/supabase.ts` | All protected routes and feature services | Keep auth/route protection and Supabase client centralized. Auth/cache lifecycle is separately flagged in REF-003. |
| Buffalo lifecycle & finance | `src/features/buffaloes/{components,hooks,services,types.ts,validation.ts,utils.ts}` | Buffalo directory/detail, acquisition cost, purchase/payment, sale/payment, status/disposal, production history | Mostly feature-owned. Production-history query is duplicated with buffalo-production feature; see REF-003. |
| Buffalo production | `src/features/buffalo-production/{components,services,types.ts,validation.ts,buffalo-production.queries.ts}` | Herd entry, mixed-pool fat, production analytics, buffalo detail history, milk pool/dashboard | Strong feature boundary, but its types import `MilkEntryShift` from a shared list-data module. Prefer the canonical domain shift type directly. |
| Customers | `src/features/customers/services/customer.service.ts`, `customer.queries.ts`, feature components | Milk entry/customer pricing, directory/detail/payment summaries, dashboard | Good service/query ownership. Core customer types currently live inside service file; move to a dedicated feature types file only when editing this module. |
| Milk entries & pool | `src/features/milk/{services,milk.queries.ts,milk.constants.ts,components}`; shared list query at `src/lib/milk-entry-list.ts`; schema at `src/lib/milk-entry-validation.ts` | Customer prices and customer summaries, herd production, milk pool, sales analytics/dashboard | Split ownership: feature logic is mixed with shared list query/service/schema. Keep a canonical shared shift/pricing vocabulary; decide whether list data access is milk-feature-owned or intentionally shared before moving it. |
| Sales analytics | `src/features/analytics/services/sales-analytics.service.ts`, `SalesAnalyticsPage.tsx`; calculations/types also in `src/lib/analytics.ts` | Milk, production, customer, expenses and farm financial RPC summaries | Types, pure formulas and remote report service have mixed ownership. Keep pure calculations in shared lib if multiple modules consume them; feature-specific response types belong to analytics. |
| Dashboard | `src/features/dashboard.tsx`, `src/features/dashboard/services/dashboard.service.ts` | Customers, buffaloes, milk entries, production, expense and sales analytics RPC | Service exists, but defines a customer type overlapping the customer feature and imports shared MilkEntry from analytics lib. Query/effect migration is a later task. |
| Expenses | `src/app/(protected)/expenses/*`, `shared.tsx` | Feed purchases create expense-linked records; dashboard/financial reports and acquisition costs consume expenses | Largest boundary concern: route/page files contain DB access; `shared.tsx` mixes presentation/navigation, date filter behavior, currency formatting and category seeding. Keep the category master and transaction semantics intact while extracting data access in later implementation phases. |
| Feed master | `src/app/(protected)/feeds/items/*`; entity type `src/lib/feed-types.ts` | Purchase, inventory, diet plan and consumption | Entity types are shared, but route owns direct CRUD/data access. |
| Feed purchases | `src/app/(protected)/feeds/purchases/{services.ts,components/*,page routes}`; `src/lib/feed-purchase-types.ts` | Expense linkage, stock-in ledger, purchase payment status, inventory and reports | Business service is outside feature tree and page routes own loading state. High-integrity transaction boundary; preserve RPC/ledger behavior during moves. |
| Feed consumption | `src/app/(protected)/feeds/consumption/{services.ts,components/*,page routes}`; `src/lib/feed-consumption-types.ts` | Inventory movement ledger, diet-plan scheduler/run snapshots, feed costs and reports | Service is route-scoped, types shared. Deletion/reversal and cost invariants need REF-007 before refactoring. |
| Feed inventory | `src/app/(protected)/feeds/inventory/{services.ts,components/*,page.tsx}`; `src/lib/feed-inventory-types.ts` | Purchases, consumption, stock ledger, weighted average cost | Read-model/service ownership is route-scoped while types are in lib. Candidate for a cohesive `src/features/feed-inventory` boundary after transaction audit. |
| Diet plans / scheduler | `src/app/(protected)/feeds/diet-plans/{services.ts,schema.ts,components/*,page routes}`; `src/lib/diet-plan-types.ts` | Feed master, active buffaloes, schedule configuration, consumption sessions, inventory deductions and cost snapshots | Split between app routes and shared lib. Scheduler RPC and explicit retry/failure semantics are critical; do not move or rewrite until REF-007. |
| Financial reports | `src/app/(protected)/financial-reports/page.tsx` | Sales analytics, expenses, buffalo finance, feed costs, customer receipts and operational ledgers | Report page is a composition point, not an owner of underlying transaction models. Its query boundary should be extracted only after dependencies and invalidation are mapped. |

## 2. Confirmed duplicate / overlapping type definitions

These are source-backed candidates, not an instruction to perform a blind rename. Before consolidation, verify consumers and semantics with a repository-wide import search.

### A. Milk-pool shift-fat record — duplicate type name and shape

- `src/features/buffalo-production/types.ts`: `MilkPoolShiftFatRecord` has `business_date`, `shift: MilkEntryShift`, and `fat_percentage: number | string`.
- `src/features/milk/services/milk-pool.service.ts`: independently declares `MilkPoolShiftFatRecord` with the same three fields and compatible value types.

**Recommendation:** one canonical milk-pool domain/read-model type should be owned by the milk-pool feature or shared milk domain types. Production should import it rather than maintaining a second definition. Check that both services normalize numeric values consistently before unifying.

### B. Customer option / dashboard customer — overlapping shape

- `src/features/customers/services/customer.service.ts`: `CustomerOption = { id, name, pricing_type, default_rate, is_active }`.
- `src/features/dashboard/services/dashboard.service.ts`: `DashboardCustomer` repeats those same fields and types, including the same pricing literal union.

**Recommendation:** reuse `CustomerOption` or introduce a canonical `CustomerSummaryOption` in customer feature types if dashboard's fields/semantics truly differ. Avoid a dashboard-specific duplicate merely because the consumer is the dashboard.

### C. Shift and pricing vocabulary — canonical base exists, but aliases/literals persist

- `src/lib/analytics.ts` defines `PricingType = 'FIXED_PER_LITRE' | 'FAT_BASED'` and `Shift = 'MORNING' | 'EVENING'`.
- `src/lib/milk-entry-list.ts` aliases `MilkEntryShift = Shift`.
- `src/features/buffalo-production/types.ts` and service signatures import `MilkEntryShift` from the list module, coupling production domain types to the list query module.
- `src/features/customers/services/customer.service.ts` uses `PricingType`, while `DashboardCustomer` and several service/response types repeat the literal union.
- `src/features/milk/services/milk-pool.service.ts` repeats `'MORNING' | 'EVENING'` in input/context signatures; `CustomerEntry.shift` repeats the union too.

**Recommendation:** establish a small canonical domain-types module (or keep `Shift` / `PricingType` in their current shared domain location if import direction is clean). Feature types should import these definitions, not depend on `milk-entry-list.ts` and not repeat literal unions. Avoid creating another alias unless it conveys a real domain distinction.

### D. Shared entity/read-model types — keep ownership explicit

- `src/lib/analytics.ts` exports `MilkEntry` and `BuffaloMilkProduction`, plus pure analytics calculations.
- `src/lib/milk-entry-list.ts` exports a separate `MilkEntryListRow` including list-only fields (`id`, `notes`, `created_at`, nested customer display data).
- `src/features/customers/services/customer.service.ts` exports `CustomerEntry` with a customer-detail projection and calculated pricing fields.

These are not automatically duplicates: they represent different projections and consumers. Document projection differences and share only their primitive domain types. Do not collapse API/read-model response shapes simply because fields overlap.

### E. Payment method vocabularies

- `src/features/buffaloes/types.ts` defines `BuffaloPaymentMethod`.
- `src/features/customers/services/customer.service.ts` separately defines `CustomerPaymentMethod` with the same current literals `CASH | UPI | BANK_TRANSFER | OTHER`.

These currently have the same enum values, but ownership may differ by domain and database constraints. Check SQL enum/check constraints and intended future method differences before centralizing. If truly the same domain concept, use one shared payment-method type; do not force sharing only because strings happen to match today.

## 3. Shared helper and schema ownership

### Good canonical candidates already present

- `src/lib/date-key.ts` and `src/lib/date-input.ts`: date-only normalization/validation and Zod date-key schema helpers.
- `src/lib/analytics.ts`: canonical `PricingType`, `Shift`, `MilkEntry`/production analytics types and pure formulas such as `calculateEntryAmount`, `calculateWeightedFat`, and aggregation functions. Preserve decimal/rounding behavior; do not duplicate the amount formula.
- `src/lib/feed-types.ts`, `feed-purchase-types.ts`, `feed-consumption-types.ts`, `feed-inventory-types.ts`, `diet-plan-types.ts`: shared feed entity/read-model type definitions.
- `src/lib/milk-entry-validation.ts`: canonical milk-entry form schema; `src/features/buffaloes/validation.ts` and `src/features/buffalo-production/validation.ts` own their respective domain schemas.

### Boundary problems to address in later tasks

- `src/lib/milk-entry-list.ts` combines domain aliases, filters/list response types, date presets/date helpers, URL serialization, pagination helpers and Supabase list/export reads. It is a shared lib file with feature-specific DB access. Decide whether it becomes a milk-feature service plus a small shared pure utility before moving it.
- `src/app/(protected)/expenses/shared.tsx` combines reusable UI, `money` formatting, local date calculation/presets and `ensureExpenseCategories` data seeding. Separate UI/pure helper/service concerns in a later expense task, retaining idempotent default-category seeding.
- `src/features/dashboard/services/dashboard.service.ts` embeds `DashboardCustomer` and RPC response shapes inside a service. Move stable dashboard response types to `src/features/dashboard/types.ts` when that service is next changed; reuse customer types where semantically identical.
- `src/features/analytics/services/sales-analytics.service.ts` owns report DTOs alongside service functions. This is not inherently wrong, but stable report types should move to analytics `types.ts` if the module grows or multiple consumers need them.
- Feed services currently sit under `src/app/(protected)/feeds/*`, while domain types live under `src/lib/*-types.ts`. Consider feature ownership only after REF-007 maps purchase → expense → stock → consumption → cost and scheduler retry/ledger invariants.

### Date helper caution

`src/lib/milk-entry-list.ts` exposes `localDateKey()` using Day.js; `src/lib/date-input.ts` re-exports `todayDateKey()` from `src/lib/date-key.ts`; `src/app/(protected)/expenses/shared.tsx` independently defines `todayLocal()` using the local JS Date fields. They may be equivalent in ordinary local use but have different implementations and ownership. Compare timezone/date-only expectations and consumers before consolidation; don't replace date-only handling with UTC conversion casually.

## 4. Dependency map (high-level)

```text
Shared infrastructure (Supabase, auth, date-key)
  ├── Buffaloes / acquisition / lifecycle / payments
  │     ├── Buffalo production (eligible animals + detail history)
  │     └── Buffalo financial reports / acquisition-cost expenses
  ├── Buffalo production
  │     ├── Milk pool shift fat + production summaries
  │     ├── Milk delivery context (available litres)
  │     └── Dashboard / production analytics
  ├── Customers + pricing history
  │     └── Milk entries / customer payments
  │           ├── Customer directory/detail summaries
  │           ├── Milk pool outflow
  │           └── Sales analytics / dashboard
  ├── Feed master
  │     ├── Feed purchases ──> Expense transaction/payment + inventory stock-in
  │     ├── Diet plans / scheduler ──> Consumption session ──> inventory stock-out
  │     └── Inventory ledger/valuation ──> feed cost analytics / reports
  └── Expenses + vendors/categories
        ├── Feed purchase linkage
        ├── Buffalo acquisition-cost linkage
        └── Dashboard / financial reports
```

This graph expresses known domain relationships and current consumers; it is not a substitute for tracing the exact RPC, migration, foreign-key, RLS and reporting dependencies in REF-007.

## 5. Recommended implementation order after audits

1. REF-005: audit effect-driven remote reads and establish a migration pattern, including valid UI/auth effects.
2. REF-006: complete mutation/cache/error/loading/pagination checklist and record cross-module invalidation dependencies.
3. REF-007: trace transaction integrity from UI → service → RPC/migration/RLS → ledger/report consumers, especially milk pool and feed/expense/inventory.
4. REF-008: finalize implementation phases and acceptance criteria.
5. Only after those are complete, make small type/boundary changes: first remove the production/milk-pool fat type duplicate; next align customer/dashboard option types and canonical shift/pricing imports; then move feed services behind feature-owned service/query boundaries one module at a time.

## Validation boundary

- Executed: confirmed the branch was 7 commits ahead of and 0 behind latest `master` at `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9` before REF-004 changes.
- Executed: inspected buffalo/customer/milk/production/dashboard/analytics types and services, shared date/analytics/milk-entry/feed type files, expense shared helpers, feed services and existing architecture/task documents.
- Static review only. Not run: local build, lint, typecheck, tests, runtime flows, Supabase migrations/RLS/database checks, or exhaustive compiler-backed import search.
- No source files or database objects changed in REF-004.
