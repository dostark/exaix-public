# Exaix: The Governance-First AI Agent Operating System

## White Paper - Three-Tier Edition**

- **Date:** January 16, 2026
- **Version:** 2.0.0
- **Status:** Production Specification
- **Target Audience:** Developers, DevSecOps Teams, Compliance Officers, System Architects

---

## Terminology Reference

- **Activity Journal:** Audit database logging all agent events with full traceability (SQLite/PostgreSQL/Immutable Ledger by edition)
- **Portal:** Symlinked directory providing agents access to external projects
- **Request:** Markdown file in `/Workspace/Requests` containing user intent
- **Plan:** Agent-generated proposal in `/Workspace/Plans` requiring human approval
- **Active Task:** Approved plan in `Workspace/Active` being executed
- **Report:** Agent-generated summary in `Memory/Reports` after completion
- **Trace ID:** UUID linking request → plan → execution → commit → report
- **Blueprint:** TOML definition of an agent (model, capabilities, system prompt)
- **MCP:** Model Context Protocol - standard for AI agent tool integration
- **AI-BOM:** AI Bill of Materials - audit trail of all AI agent actions
- **WORM Storage:** Write-Once-Read-Many storage for regulatory compliance (Enterprise)

---

## Executive Summary

### The AI Governance Crisis of 2026

According to Gartner, **over 40% of agentic AI projects will be canceled by the end of 2027** due to inadequate governance frameworks. As enterprises deploy autonomous AI agents across critical workflows, regulatory bodies are demanding answers to fundamental questions:

- **What did the AI agent do?**
- **Why did it make that decision?**
- **Who approved the action?**
- **Can we prove compliance?**

Traditional AI coding assistants (GitHub Copilot, Cursor, Windsurf) excel at real-time developer productivity but provide **no audit trail, no approval gates, and no compliance framework**. They were built for individual productivity, not enterprise governance.

### Exaix: Built for the Governance Era

**Exaix is the governance-first AI agent operating system** — purpose-built for teams and organizations that need autonomous AI with accountability, traceability, and control.

## Core Value Proposition

1. **Comprehensive Audit Trail** - Every agent action logged with trace IDs linking requests → plans → code changes → commits. The Activity Journal serves as your organization's "AI Bill of Materials."

1.

1.

1.

1.

1.

### Three-Tier Edition Model

Exaix is available in three editions to serve different organizational needs:

| Edition        | Target Audience                                 | License                      | Key Differentiation                                                 |
| -------------- | ----------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| **Solo**       | Individual developers, open source contributors | MIT/Apache 2.0 (Free)        | CLI + TUI, basic MCP client, local-first                            |
| **Team**       | Small teams, startups, consulting firms         | Source-Available (Paid)      | Web UI for approvals, MCP server mode, multi-user                   |
| **Enterprise** | Regulated industries, large enterprises         | Proprietary (Custom Pricing) | Full governance dashboard, compliance frameworks, advanced features |

## Quick Comparison

```text
Solo Edition:        CLI + TUI + Audit Trail + Local AI
Team Edition:        Solo + Web UI + MCP Server + Collaboration
Enterprise Edition:  Team + Governance + Compliance + Advanced Analytics
```

### When to Use Exaix

| Scenario                                   | Recommended Tool                |
| ------------------------------------------ | ------------------------------- |
| Quick code fix while coding                | Use IDE agent (Cursor, Copilot) |
| Interactive feature development            | Use IDE agent                   |
| **Overnight batch processing**             | **Exaix**                       |
| **Compliance/audit requirements**          | **Exaix**                       |
| **Multi-project refactoring**              | **Exaix**                       |
| **Regulated industry development**         | **Exaix (Enterprise)**          |
| **Team collaboration with approval gates** | **Exaix (Team/Enterprise)**     |

---

## 1. The Governance Crisis in AI Agent Orchestration

### The 40% Failure Rate

Gartner's 2026 prediction is stark: **over 40% of agentic AI projects will be canceled** due to inadequate governance. This isn't a technology problem—it's a **trust problem**.

## Why Projects Fail

- **No audit trail:** "What did the AI change and why?"
- **No approval process:** "Who authorized this risky operation?"
- **No compliance mapping:** "How do we prove HIPAA compliance?"
- **No cost controls:** "Why did our OpenAI bill spike to $50,000?"
- **No accountability:** "Which agent made this breaking change?"

### Regulatory Pressure Intensifying

**2026 marks the enforcement year** for multiple AI governance frameworks:

- **EU AI Act:** Requires transparency, accountability, and human oversight for high-risk AI systems
- **NIST AI Risk Management Framework:** Establishes standards for trustworthy AI
- **ISO/IEC 42001:2023:** International standard for AI management systems
- **HIPAA (Healthcare):** Demands audit trails for any AI accessing protected health information
- **SOX (Finance):** Requires controls for AI systems affecting financial reporting

### The Enterprise Dilemma

Enterprises face a impossible choice:

- **Option A:** Use IDE coding agents → High productivity, zero governance
- **Option B:** Build custom governance layer → Expensive, slow, reinventing the wheel
- **Option C:** Don't use AI agents → Fall behind competitors

**Exaix is Option D:** Governance built-in from day one.

---

## 2. Exaix: The Governance-First AI Agent OS

### Core Philosophy: Trust Through Transparency

Exaix rejects the false dichotomy between automation and control. Our philosophy:

> **"Every AI agent action must be traceable, explainable, and reversible."**

This is achieved through four architectural pillars:

#### 1. The Activity Journal: Your AI Bill of Materials

Every agent action is logged to a tiered database architecture:

| Edition        | Database                           | Compliance Level                           |
| -------------- | ---------------------------------- | ------------------------------------------ |
| **Solo**       | SQLite (embedded)                  | Basic audit logging                        |
| **Team**       | PostgreSQL (append-only tables)    | Multi-user with immutability               |
| **Enterprise** | PostgreSQL + immudb or TimescaleDB | WORM-compliant, cryptographically verified |

## Audit Record Contents

- **Timestamp** (ISO 8601, immutable, cryptographically signed for Enterprise)
- **Trace ID** (UUID linking related actions)
- **Actor** (agent name or "human", authenticated via SSO for Enterprise)
- **Action Type** (request.created, plan.approved, file.modified, etc.)
- **Target** (affected file, portal, plan)
- **Payload** (full context: what changed, why, inputs/outputs)
- **Cryptographic Hash** (Enterprise: tamper-evident chain verification)

## Enterprise Compliance Features

- **WORM Storage:** Records cannot be modified or deleted (SOX requirement)
- **7-Year Retention:** Configurable retention policies for regulatory compliance
- **Cryptographic Verification:** Immutable ledger with hash chains (audit-proof)
- **Access Control:** RBAC on audit data (auditors vs. developers)

**Result:** Complete audit trail suitable for regulatory compliance, forensic analysis, and debugging.

