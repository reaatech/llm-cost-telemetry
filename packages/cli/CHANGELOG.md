# @reaatech/llm-cost-telemetry-cli

## 0.2.0

### Minor Changes

- [`244404c`](https://github.com/reaatech/llm-cost-telemetry/commit/244404cc626a74028ab3912bd318cd695e7e6269) Thanks [@reaatech](https://github.com/reaatech)! - - **@reaatech/llm-cost-telemetry-cli** (minor): Bumps the commander runtime dependency from ^12.1.0 to ^14.0.3, a two-major-version jump in a direct runtime dependency that consumers of the CLI will see resolve. This is the only user-facing change in the cli package and warrants a release; minor bump per pre-1.0 semver convention.
  - **@reaatech/llm-cost-telemetry** (minor): Upgrades the zod runtime dependency from ^3.24.2 to ^4.4.3 and adapts the exported CostSpanSchema to the zod 4 API (z.record now requires explicit key/value type arguments). The schema is part of the public API and the major zod bump is meaningful to consumers.

### Patch Changes

- [#27](https://github.com/reaatech/llm-cost-telemetry/pull/27) [`8415dda`](https://github.com/reaatech/llm-cost-telemetry/commit/8415dda900f710a06da241ad4f79f8dbbdf1d8de) Thanks [@reaatech](https://github.com/reaatech)! - Fix: CI failing on main: All Checks Passed, Security Audit

  Closes [#26](https://github.com/reaatech/llm-cost-telemetry/issues/26)

- Updated dependencies [[`244404c`](https://github.com/reaatech/llm-cost-telemetry/commit/244404cc626a74028ab3912bd318cd695e7e6269), [`8415dda`](https://github.com/reaatech/llm-cost-telemetry/commit/8415dda900f710a06da241ad4f79f8dbbdf1d8de)]:
  - @reaatech/llm-cost-telemetry@0.2.0
  - @reaatech/llm-cost-telemetry-aggregation@0.1.1
  - @reaatech/llm-cost-telemetry-exporters@0.1.1
