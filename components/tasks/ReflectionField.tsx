import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ReflectionFieldProps {
  prompt: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ReflectionField({ prompt, value, onChange, disabled }: ReflectionFieldProps) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-6 shadow-sm">
      <div className="space-y-1">
        <Label htmlFor="reflection" className="text-base font-semibold">
          Reflection
        </Label>
        <p className="text-sm text-muted-foreground">{prompt}</p>
      </div>
      <Textarea
        id="reflection"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="min-h-[150px] resize-y"
        placeholder="Type your reflection here..."
      />
    </div>
  );
}
