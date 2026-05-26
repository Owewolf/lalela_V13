# Markdown 2 - Global Token Model and Theme Contract Plan

## Objective
Define a semantic, scalable token model rooted in current Tailwind/NativeWind usage, with clear contracts for component consumption.

## Baseline Inputs
- Existing colors in `tailwind.config.js`:
  - `primary`, `primary-container`, `secondary`, `secondary-container`, `tertiary-fixed`
  - `surface`, `on-surface`, `surface-container`, `surface-container-low`
  - `outline`, `outline-variant`, `error`
- `darkMode: 'class'` is already enabled.
- `global.css` currently contains only Tailwind layer directives.

## Token Categories
1. Color tokens: semantic roles only (`primary`, `surface`, `textPrimary`, `error`, etc.)
2. Typography tokens: size, weight, line-height, letter spacing
3. Spacing tokens: 4/8-based scale and layout spacing semantics
4. Radius tokens: component-level radii (`sm|md|lg|xl|pill`)
5. Elevation tokens: shadow/elevation levels
6. Motion tokens: duration/easing presets

## Naming Rules
- Use semantic names, not component-specific names.
- Keep platform-agnostic naming.
- Prohibit names tied to visual color labels (`greenButton`, `blueCard`).

## Theme Contract
The theme contract must expose:
1. `theme.colors`
2. `theme.typography`
3. `theme.spacing`
4. `theme.radius`
5. `theme.elevation`
6. `theme.motion`

## Implementation Strategy
1. Keep existing color keys for compatibility.
2. Add missing semantic aliases in Tailwind `extend.colors`.
3. Define shared token files under `src/theme/tokens/` for runtime usage.
4. Add light theme first; dark theme parity in staged rollout.
5. Document fallback behavior for missing tokens.

## Deliverables
- `docs/theme-refactor/specs/token-dictionary.md`
- `docs/theme-refactor/specs/theme-contract.md`
- `docs/theme-refactor/specs/token-mapping-from-literals.md`

## Frontend/Backend Responsibilities
Frontend:
- Consume only semantic tokens
- Remove direct literals from refactored areas
- Keep APIs/components backward compatible

Backend (future-ready in this phase):
- Define validation rules for future dynamic theme payloads
- Keep schema/API decisions documented but not implemented in this phase

## Success Criteria
- Token dictionary approved
- Contract can represent current UI without regressions
- Mapping exists for all high-priority literals from phase 1

## Exit Gate to Phase 3
A stable token contract and migration mapping are available for runtime service integration.
