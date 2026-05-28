# Appendix: Transactional Inventory & Partial Sales Architecture

## Purpose

This appendix defines the architectural evolution of the marketplace system from simple “sold/not sold” listings into a transaction-driven inventory and contribution tracking system.

The objective is to support:

* Quantity-based listings
* Partial sales
* Inventory tracking
* Immutable transaction history
* Accurate CAT (Community Assisted Tax) calculations
* Charity contribution accountability
* Real-time marketplace reporting
* Scalable commerce functionality

This architecture applies across:

* Web
* Android
* iOS

---

# Core Architectural Principle

A marketplace listing must no longer represent a single completed sale.

Instead:

A listing becomes an inventory source, while every individual sale becomes a permanent transaction record.

This changes the system from:

“Was the item sold?”

to:

“How many units were sold, when, by whom, and what contribution did they generate?”

---

# Architectural Source of Truth

## Critical Design Rule

The system must never rely solely on a mutable “Sold Quantity” counter stored on the listing itself.

Instead:

The permanent source of truth must be the transaction history.

This ensures:

* Auditability
* Transparency
* Financial integrity
* Correct CAT calculations
* Fraud prevention
* Historical accountability

---

# Primary Data Entities

The architecture should be separated into three core logical structures.

---

# 1. Listing Entity

## Purpose

Defines the inventory item being offered for sale.

This represents:

* The product
* The seller
* Original stock availability
* Pricing
* Potential marketplace value

---

## Core Listing Fields

| Field                | Purpose                                 |
| -------------------- | --------------------------------------- |
| Listing ID           | Unique listing identifier               |
| Seller ID            | Owner of listing                        |
| Title                | Product title                           |
| Description          | Product description                     |
| Unit Price           | Price per individual item               |
| Initial Quantity     | Original stock quantity                 |
| Quantity Type        | Bottles, units, kg, litres, boxes, etc. |
| CAT Percentage       | Community contribution rate             |
| Charity/Community ID | Destination allocation                  |
| Created Date         | Listing creation timestamp              |
| Listing Status       | Active, Low Stock, Sold Out, Archived   |

---

# Example Listing

| Property                    | Value         |
| --------------------------- | ------------- |
| Product                     | Honey Bottles |
| Unit Price                  | R100          |
| Initial Quantity            | 50            |
| Potential Marketplace Value | R5,000        |

---

# 2. Sale Transaction Entity

## Purpose

This is the permanent ledger of all sales activity.

Every purchase event creates a new immutable transaction.

This table becomes:

* The financial history
* The inventory history
* The CAT history
* The accountability ledger

---

# Critical Rule

Sale transactions must be append-only.

Transactions should never be deleted or overwritten.

Corrections must create reversal or adjustment entries instead of modifying history.

---

# Core Transaction Fields

| Field                 | Purpose                         |
| --------------------- | ------------------------------- |
| Transaction ID        | Unique sale identifier          |
| Listing ID            | Related marketplace listing     |
| Buyer ID              | Purchasing user                 |
| Quantity Sold         | Number of units purchased       |
| Unit Price at Sale    | Locked-in sale price            |
| Total Sale Value      | Quantity × Unit Price           |
| CAT Generated         | CAT contribution amount         |
| Charity Allocation    | Charity/community receiving CAT |
| Transaction Timestamp | Date/time of purchase           |
| Payment Status        | Pending, Completed, Failed      |
| Transaction Status    | Active, Refunded, Reversed      |

---

# Example Transaction History

## Listing: Honey Bottles

| Transaction | Quantity Sold | Value  |
| ----------- | ------------- | ------ |
| Sale #1     | 5             | R500   |
| Sale #2     | 10            | R1,000 |
| Sale #3     | 7             | R700   |

---

# Calculated Totals

| Metric            | Value  |
| ----------------- | ------ |
| Total Sold        | 22     |
| Remaining Stock   | 28     |
| Revenue Generated | R2,200 |

---

# 3. Inventory State Layer

## Purpose

The inventory state should be dynamically calculated from transaction history.

The system should never depend solely on editable counters.

---

# Inventory Calculation Logic

## Total Sold Quantity