### 2. Explicit Approval Gates: Human-in-the-Loop Governance

Agents operate under a **three-phase approval workflow:**

1. **Request Phase:** Human creates request (or request auto-generated from external trigger)

1.

## No agent ever modifies code without explicit human authorization

### 3. MCP-Native: Interoperability as a First-Class Citizen

Built on the **Model Context Protocol (MCP)**, the emerging standard for AI agent tool integration:

- **MCP Client (Solo+):** Connect to external MCP servers (Google Drive, GitHub, databases)
- **MCP Server (Team+):** Expose Exaix to external AI assistants (Claude Desktop, Cline, Cursor)
- **MCP Tools:** Standardized interfaces for `create*request`, `approve*plan`, `query_journal`

**Result:** Exaix integrates seamlessly with the emerging AI agent ecosystem.

#### 4. Deno Security Model: Defense in Depth

Leveraging **Deno's OS-level permission system**:

```bash
deno run \
  --allow-read="/Exaix,/portals" \
  --allow-write="/Exaix,/portals" \
  --allow-net="api.anthropic.com" \
  src/main.ts
```

## Security guarantees

- Agents **cannot** access `/etc/passwd` or your SSH keys
- Agents **cannot** make network requests to unapproved domains
- Agents **cannot** write outside designated portals
- Path traversal attacks are blocked at runtime

---

## 3. Market Positioning & Differentiation

### The AI Agent Landscape (2026)

Exaix competes in three distinct segments:

#### Segment 1: IDE-Integrated Coding Agents

**Players:** GitHub Copilot, Cursor, Windsurf
**Strength:** Real-time coding assistance, zero friction
**Weakness:** No audit trail, no approval gates, single-workspace only

| Capability                      | IDE Agents            | Exaix                         |
| ------------------------------- | --------------------- | ----------------------------- |
| Real-time code completion       | ✅ Excellent          | ❌ Not a focus                |
| Interactive chat                | ✅ Native             | ❌ File-based                 |
| **Audit trail**                 | ❌ None               | ✅ Full trace_id linking      |
| **Async background processing** | ❌ Requires attention | ✅ Daemon-based               |
| **Multi-project context**       | ⚠️ Limited            | ✅ Portal system              |
| **Human approval gates**        | ⚠️ Implicit           | ✅ Explicit workflow          |
| **Compliance-ready**            | ❌ No logging         | ✅ Activity Journal + reports |

**Positioning:** Exaix **complements** IDE agents—use both tools for different scenarios.

#### Segment 2: Developer Orchestration Tools

**Players:** LangChain, LlamaIndex, AutoGen
**Strength:** Flexible agent orchestration, extensive documentation
**Weakness:** No built-in governance, developers must implement audit trails

## Exaix Differentiators

- **Governance built-in** vs. "bring your own governance"
- **Opinionated workflow** (request → plan → approve → execute) vs. flexible but complex
- **File-based simplicity** vs. code-heavy orchestration
- **Audit-native** vs. logging as afterthought

**Positioning:** Exaix is **more opinionated, compliance-focused, and simpler** for teams needing governance out-of-the-box.

### Segment 3: Enterprise AI Platforms

**Players:** SuperAGI, FluxForce, enterprise vendor solutions
**Strength:** Full enterprise features, white-glove support
**Weakness:** Complex, expensive, long deployment cycles

## Exaix Differentiators

- **Developer-first** vs. enterprise-heavy
- **Faster deployment** (days vs. months)
- **Open core model** (Solo edition free) vs. closed/expensive
- **MCP-native** (standards-based) vs. proprietary

**Positioning:** Exaix is **simpler and faster than enterprise platforms** while providing governance features they lack.

### The Exaix Positioning Map

```text
Enterprise Features
        ↑
        │     SuperAGI
        │     FluxForce
        │
        │    ┌─────────────┐
        │    │  Exaix   │ ← SWEET SPOT
        │    │ (Enterprise)│
        │    └─────────────┘
        │
        │  LangChain
        │  LlamaIndex
        │
        │              Cursor
Low     │              Copilot
        │              Windsurf
        └──────────────────────────→
     Low          Governance/Compliance          High
```

**Key Insight:** Exaix occupies the "governance-conscious SMB" quadrant—teams that need more than IDE agents but less complexity than enterprise platforms.

### Competitive Defensibility

VCs and enterprise customers ask: **"What prevents competitors from copying your features?"**

Exaix's competitive moats are **structural, not feature-based**:

#### 1. Cumulative Intelligence Advantage

As organizations use Exaix, they accumulate **institutional intelligence** that becomes increasingly valuable:

- **Memory Banks:** Context accumulates over time—past decisions, code patterns, organizational knowledge
- **Blueprint Library:** Curated agent configurations improve with usage
- **Context Cards:** Auto-generated portal understanding becomes organizational memory

**Switching Cost:** Migrating away means losing months/years of accumulated context.

#### 2. Compliance Continuity Lock-In

Once an organization establishes Exaix as their **audit trail of record**, switching creates regulatory risk:

- **Historical Audit Data:** 7 years of SOX logs can't be easily migrated
- **Regulatory Continuity:** Auditors expect consistent systems across audit periods
- **Attestation Risk:** Switching mid-audit-cycle creates compliance gaps

**Switching Cost:** Organizations don't change audit infrastructure casually.

#### 3. Workflow Integration Depth

Exaix integrates deeply into development workflows:

- **Git Hooks:** Trace IDs embedded in every commit
- **File System Watchers:** Request/plan workflows become muscle memory
- **Approval Processes:** Teams build rituals around plan review
- **Skills & Flows:** Custom automation compounds over time

**Switching Cost:** Changing ingrained team workflows is expensive and disruptive.

#### 4. Community Blueprint Network Effects

As the user base grows, Exaix's value increases:

- **Shared Blueprints:** Community-contributed agent configurations
- **Verified Templates:** Security-audited blueprints for common tasks
- **Enterprise Marketplace:** Premium blueprints for specific industries
- **Integration Ecosystem:** MCP servers, skills, and tools

**Network Effect:** More users → better blueprints → more users.

### Industry Vertical Specialization

While Exaix is a horizontal platform, **vertical-specific configurations** add differentiated value:

#### Healthcare & Life Sciences (Enterprise)

| Feature                  | Implementation                                   |
| ------------------------ | ------------------------------------------------ |
| HIPAA Compliance Profile | Pre-configured audit policies, PHI detection     |
| PHI Detection in Code    | AI-powered scan for protected health information |
| FDA 21 CFR Part 11       | Electronic signature validation support          |
| Healthcare Blueprints    | HL7/FHIR integration, EHR patterns               |

**Use Case:** Pharmaceutical R&D teams requiring FDA-compliant software development.

#### Financial Services (Enterprise)

