# Buffalo Analytics — UX Use-Case Specification

**Status:** Requirements captured; not implemented  
**Last updated:** 2026-10-18  
**Repository:** https://github.com/sarfarazansari/yureeh-dairy-hub  
**Route:** `/buffalo-analytics`

## 1. Objective

Make Buffalo Analytics useful for daily farm decisions, not just displaying historical numbers. The same page must support both whole-herd monitoring and investigation of one selected buffalo, with clear date/shift filtering and trustworthy handling of incomplete records.

This document records the agreed use case only. It does not authorize UI, service, query, database, or migration changes.

## 2. Primary interaction model

- Default scope: **All buffaloes**.
- Scope selection: a **dropdown at the top of the page**. Options include All buffaloes and individual buffaloes.
- Selecting an individual buffalo changes the analytics on the same page; do not create a separate analytics route for this use case.
- Keep the selected date range and shift filter when switching scope where that remains meaningful.
- In All buffaloes mode, show herd-level KPIs, shift trends, mixed-milk-fat history, missing-entry coverage, and a sortable buffalo comparison table.
- In Single buffalo mode, show the selected buffalo's KPIs, production trend, morning/evening split, day-level production history, and missing-entry status for the selected period. Mixed milk fat remains a farm-level measure and must not be presented as an individual buffalo's fat.

## 3. Filters

Provide these independent filters:

### Buffalo scope
- All buffaloes (default)
- One selected buffalo via the top dropdown

### Date range
- Today
- Last 7 days
- Last 30 days
- This month
- Custom date range with start and end dates

The selected range applies consistently to all relevant KPIs, charts, history, and comparison rows.

### Milking shift
- Both (default)
- Morning
- Evening

Morning and evening are the two operational milking shifts. A shift filter affects production totals, averages, trends, and relevant production-history views. Mixed-milk-fat history is recorded per business date and shift and should follow the selected date/shift filter.

## 4. Analytics goals and content

The page must answer these questions:

1. How much milk did the farm / selected buffalo produce in this period?
2. Which buffalo produces the most milk?
3. Which buffalo's production is decreasing?
4. How do morning and evening production compare?
5. Which expected production entries are missing?
6. What mixed-milk fat percentage was recorded for each date and shift?

### All buffaloes mode

- Total farm milk for the selected date range and shift.
- Average daily farm production using days with recorded production; also show the number of days with recorded production.
- Active buffalo count as a distinct current-status count, clearly labelled.
- Production-record count, clearly distinguished from unique buffalo count and buffalo-days.
- Morning and evening production trend over time.
- Herd coverage / missing-entry status.
- Buffalo comparison table with at least:
  - Buffalo name and code
  - Total milk in selected range
  - Average milk per recorded production day
  - Morning average
  - Evening average
  - Number of days with recorded production
  - Last production entry date
  - Production change versus the equivalent previous period
  - Consecutive-decline indicator, when supported by sufficient records
- Table sorting must be supported for total milk, average production, morning average, evening average, days recorded, and production change.
- Default ranking should make high total milk easy to identify; users must be able to sort by both total milk and average per recorded day.

### Single buffalo mode

- Selected buffalo name, code, and current status.
- Total milk in the selected period.
- Average milk per recorded production day.
- Morning and evening averages, respecting the selected shift filter.
- Production trend over the selected range.
- Day-level production history with date, morning quantity, evening quantity, total, and entry status.
- Comparison against the equivalent previous period.
- A clear indicator when consecutive recorded days show a decline, provided enough data exists.
- Do not interpret a missing shift entry as zero production.

## 5. Average and comparison rules

- **Daily average:** use recorded production days only. Do not silently treat missing dates as zero.
- Show missing expected entries separately so the recorded-day average cannot hide incomplete coverage.
- Total milk and average per recorded day are different metrics and both must be available for sorting/ranking.
- Period comparison must compare the selected period with the immediately preceding equivalent period (for example, 7 days versus the previous 7 days). Ensure the date windows are explicit and aligned to business dates.
- Consecutive-decline detection and period-over-period change are separate signals and should both be available.
- A decline signal must be based on actual recorded quantities. Missing records break or suspend the sequence; they must not be converted to zero.
- Do not claim a production decrease where the selected period lacks sufficient comparable records. Show a neutral/insufficient-data state instead.

## 6. Production-entry status and zero values

The UI must distinguish:
- **Recorded:** a production entry exists, including an explicitly recorded zero quantity if the data model permits it.
- **Missing / Pending:** an expected buffalo/date/shift entry has not been recorded.
- **Zero production:** an actual zero quantity was explicitly recorded.

Derive these states from persisted records and the farm's expected-entry rules, not from chart gaps or default numeric values. Confirm which buffalo statuses are expected to have production entries before implementing coverage logic; current domain notes state that the production RPC allows ACTIVE and DRY buffaloes, so the UI must not invent a different eligibility rule.

## 7. Mixed milk fat

- Fat is measured once for combined farm milk per business date and shift, not per buffalo.
- Display fat history as a **table only** (no fat trend chart in this scope).
- Table columns: business date, shift, mixed milk fat percentage.
- Respect date and shift filters.
- When Single buffalo mode is selected, keep this explicitly labelled as farm-level mixed milk fat or hide it if that would confuse the individual-animal analysis. Never attribute it to the selected buffalo.
- Do not add individual-buffalo fat fields or infer an animal's fat from the mixed pool measurement.

## 8. UX and data-quality requirements

- Every KPI must have a clear label, unit, and selected-period context.
- Empty states must explain whether no records exist in the selected range and how to change the range or enter missing production.
- Loading and error states must be explicit.
- Charts must identify morning and evening series, display date labels, and provide readable quantities/units and useful point details.
- Missing data must be visually distinct from a true zero.
- Do not use a single production-record count as a proxy for herd coverage.
- Keep labels and metric definitions consistent across KPI cards, charts, and the comparison table.

## 9. Acceptance criteria for a future implementation

1. User can switch between All buffaloes and one buffalo using the top dropdown without leaving the page.
2. Date presets, custom date range, and shift filters consistently update applicable analytics.
3. Both total milk and average per recorded day can be sorted in the comparison table.
4. Period-over-period production change is calculated using equivalent adjacent date windows and clearly labelled.
5. Consecutive decline is shown separately from period comparison and never treats missing entries as zero.
6. The UI differentiates recorded, pending/missing, and explicitly recorded zero production.
7. Mixed milk fat is shown only as farm-level combined milk fat by date and shift, in a table.
8. Totals and averages can be reconciled to the underlying buffalo/date/shift records.
9. No database schema or business-rule change is made merely to support this UX without a separate domain review.

## 10. Decisions still needed before implementation

- What minimum absolute or percentage change should count as a meaningful decline, if any? Until agreed, show the measured change without inventing an alert threshold.
- How many consecutive lower recorded days are required to flag a decline? The default candidate is at least 3 consecutive comparable recorded days, but this needs confirmation before implementation.
- Should farm-level mixed milk fat remain visible in Single buffalo mode with an explicit farm-level label, or be hidden in that mode?
- Which statuses should count as expected to produce for missing-entry coverage (particularly DRY)? Inspect the current production save rules and confirm the farm's operational expectation before coding.

## 11. Scope boundary

This is a requirements/specification update only. No application source, queries, business calculations, Supabase schema, migrations, or production data are changed by this specification.
