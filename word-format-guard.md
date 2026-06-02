---
name: word-format-guard
description: >
  LOAD FIRST before any .docx/.doc editing. Scan the document's format skeleton, build an edit
  plan, then delegate to word-chisel MCP tools for execution. This is the PRE-EDIT phase —
  word-chisel handles the actual tool calls. Always loaded together with word-chisel.
---

# Word Format Guard

**CRITICAL: This skill loads FIRST, before word-chisel. It handles Phase 1+2 (scan + plan).
Word-chisel handles Phase 3+4 (execute + verify). Both skills must be active in the same session.
Load order: word-format-guard → word-chisel.**

Without format awareness, edits break underlines, bold/italic, fonts, colors, and page layout.
This skill enforces **scan → plan → delegate → verify**.

## Key Concept: `path` vs `outputName`

These two parameters serve different roles. Never confuse them.

| Parameter | Meaning | Changes across calls? | Example |
|-----------|---------|----------------------|---------|
| `path` | The **original file** (read-only reference) | **NEVER** — always the same path | `"C:/docs/report.docx"` |
| `outputName` | Name for the working copy | **NEVER** — set once, reused everywhere | `"report-edited"` |

Both are passed to every tool call. `path` never changes. `outputName` is set on the first call and reused identically.

```
All calls: path="C:/docs/report.docx"  outputName="report-edited"
                                                ↑
                                   same string in every call
```

## Terminology

In Word XML, a paragraph is made of **runs** — contiguous text with identical formatting.
Use "text segment" when showing output to the user. Use "run" only in internal reasoning.

## Phase 1: Scan — Build the Format Skeleton (INTERNAL)

If the user hasn't specified paragraph numbers, call `list_paragraphs` first to identify targets.
Then call `read_docx` with `includeRunDetail: true` on the paragraphs to be modified. Record the
skeleton **internally — do not dump raw data to the user.** Summarize briefly: "Scanned paragraph 3,
found 3 text segments — one bold, two plain."

Internal format skeleton:
```
Para [3] style="BodyText"
  [0] "The Q1 revenue was "       Calibri 11pt  plain
  [1] "$12.5 million"             Calibri 11pt  BOLD, color:#0070C0
  [2] " which exceeded targets."  Calibri 11pt  plain
```

The skeleton is your **source of truth for search strings** in Phase 3.

## Phase 2: Plan — Choose Strategy

Based on the skeleton, determine the strategy. **You only decide — the tool handles the math.**

| Scenario | Strategy |
|----------|----------|
| Match within ONE segment | `firstRunFormatting` — formatting auto-preserved |
| Cross-segment, want unified look | `firstRunFormatting` — inherits first segment's style |
| Cross-segment, must keep mixed formatting | `distributeProportional` — tool auto-splits replacement |

When using `distributeProportional`: pass the complete `search` and `replace` strings.
Do NOT manually split the text. The tool distributes it automatically.

## Phase 3: Execute — Delegate to word-chisel

Call `replace_text` one paragraph at a time. **Use the text from your Phase 1 skeleton as the
`search` parameter.** Do not re-read before each replacement — the text has not changed.
Only re-read if `matchCount: 0` indicates the text was already modified.

```
For each paragraph:
  1. search = exact text from Phase 1 skeleton
  2. Call replace_text({ path, outputName, paragraphIndex: N, search, replace, strategy })
  3. matchCount > 0 → next paragraph
  4. matchCount: 0 → re-read paragraph, update search text, retry
```

**One paragraph per call.** Never batch multiple indices.

## Phase 4: Verify

Re-read modified paragraphs with `includeRunDetail: true`. Compare against skeleton:
bold/italic/underline, font names, sizes, colors, paragraph style. Report any loss to the user.

## Common Pitfalls

| Problem | Fix |
|---------|-----|
| Underline disappears | Use `distributeProportional` for cross-run matches |
| Bold spreads to entire paragraph | Same — `distributeProportional` keeps boundary |
| Page layout shifts | Only replace text; paragraph style is preserved by the tool |
| Multiple copies created | Pass identical `outputName` in every call |
| matchCount: 0 | Re-read paragraph, update search text from latest read |
| Wrong path | `path` = original file (NEVER changes), `outputName` = copy name |

## Environment Notes

- **Local paths** (Windows/macOS/Linux): Absolute paths like `C:/docs/file.docx` or `/home/user/file.docx`
- **Claude.ai / web uploads**: Files uploaded to Claude chat may have paths like `/mnt/user-data/...` — these work the same way
- **Network drives**: UNC paths (`\\server\share\file.docx`) are supported if the OS can access them
- **LibreOffice for .doc files**: Must be installed on the same machine running the MCP server

## Example

```
User: "Update paragraph 5 — change $12.5M to $18.3M"

SCAN (internal):
  Para [5] style="BodyText"
    [0] "The Q1 revenue was "       Calibri 11pt  plain
    [1] "$12.5 million"             Calibri 11pt  BOLD, blue
    [2] " which exceeded targets."  Calibri 11pt  plain

PLAN:
  search: "$12.5 million"  replace: "$18.3 million"
  Strategy: firstRunFormatting (single segment)

EXECUTE:
  replace_text({ path: "C:/docs/report.docx", outputName: "report-q1",
                 paragraphIndex: 5, search: "$12.5 million",
                 replace: "$18.3 million", strategy: "firstRunFormatting" })

VERIFY:
  read_docx({ path: "C:/docs/report.docx", outputName: "report-q1",
              paragraphs: [5], includeRunDetail: true })
  → Bold and blue color preserved on new value ✓
```