| Feature                 | Implementation                                  |
| ----------------------- | ----------------------------------------------- |
| SOX Compliance Profile  | 7-year retention, segregation of duties         |
| PCI-DSS Code Checks     | Payment card data handling verification         |
| Dual Approval Workflows | Tech lead + compliance officer sign-off         |
| Trading System Controls | Enhanced change management for critical systems |

**Use Case:** Banks and fintech companies modernizing regulatory-reporting systems.

#### Government & Defense

| Feature                   | Implementation                                 |
| ------------------------- | ---------------------------------------------- |
| FedRAMP Deployment Guide  | Cloud security controls documentation          |
| Air-Gapped Installation   | Fully offline operation support                |
| Clearance-Aware Workflows | Approval routing by security clearance         |
| NIST 800-171 Mapping      | Controlled Unclassified Information protection |

**Use Case:** Defense contractors requiring secure, auditable AI agent operations.

### Inference Economics & LLM Cost Management

**The Hidden Cost of AI Agents:** LLM inference can silently drain budgets. Exaix provides comprehensive cost controls.

#### Token Optimization Strategies

| Strategy                  | Description                                       | Savings |
| ------------------------- | ------------------------------------------------- | ------- |
| **Request Deduplication** | Similar requests share cached plan analysis       | 30-50%  |
| **Incremental Context**   | Only send changed files, not full codebase        | 40-60%  |
| **Model Tiering**         | Routine tasks → cheaper models; complex → premium | 25-35%  |
| **Response Caching**      | Identical queries return cached results           | 20-40%  |

#### Cost Controls by Edition

## Solo Edition

- Basic token logging
- Manual provider selection

## Team Edition

- Per-user token budgets (daily/monthly caps)
- Cost alerts and pause thresholds
- Provider fallback chains (Claude hits budget → Ollama)
- Cost attribution per portal

## Enterprise Edition

- Department-level budget allocation
- Cost forecasting with ML predictions
- Anomaly detection (unusual spending patterns)
- ROI dashboards (compare agent cost vs. developer time saved)
- Provider policies by data classification (sensitive = local only)

### Example: Cost-Aware Provider Routing

```toml
# Enterprise provider policy

default = "claude-3.5-sonnet"
fallback = ["gpt-4-turbo", "ollama/deepseek"]

[providers.policies]

# PHI-containing portals use local only

# Cost optimization for bulk operations

# Premium for critical decisions
```

---

## 4. Three-Tier Edition Model

### Edition Comparison Matrix

| Feature Category            | Solo (Free)                          | Team (Usage-Based)              | Enterprise (AELA)                        |
| --------------------------- | ------------------------------------ | ------------------------------- | ---------------------------------------- |
| **Interface**               |                                      |                                 |                                          |
| CLI (`exactl`)              | ✅ Full                              | ✅ Full                         | ✅ Full                                  |
| TUI Dashboard               | ✅ 7 views                           | ✅ 7 views                      | ✅ Enhanced 9 views                      |
| Web UI                      | ❌ No                                | ✅ Plan review, approval, logs  | ✅ Full (visual workflows, admin)        |
| **Database & Audit**        |                                      |                                 |                                          |
| Audit Database              | SQLite (embedded)                    | PostgreSQL (append-only)        | PostgreSQL + immudb (WORM)               |
| Immutability                | ⚠️ Application-level                 | ✅ Database-enforced            | ✅ Cryptographically verified            |
| Retention Policies          | ⚠️ Manual                            | ✅ Configurable                 | ✅ SOX 7-year, HIPAA 6-year              |
| **Core Features**           |                                      |                                 |                                          |
| Activity Journal            | ✅ Full audit trail                  | ✅ Full audit trail             | ✅ Enhanced with analytics               |
| Portal System               | ✅ Unlimited                         | ✅ Unlimited                    | ✅ Unlimited + multi-tenancy             |
| Agent Blueprints            | ✅ Basic templates                   | ✅ Team library                 | ✅ Enterprise templates + marketplace    |
| Git Integration             | ✅ Trace IDs in commits              | ✅ + team workflows             | ✅ + advanced branch policies            |
| **MCP Support**             |                                      |                                 |                                          |
| MCP Client                  | ✅ Connect to MCP servers            | ✅ Full                         | ✅ Full                                  |
| MCP Server                  | ❌ No                                | ✅ Expose Exaix APIs            | ✅ + custom tool development             |
| **LLM Providers**           |                                      |                                 |                                          |
| Basic Providers             | ✅ Ollama, OpenAI, Anthropic, Google | ✅ All                          | ✅ All                                   |
| OpenRouter                  | ❌ No                                | ✅ 100+ models, unified billing | ✅ Full                                  |
| Enterprise Providers        | ❌ No                                | ❌ No                           | ✅ Azure OpenAI, AWS Bedrock, GCP Vertex |
| Provider Routing            | ❌ Manual selection                  | ✅ Cost-based, fallback chains  | ✅ + advanced policies                   |
| Cost Management             | ⚠️ Basic logs                        | ✅ Per-user tracking, budgets   | ✅ Forecasting, anomaly detection        |
| **Collaboration**           |                                      |                                 |                                          |
| Users                       | ⚠️ Single user                       | ✅ Multi-user (unlimited)       | ✅ Multi-user + RBAC                     |
| Shared Workspaces           | ❌ No                                | ✅ Team workspaces              | ✅ + department isolation                |
| Skills Library              | ✅ Personal                          | ✅ Org-wide                     | ✅ + verified marketplace                |
| **Governance & Compliance** |                                      |                                 |                                          |
| Audit Exports               | ⚠️ CSV only                          | ✅ CSV, JSON                    | ✅ + PDF compliance reports              |
| Compliance Frameworks       | ❌ None                              | ❌ None                         | ✅ EU AI Act, HIPAA, SOX, ISO 27001      |
| Governance Dashboard        | ❌ No                                | ❌ No                           | ✅ Risk scoring, policy enforcement      |
| **Advanced Features**       |                                      |                                 |                                          |
| Memory Banks                | ✅ Basic (file-based)                | ✅ + full-text search           | ✅ + vector search, knowledge graphs     |
| Analytics                   | ❌ No                                | ✅ Basic (performance, costs)   | ✅ Advanced (predictions, anomalies)     |
| SSO/SAML                    | ❌ No                                | ❌ No                           | ✅ Enterprise auth                       |
| Air-Gapped Deployment       | ✅ Possible                          | ✅ Possible                     | ✅ + professional services               |
| **Support**                 |                                      |                                 |                                          |
| Community Support           | ✅ GitHub, Discord                   | ✅ ✅                           | ✅ ✅                                    |
| Email Support               | ❌ No                                | ✅ Business hours               | ✅ 24/7                                  |
| SLA Guarantee               | ❌ No                                | ❌ No                           | ✅ 99.9% uptime                          |
| Professional Services       | ❌ No                                | ⚠️ Available (paid addon)       | ✅ Included                              |

### Recommended Edition by Use Case

