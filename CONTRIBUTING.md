# Contributing to word-chisel

Thanks for your interest in contributing.

## Setup

```bash
git clone <repo>
cd word-chisel
npm install
npm run build
```

## Development workflow

- Source code lives in `src/` — TypeScript, compiled to `dist/`
- `npm run build` compiles with `tsc`
- `npm test` runs the test suite with `vitest`
- `npm run dev` starts the MCP server directly via `tsx`

## Project structure

```
src/
├── index.ts              # MCP server entry point (stdio transport)
├── cli/
│   └── setup.ts          # One-command installer
├── docx/
│   ├── DocConverter.ts   # .doc → .docx conversion + working copy creation
│   ├── DocxReader.ts     # Open & parse .docx files
│   ├── DocxWriter.ts     # Serialize & write back
│   ├── DocumentStore.ts  # In-memory cache with mtime invalidation
│   ├── TextFlattener.ts  # Walk OOXML tree → flat paragraph model
│   ├── TextReplacer.ts   # Surgical find & replace engine
│   ├── XmlTree.ts        # fast-xml-parser wrapper
│   └── XmlUtils.ts       # OOXML navigation helpers
├── tools/
│   ├── listParagraphs.ts # list_paragraphs MCP tool
│   ├── readDocx.ts       # read_docx MCP tool
│   └── replaceText.ts    # replace_text MCP tool
└── types/
    └── index.ts          # All TypeScript types
```

## Testing

Tests use `vitest` and live in `tests/`. Fixtures are auto-generated.

```bash
npm test              # Run once
npm run test:watch    # Watch mode
```

## Pull requests

- Keep changes focused and minimal
- Add or update tests for new functionality
- Run `npm run build && npm test` before submitting
- Follow the existing code style (no unnecessary comments, single-purpose functions)
