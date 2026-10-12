# Graph Report - Source  (2026-10-12)

## Corpus Check
- 327 files · ~695,508 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: (none) 6, .log 5, .err 2)

## Summary
- 1257 nodes · 2864 edges · 93 communities (63 shown, 30 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 185 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7af8bf0a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- review/page.tsx
- useClientNavStore.ts
- CloudFlare.js
- ReflectionCanvas.tsx
- vignette-generator.tsx
- dependencies
- cn
- export-practice-pdf.ts
- worker.test.mjs
- use-toast.ts
- clinical-hierarchy.ts
- react
- package.json
- command.tsx
- item.tsx
- apiFetch
- compilerOptions
- utils.ts
- alert-dialog.tsx
- components.json
- context-menu.tsx
- menubar.tsx
- ActivityScheduleForm.tsx
- ThreeCsForm.tsx
- DynamicTaskForm.tsx
- toggle-group.tsx
- modality-selector.tsx
- types/tasks.ts
- dashboard/page.tsx
- breadcrumb.tsx
- chart.tsx
- drawer.tsx
- hydration-guard.test.mjs
- devDependencies
- scripts
- navigation-menu.tsx
- 13.4 Tooling and process gaps
- input-group.tsx
- NormalisedSubmission
- ALICE — System Documentation
- tooltip.tsx
- dashboard-sidebar.tsx
- input-otp.tsx
- public.worksheet_submissions
- fetch
- use-mobile.ts
- collapsible.tsx
- resizable.tsx
- 20261011_task_submissions_queue.sql
- scroll-area.tsx
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
- main-content.tsx
- dropdown-menu.tsx
- POST
- 13. Known gaps & open items
- generateJson
- lucide-react
- class-variance-authority
- callGroq
- 5.5 AI routes
- ClientLanding
- patchSessionRow
- Frontend (Next.js App Router)

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
- `4.7 Client-facing material pages (public)` --references--> `DynamicTaskForm()`  [INFERRED]
  documentation.md → components/tasks/DynamicTaskForm.tsx
- `6.3 JSON payload shapes stored on `sessions`` --references--> `isStructuredTask()`  [INFERRED]
  documentation.md → lib/practice-package.ts
- `6.4 `form_data` JSONB shapes on `practice_task_submissions`` --references--> `DynamicTaskForm()`  [INFERRED]
  documentation.md → components/tasks/DynamicTaskForm.tsx
- `7.4 Legacy Ollama route (not part of the product flow)` --references--> `POST()`  [INFERRED]
  documentation.md → app/api/analyze/session/route.ts
- `10.3 API Worker (`clinical-ai-backend`)` --references--> `requireUser()`  [INFERRED]
  documentation.md → backend/CloudFlare.js

## Import Cycles
- None detected.

## Communities (93 total, 30 thin omitted)

### Community 0 - "review/page.tsx"
Cohesion: 0.10
Nodes (29): ActivityLogPanel(), ApproveDialog(), ApproveDialogProps, AuditStrip(), BehaviouralExperimentPanel(), DataGrid(), Day, DAYS (+21 more)

### Community 1 - "useClientNavStore.ts"
Cohesion: 0.15
Nodes (22): SessionRoutePage(), 8.2 The authoritative store — `stores/useClientNavStore.ts`, ClientTree, getLastSession(), LastSessionRef, readAll(), resolveDefaultSession(), sessionExistsInTree() (+14 more)

### Community 2 - "CloudFlare.js"
Cohesion: 0.10
Nodes (34): ACTIVITY_LOG_SCHEMA, ANALYSIS_SCHEMA, base64UrlFromBytes(), base64UrlToBytes(), buildClientPayload(), captureDebug(), CLIENT_PRACTICE_TASK_FIELDS, CLIENT_SUBMISSION_ALLOWED_TASK_TYPES (+26 more)

### Community 3 - "ReflectionCanvas.tsx"
Cohesion: 0.07
Nodes (59): FORM_TASK_TYPES, getTaskLabel(), PracticeHomework, PracticePage(), PracticeTask, readPracticeTask(), SessionData, BACKGROUND_OPTIONS (+51 more)

### Community 4 - "vignette-generator.tsx"
Cohesion: 0.09
Nodes (46): ClientLoginForm(), ClientLoginPage(), resolveRedirect(), PractitionerSubmissionsPage(), ReviewQueueContent(), TabConfig, TABS, StatusPill() (+38 more)

### Community 5 - "dependencies"
Cohesion: 0.04
Nodes (53): dependencies, autoprefixer, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, @hookform/resolvers (+45 more)

### Community 6 - "cn"
Cohesion: 0.07
Nodes (36): Skeleton(), AccordionContent(), AccordionItem(), AccordionTrigger(), Avatar(), AvatarFallback(), AvatarImage(), CardAction() (+28 more)

### Community 7 - "export-practice-pdf.ts"
Cohesion: 0.10
Nodes (39): A4, addPage(), buildPracticePackageFileName(), buildPracticePackagePdf(), collectHomeworkTasks(), COLORS, Cursor, downloadPracticePackagePdf() (+31 more)

### Community 8 - "worker.test.mjs"
Cohesion: 0.08
Nodes (32): esbuild, args, changedPaths(), commitMessage(), git(), has(), message, paths (+24 more)

### Community 9 - "use-toast.ts"
Cohesion: 0.10
Nodes (28): geist, geistMono, metadata, RootLayout(), Toast, ToastAction, ToastActionElement, ToastClose (+20 more)

### Community 10 - "clinical-hierarchy.ts"
Cohesion: 0.15
Nodes (30): ClinicalWorkspace, useClinicalWorkspace(), 8.3 The local-only hierarchy (parallel model — do not confuse with the store), addCase(), addClient(), addSession(), appendSessionAnalysis(), appendSessionWorksheet() (+22 more)

### Community 11 - "react"
Cohesion: 0.10
Nodes (15): ReflectionFieldProps, FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue (+7 more)

### Community 12 - "package.json"
Cohesion: 0.08
Nodes (25): name, private, version, autoprefixer, clsx, date-fns, embla-carousel-react, @hookform/resolvers (+17 more)

### Community 13 - "command.tsx"
Cohesion: 0.14
Nodes (18): Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut() (+10 more)

### Community 14 - "item.tsx"
Cohesion: 0.13
Nodes (18): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Item(), ItemActions(), ItemContent(), ItemDescription() (+10 more)

### Community 15 - "apiFetch"
Cohesion: 0.22
Nodes (16): LabelEditor(), save(), handleSave(), apiFetch(), deidentify(), DeidentifyOptions, assertOk(), commitTaskForReview() (+8 more)

### Community 16 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 17 - "utils.ts"
Cohesion: 0.16
Nodes (7): Calendar(), CalendarDayButton(), HoverCardContent(), Switch(), @radix-ui/react-hover-card, @radix-ui/react-switch, react-day-picker

### Community 18 - "alert-dialog.tsx"
Cohesion: 0.11
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogPortal() (+10 more)

### Community 19 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 20 - "context-menu.tsx"
Cohesion: 0.12
Nodes (10): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+2 more)