The system determines total sold by aggregating all related sale transactions.

Formula:

Total Sold Quantity = Sum of all transaction quantities linked to the listing

---

## Remaining Inventory

Formula:

Remaining Stock = Initial Quantity − Total Sold Quantity

---

# Example

## Original Listing

50 honey bottles

## Sales

* 5 sold
* 10 sold
* 7 sold

## Calculation

Total Sold:
22

Remaining:
28

---

# Marketplace Workflow

---

# A. Listing Creation Workflow

## Seller Actions

The seller provides:

* Product information
* Unit price
* Initial quantity
* Quantity type
* CAT percentage
* Charity/community destination

---

## System Actions

The system creates:

* A listing record
* Initial inventory state

No sale transactions exist at this stage.

---

# B. Purchase Workflow

## Buyer Purchase Request

Buyer selects quantity desired.

Example:

* Buyer purchases 5 bottles

---

## Validation Process

Before approving the transaction, the system must verify:

Requested Quantity ≤ Remaining Available Stock

---

## Transaction Creation

If approved:

The system writes a new immutable sale transaction record.

Example:

| Field         | Value                  |
| ------------- | ---------------------- |
| Listing       | Honey Bottles          |
| Quantity Sold | 5                      |
| Sale Value    | R500                   |
| CAT Generated | Calculated dynamically |

---

## Inventory Update

The inventory view recalculates automatically from transaction history.

No manual sold counter should be trusted as the authoritative source.

---

# C. Marketplace Display Logic

Marketplace cards and detail pages must display calculated live inventory values.

---

# Listing Display Requirements

Each listing should display:

| Field               | Example          |
| ------------------- | ---------------- |
| Unit Price          | R100             |
| Original Quantity   | 50               |
| Quantity Sold       | 22               |
| Remaining Quantity  | 28               |
| Percentage Sold     | 44%              |
| CAT Raised          | Dynamic total    |
| Beneficiary Charity | Community-linked |

---

# Marketplace Status Indicators

The old binary “Sold” label becomes inventory-aware.

---

# Required Listing States

| State           | Meaning                            |
| --------------- | ---------------------------------- |
| Active          | Inventory available                |
| Low Stock       | Remaining quantity below threshold |
| Nearly Sold Out | Critical inventory remaining       |
| Sold Out        | Remaining quantity = 0             |
| Archived        | Listing manually closed            |

---

# CAT & Charity Contribution Logic

## Critical Financial Rule

CAT must be calculated only against actual completed sales.

NOT against potential inventory.

---

# Example

## Listing

50 bottles at R100

## Potential Marketplace Value

R5,000

## Actual Sold

22 bottles

## Actual Revenue

R2,200

## CAT Generated

Calculated only on R2,200

NOT on R5,000

---

# Dashboard

---

# Community Dashboard

The dashboard must display both:

## Potential Figures

* Potential marketplace value
* Potential CAT value

## Realized Figures

* Actual revenue generated
* Actual CAT raised


---

# Charity Dashboard

Each charity/community section should show:

| Metric                      | Purpose                           |
| --------------------------- | --------------------------------- |
| Potential Contributions     | Based on active listings          |
| Actual Contributions Raised | Based on completed transactions   |
| Total Units Sold            | Community engagement metric       |
| Active Marketplace Listings | Economic participation visibility |

---

# Seller Analytics

Sellers should have access to:

* Total inventory listed
* Total units sold
* Remaining stock
* Revenue generated
* CAT contributed
* Top-performing listings
* Sales velocity
* Inventory depletion trends

---

# Moderation & Audit Controls

Administrators and moderators must be able to:

* Audit transaction history
* Detect inventory manipulation
* Review quantity adjustments
* Freeze suspicious listings
* Validate CAT calculations
* Investigate fraudulent reporting

---

# Data Integrity Rules

---

# Inventory Rules

Quantity:

* Cannot become negative
* Cannot exceed original stock
* Cannot bypass validation

---

# Transaction Rules

Transactions:

* Must be immutable
* Must remain historically accessible
* Must create audit trails
* Must record timestamps
* Must preserve original pricing

---

# Financial Rules

CAT:

