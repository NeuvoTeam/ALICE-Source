# Graph Report - Source  (2026-10-12)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1171 nodes · 2613 edges · 81 communities (51 shown, 30 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c6ccdd11`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- review/page.tsx
- react
- CloudFlare.js
- ReflectionCanvas.tsx
- vignette-generator.tsx
- dependencies
- cn
- export-practice-pdf.ts
- worker.test.mjs
- use-toast.ts
- clinical-hierarchy.ts
- field.tsx
- package.json
- command.tsx
- item.tsx
- lib/tasks.ts
- compilerOptions
- utils.ts
- alert-dialog.tsx
- components.json
- context-menu.tsx
- menubar.tsx
- ActivityScheduleForm.tsx
- ThreeCsForm.tsx
- DynamicTaskForm.tsx
- class-variance-authority
- modality-selector.tsx
- types/tasks.ts
- Textarea
- breadcrumb.tsx
- chart.tsx
- drawer.tsx
- hydration-guard.test.mjs
- devDependencies
- scripts
- navigation-menu.tsx
- schemas.ts
- input-group.tsx
- UUID
- pagination.tsx
- tooltip.tsx
- accordion.tsx
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

## God Nodes (most connected - your core abstractions)
1. `cn()` - 276 edges
2. `react` - 79 edges
3. `lucide-react` - 39 edges
4. `fetch()` - 38 edges
5. `apiFetch()` - 36 edges
6. `Button()` - 27 edges
7. `VignetteGenerator()` - 25 edges
8. `useClientNavStore` - 24 edges
9. `DynamicTaskForm()` - 21 edges
10. `ReviewQueueContent()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `SheetFooter()` --calls--> `cn()`  [EXTRACTED]
  components/ui/sheet.tsx → lib/utils.ts
- `SheetHeader()` --calls--> `cn()`  [EXTRACTED]
  components/ui/sheet.tsx → lib/utils.ts
- `FieldContent()` --calls--> `cn()`  [EXTRACTED]
  components/ui/field.tsx → lib/utils.ts
- `FieldDescription()` --calls--> `cn()`  [EXTRACTED]
  components/ui/field.tsx → lib/utils.ts
- `FieldError()` --calls--> `cn()`  [EXTRACTED]
  components/ui/field.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (81 total, 30 thin omitted)

### Community 0 - "review/page.tsx"
Cohesion: 0.05
Nodes (71): ClinicianTab, Dashboard(), ViewMode, ActivityLogPanel(), ApproveDialog(), ApproveDialogProps, AuditLogPanel(), AuditStrip() (+63 more)

### Community 1 - "react"
Cohesion: 0.06
Nodes (52): SessionRoutePage(), DashboardShell(), ClinicianTab, DashboardSidebar(), DashboardSidebarProps, ViewMode, LogoutButton(), Case (+44 more)

### Community 2 - "CloudFlare.js"
Cohesion: 0.07
Nodes (69): ACTIVITY_LOG_SCHEMA, ANALYSIS_SCHEMA, base64UrlFromBytes(), base64UrlToBytes(), buildClientPayload(), buildSessionPatch(), callGroq(), captureDebug() (+61 more)

### Community 3 - "ReflectionCanvas.tsx"
Cohesion: 0.07
Nodes (58): FORM_TASK_TYPES, getTaskLabel(), PracticeHomework, PracticePage(), PracticeTask, readPracticeTask(), SessionData, BACKGROUND_OPTIONS (+50 more)

### Community 4 - "vignette-generator.tsx"
Cohesion: 0.08
Nodes (48): ClientLoginForm(), ClientLoginPage(), resolveRedirect(), PractitionerSubmissionsPage(), ReviewQueueContent(), TabConfig, TABS, StatusPill() (+40 more)

### Community 5 - "dependencies"
Cohesion: 0.04
Nodes (53): dependencies, autoprefixer, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, @hookform/resolvers (+45 more)

### Community 6 - "cn"
Cohesion: 0.07
Nodes (34): Avatar(), AvatarFallback(), AvatarImage(), CardAction(), CardFooter(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem() (+26 more)

### Community 7 - "export-practice-pdf.ts"
Cohesion: 0.09
Nodes (40): A4, addPage(), buildPracticePackageFileName(), buildPracticePackagePdf(), collectHomeworkTasks(), COLORS, Cursor, downloadPracticePackagePdf() (+32 more)

### Community 8 - "worker.test.mjs"
Cohesion: 0.08
Nodes (32): esbuild, args, changedPaths(), commitMessage(), git(), has(), message, paths (+24 more)

### Community 9 - "use-toast.ts"
Cohesion: 0.10
Nodes (28): geist, geistMono, metadata, RootLayout(), Toast, ToastAction, ToastActionElement, ToastClose (+20 more)

### Community 10 - "clinical-hierarchy.ts"
Cohesion: 0.15
Nodes (29): ClinicalWorkspace, useClinicalWorkspace(), addCase(), addClient(), addSession(), appendSessionAnalysis(), appendSessionWorksheet(), ClinicalCase (+21 more)

### Community 11 - "field.tsx"
Cohesion: 0.10
Nodes (23): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSet() (+15 more)

### Community 12 - "package.json"
Cohesion: 0.08
Nodes (23): name, private, version, autoprefixer, date-fns, embla-carousel-react, @hookform/resolvers, postcss (+15 more)

### Community 13 - "command.tsx"
Cohesion: 0.14
Nodes (18): Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut() (+10 more)

### Community 14 - "item.tsx"
Cohesion: 0.12
Nodes (19): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, FieldSeparator(), Item(), ItemActions(), ItemContent() (+11 more)

### Community 15 - "lib/tasks.ts"
Cohesion: 0.16
Nodes (19): deidentify(), DeidentifyOptions, assertOk(), commitTaskForReview(), fetchSubmissionBundle(), generateStructuredTask(), insertPractitionerNote(), normalizeAuditEntry() (+11 more)

### Community 16 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 17 - "utils.ts"
Cohesion: 0.11
Nodes (11): Skeleton(), HoverCardContent(), RadioGroup(), RadioGroupItem(), Spinner(), Switch(), clsx, @radix-ui/react-hover-card (+3 more)

### Community 18 - "alert-dialog.tsx"
Cohesion: 0.15
Nodes (14): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogPortal() (+6 more)

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
Cohesion: 0.22
Nodes (13): ACTIVITY_STEPS, ApprovalGate(), ApprovalGateProps, DynamicTaskForm(), DynamicTaskInitialData, ErrorBanner(), ErrorBannerProps, SaveStatus (+5 more)

### Community 25 - "class-variance-authority"
Cohesion: 0.18
Nodes (12): Alert(), AlertDescription(), AlertTitle(), alertVariants, ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle() (+4 more)

### Community 26 - "modality-selector.tsx"
Cohesion: 0.24
Nodes (10): ModalitySelector(), ModalitySelectorProps, Checkbox(), Popover(), PopoverContent(), PopoverTrigger(), GenerateStructuredTaskInput, @radix-ui/react-checkbox (+2 more)

### Community 27 - "types/tasks.ts"
Cohesion: 0.14
Nodes (13): ActivityLogFormData, BehaviouralExperimentFormData, CanvasData, FormData, InsertPractitionerNoteInput, ISODateTime, PracticeTaskSubmissionRow, ReviewQueueCountOnlyResponse (+5 more)

### Community 28 - "Textarea"
Cohesion: 0.23
Nodes (9): RevisionDialog(), ReflectionField(), ReflectionFieldProps, createEmptyTwoChoiceData(), TwoChoiceData, TwoChoiceWorksheetForm(), TwoChoiceWorksheetFormProps, InputGroupTextarea() (+1 more)

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
Cohesion: 0.32
Nodes (10): decideSessionHydration(), HydrationAction, component(), main(), PACKAGE, pass(), row(), runEffect() (+2 more)

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

### Community 37 - "input-group.tsx"
Cohesion: 0.29
Nodes (8): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), Input()

### Community 38 - "UUID"
Cohesion: 0.25
Nodes (9): AuditStripProps, DecisionBarProps, LabelEditorProps, PractitionerNotesPanelProps, DynamicTaskFormProps, NormalisedAuditLogEntry, NormalisedPractitionerNote, NormalisedSubmission (+1 more)

### Community 39 - "pagination.tsx"
Cohesion: 0.28
Nodes (7): Pagination(), PaginationContent(), PaginationEllipsis(), PaginationLink(), PaginationLinkProps, PaginationNext(), PaginationPrevious()

### Community 40 - "tooltip.tsx"
Cohesion: 0.40
Nodes (4): Tooltip(), TooltipContent(), TooltipProvider(), @radix-ui/react-tooltip

### Community 41 - "accordion.tsx"
Cohesion: 0.33
Nodes (4): AccordionContent(), AccordionItem(), AccordionTrigger(), @radix-ui/react-accordion

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

## Knowledge Gaps
- **16 isolated node(s):** `autoprefixer`, `date-fns`, `embla-carousel-react`, `@hookform/resolvers`, `postcss` (+11 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 367 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `review/page.tsx`, `react`, `ReflectionCanvas.tsx`, `vignette-generator.tsx`, `use-toast.ts`, `field.tsx`, `command.tsx`, `item.tsx`, `utils.ts`, `alert-dialog.tsx`, `context-menu.tsx`, `menubar.tsx`, `ActivityScheduleForm.tsx`, `ThreeCsForm.tsx`, `DynamicTaskForm.tsx`, `class-variance-authority`, `modality-selector.tsx`, `Textarea`, `breadcrumb.tsx`, `chart.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `input-group.tsx`, `pagination.tsx`, `tooltip.tsx`, `accordion.tsx`, `input-otp.tsx`, `resizable.tsx`, `scroll-area.tsx`?**
  _High betweenness centrality (0.260) - this node is a cross-community bridge._
- **What connects `autoprefixer`, `date-fns`, `embla-carousel-react` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `review/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.052795031055900624 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `review/page.tsx`, `ReflectionCanvas.tsx`, `vignette-generator.tsx`, `cn`, `use-toast.ts`, `clinical-hierarchy.ts`, `field.tsx`, `package.json`, `command.tsx`, `item.tsx`, `utils.ts`, `alert-dialog.tsx`, `context-menu.tsx`, `menubar.tsx`, `ActivityScheduleForm.tsx`, `ThreeCsForm.tsx`, `DynamicTaskForm.tsx`, `class-variance-authority`, `modality-selector.tsx`, `Textarea`, `breadcrumb.tsx`, `chart.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `input-group.tsx`, `pagination.tsx`, `tooltip.tsx`, `accordion.tsx`, `input-otp.tsx`, `use-mobile.ts`, `resizable.tsx`, `scroll-area.tsx`, `theme-provider.tsx`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.05672926447574335 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Should `CloudFlare.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06519114688128773 - nodes in this community are weakly interconnected._