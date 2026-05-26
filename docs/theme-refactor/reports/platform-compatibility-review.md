# Platform Compatibility Review - Completed Audit Snapshot

## Objective
Document known compatibility risks discovered during hardcoded-style audit before migration begins.

## Current Observations
1. Mixed styling approach remains in use (`StyleSheet.create`, inline style objects, and Tailwind className).
2. High-literal files are concentrated in settings/home/auth/admin shared surfaces.
3. Status/neutral color debt is now explicitly tracked via inventory mapping (`TOKEN_GAP` vs mapped token).
4. A regression guard (`npm run lint:theme-guard`) now blocks newly introduced hardcoded color literals.

## Risks by Platform

### iOS
- Risk of spacing/safe-area drift where inline values are tightly coupled to layout math.
- Risk of visual inconsistencies in native shadow/elevation equivalents.

### Android
- Risk of touch feedback contrast issues after token replacement in high-density screens.
- Risk of performance regressions if dynamic style objects rerender frequently.

### Web
- Risk of hover/focus parity loss if token migration misses state-specific styles.
- Risk of color contrast inconsistencies if hardcoded text/background pairs are only partially migrated.

## Required Verification During Refactor
1. Validate navigation flows after each domain track migration.
2. Validate interaction states: pressed, disabled, focused, hovered.
3. Validate readability/contrast for critical actions and form states.
4. Validate responsive layouts on representative mobile and desktop widths.

## Audit Completion Signals
1. Full scan artifacts regenerated from current workspace state.
2. Line-level inventory generated with token mapping and priority assignment.
3. Token gap report generated with top unmapped literal frequencies.
4. No new hardcoded literals introduced relative to baseline guard.

## Gate Conditions
- Do not merge a migration batch without cross-platform smoke checks.
- Keep rollback-ready commits for each domain track.
- Log all parity regressions in phase-5 reports.

## Current Recommendation
- Proceed with P0/P1 file conversion order from `hardcoded-style-inventory.md`.
- Prioritize shared/admin/auth surfaces first because they impact most user journeys.