## Solo Edition - Best For

- Individual developers and hobbyists
- Open source project maintainers
- Students and researchers
- Personal productivity automation
- Learning and experimentation

## Team Edition - Best For

- Startups (2-10 developers)
- Consulting firms managing client projects
- Small agencies with collaborative workflows
- Teams needing approval workflows
- Organizations wanting MCP integration

## Enterprise Edition - Best For

- Regulated industries (healthcare, finance, pharmaceuticals)
- Government and defense contractors
- Large enterprises with compliance requirements
- Organizations needing SSO/SAML integration
- Multi-department corporations

### Migration Path

## Solo → Team

- Seamless upgrade: existing workspace, blueprints, and audit logs preserved
- Add team members via invitation
- Enable web UI access
- Configure MCP server mode

## Team → Enterprise

- Import team workspaces
- Configure compliance frameworks
- Set up SSO/SAML
- Deploy governance dashboard
- Professional services available for migration assistance

---

## 5. Architecture Overview

### High-Level System Architecture

Exaix operates as a **secure daemon** on the host machine (or shared server for Team/Enterprise).

```text
┌─────────────────────────────────────────────────────────┐
│                    User / Developer                      │
└───────────┬────────────────────────┬────────────────────┘
            │                        │
     ┌──────▼──────┐          ┌──────▼──────┐
     │  CLI        │          │  Web UI     │
     │  (exactl)   │          │ (Team/Ent)  │
     └──────┬──────┘          └──────┬──────┘
            │                        │
            └────────┬───────────────┘
                     │
            ┌────────▼─────────┐
            │   TUI Dashboard  │
            │   (7-9 views)    │
            └────────┬─────────┘
                     │
       ┌─────────────▼──────────────┐
       │    Exaix Daemon Core     │
       │  ┌──────────────────────┐  │
       │  │  Request Processor   │  │
       │  │  Request Router      │  │
       │  │  Plan Executor       │  │
       │  │  Flow Engine         │  │
       │  └──────────────────────┘  │
       └─────────────┬───────────────┘
                     │
      ┌──────────────┼──────────────┐
      │              │              │
┌─────▼────┐  ┌──────▼─────┐  ┌────▼─────┐
│ Activity │  │   File     │  │ Portal   │
│ Journal  │  │   System   │  │ System   │
│ (SQLite) │  │ (Markdown) │  │(Symlinks)│
└──────────┘  └────────────┘  └──────────┘
      │
      │ ┌────────────────────────────┐
      └─│  MCP Integration Layer     │
        │  ├─ Client (Solo+)         │
        │  └─ Server (Team+)         │
        └────────┬───────────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
┌─────▼──────┐    ┌─────────▼────────┐
│ LLM        │    │ External MCP     │
│ Providers  │    │ Servers/Clients  │
│ (Local/API)│    │ (Claude, Cline)  │
└────────────┘    └──────────────────┘
```

### Core Architectural Principles

#### 1. File-as-API Philosophy

Everything is a file—requests, plans, blueprints, reports:

```text
~/Exaix/
├── Workspace/
│   ├── Requests/         ← Drop .md files here
│   ├── Plans/            ← Agent-generated plans
│   └── Active/           ← Approved plans being executed
├── Blueprints/
│   ├── Agents/           ← TOML agent definitions
│   └── Flows/            ← Multi-agent workflows
├── Memory/
│   ├── Reports/          ← Execution summaries
│   ├── Context/          ← Knowledge base
│   └── Portals/          ← Auto-generated context cards
├── Portals/              ← Symlinks to external projects
└── .exa/
    ├── journal.db        ← Activity Journal (audit trail)
    └── config.toml       ← Global configuration
```

## Benefits

- **Simplicity:** No complex APIs to learn
- **Inspectability:** Everything is human-readable
- **Git-friendliness:** Requests and blueprints version-controlled
- **Automation-ready:** Standard Unix tools work (grep, find, sed)

### 2. Daemon-Based Asynchronous Execution

Unlike IDE agents requiring constant attention, Exaix runs as background daemon:

```text
Morning:  Drop request → "Refactor authentication module"
          ↓
Daemon:   Detects new request, generates plan, waits for approval
          ↓
Review:   exactl plan show auth-refactor → Looks good
          ↓
Approve:  exactl plan approve auth-refactor
          ↓
Execute:  Agent creates branch, refactors code, commits with trace_id
          ↓
Evening:  exactl review show auth-refactor → Review diff
          ↓
Merge:    exactl review approve auth-refactor → Done
```

**Workflow is impossible with IDE agents** (requires continuous human presence).

#### 3. Trace ID Linking: The Audit Chain

Every action is linked via **trace_id** (UUID):

```text
Request (trace_id: 550e8400...)
  ↓
Plan (trace_id: 550e8400...)
  ↓
Git Commits (footer: [ExaTrace: 550e8400...])
  ↓
Review (trace_id: 550e8400...)
  ↓
Report (trace_id: 550e8400...)
  ↓
Activity Journal (all events tagged with 550e8400...)
```

**Result:** Complete forensic trail. Answer "why did this file change?" with `exactl journal --trace 550e8400`.

#### 4. Security Through Isolation

## Runtime Security Model

Exaix leverages **OS-level permission enforcement** for defense-in-depth security. The security guarantees—sandboxing, network restrictions, file system isolation—are the value, regardless of runtime implementation.

## Current Implementation (Deno)

Exaix currently runs on Deno, chosen for its **secure-by-default** permission model:

- Agents run with **explicitly granted permissions** only
- Portal access limited via `--allow-read` and `--allow-write` flags
- Network access restricted to approved API domains
- Path traversal blocked via canonicalization

## Why Deno

- Zero-configuration TypeScript support
- Built-in security primitives (no bolted-on sandboxing)
- Modern runtime with reduced attack surface
- Used by Slack, Netlify, Supabase in production

**Enterprise Consideration:** While Deno has smaller market share than Node.js, the security model—not the runtime—is the critical factor. Exaix's architecture could theoretically support other runtimes with equivalent security primitives.

## Portal Isolation

- Each portal is a **separate symlink** to external project
- Agents can only access **assigned portal(s)**
- Cross-portal access blocked at runtime
- Audit log tracks all portal access

---

## 6. Regulatory Compliance (Enterprise Edition)

### Pre-Configured Compliance Frameworks

Enterprise Edition includes **turnkey compliance profiles** for major regulatory frameworks:

#### EU AI Act Compliance

## Requirements

- Transparency and human oversight for high-risk AI systems
- Documentation of AI decision-making processes
- Risk assessment and mitigation

## Exaix Implementation

- ✅ **Transparency:** Activity Journal logs all agent actions with reasoning
- ✅ **Human Oversight:** Explicit approval gates (plan approval, review review)
- ✅ **Documentation:** Compliance reports auto-generated from Activity Journal
- ✅ **Risk Assessment:** Governance dashboard flags high-risk operations

