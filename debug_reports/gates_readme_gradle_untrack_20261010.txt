=== ALICE hygiene card t_25d97d78 - raw gate output on the post-change tree ===
=== host: 2026-10-10 17:14:39 AUSEST ===

=== $ npx tsc --noEmit ===
exit=0

=== $ npm test ===

> my-project@0.1.0 test
> node tests/worker.test.mjs && node tests/pdf-export.test.mjs && node tests/hydration-guard.test.mjs

REQUEST POST /analyze/session
PASS  1 analyze: JSON mode + reasoning_effort=low, single call
REQUEST POST /analyze/session
Groq retry: invalid_json (contract=analyze, model=openai/gpt-oss-120b, finish_reason=stop, length=74) — retrying once at temperature 0
PASS  2 analyze: invalid JSON recovered by one temperature-0 retry
REQUEST POST /analyze/session
Groq retry: invalid_json (contract=analyze, model=openai/gpt-oss-120b, finish_reason=stop, length=74) — retrying once at temperature 0
Groq parse error: The model returned content that could not be parsed as JSON (model=openai/gpt-oss-120b, reason=invalid_json, attempts=2, finish_reason=stop) Expected double-quoted property name in JSON at position 73 (line 1 column 74) sample="{\"rationale\":\"Real formulation.\",\"inferredModality\":\"CBT\",\"riskFlags\":[],}"
PASS  3 analyze: 502 BAD_AI_RESPONSE + reason/parseError  Expected double-quoted property name in JSON at position 73 (line 1 column 74)
REQUEST POST /analyze/session
Groq warning: completion hit the token limit (model=openai/gpt-oss-120b)
Groq retry: truncated (contract=analyze, model=openai/gpt-oss-120b, finish_reason=length, length=70) — retrying once at temperature 0
PASS  4 analyze: truncation retried with max_completion_tokens=4096
REQUEST POST /analyze/session
Groq warning: completion hit the token limit (model=openai/gpt-oss-120b)
Groq retry: truncated (contract=analyze, model=openai/gpt-oss-120b, finish_reason=length, length=70) — retrying once at temperature 0
Groq warning: completion hit the token limit (model=openai/gpt-oss-120b)
Groq parse error: The model's answer was cut off before the JSON was complete (model=openai/gpt-oss-120b, reason=truncated, attempts=2, finish_reason=length) the completion hit the token limit before the JSON closed sample="{\"homework\":[\"Log mood daily\"],\"scenario\":{\"title\":\"Performance review"
PASS  5 analyze: 502 AI_TRUNCATED (not BAD_AI_RESPONSE)
REQUEST POST /generate/practice-package
Groq retry: invalid_json (contract=practice-package, model=openai/gpt-oss-120b, finish_reason=stop, length=74) — retrying once at temperature 0
Groq parse error: The model returned content that could not be parsed as JSON (model=openai/gpt-oss-120b, reason=invalid_json, attempts=2, finish_reason=stop) Expected double-quoted property name in JSON at position 73 (line 1 column 74) sample="{\"rationale\":\"Real formulation.\",\"inferredModality\":\"CBT\",\"riskFlags\":[],}"
REQUEST POST /generate/practice-package
Groq warning: completion hit the token limit (model=openai/gpt-oss-120b)
Groq retry: truncated (contract=practice-package, model=openai/gpt-oss-120b, finish_reason=length, length=70) — retrying once at temperature 0
Groq warning: completion hit the token limit (model=openai/gpt-oss-120b)
Groq parse error: The model's answer was cut off before the JSON was complete (model=openai/gpt-oss-120b, reason=truncated, attempts=2, finish_reason=length) the completion hit the token limit before the JSON closed sample="{\"homework\":[\"Log mood daily\"],\"scenario\":{\"title\":\"Performance review"
PASS  6 package: 502 and degraded 200 both carry a truthful code
REQUEST POST /analyze/session
Groq retry: invalid_json (contract=analyze, model=openai/gpt-oss-120b, finish_reason=stop, length=74) — retrying once at temperature 0
Groq error: GROQ ERROR 429 Rate limit reached (model=openai/gpt-oss-120b)
PASS  7 analyze: retry that 429s reports GROQ_ERROR
REQUEST GET /ai/probe
Groq retry: invalid_json (contract=practice-package, model=openai/gpt-oss-120b, finish_reason=stop, length=74) — retrying once at temperature 0
REQUEST GET /ai/probe
Groq retry: invalid_json (contract=practice-package, model=openai/gpt-oss-120b, finish_reason=stop, length=74) — retrying once at temperature 0
Groq parse error: The model returned content that could not be parsed as JSON (model=openai/gpt-oss-120b, reason=invalid_json, attempts=2, finish_reason=stop) Expected double-quoted property name in JSON at position 73 (line 1 column 74) sample="{\"rationale\":\"Real formulation.\",\"inferredModality\":\"CBT\",\"riskFlags\":[],}"
PASS  8 probe: reports attempts/reason/parse_error
REQUEST GET /ai/health
REQUEST POST /analyze/session
PASS  9 health + non-reasoning model: no JSON mode, no reasoning_effort
REQUEST POST /analyze/session
PASS  10 GROQ_MAX_TOKENS => max_completion_tokens
REQUEST POST /analyze/session
PASS  11 persistence: analyze writes sessions + session_versions
REQUEST POST /generate/practice-package
PASS  12 persistence: package writes practice_package
REQUEST POST /analyze/session
Groq retry: invalid_json (contract=analyze, model=openai/gpt-oss-120b, finish_reason=stop, length=74) — retrying once at temperature 0
Groq parse error: The model returned content that could not be parsed as JSON (model=openai/gpt-oss-120b, reason=invalid_json, attempts=2, finish_reason=stop) Expected double-quoted property name in JSON at position 73 (line 1 column 74) sample="{\"rationale\":\"Real formulation.\",\"inferredModality\":\"CBT\",\"riskFlags\":[],}"
REQUEST POST /generate/practice-package
Groq warning: completion hit the token limit (model=openai/gpt-oss-120b)
Groq retry: truncated (contract=practice-package, model=openai/gpt-oss-120b, finish_reason=length, length=70) — retrying once at temperature 0
Groq warning: completion hit the token limit (model=openai/gpt-oss-120b)
Groq parse error: The model's answer was cut off before the JSON was complete (model=openai/gpt-oss-120b, reason=truncated, attempts=2, finish_reason=length) the completion hit the token limit before the JSON closed sample="{\"homework\":[\"Log mood daily\"],\"scenario\":{\"title\":\"Performance review"
PASS  13 persistence: failed and degraded runs write nothing
REQUEST POST /generate/practice-package
Groq retry: bad_shape (contract=practice-package, model=openai/gpt-oss-120b, finish_reason=stop, length=57) — retrying once at temperature 0
PASS  14 package: a partial answer is retried and replaced, never filled with fallbacks
REQUEST POST /generate/practice-package
Groq retry: bad_shape (contract=practice-package, model=openai/gpt-oss-120b, finish_reason=stop, length=57) — retrying once at temperature 0
Groq parse error: The model's answer did not match the required JSON shape (model=openai/gpt-oss-120b, reason=bad_shape, attempts=2, finish_reason=stop) the JSON parsed but did not match the practice-package contract (keys: homework) sample="{\"homework\":[\"Complete the decatastrophizing worksheet\"]}"
PASS  15 package: unwrapped partial answer => 502 BAD_AI_SHAPE, no writes
REQUEST POST /analyze/session
Groq retry: bad_shape (contract=analyze, model=openai/gpt-oss-120b, finish_reason=stop, length=26) — retrying once at temperature 0
Groq parse error: The model's answer did not match the required JSON shape (model=openai/gpt-oss-120b, reason=bad_shape, attempts=2, finish_reason=stop) the JSON parsed but did not match the analyze contract (keys: inferredModality) sample="{\"inferredModality\":\"CBT\"}"
PASS  16 analyze: missing rationale/riskFlags => 502, never defaulted
REQUEST POST /analyze/session
Groq retry: bad_shape (contract=analyze, model=openai/gpt-oss-120b, finish_reason=stop, length=26) — retrying once at temperature 0
PASS  17 analyze: partial answer recovered by the retry
REQUEST POST /analyze/session
Groq error: GROQ ERROR 400 Invalid schema for response_format (model=openai/gpt-oss-120b)
Groq rejected the analyze JSON schema (400: Invalid schema for response_format) — falling back to json_object
PASS  18 schema rejection (400) degrades to json_object instead of failing
REQUEST POST /generate/practice-package
Groq error: GROQ ERROR 400 Generated JSON does not match the expected schema. jsonschema: '' does not validate with /required: missing properties: 'scenario', 'quiz' (model=openai/gpt-oss-120b)
Groq rejected the practice-package generation against the schema (400: Generated JSON does not match the expected schema. jsonschema: '' does not validate with /required: missing properties: 'scenario', 'quiz') — retrying with the schema
Groq retry: schema_mismatch (contract=practice-package, model=openai/gpt-oss-120b, finish_reason=n/a, length=0) — retrying once at temperature 0
PASS  19 schema mismatch 400 => retried with the schema, not downgraded
REQUEST POST /analyze/session
PASS  20 GROQ_RESPONSE_FORMAT=schema sends strict json_schema
REQUEST POST /analyze/session
PASS  21 GROQ_RESPONSE_FORMAT=json_object sends json_object
REQUEST POST /analyze/session
REQUEST GET /ai/probe
PASS  22 unescaped quote repaired without a retry (strategy=repaired)
REQUEST POST /generate/practice-package
PASS  23 nested unescaped quote repaired, package accepted
REQUEST GET /clients
REQUEST GET /clients
PASS  24 guard: missing and malformed tokens are 401, nothing upstream
REQUEST GET /clients
REQUEST PATCH /sessions/sess-1
PASS  25 guard: valid token 200, unauthenticated PATCH 401 with no write
PASS  26 guard: OPTIONS preflight is exempt
REQUEST GET /client-homework/session-0001
PASS  27 public /client-homework: signed link, no token, no clinical fields
REQUEST POST /auth/login
PASS  28 guard: auth routes remain public
REQUEST GET /client-link/session-0001
REQUEST GET /client-link/session-0001
REQUEST GET /client-homework/session-0001
PASS  29 links: minting is clinician-only and its link opens anonymously
REQUEST GET /client-link/session-0001
PASS  30 links: ttl clamped to 30 days when 9999 was requested
REQUEST GET /client-homework/session-0001
Client link rejected (missing) for session-…
REQUEST GET /client-homework/session-0001
Client link rejected (bad_signature) for session-…
REQUEST GET /client-homework/session-0001
Client link rejected (expired) for session-…
REQUEST GET /client-homework/session-0001
Client link rejected (bad_signature) for session-…
PASS  31 links: unsigned, tampered, expired, cross-session are all 403
REQUEST GET /client-link/session-0001
REQUEST GET /client-homework/session-0001
CLIENT_LINK_SECRET missing or too short — client links are disabled
Client link rejected (not_configured) for session-…
PASS  32 links: missing CLIENT_LINK_SECRET fails closed
REQUEST GET /client-homework/session-empty
PASS  33 regression: no cross-session disclosure via submissions fallback
REQUEST POST /generate/structured-task
PASS  34 structured-task: normalizes nested 3 C's output from LLM
REQUEST POST /generate/structured-task
PASS  35 structured-task: invalid request schema returns 400

