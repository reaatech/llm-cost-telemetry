# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Structured logging with PII redaction (`CostLogger`, `getLogger`)
- CLI commands with working implementations:
  - `report` — Generate cost reports (JSON/table format, tenant filtering, date ranges)
  - `check` — Check budget status (JSON/text format, threshold comparison)
  - `export` — Manual export trigger for CloudWatch, Cloud Monitoring, Phoenix
  - `config` — Show current configuration
  - `version` — Show version
- Integration tests for end-to-end pipeline, multi-provider cost calculation, and exporter mock backends
- CLI integration tests for report, check, and export commands
- Test fixtures for sample spans and budget configurations
- MCP server with three-layer tools:
  - Layer 1: `cost.span.record`, `cost.span.get`, `cost.span.flush`
  - Layer 2: `cost.aggregate.by_tenant`, `cost.aggregate.by_feature`, `cost.aggregate.by_route`, `cost.aggregate.summary`
  - Layer 3: `cost.budget.check`, `cost.budget.set`, `cost.budget.alert`

### Changed

- CLI commands refactored from stubs into working implementations
- Coverage improved to >92% lines, >80% branches (320 tests)

## [0.1.0] - 2026-04-15

### Added

- Initial release with core functionality:
  - Type definitions for all domain entities
  - Zod schemas for validation
  - Cost calculation engine with built-in pricing for OpenAI, Anthropic, and Google
  - Token counting utilities with tiktoken integration
  - Provider wrappers for OpenAI, Anthropic, and Google SDKs
  - Cost aggregation engine (by tenant, feature, route)
  - Budget manager with alert thresholds
  - Exporters for CloudWatch, Cloud Monitoring, and Phoenix/Loki
  - OpenTelemetry tracing and metrics integration
  - Configuration management from environment variables
  - CLI tool scaffolding
  - Docker support with multi-stage build
  - Docker Compose for local development
- Documentation (README, CONTRIBUTING, AGENTS, ARCHITECTURE, DEV_PLAN)
- Skills directory with 10 skill documentation files

[Unreleased]: https://github.com/reaatech/llm-cost-telemetry/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/reaatech/llm-cost-telemetry/releases/tag/v0.1.0