## Compliance Export

```bash
exactl compliance export --framework eu-ai-act \
  --period "2026-01-01 to 2026-01-31" \
  --output eu-ai-act-january-2026.pdf
```

Generates PDF report with:

- All AI agent actions during period
- Human approval timestamps and approvers
- Risk classification per action
- Audit trail integrity verification

### HIPAA (Healthcare) Compliance

## Requirements

- Audit trails for Protected Health Information (PHI) access
- Access controls and user authentication
- Encryption of PHI in transit and at rest

## Exaix Implementation

- ✅ **Audit Trails:** Activity Journal logs every file accessed by agents
- ✅ **Access Controls:** RBAC ensures only authorized users approve plans
- ✅ **Encryption:** SQLite database encrypted at rest (Enterprise)
- ✅ **PHI Flagging:** Portals marked as "contains-phi" trigger enhanced logging

## Compliance Export

```bash
exactl compliance export --framework hipaa \
  --portal "patient-records" \
  --output hipaa-phi-access-q1-2026.pdf
```

### SOX (Financial Controls) Compliance

## Requirements

- Controls over systems affecting financial reporting
- Audit trails for code changes
- Segregation of duties

## Exaix Implementation

- ✅ **Change Controls:** No code changes without plan approval + review review
- ✅ **Audit Trails:** Git commits linked to trace_id, Activity Journal immutable
- ✅ **Segregation of Duties:** RBAC separates "developers" from "approvers"

## Compliance Export

```bash
exactl compliance export --framework sox \
  --portal "financial-reporting-api" \
  --output sox-controls-audit-2026.pdf
```

### ISO/IEC 27001 (Information Security)

## Requirements

- Information security management system
- Risk assessment and treatment
- Access control and audit logging

## Exaix Implementation

- ✅ **Risk Assessment:** Governance dashboard identifies high-risk agent actions
- ✅ **Access Control:** Deno permissions + Portal isolation + RBAC
- ✅ **Audit Logging:** Activity Journal with cryptographic timestamps (Enterprise)

### Governance Dashboard (Enterprise)

Real-time compliance monitoring interface:

## Key Metrics

- **Agent Actions (30 days):** 1,247 total
- **Approval Rate:** 94.2% (73 plans approved, 5 rejected)
- **High-Risk Actions Flagged:** 12 (manual review required)
- **Average Approval Time:** 4.2 hours
- **Compliance Status:** ✅ HIPAA Compliant, ✅ SOX Compliant

## Alerts

- ⚠️ Agent attempted to access `/etc/passwd` (blocked by Deno, logged for review)
- ⚠️ Claude API cost exceeded $500/day threshold
- ⚠️ 3 plans pending approval > 48 hours

---

## 7. Use Cases by Edition

### Solo Edition Use Cases

#### UC-S1: Open Source Maintainer Workflow

**Scenario:** You maintain an open source library with 50+ pending issues.

## Workflow

````bash
# Morning: Create batch request

  --agent senior-coder \
  --tags batch-refactor

# Daemon generates plan while you work on other tasks

# Afternoon: Review plan

exactl plan approve deprecated-api-fix

# Evening: Review review

exactl review approve deprecated-api-fix

# Result: 50 files refactored, all changes traced to single request

#### UC-S2: Personal Learning & Experimentation

**Scenario:** Learning new framework by having agent explain and refactor code.

# Workflow:

- Create request: "Convert this Express.js API to Fastify"
- Agent generates plan with explanations
- Review plan to understand architectural differences
- Execute plan with agent-generated code
- Study review to see actual implementation patterns

**Value:** Learning by doing, with full audit trail for later reference.

### Team Edition Use Cases

#### UC-T1: Startup Product Development

**Scenario:** 5-person startup building SaaS product, needs approval workflow.

# Setup:

- Team workspace with shared blueprints
- Web UI for non-technical CEO to approve high-risk changes
- MCP server exposes Exaix to Claude Desktop for rapid prototyping

# Workflow:

```bash

# Developer creates request

# Agent generates plan, notifies team via Slack integration

# CTO reviews plan in Web UI (approves/rejects with comments)

# Agent executes, creates review

# CEO reviews code changes in Web UI before merge

**Value:** Collaboration with governance, non-technical stakeholders can participate.

#### UC-T2: Consulting Firm Client Projects

**Scenario:**Consulting firm managing 10 client projects simultaneously.

# Setup:

- Separate portal per client
- Shared skill library (common patterns reused)
- Cost tracking per client for billing

# Workflow:

- Morning: Queue 10 requests across clients
- Daemon processes asynchronously
- Afternoon: Review all plans in TUI dashboard
- Evening: Export cost breakdown per client for invoicing

**Value:** Parallel project management, cost transparency, reusable workflows.

### Enterprise Edition Use Cases

#### UC-E1: HIPAA-Compliant Healthcare Development

**Scenario:** Hospital building patient records system, must comply with HIPAA.

# Setup:

- Portal marked as "contains-phi" (triggers enhanced logging)
- HIPAA compliance profile enabled
- RBAC: Developers request, Security Officers approve
- All API calls to Claude routed through on-premises proxy

# Workflow:

```bash

# Developer creates request

  --portal patient-records \
  --tags hipaa-sensitive

# System automatically flags as high-risk (PHI access)

# Agent generates plan

# Security Officer reviews in Governance Dashboard

# After approval, agent executes with enhanced logging

# Quarterly: Export HIPAA compliance report for auditors

  --output q1-2026-hipaa-audit.pdf
````

**Value:** Automated compliance, auditor-ready reports, peace of mind.

### UC-E2: Financial Institution SOX Compliance

**Scenario:** Bank maintaining financial reporting systems under SOX requirements.

## Setup

- Segregation of duties: Developers create plans, Auditors approve
- All changes to `financial-reporting-api` portal require dual approval
- Immutable audit trail with cryptographic timestamps
- Annual SOX audit preparation

## Workflow

- Developer: Creates request to fix calculation bug
- Agent: Generates plan with test coverage
- Tech Lead: Reviews technical implementation (first approval)
- Compliance Officer: Reviews SOX impact (second approval)
- Agent: Executes only after both approvals
- System: Generates SOX controls report automatically

**Value:** Bulletproof audit trail, regulatory compliance without manual overhead.

### UC-E3: Pharmaceutical R&D (21 CFR Part 11)

**Scenario:** Pharma company developing clinical trial management software.

## Setup

- FDA 21 CFR Part 11 compliance (electronic records and signatures)
- Vector search Memory Banks for protocol reuse
- Air-gapped deployment (no data leaves premises)

## Workflow

- Request: "Update adverse event reporting module per new FDA guidance"
- Memory Banks: Retrieve similar past implementations
- Agent: Generates plan incorporating institutional knowledge
- Medical Director: Reviews and e-signs plan approval
- Agent: Executes with full audit trail
- System: Generates 21 CFR Part 11 compliance package for FDA submission

