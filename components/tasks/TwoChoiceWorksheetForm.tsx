import React from "react";
import { ReflectionField } from "./ReflectionField";

export interface TwoChoiceData {
  title: string;
  prompts: Array<{ question: string; options: [string, string] }>;
  answers: Array<0 | 1 | null>;
  reflection: string;
  reflection_prompt: string;
  notes?: string;
}

export function createEmptyTwoChoiceData(
  title = "Interactive Worksheet", 
  prompts: Array<{ question: string; options: [string, string] }> = [],
  reflection_prompt = "Reflect on your choices above."
): TwoChoiceData {
  return {
    title,
    prompts,
    answers: prompts.map(() => null),
    reflection: "",
    reflection_prompt,
  };
}

interface TwoChoiceWorksheetFormProps {
  data: TwoChoiceData;
  onChange: (data: TwoChoiceData) => void;
  disabled?: boolean;
}

export function TwoChoiceWorksheetForm({
  data,
  onChange,
  disabled,
}: TwoChoiceWorksheetFormProps) {
  const updateAnswer = (index: number, answerIndex: 0 | 1) => {
    if (disabled) return;
    const newAnswers = [...data.answers];
    newAnswers[index] = answerIndex;
    onChange({ ...data, answers: newAnswers });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        {data.notes && (
          <div className="rounded-lg bg-blue-50/50 p-4 text-sm text-blue-900 border border-blue-100 dark:bg-blue-950/20 dark:text-blue-200 dark:border-blue-900/50">
            <strong>Practitioner Notes: </strong>
            {data.notes}
          </div>
        )}
        
        <h2 className="text-xl font-bold">{data.title}</h2>
      </div>

      <div className="space-y-6">
        {data.prompts.map((prompt, i) => {
          const selectedAnswer = data.answers[i];
          
          return (
            <div key={i} className="space-y-3 rounded-lg border bg-card p-6 shadow-sm">
              <h3 className="font-medium">{prompt.question}</h3>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => updateAnswer(i, 0)}
                  className={`flex-1 rounded-lg border p-4 text-left transition-all ${
                    selectedAnswer === 0
                      ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                      : "hover:bg-accent hover:border-accent-foreground/20"
                  } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {prompt.options[0]}
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => updateAnswer(i, 1)}
                  className={`flex-1 rounded-lg border p-4 text-left transition-all ${
                    selectedAnswer === 1
                      ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                      : "hover:bg-accent hover:border-accent-foreground/20"
                  } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {prompt.options[1]}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ReflectionField
        prompt={data.reflection_prompt}
        value={data.reflection}
        onChange={(val) => onChange({ ...data, reflection: val })}
        disabled={disabled}
      />
    </div>
  );
}
