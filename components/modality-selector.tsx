import React from "react";
import type { Modality } from "@/types/tasks";
import { MODALITIES } from "@/lib/ai/schemas";

interface ModalitySelectorProps {
  selectedModalities: Modality[];
  onChange: (modalities: Modality[]) => void;
  disabled?: boolean;
}

export function ModalitySelector({ selectedModalities, onChange, disabled }: ModalitySelectorProps) {
  const normalizedSelected: Modality[] = React.useMemo(() => {
    const list = Array.isArray(selectedModalities) ? selectedModalities : [];
    const valid = new Set<Modality>(MODALITIES);
    const cleaned = list
      .map((m) => (typeof m === "string" ? (m.trim().toUpperCase() as Modality) : m))
      .filter((m): m is Modality => valid.has(m));
    const unique = Array.from(new Set(cleaned));
    return unique.length > 0 ? unique : ["CBT"];
  }, [selectedModalities]);

  const toggleModality = (modality: Modality) => {
    if (normalizedSelected.includes(modality)) {
      if (normalizedSelected.length > 1) {
        onChange(normalizedSelected.filter((m) => m !== modality));
      }
    } else {
      if (normalizedSelected.length < 3) {
        onChange([...normalizedSelected, modality]);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        Clinical Modalities (1-3)
      </label>
      <div className="flex flex-wrap gap-2">
        {MODALITIES.map((modality) => {
          const isSelected = normalizedSelected.includes(modality);
          const isAtLimit = normalizedSelected.length >= 3 && !isSelected;
          
          return (
            <button
              key={modality}
              type="button"
              disabled={disabled || isAtLimit}
              onClick={() => toggleModality(modality)}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border h-10 px-4 py-2
                ${isSelected 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "bg-background border-input hover:bg-accent hover:text-accent-foreground"
                }`}
            >
              {modality}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        Select up to 3 modalities to ground the generated task.
      </p>
    </div>
  );
}