**Value:** Institutional knowledge preservation, regulatory compliance, FDA submission-ready documentation.

---

## 8. Security & Threat Model

### Security Principles

Exaix implements **defense in depth** with multiple security layers:

1. **OS-Level Permissions** (Deno)

1.
1.
1.

### Threat Matrix

| Threat                         | Likelihood | Deno Mitigation          | Exaix Control                       | Residual Risk |
| ------------------------------ | ---------- | ------------------------ | ----------------------------------- | ------------- |
| **Buggy Agent**                | High       | None                     | Git feature branches + Plan review  | Low           |
| **Malicious Dependency**       | Medium     | ✅ Permission system     | Supply chain review                 | Very Low      |
| **Hijacked API Keys**          | Low        | ✅ Network restrictions  | Keyring storage (Enterprise)        | Very Low      |
| **Path Traversal**             | Low        | ✅ Path canonicalization | Portal allow-lists                  | Very Low      |
| **Malicious Blueprint**        | Low        | ⚠️ Partial               | Blueprint verification (Enterprise) | Low           |
| **Credential Leakage in Logs** | Medium     | None                     | Payload sanitization                | Low           |
| **Compromised MCP Server**     | Low        | ✅ Permission system     | MCP server validation               | Low           |

### What Deno Provides

## Runtime Security

```bash
# Agent code attempts:

→ PermissionDenied (not in --allow-read list)

fetch("https://evil.com")
→ PermissionDenied (not in --allow-net list)

Deno.writeFile("../../.ssh/id_rsa")
→ PermissionDenied (path canonicalized, blocked)
```

### What Deno Does NOT Provide

## Deno cannot prevent

- Logic bugs (agent deletes important file within allowed portal)
- Bad decisions (agent refactors working code into broken code)
- Resource abuse (agent consumes 100% CPU in infinite loop)
- Social engineering (malicious blueprint tricks you into approval)

**Mitigation:** Human review, Git rollback, resource limits, blueprint auditing.

### Best Practices

## For All Editions

1. Review blueprints before first use

1.
1.
1.

## For Team/Enterprise

1.
1.
1.
1.
1.

---

## 9. Deployment & Scaling

### Solo Edition Deployment

## Installation

```bash
# Install Deno (if not already installed)

# Clone Exaix

cd exaix

# Initialize workspace

# Start daemon

# Verify installation
```

## Requirements

- Deno 2.0+
- 4GB RAM (8GB recommended)
- 10GB disk space (varies with project size)
- Linux, macOS, or WSL2

## Local LLM (Optional)

```bash
# Install Ollama for 100% local operation

# Pull model

# Configure Exaix

exactl config set llm.model deepseek-coder:33b
```

### Team Edition Deployment

## Shared Server Setup

```bash
# Deploy to shared server (Ubuntu 24.04)

# Install as systemd service

  https://exaix.io/install/team/exaix.service

sudo systemctl enable exaix
sudo systemctl start exaix

# Configure web UI

exactl config set webui.port 3000
exactl config set webui.bind "0.0.0.0"

# Add team members

exactl user add bob@example.com --role approver
```

## Requirements

- 16GB RAM (with 5+ concurrent users)
- 100GB disk space
- PostgreSQL (optional, for enhanced Activity Journal)

### Enterprise Edition Deployment

## High-Availability Setup

```bash
# Load-balanced deployment with Kubernetes

# Configure SSO (example: Okta)

exactl config set auth.okta.domain "yourcompany.okta.com"
exactl config set auth.okta.client_id "xxx"
exactl config set auth.okta.client_secret "yyy"

# Enable compliance frameworks

exactl compliance enable sox
exactl compliance enable iso27001

# Configure air-gapped deployment (no internet)

exactl config set llm.azure.endpoint "https://your-private-endpoint.azure.com"
```

## Requirements

- 32GB+ RAM (production cluster)
- 500GB+ disk (audit retention, vector embeddings)
- PostgreSQL with replication
- Redis for caching
- Professional services included for setup

---

## 10. Roadmap & Future Vision

### 2026 Priorities

## Q1 2026 (Current)

- ✅ Three-tier edition launch
- ✅ MCP server implementation (Team+)
- ✅ Governance dashboard (Enterprise)
- ⏳ Blueprint marketplace (Solo+)

## Q2 2026

- Visual workflow builder (Enterprise)
- Advanced Memory Banks with vector search (Enterprise)
- Provider strategy optimization (improved cost prediction)
- Multi-language support (TUI/Web UI internationalization)

## Q3 2026

- AI-assisted blueprint generation (describe in natural language → TOML)
- Workflow analytics with ML insights (Enterprise)
- Mobile app for plan approval (Team/Enterprise)
- Kubernetes operator for scalable deployments

## Q4 2026

- Agent specialization framework (domain-specific agents)
- Cross-workspace collaboration (multiple Exaix instances)
- Advanced security: anomaly detection in agent behavior
- Compliance framework expansion (GDPR, CCPA, more)

### Open Core Philosophy

Exaix follows **transparent open-core licensing**. Developers deserve clarity on what's open and what's commercial.

#### What's Open Source (MIT/Apache 2.0)

| Component            | Description                     | Why Open                           |
| -------------------- | ------------------------------- | ---------------------------------- |
| **Exaix Daemon**     | Core orchestration engine       | Security auditing, community trust |
| **CLI (`exactl`)**   | Command-line interface          | Developer tools should be free     |
| **TUI Dashboard**    | Terminal UI (7 views)           | Core UX, community can extend      |
| **File Formats**     | Request, plan, blueprint specs  | Interoperability, no lock-in       |
| **MCP Client**       | Connect to external MCP servers | Standard protocol support          |
| **SQLite Journal**   | Basic audit trail (Solo)        | Core functionality                 |
| **Basic Blueprints** | Starter agent templates         | Onboarding, community contribution |

**Commitment:** The daemon core will **always remain open source** for security auditing.

#### What's Commercial (Team/Enterprise)

| Component                      | Edition    | Why Commercial               |
| ------------------------------ | ---------- | ---------------------------- |
| **Web UI**                     | Team+      | Significant development cost |
| **MCP Server Mode**            | Team+      | Enterprise integration value |
| **PostgreSQL/immudb Backend**  | Team+      | Infrastructure complexity    |
| **Governance Dashboard**       | Enterprise | Enterprise-specific feature  |
| **Compliance Frameworks**      | Enterprise | Regulatory expertise value   |
| **SSO/SAML Integration**       | Enterprise | Enterprise authentication    |
| **Advanced Analytics**         | Enterprise | ML/data science investment   |
| **Vector Search Memory Banks** | Enterprise | AI infrastructure cost       |

**Philosophy:** Commercial features fund core development. We don't "open-core bait" — the free tier is genuinely useful, not crippled.

#### Community Contributions

