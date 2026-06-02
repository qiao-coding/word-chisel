import { execSync } from "child_process";
import { copyFileSync, existsSync, renameSync, statSync } from "fs";
import { dirname, basename, extname, join } from "path";
import { platform } from "os";

export class DocConvertError extends Error {
  constructor(message: string, public code: "LIBREOFFICE_NOT_FOUND" | "CONVERSION_FAILED" | "COPY_FAILED") {
    super(message); this.name = "DocConvertError";
  }
}

export function prepareWorkingCopy(originalPath: string, outputName?: string): { workingPath: string; wasConverted: boolean } {
  const ext = extname(originalPath).toLowerCase();
  const dir = dirname(originalPath);
  const defaultName = basename(originalPath, ext);
  if (ext === ".doc") return { workingPath: convertDoc(originalPath, dir, outputName || defaultName), wasConverted: true };
  if (ext === ".docx") return { workingPath: copyDocx(originalPath, dir, defaultName, outputName), wasConverted: false };
  return { workingPath: originalPath, wasConverted: false };
}

function getSofficePath(): string {
  try { execSync("soffice --version", { stdio: "ignore" }); return "soffice"; } catch {}
  if (platform() === "win32") {
    for (const c of [join("C:", "Program Files", "LibreOffice", "program", "soffice.exe"), join("C:", "Program Files (x86)", "LibreOffice", "program", "soffice.exe")])
      if (existsSync(c)) return `"${c}"`;
  }
  if (platform() === "darwin" && existsSync("/Applications/LibreOffice.app/Contents/MacOS/soffice")) return "/Applications/LibreOffice.app/Contents/MacOS/soffice";
  throw new DocConvertError("LibreOffice not found. Install from https://www.libreoffice.org/download/", "LIBREOFFICE_NOT_FOUND");
}

function convertDoc(docPath: string, dir: string, targetName: string): string {
  const docxPath = join(dir, `${targetName}.docx`);
  const defaultName = basename(docPath, extname(docPath));
  if (existsSync(docxPath) && statSync(docxPath).mtimeMs >= statSync(docPath).mtimeMs) return docxPath;
  const soffice = getSofficePath();
  try { execSync(`${soffice} --headless --convert-to docx --outdir "${dir}" "${docPath}"`, { timeout: 120000, windowsHide: true }); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new DocConvertError(msg.includes("not found") || msg.includes("ENOENT") ? `LibreOffice not found: ${docPath}` : `Conversion failed: ${msg}`, msg.includes("not found") || msg.includes("ENOENT") ? "LIBREOFFICE_NOT_FOUND" : "CONVERSION_FAILED");
  }
  const generated = join(dir, `${defaultName}.docx`);
  if (!existsSync(generated)) throw new DocConvertError(`No output from LibreOffice: ${generated}`, "CONVERSION_FAILED");
  if (targetName !== defaultName) renameSync(generated, docxPath);
  return docxPath;
}

function copyDocx(docxPath: string, dir: string, defaultName: string, outputName?: string): string {
  const targetName = outputName || `${defaultName}_edited`;
  const workingPath = join(dir, `${targetName}.docx`);
  if (existsSync(workingPath) && statSync(workingPath).mtimeMs >= statSync(docxPath).mtimeMs) return workingPath;
  try { copyFileSync(docxPath, workingPath); } catch (e) { throw new DocConvertError(`Copy failed: ${e instanceof Error ? e.message : String(e)}`, "COPY_FAILED"); }
  return workingPath;
}
