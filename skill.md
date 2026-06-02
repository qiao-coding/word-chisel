---
name: word-chisel
description: >
  REQUIRED for any .docx/.doc editing task. Use when the user asks to edit, modify, update,
  replace, change, rewrite, or correct text in Word documents. Also use when user mentions
  .docx, .doc, Word, WPS, Office documents, experiment reports, contracts, or any document
  editing scenario. NEVER attempt to edit .docx/.doc via raw XML parsing, AdmZip, python-docx,
  or any other method — always use these MCP tools.
---

# Word Chisel

**CRITICAL: You MUST use these MCP tools for ALL .docx/.doc editing. Do NOT write code to parse
or modify Word files yourself. Do NOT install npm packages or create scripts on the user's
desktop. These tools are the ONLY supported way to edit Word documents.**

**LOAD ORDER: Always load `/word-format-guard` FIRST (scan + plan), then use this skill for execution.
Both skills must be active. Format-guard produces the skeleton and plan; word-chisel runs the tools.**

**Tool names: The three MCP tools are registered as `list_paragraphs`, `read_docx`, and `replace_text`.
Depending on your MCP client, you may need to prefix them with the server name (e.g.
`mcp__word-chisel__list_paragraphs`). Check available tools if a direct name is not found.**

## Mandatory Rules

### 1. Use these tools, not your own code
When the user asks to edit a `.docx` or `.doc` file, your ONLY option is these three tools.
Do not attempt to: parse XML, use AdmZip, shell out to python-docx, write a Node.js script,
or create any helper files. Call the tools directly.

### 2. path = original file (never changes), outputName = copy name (never changes)
Every tool takes two key parameters. Do NOT confuse them:
- `path`: The **original file** — always the same absolute path in every call. Read-only reference.
- `outputName`: The **working copy name** — set once on first call, reused identically in all subsequent calls.

```
All calls: path="C:/docs/report.docx"  outputName="report-edited"
                      ↑                              ↑
               NEVER changes                  NEVER changes
```

If you omit `outputName` on a later call, the tool creates a separate copy. Don't do that.

### 3. One paragraph at a time
`replace_text` operates within a single paragraph. When replacing text that spans multiple paragraphs,
make separate `replace_text` calls, one per paragraph. Use `paragraphIndex` to target each one.

### 4. Match exact text from read_docx
The `search` parameter must match the document text character-for-character. Call `read_docx`
once per target paragraph to capture its exact text, or use the skeleton from word-format-guard
if already scanned. Do NOT re-read before every replacement — only re-read a specific paragraph
if `matchCount: 0` indicates its text changed since your last snapshot.

### 5. Always pass strategy explicitly
`strategy` has a default (`firstRunFormatting`), but never rely on it. Always set `strategy`
explicitly based on the format-guard plan. This prevents silent misapplication of the wrong
strategy on cross-run matches.

### 6. list_paragraphs is optional when you already have paragraph indices
If the user explicitly specified paragraph numbers, or if format-guard already identified
target paragraphs, you may skip `list_paragraphs` and go directly to `read_docx`.

### 7. Handle errors, don't fix the environment
- `LIBREOFFICE_NOT_FOUND`: Tell the user to install LibreOffice. Do NOT try to install it.
- `FILE_NOT_FOUND`: Ask the user to verify the path.
- `matchCount: 0`: Re-read the paragraph text and try again with the exact text.

### 8. Cross-paragraph replacement strategy
When replacing text spanning multiple paragraphs (e.g. "replace sections 3 through 5"):
replace the first paragraph's text with the new content, then clear subsequent paragraphs by using
`search` = their full text and `replace` = `""`. Clearing text leaves empty paragraphs (visible as
blank lines) — the paragraph elements remain. word-chisel cannot delete paragraphs; it can only
clear their content. Inform the user about resulting blank lines before proceeding.

## Workflow

The full scan → plan → execute → verify workflow is defined by `/word-format-guard`.
Follow that skill's Phases 1–4. This file provides tool signatures and mandatory rules.

## Tools

### `list_paragraphs`
Scan document structure. Returns paragraph indices, styles, run counts, and a preview of
each paragraph's text (truncated to 200 chars). Skip if the user already specified paragraph
numbers or format-guard has already identified targets.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | yes | Absolute path to .docx/.doc |
| `includeEmpty` | boolean | no | Include empty paragraphs (default false) |
| `outputName` | string | no | Custom name for output .docx (no extension). If omitted, auto-generates `<original>_edited.docx`. |

### `read_docx`
Read full paragraph text with formatting details. Call once per target paragraph to capture exact
text for building search strings. Do NOT re-read before every replacement.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | yes | Absolute path to .docx/.doc |
| `paragraphs` | number[] | no | Specific paragraph indices (default: all) |
| `includeRunDetail` | boolean | no | Show per-run formatting (default false) |
| `outputName` | string | no | Custom name for output .docx. If omitted, auto-generates `<original>_edited.docx`. |

### `replace_text`
Surgical text replacement. Preserves all formatting. One paragraph per call.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | yes | Absolute path to .docx/.doc |
| `search` | string | yes | Exact text to find |
| `replace` | string | yes | New text to insert |
| `paragraphIndex` | number | no | Target a specific paragraph by index. Omit to search the entire document. |
| `replaceAll` | boolean | no | When true: replace all matches. When false: replace first match only. If paragraphIndex is provided, scoped to that paragraph; otherwise applies to entire document. |
| `strategy` | "firstRunFormatting" \| "distributeProportional" | no | Always pass explicitly. See Rule 5. |
| `outputName` | string | no | Custom name for output .docx |

## Example

User: "Change paragraph 3 of C:/docs/lab.docx from 'old results' to 'new findings'"

```
Step 1: list_paragraphs({ path: "C:/docs/lab.docx", outputName: "lab-updated" })
  → outputPath: "C:/docs/lab-updated.docx"
  → paragraph 3: "The experiment produced old results which were analyzed..."

Step 2: read_docx({ path: "C:/docs/lab.docx", paragraphs: [3], outputName: "lab-updated" })
  → fullText: "The experiment produced old results which were analyzed thoroughly."

Step 3: replace_text({
  path: "C:/docs/lab.docx",
  search: "old results",
  replace: "new findings",
  paragraphIndex: 3,
  strategy: "firstRunFormatting",
  outputName: "lab-updated"
})
  → changed: true, matchCount: 1

Step 4: read_docx({ path: "C:/docs/lab.docx", paragraphs: [3], outputName: "lab-updated" })
  → Verify: "The experiment produced new findings which were analyzed thoroughly."
```

## Replacement Strategies

- **firstRunFormatting** (default): Entire replacement inherits the first matched run's style.
- **distributeProportional**: Tool automatically splits replacement proportionally across matched runs,
  preserving each run's individual formatting. You do NOT need to manually split the text — just pass
  the full `search` and `replace` strings. Use when replacing text that crosses a formatting boundary
  (e.g. part bold, part italic).
