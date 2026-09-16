/**
 * Regression tests for the programmatic A4 export (`lib/export-practice-pdf.ts`).
 *
 *   npm run test:pdf   ->  node tests/pdf-export.test.mjs
 *
 * No browser, no network, no canvas: Node's own type stripping loads the exporter
 * directly, and the assertions read the PDF's content stream, so a pagination,
 * margin or text-hygiene regression fails the build instead of shipping a clipped
 * or colourless document to a client.
 *
 * jsPDF writes text as `<x> <y> Td` in POINTS with the origin at the page's
 * BOTTOM-LEFT corner, whatever unit the document uses — hence the conversion
 * `yMm = A4.PAGE_H - yStream / A4.PT_PER_MM` used throughout.
 */
import assert from "node:assert/strict"

import {
  A4,
  buildPracticePackageFileName,
  buildPracticePackagePdf,
  collectHomeworkTasks,
  sanitizeForPdf,
} from "../lib/export-practice-pdf.ts"

const GENERATED_AT = new Date("2026-09-16T09:30:00Z")

/** Mirrors the payload `POST /generate/practice-package` stores. */
const pkg = (homework) => ({
  homework,
  scenario: { title: "s", difficulty: "easy", situation: "s", objectives: [], coachTips: [] },
  quiz: [],
})

/** Wraps to two lines at 10.5 pt inside the 167.5 mm task column. */
const longTask = (i) =>
  `Task ${i}: log your mood and rate anxiety before bed each evening, then note the ` +
  `situation that preceded the strongest urge you recorded during the day`

/** Every text baseline in the document, in millimetres measured from the top edge. */
function textBaselines(pdf) {
  return [...pdf.output().matchAll(/([\d.-]+) ([\d.-]+) Td/g)]
    .map((match) => Number(match[2]))
    .map((y) => A4.PAGE_H - y / A4.PT_PER_MM)
}

/** Every string actually drawn, so layout can be compared without PDF metadata. */
function textRuns(pdf) {
  return [...pdf.output().matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g)].map((match) => match[1])
}

let passed = 0

function pass(label, extra = "") {
  passed += 1
  console.log(`PASS  ${passed} ${label}${extra ? "  " + extra : ""}`)
}

