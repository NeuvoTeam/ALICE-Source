# ALICE — System Patterns & Architecture

## Runtime Architecture
- **Tier 1 (Browser):** Next.js 16 (App Router), React Server Components, Zustand (`useClientNavStore.ts`), Tailwind CSS v4. Communicates solely via `CLINICAL_AI_API_BASE` using `apiFetch`.
- **Tier 2 (Edge Proxy):** Cloudflare Worker (`clinical-ai-backend` / `backend/CloudFlare.js`). Holds service-role credentials and proxies all PostgREST/GoTrue operations.
- **Tier 3 (Data & AI):** Supabase (PostgreSQL + Auth) and Groq API (`openai/gpt-oss-120b`).
- **MCP Gateway:** Cloudflare Worker (`alice-mcp` / `workers/mcp-gateway/`) connecting agents to backend service bindings.

## Critical Patterns & Conventions
- **Route Ordering in Worker:** When adding new `POST` handlers in `backend/CloudFlare.js`, they must be declared above the catch-all AI route block (`if (method === "POST")`) to avoid parameter errors.
- **Case Mapping:** Database rows use `snake_case`; frontend application state strictly uses `camelCase`. Conversions occur exclusively at normalisation boundaries (`normalizeSession`, `normalizeClientTree`, `formatSessionRow`).
- **Client Link Signing:** URL verification uses `crypto.subtle.verify` with HMAC-SHA256 over `v1|<sessionId>|<exp>`, failing closed on missing or weak secrets.
- **Session Hydration:** Latch hydration with `useRef` and key on `sessionHydratedId` to prevent race conditions during session selection.