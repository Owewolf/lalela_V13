# Interaction State Inventory

Date: 2026-05-26
Scope: Strict interaction-state validation readiness
Source: `docs/theme-refactor/reports/interaction-state-coverage.raw.txt`

## Baseline
- Total interaction-state findings: 242
- Interpretation: Inventory findings, not tokenization debt

## Token Breakdown
- `activeOpacity`: 174
- `disabled`: 65
- `focused`: 5
- `onBlur`: 1

## Top File Concentration
1. `src/components/home/HomePage.tsx` (41)
2. `src/components/posts/PostsPage.tsx` (20)
3. `src/components/posts/CreatePostPage.tsx` (14)
4. `src/components/admin/ModerationCenter.tsx` (13)
5. `src/components/market/MarketPage.tsx` (12)
6. `src/components/shared/MobileSidebar.tsx` (10)
7. `src/components/admin/BusinessImportTool.tsx` (10)
8. `src/components/admin/AdminDashboard.tsx` (10)
9. `src/components/auth/OnboardingCreate.tsx` (8)
10. `src/components/admin/CommunityInsightPanels.tsx` (8)

## Validation Buckets
- Press feedback coverage: all `activeOpacity` surfaces.
- Disabled-state gating: all `disabled` controls.
- Focus management: `focused` and `onBlur` occurrences.

## Execution Plan
1. Execute top-10 files first, then remaining files in descending count order.
2. For each file, capture evidence using `docs/theme-refactor/evidence/EVIDENCE_TEMPLATE.md`.
3. Mark each finding group as PASS/FAIL/BLOCKED in strict manual matrix.
4. On completion, recompute `audit:theme-noncolor` and update sign-off docs.

## Exit Condition
State inventory is considered complete when all findings are mapped to evidence artifacts or linked issues with owner/date.