* Must calculate from completed transactions only
* Must remain historically reproducible
* Must support auditing and reporting

---

# Historical Accountability

The system must permanently preserve:

* Original listing quantities
* Every sale event
* Inventory adjustment history
* CAT contribution history
* Charity allocation history
* Marketplace activity timelines

This creates:

* Trust
* Transparency
* Community accountability
* Financial verifiability

---

# Scalability & Future Compatibility

This architecture is intentionally designed to support future marketplace expansion.

Future-compatible capabilities include:

* Shopping carts
* Multi-buyer concurrency
* Reservations
* Bulk discounts
* Wholesale tiers
* Auctions
* Subscription inventory
* Automatic restocking
* Warehouse support
* QR/barcode systems
* Cooperative inventory pooling
* Community supply chains

---

# Final Architectural Objective

Transform the marketplace from static listing posts into a fully transactional commerce ecosystem capable of:

* Live inventory management
* Accurate partial sales tracking
* Immutable sales accounting
* Transparent CAT calculation
* Community contribution auditing
* Scalable marketplace growth
* Financial-grade accountability
* Long-term economic reporting

The marketplace must ultimately function not merely as a classifieds system, but as a transactionally accountable community economy infrastructure.


# Further Appendix: Listing Shortcut Menu & Partial Sold Workflow Integration

## Purpose

This appendix defines the required changes to the marketplace listing shortcut menu and sold-state interaction logic to support quantity-aware inventory tracking and transactional sales recording.

The current implementation assumes a listing can only be entirely sold or unsold.

This must evolve into a quantity-aware sales workflow capable of handling:

* Single-item listings
* Multi-quantity listings
* Partial inventory depletion
* Incremental sales
* Real-time CAT contribution calculations

This workflow must integrate directly into:

* Homepage listings
* Marketplace listing cards
* Listing detail pages
* Seller shortcut menus
* Three-dot contextual menus

Across:

* Web
* Android
* iOS

---

# Current Limitation

The current “Mark as Sold” action is binary.

This creates architectural inaccuracies because:

* Listings may contain multiple units
* Sellers may sell portions of inventory over time
* CAT must reflect actual quantities sold
* Inventory may remain active after partial sales

---

# Required Workflow Evolution

The “Mark as Sold” action must become quantity-aware.

The system must intelligently determine whether:

* The listing is a single-item listing
  OR
* The listing supports partial quantity sales

---

# Listing Quantity Behaviour

---

# A. Single-Item Listings

## Definition

Listings where:

* Initial quantity = 1

OR

* Partial sales are disabled

---

## Seller Interaction

When the seller selects:

“Mark as Sold”

The system should immediately:

* Record the transaction
* Mark remaining inventory as zero
* Close the listing
* Update CAT calculations
* Transition listing to “Sold Out”

No quantity prompt is required.

---

# B. Multi-Quantity Listings

## Definition

Listings where:

* Initial quantity > 1
  AND
* Partial sales are enabled

---

## Seller Interaction

When the seller selects:

“Mark as Sold”

The system must instead launch a quantity input workflow.

---

# Required Quantity Modal

The seller must be prompted with:

| Field                      | Purpose                       |
| -------------------------- | ----------------------------- |
| Quantity Sold Input        | Number of units sold          |
| Remaining Quantity Preview | Real-time remaining inventory |
| Sale Value Preview         | Calculated transaction value  |
| CAT Contribution Preview   | Estimated CAT generated       |
| Confirm Sale Button        | Finalize transaction          |

---

# Example Workflow

## Original Listing

Honey Bottles

| Property          | Value |
| ----------------- | ----- |
| Original Quantity | 50    |
| Unit Price        | R100  |

---

## Seller Action

Seller opens three-dot menu.

Selects:
“Mark Quantity as Sold”

---

## Modal Opens

Input:
5

---

## System Preview

| Metric              | Value   |
| ------------------- | ------- |
| Quantity Being Sold | 5       |
| Sale Value          | R500    |
| Remaining Stock     | 45      |
| CAT Generated       | Dynamic |

---

## Confirmation

Seller confirms transaction.

---

# System Actions After Confirmation

The system must:

