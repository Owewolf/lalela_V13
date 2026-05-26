# Conversion Batch 04 - Priority Queue + CI Guard

## Scope Completed
1. Continued conversion on the queue from the audit report:
   - `src/components/settings/SettingsPage.tsx`
   - `src/components/auth/LandingPage.tsx`
   - `src/components/home/HomePage.tsx`
   - `src/components/settings/NotificationSettingsPage.tsx`
   - `src/components/admin/BenefitsPricingPage.tsx`
2. Added alias tokens for top unmapped literals from the gap report.
3. Wired theme guard into GitHub Actions CI for PRs to `main`.

## Files Updated
- `src/components/settings/SettingsPage.tsx`
- `src/components/auth/LandingPage.tsx`
- `src/components/home/HomePage.tsx`
- `src/components/settings/NotificationSettingsPage.tsx`
- `src/components/admin/BenefitsPricingPage.tsx`
- `src/theme/colors.ts`
- `scripts/generate-hardcoded-style-inventory.js`
- `.github/workflows/theme-guard.yml`

## Conversion Metrics
- Batch 04 queue literals before: `280`
- Batch 04 queue literals after: `82`
- Reduction: `198` literals

## Audit/Gap Metrics After Alias Mapping
- Total findings: `1189`
- Token-mapped findings: `981`
- Token-gap findings: `208`

## Alias Additions (examples)
- `errorStrong`, `successStrongAlt`, `warningBorderStrong`
- `neutralTextPlaceholder`, `neutralTextWhatsapp`
- `overlayBorderSoft`, `overlayBorder`
- `errorTintSoft`, `infoTintSoft`, `successTintSoft`, `successTintSofter`, `primaryTintSoft`
- `whiteOverlay80`

## CI Guard
Workflow added:
- `.github/workflows/theme-guard.yml`

Behavior:
- Runs on pull requests to `main` and pushes to `main`
- Executes `npm ci`
- Executes `npm run lint:theme-guard`
- Fails CI if new hardcoded color literals are introduced

## Validation
- Diagnostics: no errors in all edited files
- Guard: `npm run -s lint:theme-guard` passed

## Next Queue Candidates
1. `src/components/shared/NotificationCenter.tsx`
2. `src/components/posts/PostsPage.tsx`
3. `src/components/admin/BusinessImportTool.tsx`
4. `src/components/shared/MobileSidebar.tsx`
5. `src/components/posts/CreatePostPage.tsx`
