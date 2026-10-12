"use client";

import React from "react";
import type { Modality } from "@/types/tasks";
import { MODALITIES } from "@/lib/ai/schemas";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const checkboxes = Array.from(
        e.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="checkbox"]')
      ).filter((cb) => !cb.disabled);

      if (checkboxes.length === 0) return;

      const currentIndex = checkboxes.findIndex((cb) => cb === document.activeElement);
      let nextIndex = 0;

      if (currentIndex !== -1) {
        if (e.key === "ArrowDown") {
          nextIndex = (currentIndex + 1) % checkboxes.length;
        } else {
          nextIndex = (currentIndex - 1 + checkboxes.length) % checkboxes.length;
        }
      } else if (e.key === "ArrowUp") {
        nextIndex = checkboxes.length - 1;
      }

      checkboxes[nextIndex]?.focus();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="modalities-trigger"
            variant="outline"
            disabled={disabled}
            className="w-full justify-between text-left"
          >
            <span className="truncate min-w-0">
              Clinical Modalities (1-3) · {normalizedSelected.join(", ")}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-[12rem] max-w-[calc(100vw-2rem)] p-2"
        >
          <div
            role="group"
            aria-labelledby="modalities-trigger"
            className="flex flex-col gap-1 p-1"
            onKeyDown={handleKeyDown}
          >
            {MODALITIES.map((modality) => {
              const isSelected = normalizedSelected.includes(modality);
              const isAtLimit = normalizedSelected.length >= 3 && !isSelected;
              const isDisabled = disabled || isAtLimit;

              return (
                <label
                  key={modality}
                  htmlFor={`modality-${modality}`}
                  className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                    isDisabled ? "pointer-events-none opacity-50" : "cursor-pointer"
                  }`}
                >
                  <Checkbox
                    id={`modality-${modality}`}
                    checked={isSelected}
                    disabled={isDisabled}
                    onCheckedChange={() => toggleModality(modality)}
                  />
                  {modality}
                </label>
              );
            })}
            {normalizedSelected.length >= 3 && (
              <div className="text-xs text-muted-foreground px-2 py-1" aria-live="polite">
                Maximum of 3 selected — clear one to choose another.
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <p className="text-sm text-muted-foreground">
        Select up to 3 modalities to ground the generated task.
      </p>
    </div>
  );
}
