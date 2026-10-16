# Phase 8 — Final shadcn Migration Audit

Date: 2026-10-16
Base commit: `1c6033de4f1b9c78596f12d3aff74e023b80903c`

## Scope and evidence

This audit branch was created from the latest `origin/master` commit above. Findings were based on static inspection of repository files through GitHub. A local checkout could not be created in the available execution environment because direct network access to github.com failed. Therefore, no local package installation, formatting, lint, typecheck, production build, or browser/DB regression test is claimed.

## Changes made on this branch

- Replaced the native Clear filters button in the feed consumption archive with the shared shadcn Button.
- Replaced the legacy `.btn` link for creating feed consumption with the shared Button using `asChild`.
- Replaced the native Save feeding times button with the shared shadcn Button.
- Replaced the legacy expense dashboard Record expense button with the shared Button using `asChild`.

These changes are presentation-only; they do not intentionally change handlers, data access, RPC calls, validation, or financial calculations.

## Remaining review checklist

- [ ] Continue repository-wide scan for native `input`, `select`, `textarea`, checkbox and button elements. Retain semantic HTML where appropriate; prioritize controls that bypass shared primitives.
- [ ] Inspect remaining native controls in customer management and milk-entry pages and migrate where safe.
- [ ] Review all uses of legacy `.btn`, `.field`, `.date-chip`, `.table`, `.tag`, `.status-overdue`, `.status-today` and custom dialog classes. Do not remove CSS until every consumer has been checked.
- [ ] Review remaining custom date-picker implementations and `date-picker.css` imports for duplication and accessibility.
- [ ] Verify dialog wrapper use. `src/app/dialog.tsx` delegates to the shared shadcn/Radix Dialog primitive; do not treat its compatibility wrapper alone as a custom non-modal dialog.
- [ ] Check all form labels, accessible names, error associations (`aria-describedby` / `aria-invalid`), keyboard focus, Escape handling, focus restoration, disabled/loading states, and mobile navigation with keyboard and assistive technology.
- [ ] Check dependencies against lockfile with a clean install.
- [ ] Run `npm run format:check`, `npm run lint`, `npx tsc --noEmit` (if supported by project configuration), and `npm run build`.
- [ ] Regression-test milk production and pool reconciliation, customer sales/payments, feed purchases/consumption/inventory, diet-plan schedules/retries, expenses/payments, and buffalo lifecycle transactions.
- [ ] Confirm no changes to RLS, DB constraints, RPC contracts, ledger semantics, or financial calculations.

## Verification status

| Check | Status |
| --- | --- |
| Branch based on latest master | Verified |
| Targeted shadcn button migrations | Changes committed on audit branch |
| Full repository control inventory | Incomplete |
| Legacy CSS consumer audit | Incomplete |
| Formatting / ESLint / TypeScript / production build | Not run |
| Browser accessibility / responsive checks | Not run |
| Live database and financial regression tests | Not run |
| PR or merge | Not created / not performed |

## Limitations

This is an in-progress audit, not a declaration that the migration is complete or production-ready. Remaining checklist items must be resolved and automated/runtime checks must pass before closing Phase 8.