35/35 checks passed
(node:22036) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///D:/Work/Neuvo/ALICE/Source/lib/export-practice-pdf.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to \\?\D:\Work\Neuvo\ALICE\Source\package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
PASS  1 geometry: 174 mm column, body stops at 275 mm, footer at 281 mm
PASS  2 sanitize: ☐ dropped, ⚠ and arrows mapped, Latin-1 accents kept
PASS  3 collect: string rows, { task } rows, blanks and a null package
PASS  4 short package: single-page PDF  6881 bytes
PASS  5 empty package: renders the empty-state copy on one page
PASS  6 25 tasks: multi-page, nothing dropped, all baselines inside the printable box  2 pages, deepest body line 262.4 mm
PASS  7 60 tasks: pagination scales  4 pages
PASS  8 6000-character task: hard-split across pages without overflow  75 lines
PASS  9 determinism: identical layout for identical input
PASS  10 footer: 'Page x of y' stamped on every page
PASS  11 filename: ALICE_PracticePackage_YYYYMMDD_ClientName.pdf  ALICE_PracticePackage_20260916_JaneMayLow.pdf
PASS  12 filename: accents folded, illegal characters dropped, capped, no invented segment

12/12 checks passed
(node:26528) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///D:/Work/Neuvo/ALICE/Source/lib/session-hydration.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to \\?\D:\Work\Neuvo\ALICE\Source\package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
PASS  1 guard: wait on the stub, keep when latched, hydrate when the payload lands
PASS  2 race: the GET /client/:id stub never latches
PASS  3 race: the payload rehydrates the notes, the analysis and Phase 3
PASS  4 later write cannot reset the phase or stomp edits
PASS  5 empty session: hydration completes on Phase 1
PASS  6 blur-save after Next keeps Phase 2 and the typed notes
PASS  7 Adjust -> Back -> blur-save stays on Phase 1 with the edits
PASS  8 placeholder advisory survives a later write
PASS  9 no advisory for a real formulation
PASS  10 failed GET /sessions/:id leaves an empty Phase 1
PASS  11 remount hydrates immediately
PASS  12 re-selecting the same session leaves the clinician where they were
PASS  13 losing the session clears local state and re-arms the latch
PASS  14 the cleared latch hydrates a returning session
PASS  15 counter-example: the pre-c902331 effect stuck on an empty Phase 1

