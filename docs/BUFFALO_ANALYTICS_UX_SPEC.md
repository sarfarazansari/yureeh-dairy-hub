# Buffalo Analytics — Final UX Use-Case Specification

**Status:** Finalized for implementation planning; not implemented  
**Last updated:** 2026-10-18  
**Repository:** https://github.com/sarfarazansari/yureeh-dairy-hub  
**Route:** `/buffalo-analytics`

## 1. Objective

Turn Buffalo Analytics into a practical decision-support page for daily dairy operations. It must support whole-herd monitoring and investigation of one buffalo, identify production growth or decline, distinguish missing data from true zero production, and show an evidence-based view of each buffalo's economic performance when the required financial data is available.

This is a requirements document only. No application source, calculations, Supabase queries, schema, migrations, or production data are changed by this specification.

## 2. Primary interaction model

- Default scope: **All buffaloes**.
- Scope selector: a **dropdown at the top of the page**, with All buffaloes and each eligible buffalo.
- Selecting one buffalo changes the analytics on the same page; do not create a separate analytics route for this use case.
- Preserve the selected date range and shift filter when switching scope where meaningful.
- All buffaloes mode: herd KPIs, shift trends, mixed-milk-fat history, missing-entry coverage, sortable buffalo comparison, and production alerts/insights.
- Single buffalo mode: animal-specific KPIs, daily production history, shift comparison, trend analysis, previous-period comparison, decline/growth signals, and economic performance when supported by trustworthy financial data.
- Never display farm-level mixed milk fat as if it were an individual buffalo's fat.

## 3. Filters

### Buffalo scope
- All buffaloes (default)
- One selected buffalo, selected using the top dropdown

### Date range
- Today
- Last 7 days
- Last 30 days
- This month
- Custom date range (start and end dates)

All applicable KPIs, charts, tables, comparisons, and status counts must use the same clearly displayed date window.

### Milking shift
- Both (default)
- Morning
- Evening

The shift filter applies to production totals, averages, trends, history, and mixed-milk-fat records. Morning and evening are the two operational milking shifts.

## 4. Analytics questions the page must answer

1. How much milk did the farm or selected buffalo produce in the selected period?
2. Is production growing, stable, or declining?
3. Which buffalo produces the most milk by total quantity and by average recorded day?
4. Which buffalo has a meaningful production decline, and what evidence supports that signal?
5. How do morning and evening production compare?
6. Which expected production records are missing?
7. What combined farm milk fat was recorded for each business date and shift?
8. For a selected buffalo, is the animal economically contributing positively, or is it operating at a loss based on recorded and defensibly allocated revenue and costs?

## 5. All buffaloes mode

Show:
- Total farm milk for the selected period and shift.
- Average daily farm production, using dates with recorded production; also show recorded-day coverage and missing expected entries separately.
- Current active-buffalo count, clearly labelled as a current-status count rather than a count of buffaloes producing in the selected period.
- Production-record count, clearly distinguished from unique buffalo count, buffalo-days, and shift coverage.
- Daily morning and evening production trend.
- Herd coverage / missing-entry status.
- Mixed milk fat table by business date and shift.
- Sortable buffalo comparison table with:
  - Buffalo name and code
  - Total milk in selected period
  - Average milk per recorded production day
  - Morning average and evening average
  - Days with recorded production
  - Last production-entry date
  - Change versus the equivalent previous period
  - Consecutive-decline/growth status when enough comparable records exist
  - Economic result only if a valid animal-level revenue/cost calculation is available; otherwise show “Not available” rather than a fabricated estimate

The table must support sorting by total milk, average per recorded day, morning average, evening average, recorded days, and production change. Make total milk and average per recorded day easy to compare because they answer different questions.

## 6. Single buffalo mode

Show:
- Selected buffalo name, code, and current status.
- Total milk in the selected period.
- Average milk per recorded production day.
- Morning and evening averages, respecting the shift filter.
- Daily production history: date, morning quantity, evening quantity, total quantity, and entry status.
- Production trend and comparison against the immediately preceding equivalent period.
- Growth/decline interpretation based on actual recorded values.
- Consecutive decline/growth signal when sufficient comparable records exist.
- An economic performance section with explicit status:
  - **Profitable / positive contribution** only when allocated revenue exceeds allocated costs for the stated calculation scope.
  - **Loss / negative contribution** only when allocated costs exceed allocated revenue.
  - **Break-even** when revenue and costs are equal within the stated precision.
  - **Insufficient financial data** when required revenue, feed cost, or other relevant costs are missing or cannot be allocated reliably.

