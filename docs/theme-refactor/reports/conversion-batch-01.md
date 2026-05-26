# Conversion Batch 01 - Auth and Emergency Theme Tokenization

## Scope Completed
1. Added shared color token module.
2. Migrated auth utility screens to consume shared tokens.
3. Applied first-pass primary color tokenization in onboarding flow.

## Files Updated
- `src/theme/colors.ts`
- `app/join.tsx`
- `app/phone-reset.tsx`
- `app/emergency/index.tsx`
- `src/components/auth/OnboardingCreate.tsx`

## Changes Applied
### 1) Shared token source created
- Introduced `THEME_COLORS` with baseline palette values aligned to Tailwind config.

### 2) Direct literal replacement to semantic tokens
- Replaced hardcoded brand/neutral literals in:
  - Join route loading shell
  - Phone reset screen (buttons, inputs, icons, text, activity indicators)
  - Emergency index screen constants and core white surfaces

### 3) Onboarding conversion (batch scope)
- Replaced all `#0d3d47` and `#fff` usages with token-driven values (`text-primary`, `THEME_COLORS.primary`, `THEME_COLORS.white`).
- Converted map/slider primary accents (`strokeColor`, `pinColor`, track/thumb tint) to `THEME_COLORS.primary`.

## Validation
- Type/diagnostic check run on all modified files.
- Result: no errors in edited files.

## Remaining Hardcoded Highlights in OnboardingCreate
- `#0d3d47` and `#fff` are fully migrated in this file.
- Remaining literals are non-primary/non-white values and will be normalized in subsequent batches (status/warning/info neutrals, grays, and accent variants).

## Next Batch Recommendation (Batch 02)
1. Complete `OnboardingCreate` color migration for all remaining brand/white literals.
2. Migrate `src/components/admin/AdminDashboard.tsx` constants to `THEME_COLORS` and remove top-level brand literals.
3. Migrate `src/components/admin/ModerationCenter.tsx` top-level constants and highest-frequency inline literals.

## Risk Notes
- No functional behavior changed.
- No API or backend changes introduced.
- Conversion so far is presentation-token only.
