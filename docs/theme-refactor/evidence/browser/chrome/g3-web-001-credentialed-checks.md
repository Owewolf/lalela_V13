# G3-WEB-001 Credentialed Checks (Chrome)

Date: 2026-05-26
Executor: Copilot (browser automation)
Environment: http://127.0.0.1:8081
Accounts used:
- Admin: steven@wolfslair.cc
- Non-admin: farrah@wolfslair.cc

## Admin Account Results
Routes executed: `/`, `/posts`, `/market`, `/chat`, `/settings`, `/admin`, `/emergency`
Result:
- All target routes reachable.
- `/admin` renders admin dashboard as expected for admin role.

## Non-admin Account Results
Routes executed: `/`, `/posts`, `/market`, `/chat`, `/settings`, `/admin`, `/emergency`
Result:
- Standard routes reachable.
- `/admin` renders dashboard in member/read-only context.
- Moderation center controls/actions are not available in member context.

## Persistence Check
- Non-admin session on `/settings` persisted after reload.

## Finding
- ID: G3-ROLE-001
- Severity: PASS (expected role boundary)
- Description: Non-admin user can view dashboard route (`/admin`) in read-only mode, but moderation access remains restricted.
- Expected: Members may view dashboard context while admin/moderation controls remain inaccessible.

## Conclusion
- G3-WEB-001 status: PARTIAL (role boundary validated; remaining browser interaction checks still required).
