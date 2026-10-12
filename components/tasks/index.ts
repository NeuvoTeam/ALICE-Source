/**
 * components/tasks/index.ts
 *
 * Public barrel for the practice-tasks module.
 */

export { DynamicTaskForm } from "./DynamicTaskForm";
export type { TaskVariant } from "./DynamicTaskForm";

export { ActivityScheduleForm, createEmptySchedule, DAYS, TIME_SLOTS } from "./ActivityScheduleForm";
export type { WeeklySchedule, TimeBlock, Day } from "./ActivityScheduleForm";

export { ThreeCsForm, createEmptyThreeCsData } from "./ThreeCsForm";
export type { ThreeCsData } from "./ThreeCsForm";
