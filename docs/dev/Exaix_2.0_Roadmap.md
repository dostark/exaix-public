# Exaix 2.0 Implementation Roadmap

**Version:** 1.0.0
**Date:** January 16, 2026
**Status:** Draft
**Alignment:** White Paper v2.0.0

---

## Executive Summary

This roadmap outlines the phased implementation of Exaix 2.0, transitioning from the current single-edition codebase to a **three-tier open-core architecture** (Solo/Team/Enterprise) as specified in the White Paper v2.0.0.

---

## Repository Strategy

### Selected Approach: Git Submodules (Option B)

Exaix 2.0 uses a **multi-repository submodule architecture** to enforce true source code separation between open-source and proprietary components.

````text
exaix/                          (composition repo - private)
  ├── core/                        (submodule → github.com/exaix/exaix-core, public, MIT)
  ├── team/                        (submodule → github.com/exaix/exaix-team, private)
  └── enterprise/                  (submodule → github.com/exaix/exaix-enterprise, private)
```text

| Repository            | Visibility  | License                | Contents                                            |
| --------------------- | ----------- | ---------------------- | --------------------------------------------------- |
| `exaix-core`       | **Public**  | MIT/Apache 2.0         | CLI, TUI, Daemon, SQLite, MCP Client, Solo features |
| `exaix-team`       | **Private** | Source-Available (BSL) | Web UI, PostgreSQL, MCP Server, multi-user          |
| `exaix-enterprise` | **Private** | Proprietary            | Governance Dashboard, Compliance, immudb, SSO       |

### Why Not Git Branches?

> [!CAUTION]
> **Git branches cannot protect proprietary source code on GitHub.**

| Problem                               | Explanation                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **No per-branch access control**      | All branches in a repository share the same visibility (public or private)                                |
| **Public repo = all branches public** | If `exaix` repo is public for Solo edition, `team` and `enterprise` branches are also publicly visible |
| **Private repo = no open source**     | If repo is private to hide Team/Enterprise, Solo cannot be truly open-source                              |
| **Git history exposure**              | Even deleted branches leave commits in history accessible via SHA                                         |
| **Fork vulnerability**                | Anyone who forks a public repo gets all branches, including proprietary code                              |

**Conclusion:** Branches are suitable only for **local development** or **feature work within a single edition**. For true open-core licensing with source protection, **separate repositories are mandatory**.

### Alternative Considered: Package Dependencies

| Aspect         | Assessment                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------- |
| **Approach**   | Publish `@exaix/core`, `@exaix/team`, `@exaix/enterprise` as packages                |
| **Verdict**    | Deferred to post-1.0; adds registry complexity without significant benefit during development |
| **Future Use** | May adopt for external distribution once editions are stable                                  |

---

## Implementation Phases

### Phase 1: Foundation & Repository Setup

**Timeline:** Q1 2026 (Weeks 1-6)
**Focus:** Establish multi-repository submodule architecture and prepare codebase for edition separation

**Objectives:**

- Create `exaix-core` (public), `exaix-team` (private), `exaix-enterprise` (private) repositories
- Set up composition repository with git submodules
- Implement feature flags for edition-gated functionality
- Create build system supporting edition-specific outputs
- Refactor shared components into `core/` boundaries

**Success Criteria:**

- [ ] Three GitHub repositories created with correct visibility settings
- [ ] Submodule structure operational (`git submodule update --init`)
- [ ] `deno task build:solo`, `build:team`, `build:enterprise` produce distinct artifacts
- [ ] Feature flag system operational with `EXAIX_EDITION` environment variable
- [ ] CI pipeline builds all three editions with proper access tokens
- [ ] Developer onboarding docs for submodule workflow

---

### Phase 2: Team Edition Core Features

**Timeline:** Q1-Q2 2026 (Weeks 7-14)
**Focus:** Implement Team-exclusive features

**Objectives:**

- Implement PostgreSQL backend for Activity Journal (append-only)
- Build Web UI foundation for plan review and approval
- Enable MCP Server mode
- Add multi-user collaboration primitives

**Success Criteria:**

- [ ] PostgreSQL Activity Journal passes data integrity tests
- [ ] Web UI renders plan list and supports approve/reject actions
- [ ] MCP Server responds to `tools/list` and `tools/call` from Claude Desktop
- [ ] Two users can approve plans on shared workspace

---

### Phase 3: Enterprise Edition & Compliance

**Timeline:** Q2-Q3 2026 (Weeks 15-26)
**Focus:** Governance, compliance, and enterprise infrastructure

**Objectives:**

- Integrate immudb for WORM-compliant audit storage
- Implement Governance Dashboard (risk scoring, policy enforcement)
- Add Enterprise LLM providers (Azure OpenAI, AWS Bedrock, GCP Vertex)
- Build compliance export framework (EU AI Act, HIPAA, SOX, ISO 27001)
- Implement SSO/SAML authentication

**Success Criteria:**

- [ ] immudb integration passes tamper-detection validation
- [ ] Governance Dashboard displays agent actions with risk scores
- [ ] `exactl compliance export --framework hipaa` generates valid PDF
- [ ] SSO login functional with Okta/Azure AD test tenant
- [ ] At least 1 pilot customer validates compliance workflow

---

### Phase 4: Licensing & Public Release Prep

**Timeline:** Q3 2026 (Weeks 27-32)
**Focus:** License enforcement and release preparation

**Objectives:**

- Implement license key verification for Team/Enterprise features
- Prepare `exaix-core` for public open-source release
- Finalize licensing headers and NOTICE files
- Set up public issue tracker and contribution guidelines
- Security audit and penetration testing

**Success Criteria:**

- [ ] License key validation blocks unauthorized feature access at runtime
- [ ] `exaix-core` passes security audit (no proprietary code leakage)
- [ ] All files have correct license headers (MIT for core, proprietary for Team/Enterprise)
- [ ] CONTRIBUTING.md and CLA process documented
- [ ] Penetration test report with no critical findings

---

### Phase 5: Launch & Ecosystem

**Timeline:** Q4 2026 (Weeks 33-40)
**Focus:** Public launch and ecosystem enablement

**Objectives:**

- Public release of Solo edition (open source)
- Launch Team edition (usage-based pricing)
- Enterprise edition GA with first paying customers
- Blueprint marketplace foundation
- Community contribution guidelines and processes

**Success Criteria:**

- [ ] Solo edition available via `curl -fsSL https://exaix.io/install.sh | sh`
- [ ] Team edition sign-up → running in < 15 minutes
- [ ] 3+ Enterprise pilot customers converted to paid
- [ ] 10+ community-contributed blueprints in marketplace
- [ ] SOC 2 Type I audit initiated