async function main() {
  /* 1. The page grid is internally consistent and leaves a printable margin. */
  assert.equal(A4.CONTENT_W, 174)
  assert.equal(A4.CONTENT_BOTTOM + A4.MARGIN.bottom, A4.PAGE_H)
  assert.equal(A4.CONTENT_TOP, A4.MARGIN.top)
  assert.ok(A4.CONTENT_BOTTOM > A4.CONTENT_TOP + 200, "usable height must exceed 200 mm")
  assert.ok(A4.FOOTER_BASELINE <= A4.PAGE_H - 10, "footer must stay 10 mm off the paper edge")
  pass("geometry: 174 mm column, body stops at 275 mm, footer at 281 mm")

  /* 2. Glyphs the built-in fonts cannot draw never reach the encoder. */
  const sanitized = sanitizeForPdf("☐ ⚠️ → “curly” — dash é 100%")
  assert.equal(sanitized, '! -> "curly" - dash é 100%')
  assert.ok(/^[\u0020-\u00FF]*$/.test(sanitized), "output must stay inside Latin-1")
  pass("sanitize: ☐ dropped, ⚠ and arrows mapped, Latin-1 accents kept")

  /* 3. Homework rows are coerced exactly as the worksheet coerces them. */
  assert.deepEqual(
    collectHomeworkTasks(pkg(["Log mood", { task: "Rate anxiety" }, "", null, 7])),
    ["Log mood", "Rate anxiety", "7"]
  )
  assert.deepEqual(collectHomeworkTasks(null), [])
  assert.deepEqual(collectHomeworkTasks(pkg([])), [])
  pass("collect: string rows, { task } rows, blanks and a null package")

  /* 4. A short package is one page with its header, copy and footer present. */
  const short = buildPracticePackagePdf(pkg(["Log mood daily"]), {
    clientName: "Sample client",
    sessionName: "Session 1",
    generatedAt: GENERATED_AT,
  })
  const shortText = short.output()

  assert.equal(short.getNumberOfPages(), 1)
  assert.match(shortText, /^%PDF-/)
  assert.match(shortText, /\(Client Practice Task\) Tj/)
  assert.match(shortText, /\(Log mood daily\) Tj/)
  assert.match(shortText, /\(Page 1 of 1\) Tj/)
  assert.ok(short.output("arraybuffer").byteLength > 1000)
  pass("short package: single-page PDF", `${short.output("arraybuffer").byteLength} bytes`)

  /* 5. No package still yields a printable page, not a blank one. */
  const blank = buildPracticePackagePdf(null, { generatedAt: GENERATED_AT })
  assert.equal(blank.getNumberOfPages(), 1)
  assert.match(blank.output(), /\(No Practice Package generated\.\) Tj/)
  pass("empty package: renders the empty-state copy on one page")

  /* 6. The tall case — the content that used to be clipped off the sheet. */
  const tall = buildPracticePackagePdf(
    pkg(Array.from({ length: 25 }, (_, i) => longTask(i + 1))),
    { clientName: "Sample client", sessionName: "Session 12", generatedAt: GENERATED_AT }
  )

  const tallText = tall.output()
  const baselines = textBaselines(tall)

  assert.ok(tall.getNumberOfPages() >= 2, "25 wrapped tasks cannot fit on one A4 page")

  for (let i = 1; i <= 25; i += 1) {
    assert.ok(tallText.includes(`Task ${i}:`), `task ${i} disappeared from the document`)
  }

  const body = baselines.filter((y) => y <= A4.CONTENT_BOTTOM + 0.5)
  const footer = baselines.filter((y) => y > A4.CONTENT_BOTTOM + 0.5)

  assert.ok(body.length > 25, "every task line must be positioned on a page")
  assert.ok(
    Math.min(...body) >= A4.CONTENT_TOP - 0.01,
    `body text above the top margin: ${Math.min(...body)} mm`
  )
  assert.ok(
    Math.max(...body) <= A4.CONTENT_BOTTOM + 0.01,
    `body text below the content floor: ${Math.max(...body)} mm`
  )
  assert.ok(
    footer.every((y) => Math.abs(y - A4.FOOTER_BASELINE) < 0.01),
    "only footers may occupy the bottom band"
  )
  assert.ok(
    Math.max(...body) > A4.CONTENT_BOTTOM - 20,
    "the break must fill the page rather than waste it"
  )
  assert.doesNotMatch(tallText, /NaN/)
  pass(
    "25 tasks: multi-page, nothing dropped, all baselines inside the printable box",
    `${tall.getNumberOfPages()} pages, deepest body line ${Math.max(...body).toFixed(1)} mm`
  )

  /* 7. More content means more pages. */
  const wider = buildPracticePackagePdf(
    pkg(Array.from({ length: 60 }, (_, i) => longTask(i + 1))),
    { generatedAt: GENERATED_AT }
  )
  assert.ok(
    wider.getNumberOfPages() > tall.getNumberOfPages(),
    "pagination must scale with the homework list"
  )
  pass("60 tasks: pagination scales", `${wider.getNumberOfPages()} pages`)

  /* 8. One pathological 6,000-character task is hard-split, never overflowed. */
  const monster = buildPracticePackagePdf(pkg(["x".repeat(6000)]), {
    generatedAt: GENERATED_AT,
  })
  const monsterBaselines = textBaselines(monster)

  assert.ok(monster.getNumberOfPages() >= 2, "an unbroken 6,000-character word must paginate")
  assert.ok(monsterBaselines.length >= 40, "the word must be split into many lines")
  assert.ok(Math.max(...monsterBaselines) <= A4.FOOTER_BASELINE + 0.01)
  assert.doesNotMatch(monster.output(), /NaN/)
  pass(
    "6000-character task: hard-split across pages without overflow",
    `${monsterBaselines.length} lines`
  )

  /* 9. Identical input produces an identical layout (no drifting positions). */
  const first = buildPracticePackagePdf(pkg(["Log mood", "Rate anxiety"]), {
    generatedAt: GENERATED_AT,
  })
  const second = buildPracticePackagePdf(pkg(["Log mood", "Rate anxiety"]), {
    generatedAt: GENERATED_AT,
  })
  assert.deepEqual(textBaselines(first), textBaselines(second))
  assert.deepEqual(textRuns(first), textRuns(second))
  pass("determinism: identical layout for identical input")

  /* 10. The footer is stamped on every page, including the last. */
  const total = tall.getNumberOfPages()
  for (let page = 1; page <= total; page += 1) {
    assert.match(tallText, new RegExp(`\\(Page ${page} of ${total}\\) Tj`))
  }
  pass("footer: 'Page x of y' stamped on every page")

  /* 11. The download name is structured, human-readable and space-free. */
  const named = buildPracticePackageFileName({
    clientName: "Jane May Low",
    generatedAt: new Date(2026, 8, 16),
  })
  assert.equal(named, "ALICE_PracticePackage_20260916_JaneMayLow.pdf")
  assert.ok(!/[<>:"|?*\\/]/.test(named), "no filesystem-hostile characters")
  assert.ok(!named.includes(" "), "no spaces")
  pass("filename: ALICE_PracticePackage_YYYYMMDD_ClientName.pdf", named)

  /* 12. Hostile names are folded, capped, and never invented. */
  assert.equal(
    buildPracticePackageFileName({
      clientName: "Seán O'Brien / Ltd.",
      generatedAt: new Date(2026, 8, 16),
    }),
    "ALICE_PracticePackage_20260916_SeanOBrienLtd.pdf"
  )
  assert.equal(
    buildPracticePackageFileName({ generatedAt: new Date(2026, 8, 16) }),
    "ALICE_PracticePackage_20260916.pdf",
    "a missing client name drops the segment"
  )
  assert.equal(
    buildPracticePackageFileName({
      clientName: "漢字クライアント",
      generatedAt: new Date(2026, 8, 16),
    }),
    "ALICE_PracticePackage_20260916.pdf",
    "an unrenderable name drops the segment"
  )
  assert.equal(
    buildPracticePackageFileName({
      clientName: "A".repeat(80),
      generatedAt: new Date(2026, 8, 16),
    }),
    `ALICE_PracticePackage_20260916_${"A".repeat(48)}.pdf`,
    "the name segment is capped at 48 characters"
  )
  pass("filename: accents folded, illegal characters dropped, capped, no invented segment")
}

const TOTAL_CHECKS = 12

main()
  .then(() => console.log(`\n${passed}/${TOTAL_CHECKS} checks passed`))
  .catch((err) => {
    console.error(`\nFAILED after ${passed} passing checks:\n`, err)
    process.exitCode = 1
  })
