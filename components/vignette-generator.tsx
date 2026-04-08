"use client"

import { useCallback, useRef, useState } from "react"
import html2canvas from "html2canvas"
import { jsPDF } from "jspdf"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Download, Loader2 } from "lucide-react"

const MM_PER_PT = 25.4 / 72

interface VignetteGeneratorProps {
  scenario: string
  skill: string
  reflection: string
  clientId: string
}

/**
 * Captures the worksheet DOM node with html2canvas and builds a printable PDF
 * with a Clinical Homework header and Client ID footer on every page.
 */
export async function downloadPDF(worksheetElement: HTMLElement, clientId: string): Promise<void> {
  const canvas = await html2canvas(worksheetElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  })

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 16
  const headerY = margin
  const footerY = pageHeight - margin
  const headerBlock = 14 * MM_PER_PT
  const footerBlock = 8 * MM_PER_PT
  const contentTop = headerY + headerBlock + 4
  const contentBottom = footerY - footerBlock - 4
  const usableHeight = Math.max(20, contentBottom - contentTop)
  const imgWidth = pageWidth - 2 * margin

  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  const pdfImgHeight = (canvasHeight * imgWidth) / canvasWidth

  const drawHeaderFooter = () => {
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(14)
    pdf.setTextColor(33, 33, 33)
    pdf.text("Clinical Homework", margin, headerY + 5)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8.5)
    pdf.setTextColor(90, 90, 90)
    pdf.text(`Client ID: ${clientId}`, margin, footerY - 2)

    pdf.setDrawColor(220, 220, 220)
    pdf.setLineWidth(0.2)
    pdf.line(margin, headerY + headerBlock + 2, pageWidth - margin, headerY + headerBlock + 2)
    pdf.line(margin, footerY - footerBlock, pageWidth - margin, footerY - footerBlock)
  }

  if (pdfImgHeight <= 0 || !Number.isFinite(pdfImgHeight)) {
    drawHeaderFooter()
    pdf.save("clinical-homework.pdf")
    return
  }

  let rendered = 0
  let pageIndex = 0

  while (rendered < pdfImgHeight) {
    if (pageIndex > 0) pdf.addPage()
    drawHeaderFooter()

    const slicePdfHeight = Math.min(usableHeight, pdfImgHeight - rendered)
    const sourceY = (rendered / pdfImgHeight) * canvasHeight
    const sourceH = (slicePdfHeight / pdfImgHeight) * canvasHeight

    const sliceCanvas = document.createElement("canvas")
    sliceCanvas.width = canvasWidth
    sliceCanvas.height = Math.max(1, Math.ceil(sourceH))
    const ctx = sliceCanvas.getContext("2d")
    if (!ctx) break
    ctx.drawImage(
      canvas,
      0,
      sourceY,
      canvasWidth,
      sourceH,
      0,
      0,
      canvasWidth,
      sliceCanvas.height
    )

    const sliceData = sliceCanvas.toDataURL("image/png")
    pdf.addImage(sliceData, "PNG", margin, contentTop, imgWidth, slicePdfHeight)

    rendered += slicePdfHeight
    pageIndex += 1
    if (slicePdfHeight <= 0) break
  }

  pdf.save("clinical-homework.pdf")
}

export function VignetteGenerator({
  scenario,
  skill,
  reflection,
  clientId,
}: VignetteGeneratorProps) {
  const worksheetRef = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  const handleDownloadPdf = useCallback(async () => {
    const el = worksheetRef.current
    if (!el) return

    setIsExporting(true)
    try {
      await downloadPDF(el, clientId)
    } finally {
      setIsExporting(false)
    }
  }, [clientId])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          Generated Vignette
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          id="worksheet"
          ref={worksheetRef}
          className="space-y-6 rounded-lg border border-border bg-white p-6 shadow-sm"
        >
          <section className="rounded-lg border border-border bg-muted/30 p-6">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Step 1 · The Scenario
            </h4>
            <p className="whitespace-pre-wrap leading-relaxed text-foreground">
              {scenario || "No scenario content available."}
            </p>
          </section>
          <section className="rounded-lg border border-border bg-muted/30 p-6">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Step 2 · The Skill
            </h4>
            <p className="whitespace-pre-wrap leading-relaxed text-foreground">
              {skill ||
                "No skill content available. Your backend may need to return a 'skill' field."}
            </p>
          </section>
          <section className="rounded-lg border border-border bg-muted/30 p-6">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Step 3 · Your Reflection
            </h4>
            <p className="whitespace-pre-wrap leading-relaxed text-foreground">
              {reflection ||
                "No reflection content available. Your backend may need to return a 'reflection' field."}
            </p>
          </section>
        </div>

        <div className="flex justify-end border-t border-border pt-4">
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={handleDownloadPdf}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing PDF…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download as PDF
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