### Community 21 - "menubar.tsx"
Cohesion: 0.12
Nodes (12): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarPortal(), MenubarRadioItem(), MenubarSeparator() (+4 more)

### Community 22 - "ActivityScheduleForm.tsx"
Cohesion: 0.23
Nodes (14): ActivityScheduleForm(), ActivityScheduleFormProps, createEmptySchedule(), Day, DAYS, MobileDayAccordion(), MobileDayAccordionProps, moodBg() (+6 more)

### Community 23 - "ThreeCsForm.tsx"
Cohesion: 0.20
Nodes (11): COMMON_EMOTIONS, EmotionRow(), EmotionRowProps, intensityColor(), intensityLabel(), StepCard(), StepCardProps, ThreeCsForm() (+3 more)

### Community 24 - "DynamicTaskForm.tsx"
Cohesion: 0.18
Nodes (17): ACTIVITY_STEPS, ApprovalGate(), ApprovalGateProps, DynamicTaskForm(), ErrorBanner(), ErrorBannerProps, SaveStatus, SaveStatusBadge() (+9 more)

### Community 25 - "toggle-group.tsx"
Cohesion: 0.31
Nodes (7): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants, @radix-ui/react-toggle, @radix-ui/react-toggle-group

### Community 26 - "modality-selector.tsx"
Cohesion: 0.21
Nodes (12): ModalitySelector(), ModalitySelectorProps, Checkbox(), Popover(), PopoverContent(), PopoverTrigger(), 4.5 The AI workflow (notes + modalities → analysis → structured task), MODALITIES (+4 more)