15/15 checks passed
exit=0

=== $ npm run build ===

> my-project@0.1.0 build
> next build

▲ Next.js 16.2.4 (Turbopack)

  Creating an optimized production build ...
(node:15648) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
✓ Compiled successfully in 4.2s
  Skipping validation of types
  Finished TypeScript config validation in 11ms ...
  Collecting page data using 15 workers ...
  Generating static pages using 15 workers (0/10) ...
  Generating static pages using 15 workers (2/10) 
  Generating static pages using 15 workers (4/10) 
  Generating static pages using 15 workers (7/10) 
✓ Generating static pages using 15 workers (10/10) in 2.2s
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/analyze/session
├ ƒ /cases/[caseId]/sessions/[sessionId]
├ ○ /client-login
├ ○ /dashboard
├ ○ /forgot-password
├ ƒ /homework/[sessionId]
├ ○ /login
├ ƒ /practice/[sessionId]
├ ƒ /practitioner/tasks/[id]/review
├ ○ /signup
└ ○ /test-auth


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

exit=0

=== $ npm run lint ===

> my-project@0.1.0 lint
> eslint .


D:\Work\Neuvo\ALICE\Source\app\api\analyze\session\route.ts
   6:27  warning  'clientId' is assigned a value but never used  @typescript-eslint/no-unused-vars
  33:19  warning  Unexpected any. Specify a different type       @typescript-eslint/no-explicit-any