1. Create immutable sale transaction
2. Deduct sold quantity from available inventory
3. Recalculate listing inventory state
4. Update CAT contribution totals
5. Update charity/community dashboards
6. Refresh marketplace display
7. Recalculate sold percentages
8. Determine whether listing remains active

---

# Dynamic Listing Status Behaviour

After each partial sale:

| Remaining Quantity | Status          |
| ------------------ | --------------- |
| > Threshold        | Active          |
| Low inventory      | Low Stock       |
| Critical inventory | Nearly Sold Out |
| 0                  | Sold Out        |

---

# Three-Dot Menu Integration

The shortcut menu must become context-aware.

---

# Owner Listing Menu Behaviour

## Single-Item Listings

Menu Option:

* Mark as Sold

---

## Multi-Quantity Listings

Menu Option:

* Record Sale
  OR
* Mark Quantity as Sold

This distinction is critical because:

* The listing itself may remain active
* Only a portion of inventory may be depleted

---

# Recommended Owner Shortcut Menu Structure

| Action             | Purpose                  |
| ------------------ | ------------------------ |
| Edit Listing       | Modify listing details   |
| Record Sale        | Record quantity sold     |
| View Sales History | Transaction history      |
| Adjust Inventory   | Manual stock adjustment  |
| Pause Listing      | Temporarily disable      |
| Archive Listing    | Remove from marketplace  |
| Share Listing      | Social/community sharing |

---

# Marketplace Card Integration

Listing cards must visually reflect live inventory state.

---

# Required Listing Card Indicators

| Indicator          | Example                    |
| ------------------ | -------------------------- |
| Remaining Quantity | 45 remaining               |
| Sold Quantity      | 5 sold                     |
| Percentage Sold    | 10% sold                   |
| Stock Status       | Active / Low Stock         |
| CAT Raised         | Dynamic contribution total |

---

# Real-Time UI Behaviour

After a transaction is recorded:

The UI must update immediately across:

* Homepage feed
* Marketplace category pages
* Seller profile listings
* Community dashboards
* Charity dashboards

Without requiring manual refreshes where possible.

---

# Inventory Validation Rules

The quantity input workflow must enforce:

| Rule                                   | Purpose                      |
| -------------------------------------- | ---------------------------- |
| Quantity cannot exceed available stock | Prevent overselling          |
| Quantity cannot be negative            | Prevent corruption           |
| Quantity cannot be zero                | Prevent invalid transactions |
| Transaction must be atomic             | Prevent race conditions      |

---

# Partial Sale Integrity

Every partial sale must generate:

* A permanent transaction record
* Updated inventory calculations
* Updated CAT calculations
* Updated reporting statistics

No direct editing of historical sold quantities should occur.

---

# Sales History Integration

Each listing should eventually support:

## Seller Sales Timeline

| Transaction | Quantity | Value | Date |
|---|---|
| Sale #1 | 5 | R500 | Timestamp |
| Sale #2 | 10 | R1,000 | Timestamp |

This provides:

* Accountability
* Transparency
* Auditability
* Financial verification

---

# Dashboard Impact

The shortcut menu sale workflow must dynamically update:

## Seller Dashboard

* Units sold
* Remaining inventory
* Revenue generated
* CAT contributed

---

## Community Dashboard

* Actual marketplace activity
* Community-supported transactions
* Charity contribution totals

---

## Charity Dashboard

* Actual realized contributions
* Marketplace participation metrics
* Inventory-driven contribution analytics

---

# Long-Term Architectural Importance

This enhancement is foundational.

It transitions the platform from:

* Static classified listings

Into:

* Transaction-driven marketplace infrastructure

This is required for future scalability including:

* Shopping carts
* Bulk ordering
* Multi-user purchases
* Reservation systems
* Subscription inventory
* Automated fulfillment
* Community commerce accounting

---

# Final Objective

The listing shortcut menu must evolve into an inventory-aware transaction interface capable of:

* Handling partial sales
* Recording quantity-specific transactions
* Maintaining immutable sales history
* Dynamically recalculating inventory
* Accurately tracking CAT contributions
* Updating marketplace statistics in real time
* Supporting scalable transactional commerce infrastructure