Do not equate increasing milk output with profitability. A buffalo can produce more milk while feed or veterinary costs rise faster. Likewise, a production decline does not by itself prove a financial loss.

## 7. Intelligent milk-production graph and insights

The user wants an AI-style graph that explains what is happening, not just two lines without interpretation.

### Graph requirements
- Plot actual daily milk quantity with clearly labelled Morning and Evening series.
- Show total daily production where both shifts are available.
- Include readable business-date labels, litre units, point details/tooltips, and a clear legend.
- Show the previous equivalent period for comparison where useful, without visually confusing it with current actuals.
- Distinguish actual recorded zero from missing data; do not draw a missing shift as zero.
- Use a trend line or rolling average only when the date range and record density make it meaningful; label it clearly as an analytical aid, not actual production.
- Mark missing/incomplete dates and explain how they affect the interpretation.
- In single-buffalo mode, focus the graph on that buffalo's own history. In all-buffalo mode, focus on herd-level production and shift comparison.

### Insight panel
Alongside the graph, provide concise, evidence-linked explanations such as:
- “Production increased by X% versus the previous equivalent period.”
- “Morning production is rising while evening production is falling.”
- “Production declined on N consecutive recorded days.”
- “The apparent change may be incomplete: N expected shift entries are missing.”
- “There is insufficient comparable data to determine a trend.”

Every insight must show the period and the underlying figures used. Do not generate a confident narrative from missing or sparse data. Do not label a change as statistically or operationally significant without a defined rule.

### Meaning of “AI”
The graph itself is a visualization; the value is the analytical explanation around it. Start with deterministic, testable calculations and transparent insight rules. An LLM may optionally phrase verified calculation results in plain language, but it must not invent figures, independently recalculate authoritative totals, diagnose animal health, or assert causation. Forecasting should be a later, explicitly labelled feature and only appear when sufficient history and validation exist. Do not imply that a prediction is a fact.

## 8. Production averages and comparison rules

- **Daily average:** total recorded milk divided by the number of distinct business dates with recorded production for the metric's scope. Do not silently count missing dates as zero.
- Show the number of dates used in the average and the number of expected entries missing separately.
- For a shift-specific average, use dates with a recorded entry for that shift; explain the denominator.
- Compare the selected period with the immediately preceding equivalent period. For example, a 7-day period compares with the prior 7-day window. Show both date windows.
- Period-over-period change and consecutive-day trend are distinct signals.
- A missing record must not be converted to zero or interpreted as a decline. Missing dates break or suspend a consecutive sequence.
- If the baseline is zero, incomplete, or insufficient, avoid misleading percentage-change calculations and show an appropriate neutral/insufficient-data state.
- Use business dates and the farm's local operational calendar consistently.

## 9. Missing records, zero production, and herd coverage

The UI must distinguish:
- **Recorded:** a production entry exists.
- **Recorded zero:** an explicit zero quantity was saved, if allowed by the domain/database.
- **Missing / pending:** an expected buffalo/date/shift entry does not exist.
- **Not expected:** the buffalo is not expected to have a production entry under the confirmed operational/status rules.

Coverage must be derived from persisted entries and confirmed business rules, not inferred from chart gaps. Current domain notes say the production save RPC allows ACTIVE and DRY buffaloes; confirm farm expectations for DRY animals and other statuses before defining which entries are expected. Do not assume every active buffalo is always milking or that every missing record means zero output.

## 10. Mixed milk fat

- Fat is measured once for combined farm milk per business date and shift, not per buffalo.
- Show a **table only**, with business date, shift, and mixed milk fat percentage.
- Respect date and shift filters.
- In single-buffalo mode, either hide this table or show it in a clearly separate section labelled “Farm-level mixed milk fat.” Never attribute it to the selected animal.
- Do not add individual-buffalo fat fields or infer an animal's fat from pool measurements.

## 11. Profitability and economic-performance rules

