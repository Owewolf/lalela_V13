# Gate 3 Risk Acceptance Register

Date: 2026-05-26
Scope: Platform confidence closure for final sign-off
Decision Authority: Theme Migration Sign-off Group

## Verified Outcomes
- G3-WEB-001 (Chrome): Credentialed checks completed for admin and member roles.
- Member access to `/admin` is expected in read-only dashboard mode.
- Moderation center remains restricted for member role.
- G3-DEV-002 (Android): Emulator validation completed for splash + landing/auth surfaces.

## Accepted Bounded Risks (P2)
| ID | Area | Severity | Owner | Date | Decision | Exit Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| G3-WEB-002 | Firefox browser execution | P2 | QA Lead (Theme Migration) | 2026-05-26 | Accepted (environment/tooling constrained in this run) | Execute credentialed Firefox matrix run and attach artifacts under `docs/theme-refactor/evidence/browser/firefox/` |
| G3-WEB-003 | Edge browser execution | P2 | QA Lead (Theme Migration) | 2026-05-26 | Accepted (environment/tooling constrained in this run) | Execute credentialed Edge matrix run and attach artifacts under `docs/theme-refactor/evidence/browser/edge/` |
| G3-WEB-004 | Safari macOS execution | P2 | QA Lead (Theme Migration) | 2026-05-26 | Accepted (Linux host cannot execute Safari) | Execute Safari matrix run on macOS and attach artifacts under `docs/theme-refactor/evidence/browser/safari/` |
| G3-DEV-001 | iOS simulator/device execution | P2 | QA Lead (Theme Migration) | 2026-05-26 | Accepted (Linux host cannot run iOS simulator/device workflow) | Execute iOS matrix run on macOS/device and attach artifacts under `docs/theme-refactor/evidence/device/ios/` |
| G3-DEV-002 | Android protected-flow/theme persistence checks | P2 | QA Lead (Theme Migration) | 2026-05-26 | Accepted (remaining protected-flow depth pending dedicated scripted mobile session) | Complete authenticated Android protected-flow checks and append evidence file |

## Gate 3 Closure Position
- Gate 3 is marked COMPLETE with bounded P2 acceptance because:
  1. all executable checks in this environment were run and evidenced,
  2. role-boundary policy is validated,
  3. remaining gaps are explicitly tracked with owner/date and closure criteria.