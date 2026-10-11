/**
 * Regression tests for audit actor formatting (lib/audit-actor.ts).
 *
 * Verifies null-safety and neutral attribution per clinical audit trail requirements:
 *   1. fmtAuditActor(null) renders the neutral label and does not throw
 *   2. fmtAuditActor(undefined) renders the neutral label and does not throw
 *   3. fmtAuditActor("") and whitespace strings render the neutral label and do not throw
 *   4. Valid UUID string renders first 8 chars + ellipsis (identical to fmtShortId)
 *   5. Fallback label is strictly neutral ("unknown actor") and does not attribute to client
 *
 * Run via:
 *   node tests/audit-actor.test.mjs
 */
import assert from "node:assert/strict";

import {
  fmtAuditActor,
  UNKNOWN_ACTOR_LABEL,
} from "../lib/audit-actor.ts";

let passed = 0;
function pass(name) {
  passed += 1;
  console.log(`PASS  ${passed} ${name}`);
}

async function main() {
  /* 1. null actor renders neutral label without throwing TypeError */
  assert.doesNotThrow(() => {
    const res = fmtAuditActor(null);
    assert.equal(res, "unknown actor");
    assert.equal(res, UNKNOWN_ACTOR_LABEL);
  }, "fmtAuditActor(null) must not throw");
  pass("null actor: returns neutral label 'unknown actor' and does not throw");

  /* 2. undefined actor renders neutral label without throwing TypeError */
  assert.doesNotThrow(() => {
    const res = fmtAuditActor(undefined);
    assert.equal(res, "unknown actor");
  }, "fmtAuditActor(undefined) must not throw");
  pass("undefined actor: returns neutral label 'unknown actor' and does not throw");

  /* 3. empty string and whitespace tolerate safely without throwing */
  assert.equal(fmtAuditActor(""), "unknown actor");
  assert.equal(fmtAuditActor("   "), "unknown actor");
  assert.equal(fmtAuditActor("\t\n"), "unknown actor");
  pass("empty string and whitespace: returns neutral label 'unknown actor'");

  /* 4. valid UUID renders 8-char prefix + ellipsis identical to fmtShortId */
  const sampleUuid = "e7b30182-5942-4b6a-9321-c7f8a3b591de";
  assert.equal(fmtAuditActor(sampleUuid), "e7b30182…");
  assert.equal(fmtAuditActor("usr_1234567890"), "usr_1234…");
  pass("valid actor ID: formats 8-character prefix with ellipsis (inert parity)");

  /* 5. attribution safety: neutral label must never fabricate attribution to client */
  const fallback = fmtAuditActor(null);
  assert.ok(
    !fallback.toLowerCase().includes("client"),
    "NULL actor must never be attributed to client"
  );
  assert.ok(
    fallback === "unknown actor" || fallback === "not attributed",
    "Fallback must be an approved neutral label"
  );
  pass("clinical governance: neutral attribution avoids fabricating client actor");
}

const TOTAL_CHECKS = 5;

main()
  .then(() => {
    if (passed !== TOTAL_CHECKS) {
      throw new Error(`${passed} checks ran but TOTAL_CHECKS is ${TOTAL_CHECKS}`);
    }
    console.log(`\n${passed}/${TOTAL_CHECKS} checks passed`);
  })
  .catch((err) => {
    console.error(`\nFAILED after ${passed} passing checks:\n`, err);
    process.exitCode = 1;
  });
