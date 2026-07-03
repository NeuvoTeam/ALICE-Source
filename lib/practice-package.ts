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