# Conversion Batch 02 - Admin Tokenization, Status Neutrals, and Regression Guard

## Scope Completed
1. Continued tokenization in `AdminDashboard` and `ModerationCenter` using the same shared token pattern.
2. Expanded `THEME_COLORS` with warning/info/success neutral variants.
3. Migrated status/neutral literals in onboarding, emergency, and admin flows to shared tokens.
4. Added lightweight lint guard to block newly introduced hardcoded color literals.

## Files Updated
- `src/theme/colors.ts`
- `src/components/admin/AdminDashboard.tsx`
- `src/components/admin/ModerationCenter.tsx`
- `app/emergency/index.tsx`
- `src/components/auth/OnboardingCreate.tsx`
- `scripts/check-hardcoded-colors.js`
- `package.json`

## Token Expansion Added
- Status role tokens:
  - `info`, `successSurface`, `successBorder`, `successText`
  - `warningSurface`, `warningBorder`, `warningStrong`, `warningText`
  - `errorSurface`, `errorBorder`, `errorText`
  - `infoSurface`, `infoBorder`, `infoText`
- Neutral helper tokens:
  - `neutralBg`, `neutralBgSoft`, `neutralBorder`
  - `neutralTextMuted`, `neutralTextSubtle`, `neutralTextStrong`

## Admin Flow Conversions
- Replaced local hardcoded top-level constants with `THEME_COLORS` in:
  - `AdminDashboard.tsx`
  - `ModerationCenter.tsx`
- Converted high-frequency status/neutral literals (warning/error/success + slate neutrals) to shared tokens across both files.

## Additional Flow Conversions
- Updated remaining status/neutral literals in:
  - `OnboardingCreate.tsx`
  - `app/emergency/index.tsx`

## Lint Guard
- New script: `scripts/check-hardcoded-colors.js`
- New npm script: `npm run lint:theme-guard`
- Behavior:
  - Scans `app/` and `src/` for quoted hex/rgb(a) literals
  - Ignores `src/theme/colors.ts` by design
  - Compares current findings to baseline file `docs/theme-refactor/reports/hardcoded-style-literals.raw.txt`
  - Fails only on newly introduced literals not present in baseline

## Validation
- Diagnostic checks: no errors in edited files.
- Guard check: `npm run -s lint:theme-guard` passed.

## Batch Metrics (Post-Change Literal Scan)
- Combined literals remaining in targeted files (`AdminDashboard`, `ModerationCenter`, `OnboardingCreate`, `emergency/index`): `186`
- `AdminDashboard.tsx` remaining: `41`
- `ModerationCenter.tsx` remaining: `92`

## Next Recommended Batch
1. Convert remaining white/alpha literals and status chip colors in `ModerationCenter.tsx`.
2. Convert remaining campaign/overlay rgba literals in `AdminDashboard.tsx` into semantic alpha tokens/helpers.
3. Optionally wire `lint` to run `lint:theme-guard` in CI once remaining debt is reduced further.
