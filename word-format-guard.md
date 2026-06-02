---
name: word-format-guard
description: >
  Companion skill for word-chisel. Before editing any Word document, scan and document its
  format skeleton — fonts, sizes, styles, alignment, spacing, underlines, colors. Then create
  an edit plan that preserves every formatting detail. Use whenever word-chisel is invoked
  or when the user asks to edit a .docx/.doc file.
---

# Word Format Guard

Companion to word-chisel. This skill ensures formatting is **never lost** during edits.

## Why This Exists

Without format awareness, edits can break:
- Underlines, strikethroughs, and text colors
- Bold/italic runs within paragraphs
- Page-level layout and paragraph alignment
- Font sizes and typefaces

This skill forces a **scan → plan → execute → verify** workflow that preserves every formatting detail.

## Phase 1: Scan — Build the Format Skeleton

Before making any edits, call `read_docx` with `includeRunDetail: true` on ALL paragraphs that will be modified.

For each target paragraph, build a format skeleton:

```
Paragraph [N]:
  fullText: "..."
  style: "BodyText" (or undefined)
  runs:
    [0] text="..."  bold=yes  italic=no   underline=no       font="Calibri"   size=22  color="auto"
    [1] text="..."  bold=no   italic=yes  underline=single   font="Calibri"   size=22  color="FF0000"
    [2] text="..."  bold=no   italic=no   underline=no       font="Arial"     size=20  color="auto"
```

**Document this skeleton visibly** before proceeding. Show the user what formatting exists so they understand what will be preserved.

Also note paragraph-level properties from `list_paragraphs`:
- Paragraph style (e.g. "Heading1", "BodyText")
- Whether the paragraph is a heading, body text, or other type

## Phase 2: Plan — Map Edits to Format Runs

Based on the skeleton, determine exactly which runs will be affected:

| Para | Run | Old Text | New Text | Formatting Preserved |
|------|-----|----------|----------|---------------------|
| 3 | 0 | "old" | "new" | bold, Calibri 22pt |
| 5 | 1 | "foo" | "bar" | italic, underline, red |

**Rules for the plan:**

1. If replacing text within a SINGLE run — the run's formatting is automatically preserved by word-chisel. No extra work needed.

2. If the replacement spans MULTIPLE runs (cross-run match) — decide on the strategy:
   - `firstRunFormatting`: all replacement text inherits the first run's style. Use when you want unified formatting.
   - `distributeProportional`: replacement text is split proportionally, each portion keeps its run's original style. Use when formatting variation matters and must be preserved.

3. If a paragraph has mixed formatting you want to KEEP — use `distributeProportional` and ensure the replacement text distribution respects the original formatting boundaries.

4. If a paragraph has formatting you want to SIMPLIFY — use `firstRunFormatting` to collapse into a single style.

## Phase 3: Execute — One Paragraph at a Time

Execute `replace_text` calls **one paragraph at a time**:

```
For each paragraph in the plan:
  1. Call read_docx({ paragraphs: [N], includeRunDetail: true }) to get the LATEST text
  2. Verify the search text still matches exactly
  3. Call replace_text({ paragraphIndex: N, search: "...", replace: "...", strategy: "..." })
  4. Verify matchCount > 0
```

**Never batch multi-paragraph replacements.** Each paragraph has its own formatting context. Combining them loses structure.

## Phase 4: Verify — Check Formatting Survived

After all edits, re-read the modified paragraphs with `includeRunDetail: true` and compare against the original skeleton:

- Are the same runs bold/italic/underlined?
- Are font names and sizes unchanged?
- Are colors preserved?
- Does the paragraph style still match?

If any formatting is lost, report it to the user.

## Common Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| Underline disappears | Cross-run replacement collapsed into a non-underlined run | Use `distributeProportional` strategy |
| Bold spreads to entire paragraph | `firstRunFormatting` on the first (bold) run | Use `distributeProportional` or target a single run |
| Page layout shifts | Replacing a heading paragraph with body text | Preserve the paragraph style — replace only the text within runs |
| Alignment breaks | Replacing the entire paragraph including its style marker | Only replace `fullText` content, never modify `w:pPr` |
| Font changes unexpectedly | Replacement text inherited font from wrong run | Check the skeleton — ensure the correct run's formatting is the target |

## Example

User: "Update paragraph 5 of the report"

Before touching anything, you output:

```
FORMAT SKELETON — Paragraph 5:
  style: "BodyText"
  Run [0]: "The Q1 revenue was "      (Calibri 11pt, no formatting)
  Run [1]: "$12.5 million"            (Calibri 11pt, BOLD, color: 0070C0)
  Run [2]: " which exceeded targets." (Calibri 11pt, no formatting)

EDIT PLAN:
  Replace "$12.5 million" → "$18.3 million" in Run [1]
  Strategy: single-run match, formatting auto-preserved
```
