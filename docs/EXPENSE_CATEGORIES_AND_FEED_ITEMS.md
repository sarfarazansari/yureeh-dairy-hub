# Expense Categories vs Feed Items — Source of Truth

Last updated: 2026-10-22

## Why this document exists

Read this before changing expense categories, the New Expense form, Feed Master, or feed purchases. The category issue has repeatedly been diagnosed as a database mapping problem when a visible defect was actually the New Expense form's data source.

## Two different domain concepts — do not conflate them

### 1. `expense_categories` = accounting/reporting classification

- Used by the generic Expenses module.
- `expenses.category_id` must reference an `expense_categories.id`.
- Each category has a `category_group` such as `FEED`, `ANIMAL`, `ADMIN`, etc.
- Categories may be shared system defaults (`owner_id IS NULL`) or farm-owned (`owner_id = farm owner`).
- The New Expense form shows these categories as normal options, formatted as `Name · GROUP`.

### 2. `feed_items` = physical inventory master

- Defines actual feed products/materials the farm buys and tracks: specific fodder varieties, khal brands, jaggery, mustard oil, supplements, minerals, etc.
- A feed item has its own UUID, owner/user, name, feed category code, base unit, purchase unit, purchase-unit conversion quantity, and active status.
- `feed_purchases.feed_item_id` references a feed item. Feed inventory movements and consumption also use feed item IDs.
- A `feed_items.id` is **not** an `expense_categories.id`. Never write one into `expenses.category_id`.

## Root causes found

1. **New Expense dropdown did not query Feed Master.** The 2026-10-22 screenshot of `/expenses/new` showed accounting categories (including FEED categories) but no physical Feed Master items. `useNewExpenseOptionsQuery` originally fetched only `expense_categories`, `expense_vendors`, and `buffaloes`. Feed Master items could not appear even if they existed in the database.
2. **Category cloning caused duplicate-name failures.** The old setup path attempted to copy shared default categories into farm-owned categories, which could trigger duplicate-name errors. Read shared defaults plus farm-owned categories; do not clone shared defaults as a form initialization side effect.
3. **Inventory items are not accounting categories.** Requiring every physical feed item name to have a one-to-one FEED expense category caused errors such as “No active FEED expense category mapping exists for …”. The feed-purchase RPC needs an explicit mapping strategy and a valid fallback category, while preserving the real feed item name in the expense description.
4. **These are separate failure layers.** Fixing the feed-purchase RPC/category fallback does not add feed items to the New Expense dropdown. Changing the dropdown does not prove the feed-purchase RPC or database migration is deployed.

## Current code work recorded (2026-10-22)

Working branch: `fix/expense-categories-master`  
This work is **not confirmed merged to master**. The user owns PR/merge decisions.

Commits on that feature branch:
- `5306a918956c30a70a197c30e610848999a451c3` — load active feed items for New Expense options.
- `eb1da2cf09fa6855bd354c864c96eacba25103c6` — render feed items in the New Expense Category selector and handle selection.

Changes made:
- `useNewExpenseOptionsQuery` fetches active `feed_items` for the resolved farm owner and returns them as `feedItems`.
- `/expenses/new` renders active feed items alongside accounting categories, labelled `FEED ITEM`.
- Selecting a feed item preserves its name in the description, selects a valid active FEED accounting category (exact name match first, then shared `Other Feed`, then another active FEED category), and sets quantity mode and purchase/base unit.
- The selection still saves through the generic `expenses` insert path. It does **not** create a `feed_purchases` record or `feed_inventory_movements` stock-in. If the desired workflow is to buy feed and increase inventory, use the dedicated `/feeds/purchases/new` flow instead. Do not silently treat a generic expense as a stock purchase.

Verification boundary:
- GitHub read-back confirmed the two source files contain the changes.
- No local typecheck, lint, build, browser test, or live Supabase verification was performed in that session.
- Do not describe this as runtime-tested until those checks are actually run.

## Feed-purchase expense category mapping

The dedicated Feed Purchase workflow is different from generic New Expense:
- The purchase must reference a real active `feed_items` row.
- The purchase flow creates the linked expense and inventory stock-in movement through its RPC.
- Prefer an active FEED expense category matching the feed item name when available.
- Known mappings may map variants such as dry fodder varieties to a broad accounting category.
- For unmatched items, use the shared active FEED category `Other Feed`; preserve the specific item name in the expense description.
- Do not make farm users create an accounting category for every inventory item.
- Feature-branch migration: `supabase/migrations/20261022100000_feed_purchase_category_fallback_redeploy.sql`. It has **not** been confirmed applied to the live Supabase project. Inspect migration history and function grants before applying/reapplying it.

## Category list and duplicate-handling rules

- Shared system categories (`owner_id IS NULL`) and farm-owned categories are both visible to the farm.
- Resolve duplicate names case-insensitively, preferring the farm-owned row over the shared default.
- A farm-owned inactive category intentionally overrides/hides the shared category with the same name; filter for active only **after** resolving the override.
- Shared system defaults are read-only in the category management UI; farm-owned categories may be edited/deactivated according to permissions.
- Never blindly insert/copy default categories during page initialization.
- When loading categories for generic expenses, apply the intended farm scope; do not expose another farm's categories.
- A UI option label or matching name is not a substitute for the correct category UUID.

## Required checks before declaring this fixed

1. Inspect latest `master`, this document, project rules, the New Expense query/form, Feed Master query/RLS, feed-purchase query/form, and relevant migrations/RPCs.
2. Confirm the signed-in Super Admin can see active Feed Master items in `/expenses/new`; inactive items and other farms' items must not appear.
3. Select a feed item and verify persisted category ID, description, unit, quantity/rate, and total. Decide explicitly whether this is a generic expense only or a stock purchase. For stock-in, test the dedicated Feed Purchase flow and confirm exactly one linked expense, one purchase, and one inventory movement.
4. Confirm normal accounting categories still work and shared/farm-owned duplicate names resolve as documented.
5. Test exact-name mapping, a known variant (e.g. Dry Fodder Gehu ka), and an unmatched item using `Other Feed`.
6. Check RLS and direct Supabase calls, not only the UI.
7. Run typecheck, lint, build, and focused browser/manual regression checks where the environment permits. Record what actually ran.
8. Verify migration status/function definition/grants in the intended Supabase project before claiming the fallback is deployed.

## Do not repeat these mistakes

- Do not assume “Feed items missing from New Expense” is a category-migration-only issue.
- Do not confuse `feed_items.id` with `expense_categories.id`.
- Do not claim the UI, build, or live database is verified based only on reading GitHub source.
- Do not create a new branch when the user says to continue on the same branch.
- Do not merge a feature branch into master; the user owns merges unless explicitly instructed otherwise.
