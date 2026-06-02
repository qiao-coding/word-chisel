import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve, join } from "path";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "fs";
import AdmZip from "adm-zip";

// Mock child_process.execSync before importing the module under test
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "child_process";
import { prepareWorkingCopy, DocConvertError } from "../src/docx/DocConverter.js";

const mockExecSync = vi.mocked(execSync);

function createMinimalDocx(filePath: string) {
  const zip = new AdmZip();
  zip.addFile(
    "[Content_Types].xml",
    Buffer.from(
      `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
      "utf-8",
    ),
  );
  zip.addFile(
    "_rels/.rels",
    Buffer.from(
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      "utf-8",
    ),
  );
  zip.addFile(
    "word/document.xml",
    Buffer.from(
      `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Test</w:t></w:r></w:p></w:body></w:document>`,
      "utf-8",
    ),
  );
  zip.writeZip(filePath);
}

const fixturesDir = resolve(__dirname, "fixtures");

beforeEach(() => {
  vi.clearAllMocks();
  if (!existsSync(fixturesDir)) {
    mkdirSync(fixturesDir, { recursive: true });
  }
});

describe("prepareWorkingCopy — .docx files", () => {
  it("copies .docx to <name>_edited.docx and returns working path", () => {
    const original = join(fixturesDir, "report.docx");
    const expectedWorking = join(fixturesDir, "report_edited.docx");

    createMinimalDocx(original);

    // Clean up any leftover working copy
    if (existsSync(expectedWorking)) unlinkSync(expectedWorking);

    const result = prepareWorkingCopy(original);

    expect(result.wasConverted).toBe(false);
    expect(result.workingPath).toBe(expectedWorking);
    expect(existsSync(expectedWorking)).toBe(true);
    // Original must still exist (untouched)
    expect(existsSync(original)).toBe(true);

    // Clean up
    unlinkSync(original);
    unlinkSync(expectedWorking);
  });

  it("reuses existing working copy if it is up to date", () => {
    const original = join(fixturesDir, "cached.docx");
    const working = join(fixturesDir, "cached_edited.docx");

    createMinimalDocx(original);
    createMinimalDocx(working); // Same content, created after original

    const result = prepareWorkingCopy(original);

    expect(result.workingPath).toBe(working);
    expect(result.wasConverted).toBe(false);
    // Should NOT re-copy (no file system write this time)
    // The working copy mtime >= original mtime, so it's reused

    unlinkSync(original);
    unlinkSync(working);
  });

  it("uses outputName for custom working copy filename", () => {
    const original = join(fixturesDir, "report.docx");
    const expectedWorking = join(fixturesDir, "字典元素的排序输出.docx");

    createMinimalDocx(original);

    if (existsSync(expectedWorking)) unlinkSync(expectedWorking);

    const result = prepareWorkingCopy(original, "字典元素的排序输出");

    expect(result.wasConverted).toBe(false);
    expect(result.workingPath).toBe(expectedWorking);
    expect(existsSync(expectedWorking)).toBe(true);

    unlinkSync(original);
    unlinkSync(expectedWorking);
  });
});

describe("prepareWorkingCopy — .doc files", () => {
  it("detects .doc and runs libreoffice conversion", () => {
    const docPath = join(fixturesDir, "legacy.doc");
    const docxPath = join(fixturesDir, "legacy.docx");

    writeFileSync(docPath, "dummy");

    mockExecSync.mockImplementation(() => {
      createMinimalDocx(docxPath);
    });

    const result = prepareWorkingCopy(docPath);

    expect(result.wasConverted).toBe(true);
    expect(result.workingPath).toBe(docxPath);
    expect(mockExecSync).toHaveBeenCalledTimes(1);

    const callArg = mockExecSync.mock.calls[0][0] as string;
    expect(callArg).toContain("soffice");
    expect(callArg).toContain("--headless");
    expect(callArg).toContain("--convert-to docx");
    expect(callArg).toContain("legacy.doc");

    unlinkSync(docPath);
    unlinkSync(docxPath);
  });

  it("returns existing .docx without re-converting", () => {
    const docPath = join(fixturesDir, "cached2.doc");
    const docxPath = join(fixturesDir, "cached2.docx");

    writeFileSync(docPath, "old");
    createMinimalDocx(docxPath);

    const result = prepareWorkingCopy(docPath);

    expect(result.wasConverted).toBe(true);
    expect(result.workingPath).toBe(docxPath);
    expect(mockExecSync).not.toHaveBeenCalled();

    unlinkSync(docPath);
    unlinkSync(docxPath);
  });
});

describe("DocConvertError handling", () => {
  it("throws LIBREOFFICE_NOT_FOUND when soffice fails", () => {
    const docPath = join(fixturesDir, "nolo.doc");
    writeFileSync(docPath, "dummy");

    mockExecSync.mockImplementation(() => {
      const err = new Error("Command not found: soffice");
      (err as any).code = "ENOENT";
      throw err;
    });

    try {
      prepareWorkingCopy(docPath);
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(DocConvertError);
      expect((e as DocConvertError).code).toBe("LIBREOFFICE_NOT_FOUND");
    }

    unlinkSync(docPath);
  });

  it("throws CONVERSION_FAILED when libreoffice produces no output", () => {
    const docPath = join(fixturesDir, "bad.doc");
    writeFileSync(docPath, "corrupt");

    mockExecSync.mockReturnValue(Buffer.from(""));

    try {
      prepareWorkingCopy(docPath);
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(DocConvertError);
      expect((e as DocConvertError).code).toBe("CONVERSION_FAILED");
    }

    unlinkSync(docPath);
  });

  it("passes through non-Word extensions unchanged", () => {
    const result = prepareWorkingCopy("/path/file.txt");
    expect(result.workingPath).toBe("/path/file.txt");
    expect(result.wasConverted).toBe(false);
  });
});
