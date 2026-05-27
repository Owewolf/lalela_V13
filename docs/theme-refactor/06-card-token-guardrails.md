# Card Token Guardrails

## Objective
Prevent regressions where card surfaces, borders, and depth drift away from centralized theme state.

## Required Card Styling Path
1. Use `src/theme/cardStyles.ts` helpers for card color/border/shadow tokens.
2. Prefer `src/components/shared/CardSurface.tsx` for new card-like wrappers.
3. Do not create local `CARD_DEPTH_*` constants in feature components.

## Guard Commands
1. `npm run lint:theme-guard`
2. `npm run lint:card-guard`
3. `npm run audit:theme-noncolor`

## Card Guard Rule Summary
- Fails when local `CARD_DEPTH*` constants are declared in `src/components/**`.
- Fails when direct card-style `backgroundColor: THEME_COLORS.surface*` + neutral card border pair is used instead of centralized helpers.

## Exception Policy
Allowed exceptions must be semantically distinct surfaces and documented in PR notes:
- error/warning/success banners
- destructive confirmation surfaces
- brand/promotional hero blocks

## Migration Baseline
During migration, existing violations should be reduced continuously. New violations are blocked.
