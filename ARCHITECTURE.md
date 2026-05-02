## ALICE Multi-Module Architecture (Authoritative)

Modules:
- alice-core: pure domain logic, no IO, no threads, no platform APIs
- alice-api: stable internal interfaces and contracts
- alice-engine: orchestration and pipelines
- alice-runtime: production wiring (threads, clocks, logging)
- alice-plugin-api: public plugin surface
- alice-plugins/*: plugin implementations
- alice-platform/*: platform adapters

Rules:
- alice-core depends on nothing
- No static global state may remain
- Constructor injection only
- No platform or runtime types may appear in core or engine
- Behavior must not change during refactors