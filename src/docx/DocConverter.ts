import { execSync } from "child_process";
import { copyFileSync, existsSync, renameSync, statSync } from "fs";
import { dirname, basename, extname, join } from "path";
import { platform } from "os";

export class DocConvertError extends Error {
  constructor(
    message: string,
    public code: "LIBREOFFICE_NOT_FOUND" | "CONVERSION_FAILED" | "COPY_FAILED",
  ) {
    super(message);
    this.name = "DocConvertError";
  }
}

/**
 * Prepare a working copy of a Word document for editing.
 * Never touches the original file.
 *
 * - .doc  → LibreOffice converts to a new .docx
 * - .docx → copied to <name>_edited.docx
 * - other → returned as-is (pass-through)
 */
export function prepareWorkingCopy(
  originalPath: string,
  outputName?: string,
): {
  workingPath: string;
  wasConverted: boolean;  // LibreOffice conversion was used
} {
  const ext = extname(originalPath).toLowerCase();
  const dir = dirname(originalPath);
  const defaultName = basename(originalPath, ext);

  if (ext === ".doc") {
    const targetName = outputName || defaultName;
    return convertDoc(originalPath, dir, targetName);
  }

  if (ext === ".docx") {
    return copyDocx(originalPath, dir, defaultName, outputName);
  }

  // Non-Word files: pass through (not expected in normal use)
  return { workingPath: originalPath, wasConverted: false };
}

function getSofficePath(): string {
  // Try PATH first
  try {
    execSync("soffice --version", { stdio: "ignore" });
    return "soffice";
  } catch {
    // Not in PATH, try platform-specific default locations
  }

  if (platform() === "win32") {
    const candidates = [
      join("C:", "Program Files", "LibreOffice", "program", "soffice.exe"),
      join("C:", "Program Files (x86)", "LibreOffice", "program", "soffice.exe"),
    ];
    for (const c of candidates) {
      if (existsSync(c)) return `"${c}"`;
    }
  }

  if (platform() === "darwin") {
    const macPath = "/Applications/LibreOffice.app/Contents/MacOS/soffice";
    if (existsSync(macPath)) return macPath;
  }

  throw new DocConvertError(
    "LibreOffice not found. Install it from https://www.libreoffice.org/download/",
    "LIBREOFFICE_NOT_FOUND",
  );
}

function convertDoc(
  docPath: string,
  dir: string,
  targetName: string,
): { workingPath: string; wasConverted: true } {
  const defaultName = basename(docPath, extname(docPath));
  const docxPath = join(dir, `${targetName}.docx`);

  // Skip if target .docx already exists and is newer than the .doc
  if (existsSync(docxPath)) {
    const docMtime = statSync(docPath).mtimeMs;
    const docxMtime = statSync(docxPath).mtimeMs;
    if (docxMtime >= docMtime) {
      return { workingPath: docxPath, wasConverted: true };
    }
  }

  const soffice = getSofficePath();
  try {
    execSync(
      `${soffice} --headless --convert-to docx --outdir "${dir}" "${docPath}"`,
      { timeout: 120000, windowsHide: true },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      throw new DocConvertError(
        `LibreOffice not found. Install LibreOffice to edit .doc files: ${docPath}`,
        "LIBREOFFICE_NOT_FOUND",
      );
    }
    throw new DocConvertError(
      `LibreOffice conversion failed for ${docPath}: ${msg}`,
      "CONVERSION_FAILED",
    );
  }

  // LibreOffice always uses the original basename; rename if custom name was given
  const generatedPath = join(dir, `${defaultName}.docx`);
  if (!existsSync(generatedPath)) {
    throw new DocConvertError(
      `LibreOffice did not produce expected output: ${generatedPath}`,
      "CONVERSION_FAILED",
    );
  }

  if (targetName !== defaultName) {
    renameSync(generatedPath, docxPath);
  }

  return { workingPath: docxPath, wasConverted: true };
}

function copyDocx(
  docxPath: string,
  dir: string,
  defaultName: string,
  outputName?: string,
): { workingPath: string; wasConverted: false } {
  const targetName = outputName || `${defaultName}_edited`;
  const workingPath = join(dir, `${targetName}.docx`);

  // Skip if working copy already exists and is up to date
  if (existsSync(workingPath)) {
    const srcMtime = statSync(docxPath).mtimeMs;
    const dstMtime = statSync(workingPath).mtimeMs;
    if (dstMtime >= srcMtime) {
      return { workingPath, wasConverted: false };
    }
  }

  try {
    copyFileSync(docxPath, workingPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new DocConvertError(
      `Failed to copy ${docxPath} to ${workingPath}: ${msg}`,
      "COPY_FAILED",
    );
  }

  return { workingPath, wasConverted: false };
}
