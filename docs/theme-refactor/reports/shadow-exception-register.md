# Shadow Exception Register

Date: 2026-05-26
Owner: Theme Migration Team
Status: APPROVED

## Purpose
Document residual `audit:theme-noncolor` shadow findings that are implementation artifacts rather than hardcoded UI debt.

## Approved Exceptions
| File | Line Pattern | Reason | Decision |
| --- | --- | --- | --- |
| `src/theme/shadows.ts` | `shadowColor: string` | Type declaration for centralized helper API; not a view-level hardcoded style usage. | Approved |
| `src/theme/shadows.ts` | `shadowOpacity: number` | Type declaration for centralized helper API; not a view-level hardcoded style usage. | Approved |
| `src/theme/shadows.ts` | `shadowRadius: number` | Type declaration for centralized helper API; not a view-level hardcoded style usage. | Approved |
| `src/theme/shadows.ts` | `shadowOffset: { ... }` | Helper output shape declaration for reusable shadow factory; not literal per-surface shadow debt. | Approved |

## Approval Notes
1. Runtime shadow literals were normalized to shared helper calls.
2. Remaining findings are scanner false positives by pattern match on helper/type declarations.
3. This register satisfies strict-path requirement for documented shadow exceptions with owner/date.