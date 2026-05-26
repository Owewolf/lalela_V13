# Markdown 4 - Component and Screen Refactor Execution Plan

## Objective
Migrate components and screens from hardcoded styles to semantic theme tokens with zero functional regressions.

## Refactor Principles
- Preserve behavior and information architecture
- Replace literals with tokens, not redesign
- Keep component props and navigation contracts stable
- Refactor in controlled domain tracks with verification checkpoints

## Domain Tracks
1. Auth and onboarding
   - `app/join.tsx`, `app/onboarding.tsx`, `app/onboarding-create.tsx`, `app/phone-reset.tsx`
2. Core tabs and shell
   - `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/chat.tsx`, `app/(tabs)/posts.tsx`, `app/(tabs)/market.tsx`, `app/(tabs)/settings.tsx`
3. Communication flows
   - `app/chat/[id].tsx`, `app/call/[id].tsx`, `app/emergency/index.tsx`, `app/emergency/[id].tsx`
4. Admin and business flows
   - `app/admin.tsx`, `app/security.tsx`, `app/checkout.tsx`, `app/pricing.tsx`, `app/create-post.tsx`

## Per-Track Process
1. Pre-check: list literals and token targets
2. Refactor: replace literals with tokenized classes/helpers
3. Verify: visual and functional smoke checks
4. Record: update migration report and unresolved gaps

## Definition of Done (Per Track)
- No direct color literals in touched files
- Typography/spacing/radius use tokenized paths
- Interaction states remain intact
- No navigation regressions
- No platform-specific rendering regressions

## Deliverables
- `docs/theme-refactor/reports/refactor-progress-by-track.md`
- `docs/theme-refactor/reports/unresolved-token-gaps.md`
- `docs/theme-refactor/reports/regression-checkpoints.md`

## Risks and Mitigations
- Risk: accidental visual drift
  - Mitigation: compare before/after screenshots on representative devices
- Risk: mixed styling systems causing inconsistency
  - Mitigation: enforce lint/checklist in code review
- Risk: performance drops from dynamic style recomputation
  - Mitigation: memoize theme selectors and style factories

## Success Criteria
- All targeted tracks migrated to tokenized styling
- Existing behavior preserved
- Remaining work clearly quantified if not 100 percent complete

## Exit Gate to Phase 5
All domain tracks have completed done-checks and documented known issues.
