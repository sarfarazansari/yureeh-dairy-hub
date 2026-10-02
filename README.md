# Yureeh Dairy Hub

Mobile-first dairy operations app for milk sales, buffalo production, and farm expenses. Data is stored in Supabase PostgreSQL and scoped to the signed-in user with RLS.

## Local development

1. Install dependencies: `npm install`
2. Put the Supabase project URL and publishable key in `.env.local` (see `.env.example`).
3. Apply database migrations (below).
4. Start the app: `npm run dev`

## Database migrations

From the repository root:

```sh
npx supabase login
npx supabase link --project-ref agiylzcbktxrnexajwmg
npx supabase db push
```

The expense module migration is `supabase/migrations/20261001100000_expenses.sql`. It adds editable per-farm expense categories (seeded from shared defaults), vendors, expenses, numeric payment balances, historical name snapshots, indexes, and owner-scoped RLS. Review migration SQL before applying it to a project with existing data.

The app includes milk entry and customer sales management, buffalo daily production and analytics, and expense entry, history, categories, vendor management, and financial summaries. The publishable key is intended for client use; never put a Supabase secret/service-role key in a `NEXT_PUBLIC_*` variable or commit `.env.local`.