### Community 27 - "types/tasks.ts"
Cohesion: 0.10
Nodes (20): STATUS_CONFIG, ActivityLogFormData, BehaviouralExperimentFormData, CanvasData, ClientReflectionRow, CommitTaskInput, FormData, InsertPractitionerNoteInput (+12 more)

### Community 28 - "dashboard/page.tsx"
Cohesion: 0.13
Nodes (16): ClinicianTab, Dashboard(), ViewMode, TestAuth(), test(), AuthGuard(), checkAuth(), ClientView() (+8 more)

### Community 29 - "breadcrumb.tsx"
Cohesion: 0.18
Nodes (9): Badge(), badgeVariants, BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator() (+1 more)

### Community 30 - "chart.tsx"
Cohesion: 0.24
Nodes (11): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), ChartTooltipContent(), getPayloadConfigFromPayload() (+3 more)

### Community 31 - "drawer.tsx"
Cohesion: 0.20
Nodes (8): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle(), vaul

### Community 32 - "hydration-guard.test.mjs"
Cohesion: 0.19
Nodes (14): fmtAuditActor(), UNKNOWN_ACTOR_LABEL, decideSessionHydration(), HydrationAction, main(), pass(), component(), main() (+6 more)

### Community 33 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, esbuild, eslint, eslint-config-next, postcss, tailwindcss, @tailwindcss/postcss, tw-animate-css (+4 more)

### Community 34 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, dev, docs:check, lint, start, test, test:audit (+4 more)

### Community 35 - "navigation-menu.tsx"
Cohesion: 0.22
Nodes (10): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+2 more)

### Community 36 - "13.4 Tooling and process gaps"
Cohesion: 0.11
Nodes (23): AssignedMaterial, FORM_TASK_TYPES, isRenderableTask(), DynamicTaskInitialData, isTaskVariant(), 13.4 Tooling and process gaps, ModalitiesSchema, ModalitySchema (+15 more)

### Community 37 - "input-group.tsx"
Cohesion: 0.23
Nodes (10): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea() (+2 more)

### Community 38 - "NormalisedSubmission"
Cohesion: 0.21
Nodes (12): AuditStripProps, DecisionBarProps, LabelEditorProps, PractitionerNotesPanelProps, DynamicTaskFormProps, 6.5 Practice-task TypeScript types (`types/tasks.ts`), NormalisedAuditLogEntry, NormalisedPractitionerNote (+4 more)

### Community 39 - "ALICE — System Documentation"
Cohesion: 0.09
Nodes (21): formatSessionRow(), Table(), 10.1 Prerequisites, 10.2 Frontend, 10.3 API Worker (`clinical-ai-backend`), 10.4 MCP gateway Worker (`alice-mcp`), 10.5 Database, 10.6 Java modules (+13 more)