D:\Work\Neuvo\ALICE\Source\app\dashboard\page.tsx
  39:17  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  40:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

D:\Work\Neuvo\ALICE\Source\app\forgot-password\page.tsx
  63:42  warning  `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`  react/no-unescaped-entities

D:\Work\Neuvo\ALICE\Source\app\layout.tsx
  10:7  warning  'geistMono' is assigned a value but never used  @typescript-eslint/no-unused-vars

D:\Work\Neuvo\ALICE\Source\app\practice\[sessionId]\page.tsx
   11:13  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   45:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  124:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  276:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

D:\Work\Neuvo\ALICE\Source\app\practitioner\tasks\[id]\review\page.tsx
  1288:21  warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

D:\Work\Neuvo\ALICE\Source\app\practitioner\tasks\[id]\review\page.tsx:1288:21
  1286 |   }, [submissionId]);
  1287 |
> 1288 |   useEffect(() => { fetchBundle(); }, [fetchBundle]);
       |                     ^^^^^^^^^^^ Avoid calling setState() directly within an effect
  1289 |
  1290 |   const isLocked = bundle?.submission.status === "approved";
  1291 |   const readOnly  = isLocked;  react-hooks/set-state-in-effect

D:\Work\Neuvo\ALICE\Source\app\signup\page.tsx
  112:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

D:\Work\Neuvo\ALICE\Source\backend\CloudFlare.js
  190:1  warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export

D:\Work\Neuvo\ALICE\Source\components\ClientLanding.tsx
  19:15  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              @typescript-eslint/no-explicit-any
  20:17  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              @typescript-eslint/no-explicit-any
  89:5   warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

