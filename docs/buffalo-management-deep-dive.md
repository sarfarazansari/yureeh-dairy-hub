# Yureeh Dairy Hub — Buffalo Management Deep Dive

## 1. Scope
This document records the current Buffalo Management domain after reviewing the application code and the Buffalo-related Supabase migrations.

It separates what the system currently models, enforced business rules, implemented changes, and farm-specific decisions still required.

## 2. Current domain model

### Buffalo master
buffaloes is the individual-animal master record.
Current fields: buffalo code, name, purchase date, age at purchase, breed, color, identification mark, current status, notes.
Buffalo code is normalized to uppercase/trimmed whitespace and uniquely enforced per farm.

### Buffalo purchase
buffalo_purchases is the acquisition transaction.
It stores purchase date, purchase price, vendor, amount paid at acquisition, generated pending amount, payment status, payment terms, due date, payment method, transaction reference and notes.
A buffalo has one purchase record.
The purchase is created transactionally with the buffalo and optional vendor through create_buffalo_purchase.

### Vendor
vendors is currently a buffalo-purchase vendor master. The purchase flow can create a vendor from name/location.

## 3. Purchase payment model
Before this change, amount_paid represented only the amount paid at purchase time. That could not safely represent later settlements without losing payment history.

Implemented: buffalo_purchase_payments.
Each payment records purchase, buffalo, payment date, amount, payment method, transaction reference, notes and created timestamp.

Implemented RPC: record_buffalo_purchase_payment.
It locks the purchase, verifies ownership, rejects invalid or excessive payments, records the payment, updates the purchase aggregate, changes status to PARTIAL or PAID, and clears credit terms when fully settled.

## 4. Buffalo lifecycle
Existing statuses are ACTIVE, DRY, SOLD, DECEASED and OTHER. Previously only current_status was stored.

Implemented: buffalo_status_history.
Each event stores buffalo, status, effective date, notes and created timestamp.

Implemented RPC: change_buffalo_status.
It updates the master status and records the lifecycle event together.

Existing buffaloes receive an initial baseline history row during migration using their current status and purchase date, or migration date when purchase date is unavailable. This is not intended to invent historical transitions.

## 5. Production relationship
buffalo_milk_production has the grain one buffalo + one business date + one shift.
Production saving is transactional through save_buffalo_milk_production.
The current RPC allows ACTIVE and DRY buffaloes. This should remain an explicit business rule during the Production deep-dive.
The older buffalo_daily_performance table remains legacy/audit data.

## 6. Remaining lifecycle questions
Not implemented yet because these require actual farm decisions: sale price/proceeds, buyer information, disposal reason, death date/reason, transfer between farms, return from DRY to ACTIVE, meaning of OTHER, pregnancy/calving, breeding history, permanent identification changes, and acquisition transport/freight capitalization.

These should be modeled as dedicated events/transactions rather than random fields on buffaloes.

## 7. Cost model
Purchase cost is separate from normal expenses, which is correct.
Buffalo-related expenses can link to a buffalo, but are not automatically treated as acquisition cost.
Purchase price is an acquisition transaction. A later veterinary bill is an operating expense. Acquisition transport may be acquisition-related cost, but that accounting treatment needs a farm decision.

## 8. Integrity already enforced
Buffalo code uniqueness and normalization; positive purchase price; valid advance; credit due date; payment-state normalization; transactional buffalo/vendor/purchase creation; production uniqueness per buffalo/date/shift; non-negative production; payment amount validation; no overpayment; transactional status changes with history.

## 9. Architectural classification
| Record | Classification |
|---|---|
| buffaloes | Master / individual asset |
| vendors | Master |
| buffalo_purchases | Acquisition transaction |
| buffalo_purchase_payments | Payment transaction |
| buffalo_status_history | Lifecycle event history |
| buffalo_milk_production | Operational transaction |
| buffalo_daily_performance | Legacy operational/audit record |
| dashboard/analytics | Derived/reporting |

## 10. Remaining Buffalo gaps
High priority: sale/disposal transaction; complete payment history reporting; buffalo profile editing; lifecycle history display; production-vs-sales reconciliation.

Farm-specific decisions: pregnancy tracking, calving history, breeding/AI records, dry-period rules, death/disposal workflow, sale workflow, acquisition transport treatment, health/medicine history, DOB versus age-at-purchase, and tag/ear-tag/barcode data.

## 11. Next deep-dive
Next module: Milk Production.
The key chain to establish is Buffalo → Production → Farm Milk Pool → Milk Sale / Customer Delivery.
The critical architectural question is whether production is only an individual performance record, a farm-level milk inventory, or both through separate reconcilable transactions.

## 12. Implementation status
Implemented on branch feature/buffalo-domain-audit.
Changes: purchase payment history, settlement RPC, status history, status-change RPC, Buffalo detail payment control, Buffalo detail lifecycle control, and service-layer methods.
No existing purchase or production flow was removed.