| Type                | Welcome?         | Process                         |
| ------------------- | ---------------- | ------------------------------- |
| Bug fixes           | ✅ Yes           | PR to main repo                 |
| Blueprints & Skills | ✅ Yes           | Community marketplace           |
| Documentation       | ✅ Yes           | PR to docs repo                 |
| Feature requests    | ✅ Yes           | GitHub issues + community votes |
| Core features       | ⚠️ Discuss first | Align with roadmap              |

### Security Certifications Roadmap

Enterprise customers require third-party security validation. Our certification timeline:

| Certification        | Status         | Target Date | Scope                    |
| -------------------- | -------------- | ----------- | ------------------------ |
| **SOC 2 Type I**     | ⏳ In Progress | Q2 2026     | Team & Enterprise hosted |
| **SOC 2 Type II**    | 📋 Planned     | Q4 2026     | Team & Enterprise hosted |
| **ISO 27001**        | 📋 Planned     | Q1 2027     | Enterprise on-premises   |
| **FedRAMP Moderate** | 📋 Evaluated   | Q3 2027     | Government customers     |
| **HIPAA BAA**        | ✅ Available   | Now         | Enterprise healthcare    |

## Current Security Practices

- Annual penetration testing (third-party)
- Continuous vulnerability scanning
- Bug bounty program (launching Q2 2026)
- Security-focused code review process
- Dependency scanning (Dependabot + Snyk)

---

## 11. Getting Started

### Quick Start: Solo Edition

```bash
# 1. Install Exaix

# 2. Initialize workspace

# 3. Configure LLM provider

exactl config set llm.model mistral

# 4. Create your first portal

# 5. Start daemon

# 6. Create request

# 7. Review plan (in TUI or CLI)

# 8. Approve and watch execution

exactl journal tail

# 9. Review review

# 10. Merge changes
```

## First task complete in ~5 minutes

### Quick Start: Team Edition

```bash
# 1. Deploy to shared server

curl -fsSL https://exaix.io/install-team.sh | sh

# 2. Access web UI

# 3. Add team members (in web UI or CLI)

# 4. Configure MCP server

# 5. Team members connect
```

### Migration Paths

## Solo → Team

```bash
# Export Solo workspace

# On Team server

# Grant access to team
```

## Team → Enterprise

- Contact sales for migration assistance
- Professional services included
- Zero-downtime migration available

---

## 12. Value-Aligned Pricing

### Pricing Philosophy

Traditional seat-based pricing is **obsolete for AI agent platforms** in 2026. When AI agents perform work previously done by humans, charging per-user makes no sense. Exaix uses **value-aligned pricing** that scales with the work performed, not the number of people watching.

## Our Principles

- **Pay for outcomes, not seats** - Charges correlate with value delivered
- **Cost predictability** - Caps and budgets prevent runaway costs
- **Free to start** - Solo edition is always free and open source
- **Enterprise flexibility** - AELA (Agentic Enterprise License Agreements) for unlimited usage

### Pricing Tiers

| Edition        | Model              | Starting Price            | Best For                         |
| -------------- | ------------------ | ------------------------- | -------------------------------- |
| **Solo**       | Free               | $0 forever                | Individual developers            |
| **Team**       | Usage-Based Hybrid | $199/workspace/month base | Small teams, startups            |
| **Enterprise** | AELA (Flat-Fee)    | $2,499/month              | Regulated industries, large orgs |

---

### Solo Edition - Free Forever

**License:** MIT/Apache 2.0

**Price:** $0

## Includes

- Full CLI and TUI
- SQLite audit journal
- Unlimited portals and requests
- Local LLM support (Ollama)
- Community support (GitHub, Discord)

**Target:** Individual developers, open source contributors, learning and experimentation.

---

### Team Edition - Usage-Based Hybrid

**License:** Source-Available (BSL)
**Pricing Model:** Base fee + usage charges with predictable cap

| Component                 | Price                                                    |
| ------------------------- | -------------------------------------------------------- |
| **Base Platform Fee**     | $199/workspace/month                                     |
| **Included**              | 500 agent requests, 100 plan executions, unlimited users |
| **Additional Requests**   | $0.10 per request                                        |
| **Additional Executions** | $0.50 per approved plan execution                        |
| **Monthly Cap**           | $499/month max (cost predictability guarantee)           |

## Includes

- PostgreSQL audit database (append-only, immutable)
- Web UI for plan review and approval
- MCP server mode
- Multi-user collaboration
- Cost tracking and budgets per user
- Email support (business hours)

## Example Costs

| Team Size     | Monthly Requests | Plan Executions | Monthly Cost           |
| ------------- | ---------------- | --------------- | ---------------------- |
| 3 developers  | 200              | 50              | $199 (base)            |
| 5 developers  | 600              | 150             | $234 (base + overages) |
| 10 developers | 1,500            | 400             | $399 (approaching cap) |
| 15 developers | 3,000            | 800             | $499 (capped)          |

---

### Enterprise Edition - AELA (Agentic Enterprise License Agreement)

**License:** Proprietary
**Pricing Model:** Flat-fee "all-you-can-eat" with compliance add-ons

| Tier          | Agent Executions | Monthly Price |
| ------------- | ---------------- | ------------- |
| **Growth**    | 1,000/month      | $2,499/month  |
| **Scale**     | 5,000/month      | $4,999/month  |
| **Unlimited** | Unlimited        | $9,999/month  |

## Compliance Add-Ons

| Add-On                    | Monthly Price                   |
| ------------------------- | ------------------------------- |
| HIPAA Compliance Module   | +$500/month                     |
| SOX Compliance Module     | +$500/month                     |
| EU AI Act Module          | +$500/month                     |
| ISO 27001 Module          | +$500/month                     |
| All Compliance Frameworks | +$1,500/month (bundle discount) |

## Includes

- PostgreSQL + immudb (WORM-compliant, cryptographically verified)
- Full Web UI with visual workflow builder
- Governance dashboard with risk scoring
- SSO/SAML integration
- RBAC (role-based access control)
- 24/7 support with SLA guarantee
- Professional services hours (onboarding, training)

## Enterprise Pricing Examples

| Scenario                            | Tier      | Add-Ons        | Monthly Cost |
| ----------------------------------- | --------- | -------------- | ------------ |
| Tech startup (no compliance)        | Growth    | None           | $2,499       |
| Healthcare app (HIPAA)              | Scale     | HIPAA          | $5,499       |
| Financial institution (SOX + HIPAA) | Scale     | SOX, HIPAA     | $5,999       |
| Large enterprise (all frameworks)   | Unlimited | All Compliance | $11,499      |

---

### Non-Profit & Education

| Program                  | Discount                                  |
| ------------------------ | ----------------------------------------- |
| Non-Profit Organizations | 50% off Team/Enterprise                   |
| Educational Institutions | 75% off Team, free Enterprise pilots      |
| Open Source Projects     | Free Team edition for qualifying projects |

