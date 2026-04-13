"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/* ─────────────────────────────
   Types
───────────────────────────── */

export interface VignetteRiskFlag {
  label: string
  severity: "low" | "moderate" | "high" | "unspecified"
  confidence: number
  evidence: string[]
}

interface VignetteGeneratorProps {
  clientId: string
  scenario: string

  /**
   * Optional clinical context
   * (display-only, provided by MainContent)
   */
  riskFlags?: VignetteRiskFlag[]

  /**
   * Optional audit metadata
   */
  generatedAt?: string
  model?: string
}

/* ─────────────────────────────
   Helpers
───────────────────────────── */

/**
 * Ensure we never display analysis JSON
 * or markdown fences by accident.
 */
function sanitizeContent(raw: string): string {
  if (!raw) return ""

  let text = raw
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```/g, "")
    .trim()

  if (text.startsWith("{")) {
    return (
      "⚠️ Clinical worksheet could not be displayed.\n\n" +
      "The generated content contained structured data rather than narrative text."
    )
  }

  return text
}

/* ─────────────────────────────
   Component
───────────────────────────── */

export function VignetteGenerator({
  clientId,
  scenario,
  riskFlags,
  generatedAt,
  model,
}: VignetteGeneratorProps) {
  const safeScenario = sanitizeContent(scenario)

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="text-lg">
          Therapeutic Worksheet
        </CardTitle>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Client ID: {clientId}
          </p>

          {generatedAt && (
            <p className="text-xs text-muted-foreground">
              Generated: {new Date(generatedAt).toLocaleString()}
            </p>
          )}

          {model && (
            <p className="text-xs text-muted-foreground">
              Model: {model}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ─────────────────────────
           Clinical Context
        ───────────────────────── */}
        {riskFlags && riskFlags.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Clinical Context
            </h3>

            <div className="space-y-3">
              {riskFlags.map((flag, index) => (
                <div
                  key={index}
                  className={`rounded-lg border p-3 ${
                    flag.severity === "high"
                      ? "bg-red-50 border-red-200"
                      : flag.severity === "moderate"
                      ? "bg-amber-50 border-amber-200"
                      : flag.severity === "low"
                      ? "bg-green-50 border-green-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {flag.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Confidence: {Math.round(flag.confidence * 100)}%
                    </span>
                  </div>

                  <div className="text-xs italic text-muted-foreground mb-2">
                    Severity:{" "}
                    {flag.severity === "unspecified"
                      ? "Not specified – review manually"
                      : flag.severity.toUpperCase()}
                  </div>

                  {flag.evidence.length > 0 && (
                    <ul className="list-disc ml-4 text-xs text-muted-foreground space-y-1">
                      {flag.evidence.map((e, i) => (
                        <li key={i}>"{e}"</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─────────────────────────
           Worksheet Content
        ───────────────────────── */}
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Scenario
          </h3>

          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {safeScenario}
          </p>
        </section>
      </CardContent>
    </Card>
  )
}