### Community 40 - "tooltip.tsx"
Cohesion: 0.40
Nodes (4): Tooltip(), TooltipContent(), TooltipProvider(), @radix-ui/react-tooltip

### Community 41 - "dashboard-sidebar.tsx"
Cohesion: 0.20
Nodes (17): DashboardShell(), ClinicianTab, DashboardSidebar(), DashboardSidebarProps, ViewMode, LogoutButton(), Sheet(), SheetContent() (+9 more)

### Community 42 - "input-otp.tsx"
Cohesion: 0.33
Nodes (4): InputOTP(), InputOTPGroup(), InputOTPSlot(), input-otp

### Community 43 - "public.worksheet_submissions"
Cohesion: 0.47
Nodes (3): public.worksheet_submissions, worksheet_submissions_client_id_idx, worksheet_submissions_session_id_idx

### Community 44 - "fetch"
Cohesion: 0.53
Nodes (5): Env, errorMessage(), fetch(), json(), notFound()

### Community 45 - "use-mobile.ts"
Cohesion: 0.70
Nodes (4): getServerSnapshot(), getSnapshot(), subscribe(), useIsMobile()

### Community 47 - "resizable.tsx"
Cohesion: 0.40
Nodes (3): ResizableHandle(), ResizablePanelGroup(), react-resizable-panels

### Community 48 - "20261011_task_submissions_queue.sql"
Cohesion: 0.60
Nodes (3): practice_task_submissions_client_status_updated_idx, practice_task_submissions_pending_idx, practice_task_submissions_session_id_idx

### Community 49 - "scroll-area.tsx"
Cohesion: 0.67
Nodes (3): ScrollArea(), ScrollBar(), @radix-ui/react-scroll-area

### Community 51 - "dispatch-inbox.ps1"
Cohesion: 1.00
Nodes (3): Append-Utf8NoBom(), Invoke-Routes(), Log-Message()

### Community 52 - "mcp-gateway/package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 81 - "main-content.tsx"
Cohesion: 0.28
Nodes (17): AuditLogPanel(), fmtDate(), PractitionerNotesPanel(), ReflectionPanel(), StructuredDataPanel(), MainContent(), Vignette, VignetteGenerator (+9 more)

### Community 82 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (10): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+2 more)

### Community 83 - "POST"
Cohesion: 0.17
Nodes (15): POST(), buildSessionPatch(), checkClientAccess(), checkSessionAccess(), 5.0 Caller authentication, 5.1 Auth, 5.2 Clients, 5.3 Cases (+7 more)

### Community 84 - "13. Known gaps & open items"
Cohesion: 0.13
Nodes (16): extractHomeworkFromPracticePackage(), requireUser(), extractHomeworkList(), 13.10 Closed — Phase 2 schema applied and verified (2026-10-12), 13.12 Closure record — Client Link Submission Route (2026-10-11), 13.14 Closure record — Client Link Submission Audit Hardening (2026-10-11), 13.15 Closure record — Session Uniqueness & Client Submission Resolution (2026-10-11), 13.16 Closure record — Practitioner Review Queue Collection Endpoint (2026-10-11) (+8 more)

### Community 85 - "generateJson"
Cohesion: 0.36
Nodes (14): degradedGroqPayload(), describeJsonFailure(), describeShapeFailure(), generateJson(), groqFailureResponse(), handleAnalyze(), handleGenerate(), handleGeneratePracticePackage() (+6 more)

### Community 86 - "lucide-react"
Cohesion: 0.32
Nodes (10): Case, CaseNode(), Session, ClientNode(), EditableName(), Props, mintClientLink(), Session (+2 more)

### Community 87 - "class-variance-authority"
Cohesion: 0.16
Nodes (12): Alert(), AlertDescription(), AlertTitle(), alertVariants, Empty(), EmptyContent(), EmptyDescription(), EmptyHeader() (+4 more)