---

### ROI: Why Exaix Pays for Itself

## Developer Productivity Gains

| Metric                     | Without Exaix | With Exaix | Annual Savings      |
| -------------------------- | ------------- | ---------- | ------------------- |
| Routine refactoring time   | 20 hrs/week   | 8 hrs/week | 624 developer hours |
| Multi-project coordination | 15 hrs/week   | 5 hrs/week | 520 developer hours |
| Code review overhead       | 10 hrs/week   | 6 hrs/week | 208 developer hours |

## At $100/hour fully-loaded developer cost: ~$135,000/year in recovered productivity

## Compliance Cost Reduction

| Metric                  | Manual Process | With Exaix   | Annual Savings |
| ----------------------- | -------------- | ------------ | -------------- |
| Audit trail maintenance | $150,000/year  | $30,000/year | $120,000       |
| Audit preparation time  | 3 weeks        | 2 days       | $50,000        |
| Compliance officer FTE  | 1.0 FTE        | 0.3 FTE      | $100,000       |

## Enterprise ROI: 5-10x return on investment within first year

---

## Conclusion: The Governance Imperative

### The Choice in 2026

As AI agents become more autonomous and pervasive, organizations face a critical decision:

**Deploy agents without governance** → High productivity today, regulatory crisis tomorrow

**Build custom governance layer** → Expensive, slow, reinventing the wheel

**Use Exaix** → Governance built-in, compliance-ready, production-proven

### Exaix's Promise

> **"Every AI agent action is traceable, explainable, and reversible."**

This isn't just a slogan—it's an architectural guarantee enforced by:

- **Activity Journal** (immutable audit trail)
- **Approval Gates** (explicit human authorization)
- **Deno Security** (OS-level boundaries)
- **MCP Integration** (standards-based interoperability)

### Why Governance Matters

The 40% project failure rate isn't a technology problem—it's a **trust problem**. Organizations can't afford to deploy AI agents they can't explain, control, or audit.

Exaix solves this by making governance **automatic, not optional**.

### Start Today

**Solo Edition:** [Download](https://exaix.io/download) and be running in 5 minutes
**Team Edition:** [Start free trial](https://exaix.io/trial) (no credit card required)
**Enterprise Edition:** [Contact sales](https://exaix.io/enterprise) for demo and pricing

### Early Access Program

Join 50+ organizations piloting governance-first AI agent orchestration:

| Industry           | Organization Type          | Use Case                                          |
| ------------------ | -------------------------- | ------------------------------------------------- |
| Healthcare         | Regional hospital network  | HIPAA-compliant EHR integration development       |
| Financial Services | Mid-size credit union      | SOX-auditable core banking modernization          |
| Technology         | Series B SaaS startup      | Multi-project refactoring with audit requirements |
| Government         | State agency IT department | Secure, auditable workflow automation             |
| Consulting         | Technical consulting firm  | Client project isolation and batch processing     |

## Early Access Benefits

- 🎯 Priority feature requests
- 👥 Direct Slack channel with engineering team
- 📊 Case study co-development (with permission)
- 💰 Founding customer pricing (locked for 3 years)

## [Apply for Early Access →](https://exaix.io/early-access)

---

## Appendix A: Glossary

**Activity Journal:** Tiered audit database logging all agent events—SQLite (Solo), PostgreSQL (Team), PostgreSQL+immudb (Enterprise).

**Agent Blueprint:** TOML configuration file defining an AI agent's model, capabilities, and system prompt.

**AI-BOM (AI Bill of Materials):** Complete audit trail of all AI agent actions, analogous to software bill of materials (SBOM).

**Review:** Git branch containing agent-generated code changes, pending human approval before merge.

**MCP (Model Context Protocol):** Standard protocol for AI agent tool integration, developed by Anthropic.

**Plan:** Agent-generated proposal outlining steps to fulfill a request, requiring human approval before execution.

**Portal:** Symlinked directory providing agents access to external projects with isolated permissions.

**Request:** User-created markdown file describing desired outcome, triggering agent plan generation.

**Trace ID:** UUID linking related actions (request → plan → commits → review → report) for forensic traceability.

---

## Appendix B: Compliance Framework Mapping (Enterprise)

### EU AI Act

| Requirement     | Exaix Implementation                | Evidence Location                                |
| --------------- | ----------------------------------- | ------------------------------------------------ |
| Transparency    | Activity Journal logs all decisions | `journal.db`                                     |
| Human Oversight | Explicit plan & review approval     | Approval timestamps in Activity Journal          |
| Risk Assessment | Governance dashboard risk scoring   | Web UI → Governance → Risk Matrix                |
| Documentation   | Auto-generated compliance reports   | `exactl compliance export --framework eu-ai-act` |

### HIPAA

| Requirement    | Exaix Implementation               | Evidence Location                    |
| -------------- | ---------------------------------- | ------------------------------------ |
| Access Control | RBAC + portal permissions          | `exactl user list`, portal configs   |
| Audit Trails   | Activity Journal + PHI access logs | `journal.db` with PHI flags          |
| Encryption     | SQLite encryption at rest          | Database file encrypted (Enterprise) |
| Authentication | SSO/SAML integration               | Auth provider logs                   |

### SOX (Sarbanes-Oxley)

| Requirement           | Exaix Implementation          | Evidence Location                     |
| --------------------- | ----------------------------- | ------------------------------------- |
| Change Controls       | Plan approval + review review | Activity Journal approval events      |
| Segregation of Duties | RBAC (developers ≠ approvers) | User roles configuration              |
| Audit Trail Integrity | Immutable Activity Journal    | Cryptographic timestamps (Enterprise) |
| IT General Controls   | Backup & recovery procedures  | Automated backup logs                 |

---

## Appendix C: API Reference (MCP Endpoints)

### MCP Server Tools (Team/Enterprise)

## `exaix*create*request`

- **Description:** Create new request from external AI assistant
- **Parameters:** `{ "title": string, "description": string, "agent": string, "portal": string }`
- **Returns:** `{ "request*id": string, "trace*id": string }`

## `exaix*list*plans`

- **Description:** List pending plans for review
- **Parameters:** `{ "status": "review" | "approved" | "rejected" }`
- **Returns:** Array of plan objects

## `exaix*approve*plan`

- **Description:** Approve plan for execution
- **Parameters:** `{ "plan_id": string, "approver": string }`
- **Returns:** `{ "success": boolean, "execution_started": boolean }`

## `exaix*query*journal`

- **Description:** Query Activity Journal for audit trail
- **Parameters:** `{ "trace*id": string, "action*type": string, "start*date": ISO8601, "end*date": ISO8601 }`
- **Returns:** Array of activity events

## `exaix*get*review`

- **Description:** Retrieve review diff for review
- **Parameters:** `{ "review_id": string }`
- **Returns:** `{ "diff": string, "files_changed": number, "status": string }`

---
