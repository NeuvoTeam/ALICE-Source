# ALICE — Project Brief

## Core Mission
ALICE is an AI-assisted clinical workspace for mental-health clinicians, featuring a guarded practitioner dashboard and a token-free, read-only client-facing surface for assigned clinical materials.

## Domain Model & Hierarchy
A strict 3-level hierarchy per clinician:
Client -> Case (named formulation) -> Session (session notes, analysis, vignette, homework, quiz, practice package, modality).

## Non-Negotiable Guardrails
1. **Frontend Isolation:** The Next.js frontend never connects directly to Supabase. All browser network traffic routes through the Cloudflare Worker API.
2. **Access Control:** Every clinician route requires a valid Supabase bearer token (`requireUser`). Client-facing surfaces require an HMAC-SHA256 signed expiring link.
3. **Clinical Review:** No autonomous diagnostic generation; all clinical outputs require human-in-the-loop clinician review.
4. **Documentation Sync:** Every change to code, configuration, or data schema must update `documentation.md` in the same commit.