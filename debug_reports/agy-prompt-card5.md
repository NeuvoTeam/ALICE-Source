TASK (ALICE, branch alan, LOCAL ONLY): apply one contrast fix. Two files, three lines, nothing else.

HARD CONSTRAINTS
- Touch ONLY these two files: app/globals.css and components/ui/toast.tsx.
- Do NOT run npm run build, npm test, npx tsc, npm run lint, or any gate. The reviewer runs them.
- Do NOT git add, git commit, git push, git stash or git checkout. Leave the working tree modified.
- Do NOT create, rename or delete any file.
- Do NOT change any other line, including the two --destructive lines (one in :root, one in .dark).
- Do not add comments anywhere except where this spec explicitly puts one.

CHANGE 1 - app/globals.css, inside the :root block
Find the line (exactly, two leading spaces):
  --destructive-foreground: oklch(0.577 0.245 27.325);
Replace it with (note the trailing comment, keep the two leading spaces and the semicolon):
  --destructive-foreground: oklch(1 0 0); /* = the components' text-white: 4.76:1 on --destructive */

CHANGE 2 - app/globals.css, inside the .dark block
Find the line (exactly, two leading spaces):
  --destructive-foreground: oklch(0.637 0.237 25.331);
Replace it with:
  --destructive-foreground: oklch(1 0 0); /* = the components' text-white: 10.06:1 on --destructive */

CHANGE 3 - components/ui/toast.tsx, in the ToastDescription component
Find the line (exactly, four leading spaces):
    className={cn('text-sm opacity-90', className)}
Replace it with:
    className={cn('text-sm opacity-90 group-[.destructive]:opacity-100', className)}

WHY (context only - do not put this reasoning in the code, and do not act on it beyond the three replacements)
The light theme sets --destructive and --destructive-foreground to the same value, so the destructive
toast paints red text on a red background (measured 1.00:1). components/ui/button.tsx and
components/ui/badge.tsx already render the destructive variant with a literal text-white, so the token
is aligned with them: pure white, oklch(1 0 0), which measures 4.76:1 on the light --destructive and
10.06:1 on the dark one. The dark pair was also failing (2.63:1 title, 2.41:1 description).
ToastDescription additionally carries opacity-90, which composites the description text against the
toast background and caps its contrast at 4.00:1 in the light theme; the group-[.destructive] override
restores full opacity for the destructive variant only, taking the description to 4.76:1. Non-destructive
toasts keep opacity-90 exactly as before.

WHEN DONE
Report, as plain text, in this order:
1. The output of: git --no-pager diff -- app/globals.css components/ui/toast.tsx
2. The output of: git status --porcelain
3. One line per file stating how many lines you changed.
Do not summarise anything else.
