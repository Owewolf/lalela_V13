# Markdown 1 - Hardcoded Style Audit and Inventory Plan

## Objective
Identify all hardcoded visual values and produce a migration-ready inventory without changing behavior or redesigning UI.

## Baseline Constraints
- Use current token baseline in `tailwind.config.js` as reference.
- Respect current global baseline in `global.css` (`@tailwind base/components/utilities` only).
- Keep compatibility across Expo mobile and web surfaces.

## In Scope
- `app/**/*.{ts,tsx}`
- `src/**/*.{ts,tsx}`
- Inline style objects (`style={{...}}`), `StyleSheet.create`, literal class values, and hardcoded color/spacing/typography values.
- States: loading, empty, error, pressed, disabled, hover/focus (web).

## Out of Scope
- Visual redesign
- Backend schema/API changes
- Rewriting component architecture

## Inventory Schema
Each finding must include:
1. File path
2. Component/screen name
3. Literal value found
4. Category (`color|spacing|radius|typography|shadow|opacity|motion`)
5. Proposed semantic token replacement
6. Priority (`P0|P1|P2`)
7. Platform impact (`ios|android|web|all`)

## Execution Steps
1. Run static scans for literals and style objects.
2. Group findings by domain: auth/onboarding, tabs, communication (chat/call/emergency), admin/settings/commerce.
3. Map each literal to an existing token from `tailwind.config.js` when possible.
4. Flag token gaps requiring new definitions for phase 2.
5. Produce final inventory report.

## Suggested Commands
```bash
rg -n "#[0-9A-Fa-f]{3,8}|rgba?\(" app src
rg -n "StyleSheet\.create|style=\{\{" app src
rg -n "className=\".*(bg-|text-|border-).*\"" app src
```

## Deliverables
- `docs/theme-refactor/reports/hardcoded-style-inventory.md`
- `docs/theme-refactor/reports/platform-compatibility-review.md`
- `docs/theme-refactor/reports/token-gap-list.md`

## Success Criteria
- All hardcoded visual values cataloged in inventory
- Every finding mapped to existing token or gap
- No functional behavior changed
- Cross-platform impact documented per finding

## Exit Gate to Phase 2
Phase 2 starts only after inventory coverage is complete and token gaps are approved.
