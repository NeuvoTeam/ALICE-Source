/**
 * Fails a change that touches behaviour but leaves `documentation.md` behind.
 *
 *   npm run docs:check                                      working tree + untracked, against HEAD
 *   node scripts/check-docs.mjs --staged --message <file>   what .githooks/commit-msg runs
 *   node scripts/check-docs.mjs --range "$BASE...HEAD"      what the docs-check workflow runs
 *
 * The rule and its rationale live in `AGENTS.md` and `documentation.md` §14. A change that
 * genuinely needs no documentation edit opts out by putting `DOCS: none` in the commit message,
 * or by setting `DOCS_CHECK=off` locally.
 *
 * Plain Node, no dependencies, no network.
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const DOC = "documentation.md"

/** Paths whose change implies a documentation edit (`documentation.md` §14). */
const TRIGGERS = [
  /^app\//,
  /^components\//,
  /^stores\//,
  /^lib\//,
  /^hooks\//,
  /^backend\//,
  /^workers\//,
  /^supabase\/migrations\//,
  /^tests\//,
  /^package\.json$/,
  /^wrangler\.jsonc$/,
  /^next\.config\.mjs$/,
  /^tsconfig\.json$/,
]

const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)
const valueOf = (flag) => {
  const index = args.indexOf(flag)
  return index === -1 ? null : args[index + 1] ?? null
}

/** `git` output, or "" when the command fails — a missing ref must not crash the check. */
function git(...argv) {
  try {
    return execFileSync("git", argv, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()
  } catch {
    return ""
  }
}

const toPaths = (text) => text.split(/\r?\n/).filter(Boolean)

function changedPaths() {
  if (has("--staged")) {
    return toPaths(git("diff", "--name-only", "--cached"))
  }

  const range = valueOf("--range")
  if (range) {
    const separator = range.includes("...") ? "..." : ".."
    const [rawBase, rawHead = "HEAD"] = range.split(separator)

    // A first push (or a force-push) reports an all-zeros base: nothing to compare against.
    if (!rawBase || /^0+$/.test(rawBase)) return []

    const base = git("rev-parse", "--verify", "--quiet", `${rawBase}^{commit}`)
    if (!base) {
      console.log(`docs:check — base ${rawBase} is not available in this clone; skipping.`)
      return []
    }

    return toPaths(git("diff", "--name-only", `${base}..${rawHead || "HEAD"}`))
  }

  return [
    ...toPaths(git("diff", "--name-only")),
    ...toPaths(git("diff", "--name-only", "--cached")),
    ...toPaths(git("ls-files", "--others", "--exclude-standard")),
  ]
}

/** The message being committed (`--message` from the hook), else the last commit's body. */
function commitMessage() {
  if (process.env.DOCS_CHECK_MESSAGE) return process.env.DOCS_CHECK_MESSAGE

  // `commit-msg` receives the message file as `$1`. A `pre-commit` hook cannot: Git writes
  // COMMIT_EDITMSG only after pre-commit has run, so that hook never sees `DOCS: none`.
  const sources = [valueOf("--message"), git("rev-parse", "--git-path", "COMMIT_EDITMSG")]

  for (const path of sources) {
    if (!path) continue
    try {
      return readFileSync(path, "utf8")
    } catch {
      // Not on disk yet (e.g. `--amend -m …`) — try the next source.
    }
  }

  return git("log", "-1", "--pretty=%B")
}

const paths = [...new Set(changedPaths())]
const message = commitMessage()

if (process.env.DOCS_CHECK === "off" || /(^|\n)\s*DOCS:\s*none\b/i.test(message)) {
  console.log("docs:check — opted out (DOCS: none).")
  process.exit(0)
}

const triggering = paths.filter((path) => TRIGGERS.some((pattern) => pattern.test(path)))

if (triggering.length === 0) {
  console.log("docs:check — ok (no behaviour-affecting path changed).")
  process.exit(0)
}

if (paths.includes(DOC)) {
  console.log(`docs:check — ok (${DOC} moved with ${triggering.length} path(s)).`)
  process.exit(0)
}

console.error(
  [
    `docs:check FAILED — ${DOC} was not updated.`,
    "",
    "These paths can change behaviour:",
    ...triggering.map((path) => `  ${path}`),
    "",
    `Update ${DOC} in the same change: §14 "Maintaining this document" maps a change to the`,
    "section that owns it.",
    "Bypass this gate by adding 'DOCS: none' anywhere in your commit message (or set DOCS_CHECK=off for a local override).",
  ].join("\n")
)

process.exit(1)
