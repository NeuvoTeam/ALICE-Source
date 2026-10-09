# ALICE Platform — Antigravity 2.0 Feature Pipeline & Sprint Roadmap

## 1. Executive Summary & Strategy

This document defines the phased feature pipeline and multi-agent execution strategy for the ALICE Platform, optimized for rapid feature testing and iteration in **Google Antigravity 2.0**.

To maximize velocity during feature development and local troubleshooting, execution is strictly separated into two distinct phases:
- **Phase 1 (Feature & UX Development):** Rapid UI/UX iteration, AI generation tuning, and client worksheet workflows using permissive local dev auth policies.
- **Phase 2 (Pre-Production Hardening):** Strict database Row Level Security (RLS), atomic audit logging, and service role key restriction applied right before release.

### Tech Stack Baseline
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Lucide React
- **Backend & Edge:** Cloudflare Worker (`backend/CloudFlare.js`), Supabase PostgreSQL, Supabase Storage (`client-reflections`)
- **AI Engine:** Async decoupled generation, Zod schema validation (`lib/ai/schemas.ts`)
- **Clinical Governance:** TGA SaMD compliance, APP 8 Data Sovereignty, PostgreSQL RLS, Postgres immutability triggers (`immutability_lock`), and `status_audit_log` tracking.

---

## 2. Phased Pipeline Execution Flow
┌────────────────────────────────────────────────────────────────────────┐

│ PHASE 1: RAPID FEATURE & UX DEVELOPMENT (DEV / TROUBLESHOOT MODE) │

│ Task 1: Clinician Modality Selector ──► Task 2: Client Worksheet View │

│ Task 3: Decoupled AI Generation Engine ──► Task 4: Asset Library Sync │

└──────────────────────────────────┬─────────────────────────────────────┘

│ (When UI & workflows are verified)

▼

┌────────────────────────────────────────────────────────────────────────┐

│ PHASE 2: PRE-PRODUCTION SECURITY HARDENING & LOCK-DOWN │

│ Task 5: Edge Security & RLS Hardening ──► Task 6: Atomic Audit & Storage│

└────────────────────────────────────────────────────────────────────────┘

### Verification Gates
- **Phase 1 (Dev Mode):**
  1. `npx tsc --noEmit`
  2. `npm test`
- **Phase 2 (Pre-Deploy Lockdown):**
  1. `npx tsc --noEmit`
  2. `npm test`
  3. `npm run docs:check`

---

## 3. Module Specifications

### PHASE 1: Rapid Feature & UX Development (Active Sprint)

#### Module 1: Front-End Clinical Workflow & Client UX
* **1.1 Clinician Modality Selection (`components/modality-selector.tsx`) — [COMPLETED]**
  * Clinicians can toggle up to 3 therapeutic modalities (`ACT`, `CBT`, `DBT`) before worksheet generation.
  * Defaults strictly to `CBT` to reduce friction while leaving final override authority with clinician.
  * Strict canonical upper-casing (`"CBT" | "ACT" | "DBT"`) and `Set` deduplication prevents selection counter mismatch.
* **1.2 Client-Facing Worksheet Constraints (`components/client-view.tsx`, `components/tasks/DynamicTaskForm.tsx`, `components/tasks/TwoChoiceWorksheetForm.tsx`) — [COMPLETED]**
  * Constrains client interface strictly to **one interactive worksheet at a time** to prevent cognitive overload.
  * Formats dual-choice worksheets with exactly two response options per prompt, plus a persistent free-form reflection area (`components/tasks/ReflectionField.tsx`).
* **1.3 Out-of-Session Care & Touchpoints — [IN PROGRESS]**
  * Add notification / email reminder touchpoints targeting uncompleted homework assignments.
* **1.4 Centralised Asset Library Integration — [COMPLETED]**
  * Connected AI generation pipeline to modality-tagged asset library in Supabase for consistent clinical output and searchability.

#### Module 2: Decoupled AI Generation Engine & Schemas — [COMPLETED]
* **Objective:** Ensure robust, structured LLM outputs without blocking local client testing.
* **Scope:**
  * Enforce strict Zod schema validation (`lib/ai/schemas.ts`) for `weekly_activity_schedule`, `three_cs`, `dual_choice`, and `reflection_prompt` via `/generate/structured-task`.
  * Sanitise reasoning LLM outputs by stripping `<think>...</think>` blocks in `stripMarkdown` to prevent JSON syntax errors.
  * Added fallback circuit breakers (`?allowDegraded=1`) returning clean fallback contracts without corrupting database drafts.
  * Enforced client-side PII de-identification (`lib/deidentify.ts`) prior to payload submission for clinical privacy (APP 8).

#### Module 3: Key Management & Local Dev Bypasses — [COMPLETED]
* **Objective:** Prevent security secrets from interrupting local development and feature testing.
* **Scope:**
  * Support a local `DEV_AUTH_BYPASS` flag / service key fallback in `backend/CloudFlare.js` for unblocked local UI testing.
  * Implement dual-key rotation for `CLIENT_LINK_SECRET` (`CURRENT_SECRET` and `PREVIOUS_SECRET`) with a 30-day TTL clamp.

---

### PHASE 2: Pre-Production Security Hardening (Deferred to Release)

#### Module 4: Edge Security & RLS Compliance Hardening
* **Objective:** Eliminate service role key bypasses for client CRUD operations in production.
* **Scope:**
  * Pass JWT authorization headers directly to Supabase PostgREST endpoints.
  * Enforce database Row Level Security (`auth.uid() = practitioner_id`) natively at the Postgres level.
  * Restrict `SUPABASE_SERVICE_ROLE_KEY` strictly to background system workers and webhooks.

#### Module 5: Atomic Audit Logging & Transactional Storage
* **Objective:** Guarantee legally defensible clinical audit trails and prevent orphaned BLOB files.
* **Scope:**
  * Convert task approvals into an atomic Postgres RPC function (`approve_task_submission`).
  * Implement transactional upload handling in `/reflections/upload` (insert pending record before storage write).
  * Add scheduled cleanup worker for unlinked storage artifacts.

---

## 4. Verification & Status Log

| Date | Verification Step | Command | Status | Notes |
| --- | --- | --- | --- | --- |
| 2026-10-10 | TypeScript compilation | `npx tsc --noEmit` | PASS | Exit 0 — zero type errors |
| 2026-10-10 | Test suite execution | `npm test` | PASS | All 61 checks green (worker, PDF, hydration) |
| 2026-10-10 | Documentation compliance | `npm run docs:check` | PASS | Exit 0 — `documentation.md` in sync |
| 2026-10-10 | Cloudflare Worker Deployment | `npx wrangler deploy` | DEPLOYED | Version ID: `54c03287-95c4-43fe-be7f-134409664e1c` |