---

## CI/CD Build Composition

The build system must support edition-specific composition:

```yaml
# Simplified CI workflow structure
jobs:
  build-solo:
    # Builds from main branch / core submodule only
    steps:
      - checkout: exaix-core
      - run: deno task build --edition=solo
      - artifact: exaix-solo-$VERSION

  build-team:
    # Composes core + team components
    steps:
      - checkout: exaix-core
      - checkout: exaix-team (private, requires token)
      - run: deno task build --edition=team
      - artifact: exaix-team-$VERSION

  build-enterprise:
    # Composes core + team + enterprise components
    steps:
      - checkout: exaix-core
      - checkout: exaix-team
      - checkout: exaix-enterprise (private, requires token)
      - run: deno task build --edition=enterprise
      - artifact: exaix-enterprise-$VERSION
```text

---

## Phase-Specific Planning Documents

Each phase will have a dedicated planning document created before phase start:

| Phase   | Document                     | Created        |
| ------- | ---------------------------- | -------------- |
| Phase 1 | `phase-1-foundation.md`      | Before Week 1  |
| Phase 2 | `phase-2-team-features.md`   | Before Week 7  |
| Phase 3 | `phase-3-enterprise.md`      | Before Week 15 |
| Phase 4 | `phase-4-repo-separation.md` | Before Week 27 |
| Phase 5 | `phase-5-launch.md`          | Before Week 33 |

---

## Risk Considerations

| Risk                         | Mitigation                                                  |
| ---------------------------- | ----------------------------------------------------------- |
| Submodule complexity         | Developer onboarding docs, helper scripts, pre-commit hooks |
| Cross-repo sync issues       | Automated dependency updates, version pinning               |
| License enforcement gaps     | Runtime validation + build-time checks + legal review       |
| Compliance timeline slippage | Early SOC 2 engagement, parallel work streams               |
| Public repo code leakage     | Pre-release audits, automated secret scanning               |

---

## Decision Log

| Decision            | Choice             | Rationale                                                                                   | Date       |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------- | ---------- |
| Repository Strategy | **Git Submodules** | Git branches cannot protect source code on GitHub; all branches share repository visibility | 2026-01-16 |

---

_This roadmap is a living document. Phase-specific planning documents will be created before each phase begins._
````
