# ALICE card 8i — measurement harness route (author this ONE file, nothing else)

Working directory: D:\Work\Neuvo\ALICE\Source

Create exactly one new file — `app/__fontprobe/page.tsx` — with byte-for-byte this
content (it is a throwaway probe route, deleted again before the commit):

```tsx
"use client";

/**
 * app/__fontprobe/page.tsx
 *
 * THROWAWAY measurement harness (ALICE card 8i). Mounts the real chart-tooltip
 * consumer from `components/ui/chart.tsx` (the `font-mono` span at ~line 236)
 * so a browser probe can read its computed font in the webfont-loaded and
 * webfont-blocked states. No shipped route mounts a chart, so this is the only
 * way to sample that consumer. NEVER commit this file.
 */

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const data = [
  { name: "Mon", value: 17 },
  { name: "Tue", value: 23 },
];

const config = {
  value: { label: "Value", color: "#00a3aa" },
} satisfies ChartConfig;

export default function FontProbePage() {
  return (
    <div style={{ width: 480, height: 320, padding: 16 }}>
      <ChartContainer config={config} className="h-[240px] w-[400px]">
        <BarChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="name" />
          <ChartTooltip
            content={<ChartTooltipContent />}
            defaultIndex={0}
          />
          <Bar dataKey="value" fill="var(--color-value)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
```

Rules:

- Do NOT modify any other file. In particular do NOT touch `app/globals.css`,
  `app/layout.tsx`, `components/ui/chart.tsx` or `eslint.config.mjs`.
- Do NOT run `npm`, `npx`, `next build`, `next dev`, lint or tests — the operator
  runs those. Do NOT commit. Do NOT push.
- Do NOT create any other file or directory.

Report back exactly two things: the created file path, and the output of
`git status --porcelain`.
