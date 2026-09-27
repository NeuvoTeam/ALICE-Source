import { z } from "zod";

export const WeeklyActivityScheduleSchema = z.object({
  task_type: z.literal("activity_log"),
  activity_date: z.string().describe("ISO date of the recorded activity (YYYY-MM-DD). Use today's date if unsure."),
  activity_description: z.string().describe("Pre-populated activity categories, instructions, and target timeslots. Must be structured to guide the client on what to schedule."),
  pleasure_rating: z.number().min(0).max(10).describe("Placeholder for pleasure rating (0)"),
  mastery_rating: z.number().min(0).max(10).describe("Placeholder for mastery rating (0)"),
  notes: z.string().optional().describe("Clinical instructions for the client regarding this weekly schedule")
});

export const ThreeCsSchema = z.object({
  task_type: z.literal("thought_record"),
  situation: z.string().describe("The specific situation or trigger the client should monitor"),
  automatic_thought: z.string().describe("Examples of automatic thoughts to catch or specific instructions for Catch It"),
  emotions: z.array(z.object({
    label: z.string(),
    intensity: z.number().min(0).max(100)
  })).describe("Expected emotions to track (can be empty array if client should fill)"),
  evidence_for: z.string().describe("Prompt or instructions for checking evidence FOR the thought (Check It)"),
  evidence_against: z.string().describe("Prompt or instructions for checking evidence AGAINST the thought (Check It)"),
  balanced_thought: z.string().describe("Prompt or instructions for correcting with a balanced thought (Correct It)"),
  outcome_emotion_intensity: z.number().min(0).max(100).describe("Placeholder outcome emotion intensity (0)"),
  notes: z.string().optional().describe("Clinical instructions for the client regarding this 3 C's exercise")
});

export const ReflectionPromptSchema = z.object({
  task_type: z.literal("reflection_prompt"),
  prompt: z.string().describe("Targeted journaling/drawing prompt for the iPad canvas"),
  suggested_background: z.enum(["blank", "lined", "dotted"]).describe("Recommended canvas background for this reflection"),
  notes: z.string().optional().describe("Any additional clinician notes")
});

export const StructuredTaskSchema = z.discriminatedUnion("task_type", [
  WeeklyActivityScheduleSchema,
  ThreeCsSchema,
  ReflectionPromptSchema
]);

export type StructuredTask = z.infer<typeof StructuredTaskSchema>;