### Critical distinction
Production analytics alone cannot determine profit or loss. The application must not show a monetary profit/loss conclusion until its revenue and cost model is grounded in actual records and explicit allocation rules.

### Required inputs to investigate before implementation
- **Revenue basis:** determine whether milk produced by a buffalo can be tied to actual sale proceeds. Milk sales currently represent customer transactions and may not identify which buffalo produced the milk. Do not arbitrarily assign customer revenue to a buffalo.
- **Feed cost:** use actual feed-consumption quantities and the established inventory/consumption cost calculation. A planned diet cost is not automatically the same as actual consumed feed cost.
- **Other animal-specific costs:** include recorded veterinary/medicine and other expenses linked to that buffalo when available and relevant to the chosen reporting scope.
- **Purchase cost:** acquisition price is a capital/acquisition transaction, not automatically a daily operating expense. If the product later presents lifetime profitability or payback, define how acquisition cost is treated and show that methodology explicitly.
- **Time window:** distinguish daily/period contribution from lifetime return. Do not mix lifetime purchase costs with a short period's revenue without clearly explaining the calculation.
- **Allocation and missing costs:** every allocation method must be explicit and consistent. If a required amount cannot be attributed reliably, show “Insufficient financial data” or a partial-cost result; never quietly treat missing costs as zero.

### Recommended staged delivery
1. **Production growth analysis first:** reliable actual quantities, shift trends, equivalent-period comparison, missing-entry coverage, and explainable insights.
2. **Cost readiness audit:** inspect existing feed-consumption costing, expense-to-buffalo links, customer milk sales/pricing, and whether produced milk can be linked to actual sales without inventing an allocation.
3. **Profitability calculation only after the model is agreed:** define contribution/profit formula, included costs, revenue basis, and reporting period. Display the formula and data coverage in the UI.
4. **Prediction later:** do not forecast profitability or production until there is enough clean history and validation.

If only actual feed cost is available but revenue cannot be assigned to an individual buffalo, the UI may show feed cost and production as separate metrics, but it must not call the difference “profit.”

## 12. UX and data-quality requirements

- Each KPI must include a clear label, unit, and selected-period context.
- Show loading, error, empty, and insufficient-data states.
- Empty states should explain whether there are no records in the range and how to change the range or enter missing production.
- Chart labels and metric definitions must match the table and KPI calculations.
- Do not use a record count as a proxy for herd coverage.
- All insights must be traceable to displayed figures and the selected filters.
- Keep the design responsive and preserve readable tables and graph interactions on smaller screens.

## 13. Acceptance criteria for future implementation

1. User can switch between All buffaloes and one buffalo using the top dropdown without leaving the page.
2. Date presets, custom range, and shift filters consistently update applicable metrics.
3. Comparison table sorts by total milk and average per recorded day, along with the other agreed production metrics.
4. Previous-period comparisons use equivalent adjacent windows and display the comparison periods.
5. Consecutive growth/decline is shown separately from period comparison and never treats missing records as zero.
6. Missing, recorded, explicit-zero, and not-expected states are not conflated.
7. The graph explains trends using transparent calculations and evidence-linked insight text; insufficient data is called out instead of hidden.
8. Mixed milk fat is shown only as farm-level combined fat by date/shift in a table.
9. Profit/loss is not shown unless revenue and costs can be assigned through a documented, defensible calculation; otherwise the UI clearly reports insufficient financial data.
10. Totals and averages reconcile to underlying buffalo/date/shift records.
11. No schema or business-rule change is made solely to support the UX without separate domain review.
12. No claim of AI prediction, causation, or animal-health diagnosis is presented as fact.

## 14. Implementation prerequisites

Before coding, inspect the existing analytics page, production service/hooks and migrations; verify the exact production data and shift-entry rules; inspect actual feed-consumption cost calculations and buffalo-linked expenses; and trace customer sales/pricing to establish whether revenue can be attributed to a particular buffalo. Document any financial-model gap before deciding implementation scope.

No arbitrary decline threshold is assumed in this specification. Initial insights should show measured changes and their evidence. Any alert threshold (for example, a minimum percentage drop or number of consecutive days) must be defined and tested against farm data before being treated as a definitive warning.

## 15. Scope boundary

This is a finalized use-case specification for planning and review only. It does not authorize implementation. No application source, service, database query, schema, migration, or production data has been changed.
