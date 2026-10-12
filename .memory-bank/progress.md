# ALICE — Progress & Gaps

## What Works
- [x] Clinician authentication (Supabase GoTrue via Worker proxy)
- [x] Client/Case/Session navigation and optimistic Zustand state management
- [x] 3-phase AI workflow (session notes -> analysis -> structured task generation)
- [x] Signed client links with HMAC-SHA256 for public practice worksheets
- [x] Automated documentation gate (`scripts/check-docs.mjs` / `npm run docs:check`)

## Open Items & Known Gaps (from documentation.md §13)
- [ ] Rotate historical Supabase service-role JWT from git history
- [ ] Implement Row Level Security (RLS) / least-privilege reads for cross-tenant clinician boundaries
- [ ] Add ownership validation for `POST /client/worksheet`
- [ ] Implement refresh-token flow for seamless token rotation
- [ ] Reconcile duplicate client state models (`useClientNavStore` vs `clinical-hierarchy.ts`)