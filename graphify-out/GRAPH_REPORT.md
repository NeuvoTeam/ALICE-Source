# Graph Report - Source  (2026-10-12)

## Corpus Check
- 327 files · ~695,662 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: (none) 6, .log 5, .err 2)

## Summary
- 1284 nodes · 2890 edges · 95 communities (62 shown, 33 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 188 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e28b6c23`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- review/page.tsx
- useClientNavStore.ts
- CloudFlare.js
- ReflectionCanvas.tsx
- submissions/page.tsx
- dependencies
- cn
- export-practice-pdf.ts
- worker.test.mjs
- use-toast.ts
- clinical-hierarchy.ts
- form.tsx
- package.json
- command.tsx
- field.tsx
- apiFetch
- compilerOptions
- utils.ts
- pagination.tsx
- components.json
- context-menu.tsx
- menubar.tsx
- DynamicTaskForm.tsx
- check-docs.mjs
- vignette-generator.tsx
- class-variance-authority
- react
- types/tasks.ts
- dashboard/page.tsx
- dashboard-sidebar.tsx
- chart.tsx
- drawer.tsx
- ClientLanding
- devDependencies
- scripts
- navigation-menu.tsx
- schemas.ts
- practice/[sessionId]/page.tsx
- main-content.tsx
- ALICE — System Documentation
- tooltip.tsx
- sheet.tsx
- input-otp.tsx
- public.worksheet_submissions
- fetch
- fmtAuditActor
- collapsible.tsx
- accordion.tsx
- 20261011_task_submissions_queue.sql
- alert.tsx
- dispatch-inbox.ps1
- mcp-gateway/package.json
- theme-provider.tsx
- aspect-ratio.tsx
- eslint.config.mjs
- practice_task_submissions_session_unique
- supabase.ts
- next.config.mjs
- postcss.config.mjs
- mcp.json
- tools.ts
- VignetteGenerator
- dropdown-menu.tsx
- POST
- 13. Known gaps & open items
- respond
- lucide-react
- empty.tsx
- generateJson
- 5.5 AI routes
- 11. Conventions & guardrails
- patchSessionRow
- GEMINI.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 277 edges
2. `react` - 79 edges
3. `apiFetch()` - 40 edges
4. `lucide-react` - 39 edges
5. `fetch()` - 38 edges
6. `Button()` - 28 edges
7. `VignetteGenerator()` - 26 edges
8. `13.4 Tooling and process gaps` - 25 edges
9. `DynamicTaskForm()` - 24 edges
10. `useClientNavStore` - 24 edges

## Surprising Connections (you probably didn't know these)
- `2. Architectural Invariants (do not violate without written human instruction)` --references--> `POST()`  [INFERRED]
  .hermes.md → app/api/analyze/session/route.ts
- `13.4 Tooling and process gaps` --references--> `Env`  [INFERRED]
  documentation.md → workers/mcp-gateway/src/index.ts
- `4.7 Client-facing material pages (public)` --references--> `DynamicTaskForm()`  [INFERRED]
  documentation.md → components/tasks/DynamicTaskForm.tsx
- `6.4 `form_data` JSONB shapes on `practice_task_submissions`` --references--> `DynamicTaskForm()`  [INFERRED]
  documentation.md → components/tasks/DynamicTaskForm.tsx
- `13.10 Closed — Phase 2 schema applied and verified (2026-10-12)` --references--> `fmtAuditActor()`  [INFERRED]
  documentation.md → lib/audit-actor.ts

## Import Cycles
- None detected.

## Communities (95 total, 33 thin omitted)

### Community 0 - "review/page.tsx"
Cohesion: 0.14
Nodes (17): ActivityLogPanel(), ApproveDialogProps, BehaviouralExperimentPanel(), DataGrid(), Day, DAYS, DecisionBarProps, moodColour() (+9 more)

### Community 1 - "useClientNavStore.ts"
Cohesion: 0.14
Nodes (18): getServerSnapshot(), getSnapshot(), subscribe(), useIsMobile(), DynamicTaskInitialData, isTaskVariant(), 13.4 Tooling and process gaps, zustand (+10 more)

### Community 2 - "CloudFlare.js"
Cohesion: 0.10
Nodes (34): ACTIVITY_LOG_SCHEMA, ANALYSIS_SCHEMA, base64UrlFromBytes(), base64UrlToBytes(), buildClientPayload(), captureDebug(), CLIENT_PRACTICE_TASK_FIELDS, CLIENT_SUBMISSION_ALLOWED_TASK_TYPES (+26 more)

### Community 3 - "ReflectionCanvas.tsx"
Cohesion: 0.09
Nodes (51): BACKGROUND_OPTIONS, BackgroundOption, BackgroundType, CanvasVectorData, DrawTool, EXPORT_MAX_SIZE_BYTES, EXPORT_MAX_WIDTH_PX, EXPORT_MIME (+43 more)

### Community 4 - "submissions/page.tsx"
Cohesion: 0.09
Nodes (44): Dashboard(), PractitionerSubmissionsPage(), ReviewQueueContent(), TabConfig, TABS, PractitionerReviewPage(), TestAuth(), test() (+36 more)

### Community 5 - "dependencies"
Cohesion: 0.04
Nodes (53): dependencies, autoprefixer, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, @hookform/resolvers (+45 more)

### Community 6 - "cn"
Cohesion: 0.10
Nodes (25): Skeleton(), Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList() (+17 more)

### Community 7 - "export-practice-pdf.ts"
Cohesion: 0.10
Nodes (39): A4, addPage(), buildPracticePackageFileName(), buildPracticePackagePdf(), collectHomeworkTasks(), COLORS, Cursor, downloadPracticePackagePdf() (+31 more)

### Community 8 - "worker.test.mjs"
Cohesion: 0.12
Nodes (21): esbuild, authCalls(), call(), calls, env, groqCalls(), groqSteps, inAnHour() (+13 more)

### Community 9 - "use-toast.ts"
Cohesion: 0.10
Nodes (28): geist, geistMono, metadata, RootLayout(), Toast, ToastAction, ToastActionElement, ToastClose (+20 more)

### Community 10 - "clinical-hierarchy.ts"
Cohesion: 0.15
Nodes (30): ClinicalWorkspace, useClinicalWorkspace(), 8.3 The local-only hierarchy (parallel model — do not confuse with the store), addCase(), addClient(), addSession(), appendSessionAnalysis(), appendSessionWorksheet() (+22 more)

### Community 11 - "form.tsx"
Cohesion: 0.08
Nodes (29): ReflectionField(), ReflectionFieldProps, TwoChoiceData, TwoChoiceWorksheetForm(), TwoChoiceWorksheetFormProps, FieldLabel(), FormControl(), FormDescription() (+21 more)

### Community 12 - "package.json"
Cohesion: 0.08
Nodes (23): name, private, version, autoprefixer, date-fns, embla-carousel-react, @hookform/resolvers, postcss (+15 more)

### Community 13 - "command.tsx"
Cohesion: 0.14
Nodes (18): Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut() (+10 more)

### Community 14 - "field.tsx"
Cohesion: 0.09
Nodes (24): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLegend(), FieldSeparator(), FieldSet() (+16 more)

### Community 15 - "apiFetch"
Cohesion: 0.18
Nodes (15): ApproveDialog(), DecisionBar(), handleApprove(), handleRevision(), ImmutabilityBanner(), LabelEditor(), save(), normalizeAuditEntry() (+7 more)

### Community 16 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 17 - "utils.ts"
Cohesion: 0.11
Nodes (12): HoverCardContent(), ResizableHandle(), ResizablePanelGroup(), ScrollArea(), ScrollBar(), Switch(), clsx, @radix-ui/react-hover-card (+4 more)

### Community 18 - "pagination.tsx"
Cohesion: 0.28
Nodes (7): Pagination(), PaginationContent(), PaginationEllipsis(), PaginationLink(), PaginationLinkProps, PaginationNext(), PaginationPrevious()

### Community 19 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 20 - "context-menu.tsx"
Cohesion: 0.12
Nodes (10): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+2 more)

### Community 21 - "menubar.tsx"
Cohesion: 0.12
Nodes (12): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarPortal(), MenubarRadioItem(), MenubarSeparator() (+4 more)

### Community 22 - "DynamicTaskForm.tsx"
Cohesion: 0.06
Nodes (56): ActivityScheduleForm(), ActivityScheduleFormProps, createEmptySchedule(), Day, DAYS, MobileDayAccordion(), MobileDayAccordionProps, moodBg() (+48 more)

### Community 23 - "check-docs.mjs"
Cohesion: 0.07
Nodes (30): 1. Compliance Boundaries, 2. Architectural Invariants (do not violate without written human instruction), 3. Tool Policy (enforced outside the model), 4. Immutable Paths (never write), 5. Antigravity CLI Execution, 6. Mandatory Completion Gate, 7. Communication & Delivery, Amber Zone (default working set) (+22 more)

### Community 24 - "vignette-generator.tsx"
Cohesion: 0.18
Nodes (12): ClientLoginForm(), ClientLoginPage(), resolveRedirect(), AnalysisResult, StepId, StructuredTaskResponse, TASK_VARIANTS, CLINICAL_AI_API_BASE (+4 more)

### Community 25 - "class-variance-authority"
Cohesion: 0.15
Nodes (15): Badge(), badgeVariants, ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, ToggleGroup(), ToggleGroupContext (+7 more)

### Community 26 - "react"
Cohesion: 0.16
Nodes (10): ModalitySelector(), ModalitySelectorProps, Checkbox(), Popover(), PopoverContent(), PopoverTrigger(), 4.5 The AI workflow (notes + modalities → analysis → structured task), @radix-ui/react-checkbox (+2 more)

### Community 27 - "types/tasks.ts"
Cohesion: 0.08
Nodes (43): AuditStripProps, LabelEditorProps, PractitionerNotesPanelProps, DynamicTaskFormProps, 6.5 Practice-task TypeScript types (`types/tasks.ts`), deidentify(), DeidentifyOptions, assertOk() (+35 more)

### Community 28 - "dashboard/page.tsx"
Cohesion: 0.24
Nodes (11): ClinicianTab, ViewMode, AssignedMaterial, ClientView(), FORM_TASK_TYPES, isRenderableTask(), StructuredTask, isStructuredTask() (+3 more)

### Community 29 - "dashboard-sidebar.tsx"
Cohesion: 0.22
Nodes (6): ClinicianTab, DashboardSidebarProps, ViewMode, LogoutButton(), logout(), next

### Community 30 - "chart.tsx"
Cohesion: 0.24
Nodes (11): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), ChartTooltipContent(), getPayloadConfigFromPayload() (+3 more)

### Community 31 - "drawer.tsx"
Cohesion: 0.20
Nodes (8): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle(), vaul

### Community 32 - "ClientLanding"
Cohesion: 0.10
Nodes (27): Client, ClientLanding(), 4.1 Sign-up (clinician), 4.2 Login, session bootstrap and logout, 4.3 Choosing a client (landing → workspace), 4.6 Creating a clinic client, 4.7 Client-facing material pages (public), 4. End-to-end flows (+19 more)

### Community 33 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, esbuild, eslint, eslint-config-next, postcss, tailwindcss, @tailwindcss/postcss, tw-animate-css (+4 more)

### Community 34 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, dev, docs:check, lint, start, test, test:audit (+4 more)

### Community 35 - "navigation-menu.tsx"
Cohesion: 0.22
Nodes (10): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+2 more)

### Community 36 - "schemas.ts"
Cohesion: 0.18
Nodes (10): MODALITIES, ModalitiesSchema, ModalitySchema, ReflectionPromptSchema, StructuredTaskRequestSchema, StructuredTaskSchema, ThreeCsSchema, TwoChoiceWorksheetSchema (+2 more)

### Community 37 - "practice/[sessionId]/page.tsx"
Cohesion: 0.28
Nodes (8): FORM_TASK_TYPES, getTaskLabel(), PracticeHomework, PracticePage(), PracticeTask, readPracticeTask(), SessionData, TaskVariant

### Community 38 - "main-content.tsx"
Cohesion: 0.47
Nodes (7): MainContent(), Vignette, VignetteGenerator, Tabs(), TabsContent(), TabsList(), TabsTrigger()

### Community 39 - "ALICE — System Documentation"
Cohesion: 0.12
Nodes (16): Table(), 10.1 Prerequisites, 10.2 Frontend, 10.3 API Worker (`clinical-ai-backend`), 10.4 MCP gateway Worker (`alice-mcp`), 10.5 Database, 10.6 Java modules, 10. Local development & deployment (+8 more)

### Community 40 - "tooltip.tsx"
Cohesion: 0.40
Nodes (4): Tooltip(), TooltipContent(), TooltipProvider(), @radix-ui/react-tooltip

### Community 41 - "sheet.tsx"
Cohesion: 0.28
Nodes (13): DashboardShell(), DashboardSidebar(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay() (+5 more)

### Community 42 - "input-otp.tsx"
Cohesion: 0.33
Nodes (4): InputOTP(), InputOTPGroup(), InputOTPSlot(), input-otp

### Community 43 - "public.worksheet_submissions"
Cohesion: 0.47
Nodes (3): public.worksheet_submissions, worksheet_submissions_client_id_idx, worksheet_submissions_session_id_idx

### Community 44 - "fetch"
Cohesion: 0.53
Nodes (5): Env, errorMessage(), fetch(), json(), notFound()

### Community 45 - "fmtAuditActor"
Cohesion: 0.48
Nodes (4): fmtAuditActor(), UNKNOWN_ACTOR_LABEL, main(), pass()

### Community 47 - "accordion.tsx"
Cohesion: 0.33
Nodes (4): AccordionContent(), AccordionItem(), AccordionTrigger(), @radix-ui/react-accordion

### Community 48 - "20261011_task_submissions_queue.sql"
Cohesion: 0.60
Nodes (3): practice_task_submissions_client_status_updated_idx, practice_task_submissions_pending_idx, practice_task_submissions_session_id_idx

### Community 49 - "alert.tsx"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 51 - "dispatch-inbox.ps1"
Cohesion: 1.00
Nodes (3): Append-Utf8NoBom(), Invoke-Routes(), Log-Message()

### Community 52 - "mcp-gateway/package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 81 - "VignetteGenerator"
Cohesion: 0.27
Nodes (17): AuditLogPanel(), AuditStrip(), fmtDate(), fmtShortId(), PractitionerNotesPanel(), ReflectionPanel(), StructuredDataPanel(), Card() (+9 more)

### Community 82 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (10): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+2 more)

### Community 83 - "POST"
Cohesion: 0.17
Nodes (15): POST(), buildSessionPatch(), checkClientAccess(), checkSessionAccess(), 5.0 Caller authentication, 5.1 Auth, 5.2 Clients, 5.3 Cases (+7 more)

### Community 84 - "13. Known gaps & open items"
Cohesion: 0.13
Nodes (16): extractHomeworkFromPracticePackage(), requireUser(), extractHomeworkList(), 13.10 Closed — Phase 2 schema applied and verified (2026-10-12), 13.12 Closure record — Client Link Submission Route (2026-10-11), 13.14 Closure record — Client Link Submission Audit Hardening (2026-10-11), 13.15 Closure record — Session Uniqueness & Client Submission Resolution (2026-10-11), 13.17 Known caveat — Review Queue Counts Scalability (2026-10-11) (+8 more)

### Community 85 - "respond"
Cohesion: 0.56
Nodes (10): degradedGroqPayload(), groqFailureResponse(), handleAnalyze(), handleGenerate(), handleGeneratePracticePackage(), handleGenerateStructuredTask(), normalizeStructuredTask(), respond() (+2 more)

### Community 86 - "lucide-react"
Cohesion: 0.20
Nodes (16): SessionRoutePage(), Case, CaseNode(), Session, ClientNode(), EditableName(), Props, mintClientLink() (+8 more)

### Community 87 - "empty.tsx"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 88 - "generateJson"
Cohesion: 0.19
Nodes (15): callGroq(), describeJsonFailure(), describeShapeFailure(), extractGroqErrorMessage(), extractJsonObject(), generateJson(), isReasoningModel(), repairJson() (+7 more)

### Community 89 - "5.5 AI routes"
Cohesion: 0.18
Nodes (12): isUsableAnalysis(), isUsablePracticePackage(), isUsableVignette(), persistSessionFields(), saveSessionVersion(), 5.5 AI routes, 6.1 Tables, 6.2 Migration in-repo (+4 more)

### Community 90 - "11. Conventions & guardrails"
Cohesion: 0.33
Nodes (6): formatSessionRow(), 11.1 TypeScript / Next.js, 11.2 Data access, 11.3 Security invariants, 11.4 Java module rules (authoritative copy: `ARCHITECTURE.md`), 11. Conventions & guardrails

### Community 91 - "patchSessionRow"
Cohesion: 0.43
Nodes (7): fetchSessionRow(), isMissingColumnError(), patchSessionRow(), supabaseJson(), 3. Runtime architecture, Boundary rules, Cross-cutting backend behaviour

## Knowledge Gaps
- **16 isolated node(s):** `autoprefixer`, `date-fns`, `embla-carousel-react`, `@hookform/resolvers`, `postcss` (+11 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 405 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `review/page.tsx`, `ReflectionCanvas.tsx`, `submissions/page.tsx`, `use-toast.ts`, `form.tsx`, `command.tsx`, `field.tsx`, `apiFetch`, `utils.ts`, `pagination.tsx`, `context-menu.tsx`, `menubar.tsx`, `DynamicTaskForm.tsx`, `class-variance-authority`, `react`, `dashboard-sidebar.tsx`, `chart.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `main-content.tsx`, `ALICE — System Documentation`, `tooltip.tsx`, `sheet.tsx`, `input-otp.tsx`, `accordion.tsx`, `alert.tsx`, `VignetteGenerator`, `dropdown-menu.tsx`, `lucide-react`, `empty.tsx`, `11. Conventions & guardrails`?**
  _High betweenness centrality (0.248) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `apiFetch()` (e.g. with `13.1 Security` and `4.4 Managing the tree`) actually correct?**
  _`apiFetch()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `autoprefixer`, `date-fns`, `embla-carousel-react` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `review/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13852813852813853 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `review/page.tsx`, `useClientNavStore.ts`, `ReflectionCanvas.tsx`, `submissions/page.tsx`, `cn`, `use-toast.ts`, `clinical-hierarchy.ts`, `form.tsx`, `package.json`, `command.tsx`, `field.tsx`, `utils.ts`, `pagination.tsx`, `context-menu.tsx`, `menubar.tsx`, `DynamicTaskForm.tsx`, `vignette-generator.tsx`, `class-variance-authority`, `dashboard/page.tsx`, `dashboard-sidebar.tsx`, `chart.tsx`, `drawer.tsx`, `ClientLanding`, `navigation-menu.tsx`, `practice/[sessionId]/page.tsx`, `main-content.tsx`, `tooltip.tsx`, `sheet.tsx`, `input-otp.tsx`, `accordion.tsx`, `alert.tsx`, `theme-provider.tsx`, `VignetteGenerator`, `dropdown-menu.tsx`, `lucide-react`?**
  _High betweenness centrality (0.187) - this node is a cross-community bridge._
- **Should `useClientNavStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14210526315789473 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `lucide-react` to `review/page.tsx`, `ReflectionCanvas.tsx`, `submissions/page.tsx`, `cn`, `use-toast.ts`, `package.json`, `command.tsx`, `utils.ts`, `pagination.tsx`, `context-menu.tsx`, `menubar.tsx`, `DynamicTaskForm.tsx`, `vignette-generator.tsx`, `react`, `dashboard/page.tsx`, `dashboard-sidebar.tsx`, `navigation-menu.tsx`, `practice/[sessionId]/page.tsx`, `main-content.tsx`, `sheet.tsx`, `input-otp.tsx`, `accordion.tsx`, `dropdown-menu.tsx`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._