D:\Work\Neuvo\ALICE\Source\components\ClientLanding.tsx:89:5
  87 |
  88 |   useEffect(() => {
> 89 |     fetchClients();
     |     ^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  90 |   }, []);
  91 |
  92 |   const fetchClient = async (id: string) => {  react-hooks/set-state-in-effect

D:\Work\Neuvo\ALICE\Source\components\canvas\ReflectionCanvas.tsx
   49:3   warning  'Upload' is defined but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  @typescript-eslint/no-unused-vars
   67:3   warning  'drawBackground' is defined but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          @typescript-eslint/no-unused-vars
  244:48  warning  Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should only be accessed outside of render, such as in event handlers or effects. Accessing a ref value (the `current` property) during render can cause your component not to update as expected (https://react.dev/reference/react/useRef).

D:\Work\Neuvo\ALICE\Source\components\canvas\ReflectionCanvas.tsx:244:48
  242 |
  243 |   // Force re-render only for UI counters (undo/redo availability)
> 244 |   const [historyLen, setHistoryLen] = useState(strokesRef.current.length);
      |                                                ^^^^^^^^^^^^^^^^^^^^^^^^^ Passing a ref to a function may read its value during render
  245 |   const [redoLen,    setRedoLen]    = useState(0);
  246 |
  247 |   // ── Upload state ─────────────────────────────────────────────────────────                                                                                                                                                                                                                                                                                                         react-hooks/refs
  254:5   warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

D:\Work\Neuvo\ALICE\Source\components\canvas\ReflectionCanvas.tsx:254:5
  252 |   useEffect(() => {
  253 |     const mq = window.matchMedia("(prefers-color-scheme: dark)");
> 254 |     setIsDark(mq.matches);
      |     ^^^^^^^^^ Avoid calling setState() directly within an effect
  255 |     const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
  256 |     mq.addEventListener("change", handler);
  257 |     return () => mq.removeEventListener("change", handler);  react-hooks/set-state-in-effect
  489:9   warning  Expected an assignment or function call and instead saw an expression                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               @typescript-eslint/no-unused-expressions
  567:7   warning  React Hook useImperativeHandle has missing dependencies: 'clientId' and 'submissionId'. Either include them or remove the dependency array                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          react-hooks/exhaustive-deps

D:\Work\Neuvo\ALICE\Source\components\canvas\canvasUtils.ts
  119:9  warning  'prev' is assigned a value but never used  @typescript-eslint/no-unused-vars

D:\Work\Neuvo\ALICE\Source\components\client-view.tsx
  20:22  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            @typescript-eslint/no-explicit-any
  30:5   warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

D:\Work\Neuvo\ALICE\Source\components\client-view.tsx:30:5
  28 |
  29 |   useEffect(() => {
> 30 |     setIsLoading(true)
     |     ^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  31 |
  32 |     const fetchVignettes = async () => {
  33 |       try {  react-hooks/set-state-in-effect

D:\Work\Neuvo\ALICE\Source\components\dashboard-shell.tsx
  52:5  warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

D:\Work\Neuvo\ALICE\Source\components\dashboard-shell.tsx:52:5
  50 |   // Picking a client or a session is navigation and must close the drawer.
  51 |   useEffect(() => {
> 52 |     setDrawerOpen(false);
     |     ^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  53 |   }, [selectedClientId, selectedSessionId]);
  54 |
  55 |   const sidebar = (  react-hooks/set-state-in-effect

D:\Work\Neuvo\ALICE\Source\components\main-content.tsx
   26:17  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          @typescript-eslint/no-explicit-any
   29:3   warning  'activeTab' is defined but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             @typescript-eslint/no-unused-vars
   90:5   warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

D:\Work\Neuvo\ALICE\Source\components\main-content.tsx:90:5
  88 |
  89 |   useEffect(() => {
> 90 |     fetchVignettes();
     |     ^^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  91 |   }, [client.id, selectedSessionId]);
  92 |
  93 |   return (  react-hooks/set-state-in-effect
   91:6   warning  React Hook useEffect has a missing dependency: 'fetchVignettes'. Either include it or remove the dependency array                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 react-hooks/exhaustive-deps
  194:1   warning  Expected an assignment or function call and instead saw an expression                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             @typescript-eslint/no-unused-expressions

D:\Work\Neuvo\ALICE\Source\components\sidebar\CaseNode.tsx
  108:1  warning  Expected an assignment or function call and instead saw an expression  @typescript-eslint/no-unused-expressions

D:\Work\Neuvo\ALICE\Source\components\sidebar\ClientNode.tsx
  57:1  warning  Expected an assignment or function call and instead saw an expression  @typescript-eslint/no-unused-expressions

D:\Work\Neuvo\ALICE\Source\components\sidebar\EditableName.tsx
  14:10  warning  'loading' is assigned a value but never used  @typescript-eslint/no-unused-vars

D:\Work\Neuvo\ALICE\Source\components\tasks\DynamicTaskForm.tsx
  109:17  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            @typescript-eslint/no-explicit-any
  345:7   warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

D:\Work\Neuvo\ALICE\Source\components\tasks\DynamicTaskForm.tsx:345:7
  343 |   useEffect(() => {
  344 |     if (externalSubmissionId) {
> 345 |       setSubmissionId(externalSubmissionId);
      |       ^^^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  346 |     }
  347 |   }, [externalSubmissionId]);
  348 |   const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");  react-hooks/set-state-in-effect
  461:5   warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

D:\Work\Neuvo\ALICE\Source\components\tasks\DynamicTaskForm.tsx:461:5
  459 |   useEffect(() => {
  460 |     if (!persist) return;
> 461 |     triggerAutoSave();
      |     ^^^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  462 |     return () => {
  463 |       if (debounceRef.current) clearTimeout(debounceRef.current);
  464 |     };                                            react-hooks/set-state-in-effect

D:\Work\Neuvo\ALICE\Source\components\tasks\ThreeCsForm.tsx
  314:50  warning  `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`  react/no-unescaped-entities

D:\Work\Neuvo\ALICE\Source\components\ui\carousel.tsx
  98:5  warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

D:\Work\Neuvo\ALICE\Source\components\ui\carousel.tsx:98:5
   96 |   React.useEffect(() => {
   97 |     if (!api) return
>  98 |     onSelect(api)
      |     ^^^^^^^^ Avoid calling setState() directly within an effect
   99 |     api.on('reInit', onSelect)
  100 |     api.on('select', onSelect)
  101 |  react-hooks/set-state-in-effect

D:\Work\Neuvo\ALICE\Source\components\ui\sidebar.tsx
  611:26  warning  Error: Cannot call impure function during render

`Math.random` is an impure function. Calling an impure function can produce unstable results that update unpredictably when the component happens to re-render. (https://react.dev/reference/rules/components-and-hooks-must-be-pure#components-and-hooks-must-be-idempotent).

D:\Work\Neuvo\ALICE\Source\components\ui\sidebar.tsx:611:26
  609 |   // Random width between 50 to 90%.
  610 |   const width = React.useMemo(() => {
> 611 |     return `${Math.floor(Math.random() * 40) + 50}%`
      |                          ^^^^^^^^^^^^^ Cannot call impure function
  612 |   }, [])
  613 |
  614 |   return (  react-hooks/purity

D:\Work\Neuvo\ALICE\Source\components\vignette-generator.tsx
   28:10  warning  'generateStructuredTask' is defined but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       @typescript-eslint/no-unused-vars
   40:14  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
   47:7   warning  'getDefaultActivity' is assigned a value but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  @typescript-eslint/no-unused-vars
   54:36  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
   64:32  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  132:10  warning  'sessionContext' is assigned a value but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      @typescript-eslint/no-unused-vars
  132:26  warning  'setSessionContext' is assigned a value but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   @typescript-eslint/no-unused-vars
  134:62  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  135:10  warning  'reflectionPrompt' is assigned a value but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    @typescript-eslint/no-unused-vars
  135:28  warning  'setReflectionPrompt' is assigned a value but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 @typescript-eslint/no-unused-vars
  135:60  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  154:7   warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

D:\Work\Neuvo\ALICE\Source\components\vignette-generator.tsx:154:7
  152 |     if (!session) {
  153 |       hydratedSessionRef.current = null
> 154 |       setDegradedWarning(null)
      |       ^^^^^^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  155 |       setStep(1)
  156 |       setSessionInput("")
  157 |       setAnalysis(null)  react-hooks/set-state-in-effect
  211:46  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  239:14  warning  'err' is defined but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          @typescript-eslint/no-unused-vars
  407:46  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  417:37  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  418:39  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  495:46  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  504:37  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  505:39  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any
  672:44  warning  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 @typescript-eslint/no-explicit-any

D:\Work\Neuvo\ALICE\Source\hooks\use-clinical-workspace.ts
  33:5  warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

D:\Work\Neuvo\ALICE\Source\hooks\use-clinical-workspace.ts:33:5
  31 |     if (selectedClientId && findClient(hierarchy, selectedClientId)) return
  32 |     const c = hierarchy.clients[0]
> 33 |     setSelectedClientId(c.id)
     |     ^^^^^^^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  34 |     setSelectedCaseId(c.cases[0]?.id ?? null)
  35 |     setSelectedSessionId(c.cases[0]?.sessions[0]?.id ?? null)
  36 |   }, [hierarchy, selectedClientId])  react-hooks/set-state-in-effect

D:\Work\Neuvo\ALICE\Source\hooks\use-mobile.ts
  14:5  warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

D:\Work\Neuvo\ALICE\Source\hooks\use-mobile.ts:14:5
  12 |     }
  13 |     mql.addEventListener('change', onChange)
> 14 |     setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
     |     ^^^^^^^^^^^ Avoid calling setState() directly within an effect
  15 |     return () => mql.removeEventListener('change', onChange)
  16 |   }, [])
  17 |  react-hooks/set-state-in-effect

D:\Work\Neuvo\ALICE\Source\hooks\use-toast.ts
  18:7  warning  'actionTypes' is assigned a value but only used as a type  @typescript-eslint/no-unused-vars

D:\Work\Neuvo\ALICE\Source\stores\useClientNavStore.ts
  113:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  119:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  125:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  152:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  191:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  195:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  263:60  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  271:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  303:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  334:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  358:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  382:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  407:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  420:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  438:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  467:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  500:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  539:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  581:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  589:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

D:\Work\Neuvo\ALICE\Source\tests\worker.test.mjs
  13:10  warning  'copyFile' is defined but never used  @typescript-eslint/no-unused-vars

D:\Work\Neuvo\ALICE\Source\workers\mcp-gateway\src\index.ts
    1:1   warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export
    2:34  warning  Unexpected any. Specify a different type                        @typescript-eslint/no-explicit-any
   48:21  warning  Unexpected any. Specify a different type                        @typescript-eslint/no-explicit-any
  107:59  warning  Unexpected any. Specify a different type                        @typescript-eslint/no-explicit-any
  186:21  warning  Unexpected any. Specify a different type                        @typescript-eslint/no-explicit-any
  218:21  warning  Unexpected any. Specify a different type                        @typescript-eslint/no-explicit-any

✖ 91 problems (0 errors, 91 warnings)

exit=0

=== JOB 2 - untrack the remaining .gradle build output =======================

$ git ls-files .gradle            # BEFORE
.gradle/9.2.0/checksums/checksums.lock
.gradle/9.2.0/fileChanges/last-build.bin
.gradle/9.2.0/fileHashes/fileHashes.bin
.gradle/9.2.0/fileHashes/fileHashes.lock
.gradle/buildOutputCleanup/buildOutputCleanup.lock
.gradle/buildOutputCleanup/cache.properties
-> tracked .gradle paths BEFORE: 6

$ git check-ignore -v .gradle/9.2.0/checksums/checksums.lock .gradle/buildOutputCleanup/cache.properties .gradle   # BEFORE
(no output, exit 1)
-> .gradle/ was NOT covered by .gitignore, .git/info/exclude or any other ignore file

$ find .gradle -type f            # the whole .gradle tree on disk, BEFORE
        17  .gradle/9.2.0/checksums/checksums.lock
         1  .gradle/9.2.0/fileChanges/last-build.bin
     18547  .gradle/9.2.0/fileHashes/fileHashes.bin
        17  .gradle/9.2.0/fileHashes/fileHashes.lock
        17  .gradle/buildOutputCleanup/buildOutputCleanup.lock
        54  .gradle/buildOutputCleanup/cache.properties
-> nothing else lives under .gradle/: no gradle.properties, no gradlew, no gradle/wrapper/

$ head -c 16 <each file> | od -An -tx1    # per-file type proof
.gradle/9.2.0/checksums/checksums.lock              03 31 a1 d7 55 3b 57 36 f5 00 00 00 00 00 00 00
.gradle/9.2.0/fileChanges/last-build.bin            00
.gradle/9.2.0/fileHashes/fileHashes.bin             44 00 00 18 10 ff ff ff ff ff ff ff ff 00 00 00
.gradle/9.2.0/fileHashes/fileHashes.lock            03 f5 cf 10 2d 90 3f 53 9e 00 00 00 00 00 00 00
.gradle/buildOutputCleanup/buildOutputCleanup.lock  03 0a cd 2b 74 a4 eb fe c6 00 00 00 00 00 00 00
.gradle/buildOutputCleanup/cache.properties         "#Sun Sep 27 12:01:31 AEST 2026" / gradle.version=9.2.0
-> three binary lock files, two binary hash/change bins (one 1 byte), plus Gradle's own
   generated cache.properties. None is authored configuration, a wrapper or gradle.properties.
-> nothing was left tracked: the whole set is plain build output.

$ git rm --cached <the six paths>      # index only; working tree untouched
rm '.gradle/9.2.0/checksums/checksums.lock'
rm '.gradle/9.2.0/fileChanges/last-build.bin'
rm '.gradle/9.2.0/fileHashes/fileHashes.bin'
rm '.gradle/9.2.0/fileHashes/fileHashes.lock'
rm '.gradle/buildOutputCleanup/buildOutputCleanup.lock'
rm '.gradle/buildOutputCleanup/cache.properties'

$ .gitignore   # added (it was not covered before)
# Gradle build output (Gradle's own project cache; never committed)
.gradle/

$ find .gradle -type f             # AFTER - all six still on disk, unchanged sizes
        17  .gradle/9.2.0/checksums/checksums.lock
         1  .gradle/9.2.0/fileChanges/last-build.bin
     18547  .gradle/9.2.0/fileHashes/fileHashes.bin
        17  .gradle/9.2.0/fileHashes/fileHashes.lock
        17  .gradle/buildOutputCleanup/buildOutputCleanup.lock
        54  .gradle/buildOutputCleanup/cache.properties

$ git check-ignore -v .gradle/9.2.0/gc.properties .gradle/9.2.0/checksums/checksums.lock .gradle/buildOutputCleanup/cache.properties .gradle   # AFTER
.gitignore:28:.gradle/	.gradle/9.2.0/gc.properties
.gitignore:28:.gradle/	.gradle/9.2.0/checksums/checksums.lock
.gitignore:28:.gradle/	.gradle/buildOutputCleanup/cache.properties
.gitignore:28:.gradle/	.gradle/

$ git ls-files .gradle             # AFTER
(empty)
-> tracked .gradle paths AFTER: 0

$ git status --porcelain           # immediately after `git rm --cached` + .gitignore edit, before commit B
 M .gitignore
D  .gradle/9.2.0/checksums/checksums.lock
D  .gradle/9.2.0/fileChanges/last-build.bin
D  .gradle/9.2.0/fileHashes/fileHashes.bin
D  .gradle/9.2.0/fileHashes/fileHashes.lock
D  .gradle/buildOutputCleanup/buildOutputCleanup.lock
D  .gradle/buildOutputCleanup/cache.properties
?? scratch/
-> the six entries are the staged index removals (they disappear from `git status` once
   committed, because the on-disk copies are now ignored). `scratch/` is a pre-existing
   untracked directory that this card did not touch.

=== POST-COMMIT STATE ========================================================

$ git log --oneline -3
0fd1458 chore(repo): untrack the remaining .gradle build output
9cf92d4 docs(repo): add a short README front door
3a106cf docs(lint): triage the 91-warning baseline into a classified register + fix plan

$ git log --oneline --name-status -2       # the two card commits
0fd1458 chore(repo): untrack the remaining .gradle build output
M	.gitignore
D	.gradle/9.2.0/checksums/checksums.lock
D	.gradle/9.2.0/fileChanges/last-build.bin
D	.gradle/9.2.0/fileHashes/fileHashes.bin
D	.gradle/9.2.0/fileHashes/fileHashes.lock
D	.gradle/buildOutputCleanup/buildOutputCleanup.lock
D	.gradle/buildOutputCleanup/cache.properties
A	debug_reports/gates_readme_gradle_untrack_20261010.txt
M	documentation.md
9cf92d4 docs(repo): add a short README front door
A	README.md
M	documentation.md

  Note on the hashes: this evidence file is folded into the second commit with
  `git commit --amend --no-edit`, so the hash 0fd1458 printed above is superseded
  by the amended tip. The FINAL hashes of both commits are recorded on card
  t_25d97d78 (the amend changes only the second commit's hash, not its content or
  its message).

$ git status --porcelain
?? scratch/
  -> only the pre-existing untracked `scratch/` directory remains. None of the six
     .gradle paths appear: the index removals are committed, and their on-disk
     copies are ignored by `.gitignore` line 28.

$ git ls-files .gradle
(empty)
  -> tracked .gradle paths: 0

$ find .gradle -type f                      # the commit did not touch the working tree
        17  .gradle/9.2.0/checksums/checksums.lock
         1  .gradle/9.2.0/fileChanges/last-build.bin
     18547  .gradle/9.2.0/fileHashes/fileHashes.bin
        17  .gradle/9.2.0/fileHashes/fileHashes.lock
        17  .gradle/buildOutputCleanup/buildOutputCleanup.lock
        54  .gradle/buildOutputCleanup/cache.properties

$ ls -la README.md
-rw-r--r-- 1 kuroi 197615 1732 Oct 10 17:13 README.md

$ git rev-parse HEAD                        # before folding this file in (pre-amend)
0fd14583f4f838599a40f09e564ab2a1e4ac4e9b

$ git ls-remote --heads origin alan         # the published tip, as measured
c6021602881baf5c69137579a4ac58ece7717966	refs/heads/alan

$ git rev-list --count origin/alan..HEAD
19

$ git branch -vv
* alan   0fd1458 [origin/alan: ahead 19] chore(repo): untrack the remaining .gradle build output
  main   5a4b7cc [origin/main] Merge branch 'debug'
  master 5a51e40 [origin/master] adjusted agents.md and added cursorrules

  -> Nothing was pushed by this card. The branch was ALREADY 17 commits ahead of
     origin/alan when the card started: origin/alan resolves to c6021602, which is
     an ancestor of the previous tip 3a106cf (`git merge-base --is-ancestor` exits
     0; `git rev-list --count c6021602..3a106cf` = 17). The card expected a freshly
     pushed tip, so the measured ahead count is 19, not 2. Recorded, not acted on.

  -> Side note (not part of either commit): `npm run build` rewrites the tracked,
     Next-generated `next-env.d.ts` (its import flips from
     `./.next/dev/types/routes.d.ts` to `./.next/types/routes.d.ts`). That churn was
     reverted with `git checkout -- next-env.d.ts` so the tree ends clean.
