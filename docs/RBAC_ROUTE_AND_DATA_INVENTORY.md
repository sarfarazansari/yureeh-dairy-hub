# RBAC Phase 1 — Route and Data Inventory

Status: In progress (initial pass; not a completed security audit)
Date: 2026-10-20
Branch: `feature/rbac-viewer-access`

## Authentication and shared layout

| Surface | Current path | RBAC review needed |
|---|---|---|
| Login/signup gate | `src/app/auth-gate.tsx` | Gate public signup; establish secure Viewer provisioning; role-aware session lifecycle |
| Protected layout | `src/app/(protected)/layout.tsx` | Central role loading, access-denied behavior, loading/error states |
| Navigation | `src/components/layout/Sidebar.tsx` | Hide admin-only navigation and management actions for Viewer |
| App shell | `src/components/layout/AppShell.tsx` | Role context/permissions should be available consistently |
| Supabase client | `src/lib/supabase.ts` | Confirm only publishable key is exposed; no service-role key in client |

## Route inventory discovered in repository tree

The following route families need page-by-page read/write classification:

- Dashboard: `/`
- Milk operations: `/new-entry`, `/entries`, `/milk-pool`
- Customers: `/customers`, `/customers/[id]`
- Sales analytics: `/analytics`
- Expenses: `/expenses`, `/expenses/new`, `/expenses/history`, `/expenses/history/[id]`, `/expenses/categories`, `/expenses/vendors`, `/expenses/vendors/[id]`
- Financial reports: `/financial-reports`
- Buffaloes and lifecycle: `/buffaloes`, `/buffaloes/[id]`, `/buffalo-sales`, `/buffalo-sales/new`, `/daily-performance`, `/buffalo-analytics`
- Feed master/inventory: `/feeds/items`, `/feeds/inventory`, `/feeds/inventory/movements`
- Feed purchases: `/feeds/purchases`, `/feeds/purchases/new`, `/feeds/purchases/edit/[id]`
- Feed consumption: `/feeds/consumption`, `/feeds/consumption/new`, `/feeds/consumption/edit/[id]`
- Diet plans and scheduler: `/feeds/diet-plans`, `/feeds/diet-plans/new`, `/feeds/diet-plans/edit/[id]`, `/feeds/diet-plans/schedule`
- Settings: `/settings`

This list is based on repository tree inspection. It is not yet proof that every nested action, dialog, server function, or mutation has been discovered.

## Data areas found in migrations

The migration history contains 64 SQL migration files at this audit point. Filename-level domains include:

- Customers, pricing history, milk entries, customer payments, financial summaries.
- Buffalo master/profile, purchase/acquisition, vendor relations, payment history, lifecycle/status history, sales/disposal.
- Buffalo milk production, farm milk pool ledger, pool balances, shift fat, reconciliation and reversal safeguards.
- Expenses, expense categories/vendors, financial balance snapshots, financial reports, sales analytics, milk-margin analytics.
- Feed master/items, inventory movements, feed purchases, purchase correction/edit/delete, consumption/reversal history, diet plans, scheduler and inventory cost logic.
- Multiple integrity/hardening migrations involving RLS, constraints, RPCs, stock locks, reconciliation and reversals.

The complete table/view/function/policy/grant list still needs to be extracted from migration source. Migration filenames alone are not a substitute for SQL inspection.

## Confirmed risks to resolve

1. Existing policies commonly use owner-only predicates such as `user_id = auth.uid()`. A Viewer with a different auth UID will not be able to read the owner's rows without a deliberate farm membership/tenant model.
2. Broadly replacing those predicates without tracing all foreign keys and cross-module functions risks cross-farm leakage and broken integrity.
3. The login gate currently exposes signup. Signup must not automatically attach a new user to the farm or grant any role.
4. Viewer restrictions must cover direct table writes and all callable RPCs, including `SECURITY DEFINER` functions and functions that create secondary records/ledger movements.
5. Scheduler functions and scheduled execution paths must be reviewed separately from user-facing routes.
6. A viewer must not change roles, membership, farm ownership, or invitations.
7. All read surfaces need a consistent farm authorization boundary, including reporting views/functions and server-side aggregates.
8. Super Admin regression must cover all financial/inventory ledger invariants; read-only access should not alter any existing transaction semantics.

## Permission matrix template

Complete this matrix during detailed source review. “Read” includes authorized SELECT/RPC results; “Write” includes indirect mutations and ledger side effects.

| Domain | Read scope | Super Admin writes | Viewer writes | DB enforcement checked |
|---|---|---|---|---|
| Milk entries / milk pool | Farm records | All current supported actions | None | Pending |
| Customers / pricing / payments | Farm records | All current supported actions | None | Pending |
| Buffaloes / lifecycle / production / sales | Farm records | All current supported actions | None | Pending |
| Expenses / vendors / categories | Farm records | All current supported actions | None | Pending |
| Feed items / purchases / inventory / consumption | Farm records | All current supported actions | None | Pending |
| Diet plans / scheduler | Farm records and approved schedule details | All current supported actions | None | Pending |
| Analytics / financial reports | Authorized farm aggregates and details | Existing capabilities | No data mutation | Pending |
| Membership / role management | Minimum necessary account details | Super Admin only | None | Pending |
| App settings | Approved read-only settings only if needed | Super Admin only | None by default | Pending |

## Phase 1 exit criteria

- [ ] Every route/page/dialog/action classified as read, write, or mixed.
- [ ] Every table, view, function/RPC, trigger, scheduled operation, policy, and grant inventoried.
- [ ] Current ownership and foreign-key paths documented; migration/backfill strategy preserves current owner access.
- [ ] Secure Super Admin bootstrap and Viewer invitation/revocation flow designed.
- [ ] Sensitive viewer-visible fields documented. Default product intent is read-only access to farm operational and financial data, unless a specific field is explicitly excluded.
- [ ] Test strategy covers cross-farm isolation, direct writes, RPC privilege escalation, auth lifecycle, and Super Admin regressions.

## Verification boundary

This document records a first-pass static inspection of GitHub source/tree and selected files. The complete SQL inventory, local test suite, local build/lint/typecheck, and live Supabase policy checks have not yet been run.
