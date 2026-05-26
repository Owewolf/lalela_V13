# Gate 2 Risk Acceptance Register

Date: 2026-05-26
Scope: Quality Baseline closure for global theme migration
Decision Authority: Theme Migration Sign-off Group

## P0 Regression Statement
- No P0 visual/function regressions found in compile/export validation runs.
- Evidence: `docs/theme-refactor/reports/visual-regression-report.md`, `docs/theme-refactor/reports/cross-platform-test-report.md`

## Accepted Bounded Risks (P2)
| ID | Area | Severity | Owner | Date | Decision | Exit Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| G2-A11Y-001 | Manual contrast verification for admin-entered custom theme colors | P2 | QA Lead (Theme Migration) | 2026-05-26 | Accepted as bounded pre-release follow-up | Add automated contrast guard and attach manual contrast evidence for critical surfaces |
| G2-A11Y-002 | Keyboard and screen-reader traversal validation across critical flows | P2 | QA Lead (Theme Migration) | 2026-05-26 | Accepted as bounded pre-release follow-up | Attach traversal recordings/checklists for Home, Posts, Market, Chat, Settings, Admin |
| G2-PERF-001 | Theme-change rerender/latency telemetry on low-end devices | P2 | Performance Owner (Client App) | 2026-05-26 | Accepted as bounded pre-release follow-up | Add timing/frames telemetry and establish thresholds with report artifact |
| G2-STATE-001 | Manual interaction-state execution matrix completion | P2 | QA Lead (Theme Migration) | 2026-05-26 | Accepted as bounded pre-release follow-up | Convert blocked rows in `interaction-state-evidence-matrix.md` to PASS/FAIL with attached evidence |

## Gate 2 Closure Position
- Gate 2 can be marked COMPLETE with bounded P2 acceptance because no P0 blockers are open and all remaining items are tracked with owner/date and explicit closure criteria.

## States Policy (Option 2)
- `theme-noncolor-audit` `states` is an interaction-state inventory metric, not residual style debt.
- Gate completion does not require `states=0`.
- Interaction-state completion is status-based:
	- every row in `interaction-state-evidence-matrix.md` must be `PASS`, or
	- `FAIL`/`BLOCKED` with linked issue plus owner/date.
