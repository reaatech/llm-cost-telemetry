---
"@reaatech/llm-cost-telemetry-cli": minor
"@reaatech/llm-cost-telemetry": minor
---

- **@reaatech/llm-cost-telemetry-cli** (minor): Bumps the commander runtime dependency from ^12.1.0 to ^14.0.3, a two-major-version jump in a direct runtime dependency that consumers of the CLI will see resolve. This is the only user-facing change in the cli package and warrants a release; minor bump per pre-1.0 semver convention.
- **@reaatech/llm-cost-telemetry** (minor): Upgrades the zod runtime dependency from ^3.24.2 to ^4.4.3 and adapts the exported CostSpanSchema to the zod 4 API (z.record now requires explicit key/value type arguments). The schema is part of the public API and the major zod bump is meaningful to consumers.
