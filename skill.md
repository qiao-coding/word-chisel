---
name: word-chisel
description: Word Chisel — surgical .docx / .doc text editor. Use when editing, modifying, or changing text in Word documents.
---

# Word Chisel: Surgical Word Document Editor

You have access to three MCP tools for editing `.docx` and `.doc` (Microsoft Word) files. All edits preserve **formatting** — fonts, bold/italic/underline, colors, highlights, and tracked changes.

## Safety Guarantee: Original Files Are Never Touched

Every edit follows a **copy-then-edit** workflow:

| Input Format | What Happens |
|-------------|-------------|
| `.docx` | File is copied to `<outputName>.docx` (or `<name>_edited.docx` if no name given). All edits go into the copy. Original is untouched. |
| `.doc` | LibreOffice converts it to a new `<outputName>.docx` (or `<name>.docx`). All edits go into the converted file. Original .doc is untouched. |

Every tool response includes:
- `outputPath` — the actual file being edited (always a .docx)
- `note` — explains the copy/conversion if applicable

### Naming the Output File

All three tools accept an optional `outputName` parameter. **Before the first call, determine a meaningful output filename** based on the document's content:

1. Start with `list_paragraphs` to understand the document's topic
2. Derive a descriptive name (e.g., `xxx小明-字典元素的排序输出`)
3. Pass it as `outputName` in the first tool call
4. All subsequent calls for the same document use the same `outputName`

If `outputName` is omitted, the default `<original>_edited.docx` is used.

**Requirement for .doc**: LibreOffice must be installed. Without it, the tool returns `LIBREOFFICE_NOT_FOUND`.

## Tools

### 1. `list_paragraphs` — Structural overview

Get a map of the document before editing.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | string | required | Absolute path to the .docx/.doc file |
| `includeEmpty` | boolean | false | Include empty paragraphs in the listing |
| `outputName` | string | — | Custom base name for output .docx (without .docx extension) |

Returns: `{ outputPath, totalParagraphs, paragraphs: [{ index, text, characterCount, runCount, style }], note? }`

- `outputPath` is the working copy file — always use this for subsequent operations
- `text` is truncated to 200 chars — use `read_docx` for full text
- Use `paragraphs[index]` to identify what to edit

### 2. `read_docx` — Full text with formatting

Read complete paragraph text and per-run formatting details.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | string | required | Absolute path to the .docx/.doc file |
| `paragraphs` | number[] | all | Specific paragraph indices to read |
| `includeRunDetail` | boolean | false | Include per-run formatting (bold, italic, etc.) |
| `outputName` | string | — | Custom base name for output .docx (without .docx extension) |

Returns: `{ outputPath, paragraphs: [{ index, fullText, style, runCount, runs? }], hasTrackChanges, note? }`

Use `includeRunDetail: true` when you need to understand formatting before replacing, or when the user asks about specific formatting.

### 3. `replace_text` — Surgical text replacement

Replace text while preserving formatting. This is the core tool.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | string | required | Absolute path to the .docx/.doc file |
| `search` | string | required | Exact text to find |
| `replace` | string | required | New text to insert |
| `paragraphIndex` | number | all | Target a specific paragraph |
| `replaceAll` | boolean | true | Replace all occurrences |
| `strategy` | enum | "firstRunFormatting" | How to merge formatting |
| `outputName` | string | — | Custom base name for output .docx (without .docx extension) |

Returns: `{ outputPath, changed, matchCount, details: [{ paragraphIndex, runIndex, oldTextFragment, newTextFragment }], note? }`

## Recommended Workflow

```
1. list_paragraphs  →  Get overview, note the outputPath
2. read_docx        →  Read target paragraphs with full text
3. replace_text     →  Make the edit
4. read_docx        →  (Optional) Verify the result
```

**Always start with `list_paragraphs`** unless the user gives you a very specific edit instruction. Use the `outputPath` from the first response in subsequent calls for consistency.

## Replacement Strategies

- **`firstRunFormatting`** (default): Collapses replacement into the first matched run's formatting. Best for simple edits where you want a consistent look.

- **`distributeProportional`**: Splits replacement proportionally across matched runs, preserving each run's formatting. Best when replacing text spanning differently-formatted runs.

## Important Rules

1. **Always use absolute paths** — full paths like `C:\Users\32890\Desktop\document.docx`, NOT relative paths.

2. **Search text must be exact** — whitespace, punctuation, and casing must match. If `matchCount: 0`, re-read the paragraph to get the exact text.

3. **Original file is never modified** — edits go to a working copy. The `outputPath` in every response tells you where.

4. **Tracked changes** — `hasTrackChanges` in `read_docx` output indicates revision marks. Tracked deletions are excluded from search.

5. **Cross-run matching works** — you can search for text spanning multiple formatting runs.

6. **Use `paragraphIndex` for targeted edits** — avoid unintended replacements by scoping to a specific paragraph.

## Examples

**Edit a specific sentence:**
```
1. list_paragraphs({ path: "C:/docs/report.docx" })
   → outputPath: "C:/docs/report_edited.docx"
2. read_docx({ path: "C:/docs/report.docx", paragraphs: [3] })
3. replace_text({
     path: "C:/docs/report.docx",
     search: "old sentence text",
     replace: "new sentence text",
     paragraphIndex: 3
   })
```

**Global find-and-replace:**
```
replace_text({
  path: "C:/docs/report.docx",
  search: "Acme Corp",
  replace: "GlobalTech Inc",
  replaceAll: true
})
```

**Replace across formatted runs:**
```
replace_text({
  path: "C:/docs/report.docx",
  search: "bold intro regular conclusion",
  replace: "new bold intro updated regular conclusion",
  strategy: "distributeProportional"
})
```

## When NOT to Use

- **Creating new documents** — word-chisel is for editing existing files only
- **Changing formatting only** — it replaces text, not style definitions
- **Working with tables** — `w:tbl` elements are skipped (future feature)
