import type { StructuredTask } from "@/lib/ai/schemas"

/**
 * The clinician-facing practice package, as `/generate/practice-package` returns it and stores
 * it (backend/CloudFlare.js).
 */
export type PracticePackage = {
  homework: string[];

  scenario: {
    title: string;
    difficulty: "easy" | "medium" | "hard";
    situation: string;
    objectives: string[];
    coachTips: string[];
  };

  quiz: {
    question: string;
    answer: string;
    rationale: string;
  }[];
};

/**
 * `sessions.practice_package` carries TWO shapes and always has: the Worker stores a
 * `StructuredTask` when `/generate/structured-task` runs (the client then saves the enriched
 * task itself — `components/vignette-generator.tsx`) and a `PracticePackage` when
 * `/generate/practice-package` runs (`backend/CloudFlare.js`). Readers must discriminate
 * instead of assuming one shape. `task_type` is the discriminant: the structured shape always
 * carries it and the package shape never does.
 */
export type StoredPracticeTask = StructuredTask | PracticePackage;

/** Narrows a stored practice package to the structured-task shape (see `StoredPracticeTask`). */
export function isStructuredTask(
  value: StoredPracticeTask | null | undefined
): value is StructuredTask {
  return !!value && typeof value === "object" && "task_type" in value
}