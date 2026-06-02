# word-chisel

[中文](README.zh-CN.md)

Let Claude edit your Word documents — no need to open Office, no copy-pasting. **Formatting, fonts, image positions, page layout, and information structure are all preserved** — only the text you specify is changed.

Once installed, Claude can modify `.docx` / `.doc` files as naturally as plain text:

- **Edit text, preserve formatting** — bold, italic, fonts, and colors all stay as they were; only the text you specify changes
- **Match across style boundaries** — search terms split across multiple formatted fragments are found and replaced in one pass
- **Zero risk to originals** — every edit happens on a copy; the source file is never touched
- **`.doc` auto-conversion** — legacy documents are automatically converted to `.docx` via LibreOffice

Use cases: revising lab reports, updating contract clauses, batch-replacing key information across documents, fine-tuning content without breaking formatting.

## Install

**Option A: Paste into Claude (recommended)**

Copy this prompt into any Claude chat. The AI handles everything:

```
Please install word-chisel for me.

npm package: word-chisel (https://www.npmjs.com/package/word-chisel)

Steps:
1. Check that Node.js is available (node --version). If not, tell me to install it.
2. Run: npx word-chisel setup
3. Verify ~/.claude/.mcp.json contains a word-chisel entry
4. Verify ~/.claude/skills/word-chisel.md exists
5. Save this memory: when editing Word documents (.docx/.doc) with Claude, the word-chisel MCP tools (list_paragraphs / read_docx / replace_text) can be used for precise text editing.
6. Tell me setup is done and I need to restart my MCP client

If you hit errors, explain what went wrong and tell me how to fix it.
Do not install extra software without asking me first.
```

**Option B: Terminal command**

```bash
npx word-chisel setup
```

## Tools

| Tool | Purpose |
|------|---------|
| `list_paragraphs` | Scan document structure — paragraph indices, styles, run counts, text preview |
| `read_docx` | Read full text with per-run formatting details (bold, italic, font, size, color, etc.) |
| `replace_text` | Replace text while preserving all formatting. Cross-run matching. Two strategies: collapse into the first run's style, or distribute proportionally to preserve each run's formatting |

## Safety

Every edit follows a **copy-then-edit** workflow:

- `.docx` → copied to `<outputName>.docx`, edits go into the copy
- `.doc` → LibreOffice converts to `.docx`, edits go into the converted file
- **The original file is never touched**

All tool responses include `outputPath` (the actual file being edited) and a `note` explaining what happened.

## Requirements

- **Node.js** 18+

### Editing `.doc` files requires LibreOffice

> `.doc` (Word 97-2003) is a proprietary binary format. word-chisel uses LibreOffice to losslessly convert it to `.docx` before editing.

If you only edit `.docx` files, **no extra tools are needed**. For `.doc` files, you have two options:

**Option A: Install LibreOffice (recommended, fully automatic)**

word-chisel auto-detects LibreOffice — no PATH configuration needed.

| Platform | Command | Manual download |
|----------|---------|-----------------|
| Windows | `winget install TheDocumentFoundation.LibreOffice` | [libreoffice.org/download](https://www.libreoffice.org/download/) |
| macOS | `brew install --cask libreoffice` | [libreoffice.org/download](https://www.libreoffice.org/download/) |
| Linux | `sudo apt install libreoffice` | `sudo dnf install libreoffice` (Fedora) |

> Don't have Homebrew on macOS? Run `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` first.

**Option B: Convert manually**

Open the `.doc` in Word / WPS → Save As `.docx` → hand it to word-chisel. No LibreOffice required.

Attempting to edit a `.doc` file without LibreOffice returns a clear `LIBREOFFICE_NOT_FOUND` error.

## Usage

After setup, simply tell Claude:

```
"Edit C:/docs/report.docx — change paragraph 3 from 'Q1 revenue grew 12%' to 'Q1 revenue grew 18%'"
```

Claude will automatically:

1. `list_paragraphs` — inspect the document structure
2. `read_docx` — confirm the exact text
3. `replace_text` — perform the surgical edit, preserving formatting
4. Return the output file path

## Development

```bash
git clone <repo>
cd word-chisel
npm install
npm run build
npm test
```

## License

MIT
