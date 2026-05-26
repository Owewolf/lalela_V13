# Markdown 5 - Validation, Accessibility, and Release Gate Plan

## Objective
Validate the theme migration end-to-end and define release gates for safe rollout across iOS, Android, and web.

## Test Matrix Scope
- Screens: all migrated domains from phase 4
- States: default, loading, error, empty, disabled, pressed, focus/hover (web)
- Devices:
  - iOS: small + large screen
  - Android: low/mid/high capability
  - Web: Chrome, Safari, Firefox, Edge + responsive breakpoints

## Validation Categories
1. Visual consistency
   - color roles, typography hierarchy, spacing, radius, shadows, icon contrast
2. Functional behavior
   - navigation, forms, modals, tab transitions, theme load/update behavior
3. Performance
   - rerender hotspots, FPS stability in key transitions, startup overhead
4. Accessibility
   - contrast checks, focus visibility, text scaling/readability, keyboard navigation (web)

## Release Gates
Gate 1: Migration complete
- All phase 4 tracks marked done or explicitly deferred

Gate 2: Quality baseline
- No P0 visual/function regressions
- No unresolved accessibility blockers in critical flows

Gate 3: Platform confidence
- Smoke tests pass on iOS, Android, and web
- Known issues documented with owners and timelines

## Bug Reporting Standard
Each issue must include:
1. Summary
2. Platform and build/version
3. Steps to reproduce
4. Actual vs expected result
5. Severity (`P0|P1|P2`)
6. Evidence (screenshot/video)
7. Proposed fix direction

## Deliverables
- `docs/theme-refactor/reports/cross-platform-test-report.md`
- `docs/theme-refactor/reports/accessibility-findings.md`
- `docs/theme-refactor/reports/performance-observations.md`
- `docs/theme-refactor/reports/release-gate-checklist.md`

## Rollback and Monitoring
- Keep rollback-ready branch/tag before merge
- Monitor post-release visual and runtime errors
- Prioritize hotfixes for critical regressions

## Success Criteria
- Theme behavior is consistent across platforms
- Critical user journeys remain stable
- Accessibility and performance meet baseline acceptance
- Release decision is supported by documented evidence