### Community 88 - "callGroq"
Cohesion: 0.21
Nodes (12): callGroq(), extractGroqErrorMessage(), extractJsonObject(), isReasoningModel(), repairJson(), resolveModel(), stripMarkdown(), 13.6 Closure record — security & reliability phase (2026-09-16) (+4 more)

### Community 89 - "5.5 AI routes"
Cohesion: 0.18
Nodes (12): isUsableAnalysis(), isUsablePracticePackage(), isUsableVignette(), persistSessionFields(), saveSessionVersion(), 5.5 AI routes, 6.1 Tables, 6.2 Migration in-repo (+4 more)

### Community 90 - "ClientLanding"
Cohesion: 0.28
Nodes (9): ClientLanding(), 11.1 TypeScript / Next.js, 4.1 Sign-up (clinician), 4.2 Login, session bootstrap and logout, 4.3 Choosing a client (landing → workspace), 4.6 Creating a clinic client, 4.7 Client-facing material pages (public), 4. End-to-end flows (+1 more)

### Community 91 - "patchSessionRow"
Cohesion: 0.43
Nodes (7): fetchSessionRow(), isMissingColumnError(), patchSessionRow(), supabaseJson(), 3. Runtime architecture, Boundary rules, Cross-cutting backend behaviour

### Community 92 - "Frontend (Next.js App Router)"
Cohesion: 0.50
Nodes (4): 2. Repository map, Backend and infrastructure, Frontend (Next.js App Router), Java skeleton and shared config

## Knowledge Gaps
- **16 isolated node(s):** `autoprefixer`, `date-fns`, `embla-carousel-react`, `@hookform/resolvers`, `postcss` (+11 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 386 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `review/page.tsx`, `ReflectionCanvas.tsx`, `vignette-generator.tsx`, `use-toast.ts`, `react`, `command.tsx`, `item.tsx`, `apiFetch`, `utils.ts`, `alert-dialog.tsx`, `context-menu.tsx`, `menubar.tsx`, `ActivityScheduleForm.tsx`, `ThreeCsForm.tsx`, `DynamicTaskForm.tsx`, `toggle-group.tsx`, `modality-selector.tsx`, `types/tasks.ts`, `breadcrumb.tsx`, `chart.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `input-group.tsx`, `ALICE — System Documentation`, `tooltip.tsx`, `dashboard-sidebar.tsx`, `input-otp.tsx`, `resizable.tsx`, `scroll-area.tsx`, `main-content.tsx`, `dropdown-menu.tsx`, `lucide-react`, `class-variance-authority`, `ClientLanding`?**
  _High betweenness centrality (0.235) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `apiFetch()` (e.g. with `13.1 Security` and `4.4 Managing the tree`) actually correct?**
  _`apiFetch()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `autoprefixer`, `date-fns`, `embla-carousel-react` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `review/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1028225806451613 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `review/page.tsx`, `useClientNavStore.ts`, `ReflectionCanvas.tsx`, `vignette-generator.tsx`, `cn`, `use-toast.ts`, `clinical-hierarchy.ts`, `package.json`, `command.tsx`, `item.tsx`, `utils.ts`, `alert-dialog.tsx`, `context-menu.tsx`, `menubar.tsx`, `ActivityScheduleForm.tsx`, `ThreeCsForm.tsx`, `DynamicTaskForm.tsx`, `toggle-group.tsx`, `modality-selector.tsx`, `types/tasks.ts`, `dashboard/page.tsx`, `breadcrumb.tsx`, `chart.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `13.4 Tooling and process gaps`, `input-group.tsx`, `tooltip.tsx`, `dashboard-sidebar.tsx`, `input-otp.tsx`, `use-mobile.ts`, `resizable.tsx`, `scroll-area.tsx`, `theme-provider.tsx`, `main-content.tsx`, `dropdown-menu.tsx`, `lucide-react`, `class-variance-authority`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **Should `CloudFlare.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09682539682539683 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._