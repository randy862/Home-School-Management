# Active Decisions

| Date | Decision | Impact |
|------|----------|--------|
| 2026-03-25 | Production single-tenant before multi-tenant | Lower architectural risk |
| 2026-03-25 | PostgreSQL database-per-tenant | Strong tenant isolation |
| 2026-03-28 | Backend owns auth/session | Removes browser-owned security risk |
| 2026-03-28 | Control plane uses queued jobs | Reliable provisioning lifecycle |
| 2026-04-10 | Hosted smoke test required after backend changes | Prevent deployment regressions |
| 2026-05-03 | Root governance files should stay lean; history belongs in archive/journal files | Reduces Codex token usage |

Historical decisions are archived at:

archive/governance/2026-05-03-context-optimization/DECISIONS.md
