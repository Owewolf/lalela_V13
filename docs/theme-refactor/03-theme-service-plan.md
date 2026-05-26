# Markdown 3 - Global Theme Service and Runtime Consumption Plan

## Objective
Create a single source of truth for theme state and token access across iOS, Android, and web.

## Target Architecture
- Provider location: Expo Router root layout (`app/_layout.tsx`)
- Access pattern: `useTheme()` hook + typed theme object
- Fallback chain: `communityTheme -> appDefaultTheme -> hardcoded-safe fallback`
- Hydration strategy: load theme before first paint where possible

## Service Responsibilities
1. Load active theme for current context/community
2. Expose loading/error states
3. Cache and reuse theme where safe
4. Apply runtime updates without full app reload
5. Prevent excessive rerenders

## State Management Options
- Option A (default): React Context + memoized selectors
- Option B: Zustand store
- Option C: Redux slice

Default assumption for this repo: Option A unless performance profiling requires store migration.

## Error Handling
- Missing payload fields -> fill from default theme
- API/network errors -> fallback to cached or default theme
- Invalid token payload -> reject and log structured error

## Migration Plan
1. Build service and typed interfaces in `src/theme/`.
2. Wire provider into root layout.
3. Migrate shared primitives first (Button/Card/Text wrappers if present).
4. Migrate feature domains incrementally using phase 4 tracks.

## Deliverables
- `docs/theme-refactor/specs/theme-service-architecture.md`
- `docs/theme-refactor/specs/runtime-fallback-rules.md`
- `docs/theme-refactor/specs/theme-loading-lifecycle.md`

## Platform Notes
iOS:
- Maintain safe-area and navigation smoothness

Android:
- Guard against rerender-induced jank on lower-end devices

Web:
- Ensure hydration consistency and no flash of wrong theme

## Success Criteria
- One runtime theme source used by all migrated screens
- Deterministic fallback behavior
- No blocking regressions in initial migrated areas

## Exit Gate to Phase 4
Theme service is integrated at app root and ready for domain-by-domain refactor.
