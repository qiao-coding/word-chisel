import AdmZip from "adm-zip";
import { parseXml } from "./XmlTree.js";
import { statSync } from "fs";
import type { XmlNode } from "../types/index.js";

export interface ParsedDocx { tree: XmlNode[]; declaration: string; zip: AdmZip; filePath: string; mtimeMs: number; }

export class DocxReadError extends Error {
  constructor(message: string, public code: "FILE_NOT_FOUND" | "NOT_A_DOCX" | "PARSE_ERROR") {
    super(message); this.name = "DocxReadError";
  }
}

export function readDocx(filePath: string): ParsedDocx {
  let zip: AdmZip;
  try { zip = new AdmZip(filePath); } catch { throw new DocxReadError(`File not found: ${filePath}`, "FILE_NOT_FOUND"); }
  const entry = zip.getEntry("word/document.xml");
  if (!entry) throw new DocxReadError(`Not a valid .docx: ${filePath}`, "NOT_A_DOCX");
  const xmlString = entry.getData().toString("utf-8");
  const decl = xmlString.match(/^<\?xml[^?]*\?>/)?. [0] || "";
  const body = xmlString.replace(/^<\?xml[^?]*\?>/, "");
  let tree: XmlNode[];
  try { tree = parseXml(body) as unknown as XmlNode[]; } catch (e) { throw new DocxReadError(`Parse error: ${e instanceof Error ? e.message : String(e)}`, "PARSE_ERROR"); }
  let mtimeMs = 0;
  try { mtimeMs = statSync(filePath).mtimeMs; } catch {}
  return { tree, declaration: decl, zip, filePath, mtimeMs };
}
