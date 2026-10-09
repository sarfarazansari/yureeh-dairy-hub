# YUREEH DAIRY HUB — PROJECT RULES

This is a real dairy farm management application.

The application must model real farm operations,
not generic CRUD screens.

Before implementing any feature:

1. Understand the real-world workflow.
2. Inspect existing database schema.
3. Inspect existing UI patterns.
4. Inspect existing related modules.
5. Reuse established patterns.
6. Identify missing business rules.
7. Consider future reporting requirements.
8. Only then modify the code.

Never implement a feature merely because a field appears
to exist somewhere else.

--------------------------------------------------

ARCHITECTURE

Next.js App Router.

Every major module must have its own route.

CRUD route convention for transaction/master modules:
- Archive/list route: `/module`
- New creation route: `/module/new`
- Edit route: `/module/edit/[id]`
- Every `/new` and `/edit/[id]` page must provide a clear back action to its module archive route.
- Do not leave users stranded on a creation/edit page without navigation back to the archive.

Do not build the application around a single app-view.tsx.

Authentication/route protection must be centralized.

Database access must not be embedded inside large page components.

Business logic must be separated from UI.

Forms must use schema validation.

Prefer React Hook Form + Zod where appropriate.

--------------------------------------------------

CODE QUALITY

Code must be:

- readable
- properly formatted
- properly indented
- logically separated
- typed
- maintainable

Avoid giant components.

Avoid giant files.

Avoid unnecessary abstractions.

Comments should explain WHY, not WHAT.

TYPE / INTERFACE / HELPER MANAGEMENT

Before creating a new type, interface, enum, schema, formula, or helper:

1. Search the existing module and shared application code first.
2. Reuse an existing definition when the domain meaning is the same.
3. Do not create duplicate types that describe the same entity or value.
4. Each feature/module must own its module-specific types and interfaces in a dedicated types file (or clearly separated type files when justified).
5. Module-specific helper functions belong inside that module.
6. Helpers used by multiple modules belong in the central shared lib/helpers area.
7. Generic business formulas and calculations must have one canonical implementation and be reused by all consumers.
8. Do not define domain types ad hoc inside page components, hooks, or services when a canonical module/shared type exists.
9. Keep database, service, form, and UI representations aligned; transform at an explicit boundary when their shapes genuinely differ.
10. A new abstraction is justified only when it represents a real domain distinction or removes meaningful duplication. Do not abstract merely for abstraction's sake.
11. After refactoring, remove obsolete duplicate definitions rather than leaving competing canonical sources.

These rules apply to every module, including modules that were already implemented. New modules must follow them from the first implementation.


--------------------------------------------------

DOMAIN RULES

BUFFALO

A buffalo is an individual animal.

Each buffalo has:

- unique code
- optional name
- breed
- purchase date
- purchase price
- advance/amount paid
- outstanding purchase balance
- vendor

A buffalo purchase is an acquisition transaction.

Additional acquisition costs such as transportation/freight
must be represented separately from the animal's purchase price,
while still being linkable to that buffalo when applicable.

--------------------------------------------------

MILK PRODUCTION

Milk production is recorded per buffalo and per milking shift.

Current operation supports:

- Morning
- Evening

For each buffalo + date + shift:

record milk quantity.

Do NOT assume fat is measured for every buffalo.

Fat belongs to milk sale/collection records where applicable.

Do not add fields merely because they exist in another module.

--------------------------------------------------

MILK SALES

Milk sales/collection records may contain:

- customer
- date
- shift
- quantity
- fat
- pricing model
- rate
- calculated amount

This is different from buffalo production.

--------------------------------------------------

EXPENSES

Expenses represent actual farm cash/business expenses.

Expense categories must use controlled categories/master data.

Do not use arbitrary free-text categories.

--------------------------------------------------

IMPORTANT

When a requirement is ambiguous:

DO NOT immediately code.

First inspect existing implementation and determine
the most consistent business interpretation.

If multiple interpretations materially affect the database
or business workflow, stop and ask for clarification.

Do not silently invent a major data model.

--------------------------------------------------

DATABASE

Prefer normalized data.

Avoid duplicating information unnecessarily.

Every important relationship should be explicit.

Migrations are required for schema changes.

Never modify production schema manually without a migration.

--------------------------------------------------

UI

Use consistent UI patterns across the application.

Tables should support:

- sensible filtering
- pagination
- loading states
- empty states
- error states

Forms must have:

- validation
- meaningful labels
- sensible defaults
- clear errors
- duplicate prevention where applicable
- success/error feedback

--------------------------------------------------

BEFORE EVERY FEATURE

Ask internally:

1. What real-world operation does this represent?
2. What entity owns the data?
3. Is this a master record or transaction?
4. Is this a one-time event or recurring event?
5. What existing module has a similar pattern?
6. What database relationship is required?
7. What reports will eventually depend on this?
8. Can duplicate records be created?
9. What validation is required?
10. What happens when the user edits or deletes it?

Only then implement.