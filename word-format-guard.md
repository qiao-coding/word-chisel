---
name: word-format-guard
description: >
  Companion skill for word-chisel. Before editing any Word document, scan and document its
  format skeleton — fonts, sizes, styles, alignment, spacing, underlines, colors. Then create
  an edit plan that preserves every formatting detail. Use whenever word-chisel is invoked
  or when the user asks to edit a .docx/.doc file.
---

# Word Format Guard

Companion to word-chisel. Ensures formatting is **never lost** during edits.

## Terminology

In Word XML, a paragraph is made of **runs** — contiguous text with identical formatting. When presenting information to the user, use "text segment" or "format fragment". Use "run" only in internal reasoning and tool calls.

## Why This Exists

Without format awareness, edits can break underlines, bold/italic boundaries, font sizes, colors, and page layout. This skill enforces a **scan → plan → execute → verify** workflow.

## Critical: Session Consistency

**Pass the same `outputName` through every phase.** The first call to `list_paragraphs` or `read_docx` sets the working copy name. Every subsequent call — `read_docx`, `replace_text`, verification reads — must use the identical `outputName`. If you omit it, the tool creates a separate copy, fragmenting your edits across multiple files.

```
Phase 1: list_paragraphs({ path: "C:/doc.docx", outputName: "my-edit" })
Phase 2: read_docx({ path: "C:/doc.docx", outputName: "my-edit", ... })
Phase 3: replace_text({ path: "C:/doc.docx", outputName: "my-edit", ... })
Phase 4: read_docx({ path: "C:/doc.docx", outputName: "my-edit", ... })
```

## Phase 1: Scan — Build the Format Skeleton

Call `read_docx` with `includeRunDetail: true` on all paragraphs to be modified. Build a format skeleton:

```
Paragraph [3]:
  fullText: "..."
  style: "BodyText"
  segments:
    [0] "The Q1 revenue was "       Calibri 11pt  — plain
    [1] "$12.5 million"             Calibri 11pt  BOLD, color:#0070C0
    [2] " which exceeded targets."  Calibri 11pt  — plain
```

Also note from `list_paragraphs`: paragraph style, heading level, position in document.

## Phase 2: Plan — Choose Strategy Per Match

Based on the skeleton, map each edit to a strategy. **You only decide the strategy — the tool handles the math.**

| Scenario | Strategy | Why |
|----------|----------|-----|
| Match is entirely within ONE segment | `firstRunFormatting` | Formatting auto-preserved, no decision needed |
| Match spans MULTIPLE segments, want unified result | `firstRunFormatting` | All replacement text inherits first segment's style |
| Match spans MULTIPLE segments, must keep mixed formatting | `distributeProportional` | Tool auto-splits replacement proportionally; each segment keeps its style |

**Important**: when using `distributeProportional`, do NOT manually split the replacement text. Pass the complete `search` and `replace` strings. The `replace_text` tool automatically distributes the replacement proportionally across matched runs.

## Phase 3: Execute — One Paragraph at a Time

Use the exact text from Phase 1/2 to construct your `search` parameter. **Do not re-read the paragraph before every replacement** — the text has not changed yet. Only re-read if a previous replacement returned `matchCount: 0`, indicating the text no longer matches.

```
For each paragraph in the plan:
  1. Use the search text from your format skeleton
  2. Call replace_text({ paragraphIndex: N, search: "...", replace: "...", strategy: "...", outputName: "..." })
  3. If matchCount: 0 — re-read that paragraph and retry with corrected search text
  4. If matchCount > 0 — move to next paragraph
```

**One paragraph per call.** Never combine multiple paragraph indices into a batch.

## Phase 4: Verify — Compare Against Skeleton

After all edits complete, re-read modified paragraphs with `includeRunDetail: true`. Compare:

- Bold/italic/underline match the skeleton?
- Font names and sizes unchanged?
- Colors preserved?
- Paragraph style still matches?

Report any formatting loss to the user immediately.

## Common Pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| Underline disappears | Cross-run match collapsed into non-underlined run | Use `distributeProportional` |
| Bold spreads everywhere | `firstRunFormatting` on bold-first match | Use `distributeProportional` |
| Page layout shifts | Replacing heading paragraph with body text | Only replace text within runs; paragraph style is preserved |
| Alignment breaks | Modifying paragraph properties | Only target `fullText` content |
| Font changes unexpectedly | Wrong run's formatting applied | Check skeleton — verify target run |
| Multiple output files created | outputName not passed consistently | Use identical outputName in ALL calls |

## Example

User: "Update paragraph 5 of the report"

```
FORMAT SKELETON — Paragraph 5:
  style: "BodyText"
  Segment [0]: "The Q1 revenue was "       Calibri 11pt  plain
  Segment [1]: "$12.5 million"             Calibri 11pt  BOLD, color:#0070C0
  Segment [2]: " which exceeded targets."  Calibri 11pt  plain

EDIT PLAN:
  Target: "$12.5 million" → "$18.3 million"
  Scope: single segment (Segment [1])
  Strategy: firstRunFormatting (formatting auto-preserved)
```
