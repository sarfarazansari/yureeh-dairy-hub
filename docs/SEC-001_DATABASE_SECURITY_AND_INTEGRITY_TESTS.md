# SEC-001 — Database Security & Financial Integrity Regression Tests

**Task:** SEC-001  
**Baseline:** `b318e2702838e93a74c566695c6ab63302cd1ab0` (`master`, fetched 2026-10-18)  
**Branch:** `feature/sec-001-database-integrity-audit`  
**Environment:** SQL regression suite for a **local/disposable Supabase database only**. The suite refuses to run unless `SEC001_ALLOW_DESTRUCTIVE_TESTS=YES` is explicitly set. Never point it at production.

## Usage

After checking out this branch locally and starting a disposable Supabase stack with all repository migrations applied:

```sh
SEC001_ALLOW_DESTRUCTIVE_TESTS=YES psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/sec-001-database-integrity.sql
```

`SUPABASE_DB_URL` must refer to the local/disposable Postgres database. The script creates temporary auth users and synthetic rows inside a transaction, switches JWT claims to exercise authenticated RLS, runs assertions, and rolls the transaction back. It does not apply migrations or mutate persistent test fixtures.

## Covered assertions

- Cross-owner read isolation and rejecting a forged `user_id` for expenses, vendors and customer payments.
- Feed-purchase-linked expense guard rejects direct update/delete while purchase is active, and allows the existing correction workflow after the purchase becomes deleted.
- Feed stock reconciliation is checked through ledger movement sums.
- The suite documents targeted follow-up concurrency and RPC scenarios which require two simultaneous database sessions and should not be faked as a sequential unit test.

## Current limitations

This file has not been executed in this environment. No local checkout, `psql`, Docker/Supabase runtime, or disposable database connection is exposed through the GitHub connector. The test is a runnable starting point; its schema/API assumptions must be verified against the complete latest migration chain locally before relying on it. SEC-001 remains blocked until the SQL passes and the concurrency scenarios are run in a disposable database.
