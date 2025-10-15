# CODEX Obsidian Plan

## Overview

This plan extends the KIRO roadmap with additional phases focused on reliability, automation, and governance. It assumes KIRO Phase 4 (advanced tools) is complete. Each phase builds on the prior foundation and can be merged into the master KIRO plan later.

- **Prerequisites:** KIRO Phases 1-4 complete and stable
- **Scope:** New epics (11-20) layered after existing KIRO epics
- **Total Effort (estimate):** 120-160 hours (4-5 weeks)
- **Recommended Sequence:** Phase 5 → Phase 6 → Phase 7 → Phase 8

---

## Phase 5 – Operational Hardening (Weeks 1-2)

**Goal:** Strengthen reliability, observability, and recovery for large-scale usage.

### Epic 11: Vault Diagnostics Toolkit
- **User Story:** As an administrator, I need instant diagnostics on vault health so I can troubleshoot tool failures quickly.
- **Deliverables:**
  - `diagnose_vault` tool (checks API availability, filesystem access, watcher status)
  - `report_cache_state` tool (surfaces indexing/caching freshness)
  - Structured JSON report with severity flags and remediation tips

### Epic 12: Link Integrity Management
- **User Story:** As a curator, I need automated link maintenance so bulk moves and graph edits don't break references.
- **Deliverables:**
  - `scan_internal_links` tool (finds broken and redirected wikilinks)
  - `update_internal_links` tool (batch rewrites after move/rename)
  - Optional dry-run and diff preview outputs

### Epic 13: Transaction Safety Layer
- **User Story:** As a power user, I want reversible bulk operations so I can recover from mistakes.
- **Deliverables:**
  - `simulate_bulk_operation` tool (dry-run with before/after diff)
  - Persistent operation log with timestamps, tool names, target paths
  - `rollback_last_operation` (limited to operations that support undo data)

---

## Phase 6 – Intelligent Automation (Weeks 3-4)

**Goal:** Introduce proactive automation and AI-assisted authoring.

### Epic 14: Scheduled Automation Engine
- **User Story:** As a team lead, I want recurring maintenance tasks so I can keep the vault tidy without manual effort.
- **Deliverables:**
  - `list_automation_jobs`, `create_automation_job`, `delete_automation_job`
  - Support cron-like schedules for existing tools (e.g., nightly link scan)
  - Execution audit trail with status and duration

### Epic 15: AI-Assisted Template Booster
- **User Story:** As a note author, I want templates that can adapt to context so I save time capturing information.
- **Deliverables:**
  - `suggest_template_variables` (analyzes recent notes and vault metadata)
  - `autofill_template` (pre-populates template variables using heuristics)
  - Guidelines for safely incorporating AI completions or metadata inference

### Epic 16: Context-Aware Notifications
- **User Story:** As a knowledge manager, I need alerts when critical thresholds are hit so I can respond quickly.
- **Deliverables:**
  - `configure_notifications` (rules: stale notes, orphan clusters, failed automations)
  - `list_notifications` and `acknowledge_notification`
  - Integrations with CLI/stdio outputs and optional webhook target

---

## Phase 7 – Security & Governance (Week 5)

**Goal:** Provide safeguards for sensitive data and controlled execution.

### Epic 17: Sensitive Data Scanner
- **User Story:** As a security officer, I want automated scans for secrets so we can prevent accidental exposure.
- **Deliverables:**
  - `scan_sensitive_data` (patterns: API keys, PII, custom regex)
  - Severity scoring and remediation recommendations
  - Optional quarantine report (no auto-deletion)

### Epic 18: Permission & Policy Framework
- **User Story:** As an administrator, I need to restrict tool usage so teams can operate safely.
- **Deliverables:**
  - Role-based configuration (read-only vs. write vs. automation)
  - Policy file (`policies.yaml`) with allow/deny lists per tool
  - Enforcement layer in tool dispatcher with detailed error messages

### Epic 19: Plugin Sandbox and Audit
- **User Story:** As a developer, I want to integrate third-party plugins without risking the vault.
- **Deliverables:**
  - Plugin capability registry (maps plugin to required permissions)
  - Safe command execution wrapper with timeouts and output capture
  - `audit_plugin_activity` tool (recent plugin command history)

---

## Phase 8 – Insight & Reporting (Week 6)

**Goal:** Convert MCP activities into actionable insights.

### Epic 20: Analytics & Reporting Suite
- **User Story:** As an executive, I want trend reports so I can measure vault health and AI effectiveness.
- **Deliverables:**
  - `generate_vault_report` (weekly KPIs: note growth, tag usage, automation impact)
  - `export_operation_metrics` (CSV/JSON for external BI tools)
  - Dashboards compatible with CLI output and optional HTML report

### Epic 21: Observability Enhancements
- **User Story:** As an operator, I need clearer telemetry so I can debug production incidents.
- **Deliverables:**
  - Structured logging conventions with correlation IDs
  - Metrics emission (Prometheus-compatible endpoint or file dump)
  - Health checks for automation scheduler, queue depth, error rate

---

## Integration Notes

- **Merge Strategy:** Treat CODEX phases as optional modules; enable per-vault via configuration flags to keep the core server lean.
- **Testing Requirements:**
  - Extend existing KIRO test matrix with automation and security scenarios
  - Add long-running integration tests for scheduled jobs and rollback flows
  - Include red-team cases for policy enforcement
- **Documentation:** Each epic requires updates to `docs/` and quick-start guides, mirroring the style used for KIRO phases.

---

## Success Criteria

1. ✅ All new tools expose explicit schemas and follow dual-mode (API + filesystem) behavior.
2. ✅ Automation, security, and diagnostics modules can be enabled independently.
3. ✅ Comprehensive tests exist for rollback, scheduling, and policy enforcement.
4. ✅ Documentation covers operational workflows, edge cases, and recovery.
5. ✅ Performance impact measured; automation tasks do not degrade core tool latency.
