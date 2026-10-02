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