const fs = require('fs');
let code = fs.readFileSync('d:/Work/Neuvo/ALICE/Source/components/vignette-generator.tsx', 'utf8');

const importsToInsert = `import { generateStructuredTask, upsertTaskDraft } from "@/lib/tasks"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DynamicTaskForm } from "@/components/tasks/DynamicTaskForm"
import ReflectionCanvas from "@/components/canvas/ReflectionCanvas"`;

code = code.replace('import { decideSessionHydration } from "@/lib/session-hydration"', 'import { decideSessionHydration } from "@/lib/session-hydration"\n' + importsToInsert);

// State vars
const stateToInsert = `
  const [activityFormat, setActivityFormat] = useState<"activity_log" | "thought_record" | "reflection_prompt">("thought_record")
  const [sessionContext, setSessionContext] = useState("")
  const [generatedSubmissionId, setGeneratedSubmissionId] = useState<string | null>(null)
  const [reflectionPrompt, setReflectionPrompt] = useState<any>(null)
`;

code = code.replace('const [practicePackage, setPracticePackage] = useState<PracticePackage | null>(null)', 'const [practicePackage, setPracticePackage] = useState<PracticePackage | null>(null)\n' + stateToInsert);

// Replace handleAnalyzeAndGenerate
const newHandler = `
  const handleAnalyzeAndGenerate = async () => {
    if (!sessionContext) {
      console.warn("⛔ GENERATE BLOCKED: Session context is empty")
      return
    }

    setIsProcessing(true)
    setDegradedWarning(null)
    setGeneratedSubmissionId(null)
    setReflectionPrompt(null)

    try {
      // 1. Generate Structured Task JSON
      const json = await generateStructuredTask({ sessionContext, activityFormat })
      
      // 2. Draft it
      if (activityFormat === "reflection_prompt") {
        setReflectionPrompt(json)
        setStep(3)
      } else {
        const submission = await upsertTaskDraft({
          clientId,
          practitionerId: "00000000-0000-0000-0000-000000000000", // Will be overwritten by worker auth
          taskType: activityFormat as any,
          formData: json as any
        })
        setGeneratedSubmissionId(submission.id)
        setStep(3)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate task"
      console.error(message)
    } finally {
      setIsProcessing(false)
    }
  }
`;

code = code.replace(/const handleAnalyzeAndGenerate = async \(\) => \{[\s\S]*?\}\n\n/m, newHandler + '\n');

// Replace Step 2 UI
const step2UI = `
        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right">
            <div className="p-6 rounded-[2rem] bg-blue-50/50 border border-blue-100 space-y-4">
              <h3 className="text-lg font-bold text-blue-900">Activity Builder</h3>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-blue-800">Activity Format</label>
                <Select value={activityFormat} onValueChange={(val: any) => setActivityFormat(val)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thought_record">The 3 C's Worksheet</SelectItem>
                    <SelectItem value="activity_log">Weekly Activity Schedule</SelectItem>
                    <SelectItem value="reflection_prompt">Reflection Canvas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-blue-800">Session Context / Clinical Focus</label>
                <Textarea
                  value={sessionContext}
                  onChange={(e) => setSessionContext(e.target.value)}
                  placeholder="E.g., Target specific behaviors, cognitive distortions..."
                  className="min-h-[120px] bg-white resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                className="flex-1 h-12 rounded-xl"
                disabled={isProcessing}
              >
                Back
              </Button>
              <Button
                onClick={handleAnalyzeAndGenerate}
                className="flex-[2] h-12 rounded-xl text-md font-bold"
                disabled={!sessionContext || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  <Sparkles className="mr-2" />
                )}
                GENERATE
              </Button>
            </div>
          </div>
        )}
`;

code = code.replace(/\{step === 2 && \([\s\S]*?<\/[a-zA-Z]+>\n\s*\)\}/m, step2UI.trim());

// Replace Step 3 UI
const step3UI = `
        {step === 3 && (
          <div className="space-y-6 animate-in zoom-in-95">
            <div className="p-10 border-2 rounded-[2.5rem] bg-white text-zinc-900 space-y-8 shadow-sm">
              <div className="flex justify-between items-start border-b pb-8">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight leading-none">
                    Client Practice Task
                  </h3>
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mt-3">
                    ALICE Draft
                  </p>
                </div>
                <div className="h-10 w-10 bg-green-50 border border-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="text-green-600 h-6 w-6" />
                </div>
              </div>

              {!generatedSubmissionId && !reflectionPrompt ? (
                <div className="text-center py-10 text-zinc-400 italic text-lg font-bold">
                  No task generated.
                </div>
              ) : generatedSubmissionId ? (
                <DynamicTaskForm
                  clientId={clientId}
                  practitionerId="00000000-0000-0000-0000-000000000000"
                  taskType={activityFormat as any}
                  initialSubmissionId={generatedSubmissionId}
                  onSubmitted={() => {}}
                  onCancel={() => setStep(2)}
                />
              ) : reflectionPrompt ? (
                <div className="space-y-4">
                  <div className="p-4 bg-muted/30 rounded-xl border">
                    <p className="text-sm font-semibold">Prompt: {reflectionPrompt.prompt}</p>
                    <p className="text-xs text-muted-foreground mt-2">Suggested background: {reflectionPrompt.suggested_background}</p>
                    {reflectionPrompt.notes && <p className="text-xs text-muted-foreground mt-1">Notes: {reflectionPrompt.notes}</p>}
                  </div>
                  <div className="border rounded-xl overflow-hidden h-[600px] relative">
                    <ReflectionCanvas 
                      initialBackground={reflectionPrompt.suggested_background}
                      onBackgroundChange={() => {}}
                    />
                  </div>
                </div>
              ) : null}

              <div className="pt-8 border-t flex justify-end gap-3">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Start Over
                </Button>
              </div>
            </div>
          </div>
        )}
`;

code = code.replace(/\{step === 3 && \([\s\S]*?<\/[a-zA-Z]+>\n\s*\)\}/m, step3UI.trim());

fs.writeFileSync('d:/Work/Neuvo/ALICE/Source/components/vignette-generator.tsx', code, 'utf8');
console.log('Patched vignette-generator.tsx');
