# Pricing & Licensing Model Update – Implementation Brief

## Overview

We are standardizing the platform’s monetization model across **communities and members**. This requires updates across **frontend, backend, licensing logic, and payment flows (Stripe mocks included)**.

The goal is a **simple, predictable structure**:

* Community = once-off cost
* Members = annual subscription after trial

---

## New Pricing Model

### Community

* **Cost:** R999 (once-off)
* **Trial:** 30 days
* **Post-payment:** Community remains active indefinitely
* **If not paid within 30 days:** Community is deactivated/removed

### Community Creator (Owner)

* Receives **1-year platform license** upon creating a community
* After 1 year → must pay **R99/year** to remain on platform

---

### Members (Invited Users)

* **Trial:** 1 year (free)
* After trial → **R99/year subscription required**
* If not paid → account becomes inactive (access restricted)

---

## Core Rules (Important)

1. **Community lifecycle**

   * Created → 30-day trial starts
   * If paid (R999) → permanent
   * If unpaid → expires and is removed

2. **Member lifecycle**

   * Invited → 1-year trial starts immediately
   * After 1 year → must pay R99/year
   * No lifetime licenses anymore

3. **Platform access**

   * Only **active licensed users** can:

     * Join communities
     * Interact/post
     * Access features

---

## Backend Changes Required

### Licensing System

* Replace any **lifetime license logic**
* Introduce:

  * `community_license_status`:

    * trial / active / expired
  * `member_license_status`:

    * trial / active / expired
  * `expiry_date` for both

---

### Community Model Updates

Add/ensure:

* `created_at`
* `trial_expires_at` (created_at + 30 days)
* `is_paid` (boolean)
* `activated_at` (when R999 paid)

Logic:

* If `now > trial_expires_at AND is_paid == false` → deactivate community

---

### Member Model Updates

Add/ensure:

* `joined_at`
* `trial_expires_at` (joined_at + 1 year)
* `subscription_active` (boolean)
* `subscription_renewal_date`

Logic:

* If `now > trial_expires_at AND subscription_active == false` → restrict access

---

## Payment Flow Changes

### Community Payment

* One-time Stripe payment: **R999**
* On success:

  * Set `is_paid = true`
  * Activate community permanently

---

### Member Subscription

* Annual Stripe subscription: **R99/year**
* On success:

  * Set `subscription_active = true`
  * Update `renewal_date`

---

### Stripe (Mock + Real)

Update all:

* Mock cards
* Payment handlers
* Webhooks (if present)

Ensure:

* Separate flows for:

  * Community purchase (once-off)
  * Member subscription (recurring)

---

## Frontend Changes

### UI Updates

Replace all pricing references with:

* “Start a community – R999 once-off”
* “Membership – R99/year after 1-year free trial”

---

### User States to Display

* Community:

  * Trial (days remaining)
  * Active
  * Expired

* Member:

  * Trial (days remaining)
  * Active subscription
  * Expired

---

### Notifications

Add:

* Community trial expiry warning (e.g. 5 days before)
* Member trial expiry warning
* Subscription renewal reminders

---

## Access Control (Critical)

Enforce globally:

### Community Access

* Block access if:

  * Community expired
  * User not licensed

### Member Access

* Block actions if:

  * Trial expired AND no active subscription

---

## Migration Considerations

* Existing users:

  * Convert to **1-year trial from migration date** OR
  * Respect current state but align going forward

* Remove any:

  * Lifetime license flags
  * Old pricing logic

---

## Summary

| Item      | Cost | Trial   | After Trial       |
| --------- | ---- | ------- | ----------------- |
| Community | R999 | 30 days | Permanent if paid |
| Member    | Free | 1 year  | R99/year          |

---

## Outcome

This creates:

* Predictable recurring revenue
* Clear lifecycle for communities
* Scalable licensing model
* Clean separation between **community ownership** and **platform membership**

---

**All systems (backend, frontend, payments, licensing) must reflect this model consistently.**





# Appendix A – Pricing & Benefits Page Update

## Objective

Update all **public-facing pricing and benefits pages** to reflect the new monetization model and ensure consistency with backend licensing logic.

This includes:

* Pricing page
* Benefits/features page
* Any onboarding or marketing screens referencing cost or access

---

## Core Messaging (Must Be Consistent Everywhere)

### Community

* **“Start a Community – R999 once-off”**
* Includes:

  * 30-day free trial
  * Permanent activation once paid
  * Ability to invite unlimited members

---

### Members

* **“Join the Platform – Free for 1 Year”**
* Then:

  * **R99 per year to stay active**

---

## Pricing Page Structure (Required Layout)

### Section 1 – Community Starter

**Title:** Start Your Community
**Price:** R999 (once-off)

**Includes:**

* 30-day trial
* Permanent community once paid
* Invite unlimited members
* 1-year platform access for creator

---

### Section 2 – Membership

**Title:** Platform Membership
**Price:** Free for 1 year → R99/year

**Includes:**

* Join communities
* Participate and interact
* Access platform features
* Continued access with annual renewal

---

## Benefits Page Updates

### Replace Existing Benefits With:

#### For Community Creators

* Launch your own community instantly
* No recurring community fees
* Grow and manage your network
* Full access for 1 year included

#### For Members

* Join communities for free (1-year trial)
* Discover and participate in local ecosystems
* Maintain access for just R99/year

---

## Trial Messaging (Critical)

Ensure clear, visible messaging:

### Community Trial

* “Your community is free for 30 days. Activate it for R999 to keep it live.”

### Member Trial

* “You have 1 year of free access. After that, continue for R99/year.”

---

## UI/UX Requirements

* Display **countdown timers** where applicable:

  * Community trial (days remaining)
  * Member trial (days remaining)

* Add **clear CTAs**:

  * “Activate Community”
  * “Renew Membership”

* Highlight:

  * No hidden fees
  * Simple pricing structure

---

## Consistency Requirements

The following must be aligned across:

* Pricing page
* Benefits page
* Signup flow
* Dashboard messaging
* Payment screens (including Stripe mocks)

---

## Removal of Legacy Messaging

Remove any references to:

* Lifetime licenses
* Old pricing tiers
* One-time member payments
* Any outdated benefits

---

## Outcome

Users should clearly understand:

* Communities cost **R999 once-off**
* Members are **free for 1 year**
* Then **R99/year to remain active**

No ambiguity. No conflicting messaging.



