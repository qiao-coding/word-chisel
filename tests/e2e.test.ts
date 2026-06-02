import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { resolve } from "path";
import AdmZip from "adm-zip";
import { getDocument, invalidateCache } from "../src/docx/DocumentStore.js";
import { replaceInParagraph } from "../src/docx/TextReplacer.js";
import { saveDocx } from "../src/docx/DocxWriter.js";

const TEST_FILE = resolve(__dirname, "fixtures", "test-sample.docx");

function createTestDocx(filePath: string) {
  const zip = new AdmZip();

  // [Content_Types].xml
  zip.addFile(
    "[Content_Types].xml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
      "utf-8",
    ),
  );

  // _rels/.rels
  zip.addFile(
    "_rels/.rels",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
      "utf-8",
    ),
  );

  // word/document.xml — 5 paragraphs with varied formatting
  zip.addFile(
    "word/document.xml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
        <w:t>Welcome to docx-mcp</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="BodyText"/></w:pPr>
      <w:r>
        <w:rPr><w:b/></w:rPr>
        <w:t>Bold introduction</w:t>
      </w:r>
      <w:r>
        <w:rPr><w:i/></w:rPr>
        <w:t> with italic followup</w:t>
      </w:r>
      <w:r>
        <w:t> and normal ending.</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:u w:val="single"/><w:color w:val="FF0000"/></w:rPr>
        <w:t>This sentence has red underlined text</w:t>
      </w:r>
      <w:r>
        <w:t> followed by plain text.</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:sz w:val="24"/><w:rFonts w:ascii="Courier New"/></w:rPr>
        <w:t>Mono font paragraph with searchable keyword HELLO here.</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Final paragraph. Replace me please.</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`,
      "utf-8",
    ),
  );

  zip.writeZip(filePath);
}

// --- Setup: create test .docx before tests ---

beforeAll(() => {
  createTestDocx(TEST_FILE);
});

// Cleanup after all tests
afterAll(() => {
  if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
  // Clean up working copies created by prepareWorkingCopy
  const editedFile = TEST_FILE.replace(/\.docx$/, "_edited.docx");
  if (existsSync(editedFile)) unlinkSync(editedFile);
});

// ============================================================
// Test 1: list_paragraphs — structural reading
// ============================================================

describe("list_paragraphs (structural overview)", () => {
  it("reads all 5 paragraphs from the test document", () => {
    const { flatDoc } = getDocument(TEST_FILE);
    expect(flatDoc.paragraphs).toHaveLength(5);
  });

  it("returns correct fullText for each paragraph", () => {
    const { flatDoc } = getDocument(TEST_FILE);
    const texts = flatDoc.paragraphs.map((p) => p.fullText);
    expect(texts[0]).toBe("Welcome to docx-mcp");
    expect(texts[1]).toBe("Bold introduction with italic followup and normal ending.");
    expect(texts[2]).toBe("This sentence has red underlined text followed by plain text.");
    expect(texts[3]).toContain("HELLO");
    expect(texts[4]).toBe("Final paragraph. Replace me please.");
  });

  it("detects paragraph styles", () => {
    const { flatDoc } = getDocument(TEST_FILE);
    expect(flatDoc.paragraphs[0].style).toBe("Heading1");
    expect(flatDoc.paragraphs[1].style).toBe("BodyText");
  });

  it("reports correct run counts", () => {
    const { flatDoc } = getDocument(TEST_FILE);
    // Paragraph 1 has 3 runs (bold, italic, normal)
    expect(flatDoc.paragraphs[1].runCount).toBe(3);
    // Paragraph 0 has 1 run
    expect(flatDoc.paragraphs[0].runCount).toBe(1);
  });
});

// ============================================================
// Test 2: read_docx — detailed reading with formatting
// ============================================================

describe("read_docx (detailed formatting read)", () => {
  it("returns text segments with formatting info", () => {
    const { flatDoc } = getDocument(TEST_FILE);
    const p1 = flatDoc.paragraphs[1]; // Bold + italic + normal paragraph

    expect(p1.segments).toHaveLength(3);

    // First segment: bold
    expect(p1.segments[0].text).toBe("Bold introduction");
    expect(p1.segments[0].formatting?.bold).toBe(true);

    // Second segment: italic
    expect(p1.segments[1].text).toBe(" with italic followup");
    expect(p1.segments[1].formatting?.italic).toBe(true);

    // Third segment: no special formatting
    expect(p1.segments[2].text).toBe(" and normal ending.");
    expect(p1.segments[2].formatting?.bold).toBeUndefined();
    expect(p1.segments[2].formatting?.italic).toBeUndefined();
  });

  it("reads underline and color formatting", () => {
    const { flatDoc } = getDocument(TEST_FILE);
    const p2 = flatDoc.paragraphs[2]; // Red underline paragraph

    expect(p2.segments[0].formatting?.underline).toBe("single");
    expect(p2.segments[0].formatting?.color).toBe("FF0000");
  });

  it("reads font name and size", () => {
    const { flatDoc } = getDocument(TEST_FILE);
    const p3 = flatDoc.paragraphs[3]; // Courier New mono paragraph

    expect(p3.segments[0].formatting?.font).toBe("Courier New");
    expect(p3.segments[0].formatting?.fontSize).toBe(24);
  });
});

// ============================================================
// Test 3: replace_text — surgical text replacement
// ============================================================

describe("replace_text (text replacement preserving formatting)", () => {
  it("replaces text in a specific paragraph", () => {
    const { doc, flatDoc } = getDocument(TEST_FILE);
    const p4 = flatDoc.paragraphs[4]; // "Final paragraph. Replace me please."

    const result = replaceInParagraph(p4, "Replace me", "REPLACED", false, "firstRunFormatting");

    expect(result.matchCount).toBe(1);
    expect(result.details[0].oldTextFragment).toBe("Replace me");
    expect(result.details[0].newTextFragment).toBe("REPLACED");

    // Save and re-read to verify persistence
    saveDocx(doc, doc.tree);
    invalidateCache(TEST_FILE);

    const { flatDoc: reRead } = getDocument(TEST_FILE);
    expect(reRead.paragraphs[4].fullText).toBe("Final paragraph. REPLACED please.");
  });

  it("replaces text across multiple runs (cross-run replacement)", () => {
    const { doc, flatDoc } = getDocument(TEST_FILE);
    // Paragraph 1: "Bold introduction with italic followup and normal ending."
    // Search across the bold→italic boundary
    const p1 = flatDoc.paragraphs[1];

    const result = replaceInParagraph(
      p1,
      "introduction with italic",
      "INTRO+ITALIC",
      false,
      "firstRunFormatting",
    );

    expect(result.matchCount).toBe(1);

    saveDocx(doc, doc.tree);
    invalidateCache(TEST_FILE);

    const { flatDoc: reRead } = getDocument(TEST_FILE);
    expect(reRead.paragraphs[1].fullText).toContain("INTRO+ITALIC");
  });

  it("replaces all occurrences with replaceAll", () => {
    const { doc, flatDoc } = getDocument(TEST_FILE);
    // Paragraph 3 has "Mono font paragraph with searchable keyword HELLO here."
    // Let's find something that appears in multiple places
    const p = flatDoc.paragraphs[3];

    // Replace all spaces with underscores to test replaceAll
    const result = replaceInParagraph(p, " ", "_", true, "distributeProportional");

    expect(result.matchCount).toBeGreaterThan(1);

    saveDocx(doc, doc.tree);
    invalidateCache(TEST_FILE);

    const { flatDoc: reRead } = getDocument(TEST_FILE);
    expect(reRead.paragraphs[3].fullText).not.toContain("Mono font");
    expect(reRead.paragraphs[3].fullText).toContain("Mono_font");
  });
});

// ============================================================
// Test 4: cache invalidation
// ============================================================

describe("cache behavior", () => {
  it("serves from cache on repeated reads", () => {
    invalidateCache(TEST_FILE);
    const first = getDocument(TEST_FILE);
    const second = getDocument(TEST_FILE);
    // Same object reference if cached
    expect(first.flatDoc).toBe(second.flatDoc);
  });

  it("invalidates cache when file is modified", () => {
    const first = getDocument(TEST_FILE);
    // Modify the file externally
    createTestDocx(TEST_FILE);
    const second = getDocument(TEST_FILE);
    // Different object reference — re-read from disk
    expect(first.flatDoc).not.toBe(second.flatDoc);
  });
});
