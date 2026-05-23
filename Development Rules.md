# Developer Implementation & Collaboration Rules

## Primary Development Principles

### 1. Preserve Existing Functionality

* Do not break, remove, or unintentionally alter existing functionality.
* All new work must complement the current codebase rather than replace working systems.
* Existing flows, especially authentication, database relationships, APIs, and UI behavior, must remain operational unless explicit approval is given for changes.
* Email authentication must remain fully functional while phone authentication is added in parallel.

---

### 2. Study Before Changing

Before writing or modifying code:

* Review the current project structure.
* Understand the existing architecture, conventions, naming patterns, database relationships, and authentication flow.
* Identify how the frontend, backend, and database currently interact.
* Avoid introducing patterns that conflict with the existing system.

No assumptions should be made about:

* frameworks
* libraries
* business logic
* data flow
* infrastructure
* intended behavior

If something is unclear, ask questions first.

---

### 3. Ask Questions Before Implementation

Do not assume implementation details.

Before making changes:

* Ask for clarification where uncertainty exists.
* Confirm expected behavior when multiple approaches are possible.
* Verify how existing systems currently behave before extending them.

Examples:

* Should OTP login create accounts automatically or only authenticate existing users?
* Should phone linking require reauthentication?
* Should invite codes be optional or enforced?
* Should OTP rate limiting be IP-based, account-based, or both?

Accuracy is more important than speed.

---

### 4. Explain Changes Before Making Them

Before implementing any modification:

* Clearly explain what files will be changed.
* Explain why the changes are required.
* Explain the expected impact.
* Explain any risks or side effects.

Do not make silent architectural changes.

---

### 5. Change Only What Is Necessary

Keep modifications tightly scoped.

Do not:

* refactor unrelated code
* rename unrelated systems
* restructure working logic unnecessarily
* rewrite existing modules without approval
* introduce large abstractions without need

Only touch code that is directly required for the requested functionality.

---

### 6. Always Use the Simplest Viable Solution

Prefer solutions that are:

* maintainable
* readable
* scalable
* production-safe
* easy for future developers to understand

Avoid:

* overengineering
* premature optimization
* unnecessary abstractions
* overly complex patterns

The simplest reliable implementation should always be preferred.

---

### 7. Keep Frontend and Backend Fully Aligned

At every stage:

* Ensure frontend behavior matches backend responses.
* Ensure database schema matches application expectations.
* Ensure API contracts remain consistent.
* Ensure TypeScript types/interfaces remain synchronized.
* Ensure validation rules are consistent across frontend and backend.

No frontend feature should rely on backend behavior that does not exist.

---

### 8. Protect Existing Authentication Systems

The existing email authentication system must remain untouched unless explicitly approved.

Phone authentication must:

* operate in parallel
* reuse existing authentication/session logic where possible
* integrate cleanly into the current auth architecture
* avoid duplicating unnecessary logic

One user account should eventually support:

* email only
* phone only
* both email and phone

---

### 9. Maintain Database Integrity

Database changes must be:

* minimal
* reversible
* migration-safe
* backward compatible

Before migrations:

* review existing relationships
* verify constraints
* ensure indexes are correct
* confirm no existing data will be damaged

All migrations must be tested locally before submission.

---

### 10. Never Fabricate Technical Assumptions

If something is unknown:

* state the uncertainty clearly
* inspect the project first
* ask for clarification

Do not invent:

* database structure
* API responses
* environment configuration
* hidden business rules
* deployment assumptions

---

# Implementation Workflow Requirements

## Phase 1 — Analysis

Before coding:

1. Review current authentication flow.
2. Review database schema.
3. Review frontend auth screens.
4. Review API structure.
5. Identify reusable systems.
6. Identify exact files requiring modification.
7. Present implementation plan before coding.

---

## Phase 2 — Planning

Before implementation:

* List all files that will be modified.
* List all new files that will be created.
* Explain why each change is required.
* Explain how existing functionality will remain protected.

No coding should begin until the implementation direction is clear.

---

## Phase 3 — Incremental Implementation

Implement in small isolated stages:

### Recommended Order

1. Database schema updates
2. Prisma migration
3. OTP model
4. SMS service
5. Backend auth routes
6. Rate limiting
7. AuthContext integration
8. Frontend login screens
9. OTP verification UI
10. Invite system
11. Phone linking
12. Reset flow
13. Platform-specific OTP improvements

Each stage should be testable independently.

---

## Phase 4 — Validation & Testing

Testing is mandatory before finalization.

The developer must verify:

* Existing email login still works
* Existing registration still works
* Existing sessions remain valid
* Phone OTP flow works
* OTP expiry works
* Invalid OTP handling works
* Rate limiting works
* Invite flow works
* Linking phone to existing account works
* Duplicate phone protection works
* Database migrations run correctly
* API responses match frontend expectations
* No regression issues were introduced

Testing must occur before code is considered complete.

---

# Code Quality Rules

## Response & Communication Standards

### No Filler Responses

Do not use conversational filler such as:

* “Great question”
* “Absolutely”
* “Of course”
* “Sure”

Start directly with useful information.

---

### Match Detail to Complexity

* Simple tasks → concise responses
* Complex changes → structured explanations

Avoid unnecessary verbosity.

---

### Explain Recommendations Clearly

When proposing changes:

* explain reasoning
* explain impact
* explain trade-offs
* explain risks

Do not present opinions as facts.

---

### Stay Focused

Only address the requested scope.

Do not:

* introduce unrelated features
* redesign unrelated UI
* change architecture unnecessarily

---

### Preserve User Intent

Respect the current product direction and existing implementation choices unless explicitly instructed otherwise.

---

### Prefer Clarity Over Style

Prioritize:

* readability
* maintainability
* correctness
* consistency

over cleverness or stylistic complexity.

---

# Phone Authentication Implementation Requirements

## Core Objective

Implement phone number authentication alongside the existing email authentication system without disrupting current functionality.

---

## Required Features

### Authentication

* Phone number login
* Phone registration
* SMS OTP verification
* Existing email login preserved
* Existing email registration preserved

---

### Account Support

Accounts must support:

* email only
* phone only
* both email and phone

---

### SMS System

Use Africa’s Talking for:

* OTP delivery
* invite SMS messages

---

### OTP Requirements

* OTP expiry
* OTP reuse prevention
* rate limiting
* E.164 validation
* secure token/session handling

---

### Invite System

Users must be able to:

* invite neighbors via SMS
* optionally include invite codes

---

### Profile Management

Users must later be able to:

* add phone numbers
* verify linked numbers
* eventually link email and phone together

---

### Security Requirements

Implement:

* rate limiting
* validation
* secure token handling
* proper OTP expiration
* duplicate prevention
* POPIA-conscious messaging practices

---

# Final Delivery Requirements

Before final submission provide:

1. List of modified files
2. List of new files
3. Database migration summary
4. API endpoint summary
5. Testing summary
6. Known limitations (if any)
7. Any required environment variables
8. Rollback considerations if applicable

---

# Non-Negotiable Rules

* Do not break existing code.
* Do not assume behavior.
* Ask questions when uncertain.
* Keep changes minimal and intentional.
* Keep frontend/backend/database aligned.
* Test before finalization.
* Use the simplest viable implementation.
* Protect existing authentication systems.
* Only modify what is necessary.

