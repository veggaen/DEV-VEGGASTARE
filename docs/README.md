# docs/ — Detailed Specifications

> In-depth specification documents for specific features and systems.

These documents provide the deep technical detail behind features summarized in the root-level [prd.md](../prd.md) and [architecture.md](../architecture.md).

---

## Index

| Document | Status | Description |
|----------|--------|-------------|
| [REACH_7_PILLARS_SPECIFICATION.md](REACH_7_PILLARS_SPECIFICATION.md) | Active | Complete True Reach™ 7-pillar metric system: formulas, verification tiers, anti-gaming, poll power calculation |
| [SOCIAL_FEATURES_PLAN.md](SOCIAL_FEATURES_PLAN.md) | Active | Social features roadmap: profile editing, friends/followers, user search, company customer chat, employee messaging (4-phase plan) |
| [NORWAY_LEGAL_COMPLIANCE.md](NORWAY_LEGAL_COMPLIANCE.md) | **Active** | **Master compliance doc**: GDPR, consumer law, DSA, accessibility, DPI tax reporting, payments, Web3/MiCA, security standards, implementation roadmap |
| [VIPPS_REQUIREMENTS.md](VIPPS_REQUIREMENTS.md) | Active | Vipps payment integration checklist: sales terms, consumer law, website content requirements |
| [integration-core.md](integration-core.md) | Reference | Backend architecture rationale: why the backend is an Integration Core, Bring API surface, testing considerations |
| [POLL_SYSTEM_UPGRADE_MASTER_QUERY.md](POLL_SYSTEM_UPGRADE_MASTER_QUERY.md) | Historical | Exhaustive spec used to build the advanced poll system (database schema, API routes, UI components, first poll content) |
| [POLL_SYSTEM_AGENT_PROMPT.md](POLL_SYSTEM_AGENT_PROMPT.md) | Historical | Agent prompt used during initial poll system development |

### Status Key

- **Active** — Actively referenced, describes current or planned features
- **Reference** — Contains useful context but the feature is implemented
- **Historical** — Build instructions that have been executed; kept for audit trail

---

## How to Use

- **Building a new feature?** Check if a spec exists here first.
- **Need the big picture?** Start with [architecture.md](../architecture.md) or [MasterContext.md](../MasterContext.md).
- **Feature status?** See [prd.md](../prd.md) for the full feature matrix with status indicators.
- **Adding a new spec?** Create it here, add it to this index, and cross-reference from prd.md.
