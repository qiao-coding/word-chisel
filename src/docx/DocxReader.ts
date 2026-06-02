import AdmZip from "adm-zip";
import { parseXml } from "./XmlTree.js";
import type { XmlNode } from "../types/index.js";

export interface ParsedDocx {
  tree: XmlNode[];
  declaration: string;
  zip: AdmZip;
  filePath: string;
  mtimeMs: number;
}

export class DocxReadError extends Error {
  constructor(
    message: string,
    public code: "FILE_NOT_FOUND" | "NOT_A_DOCX" | "PARSE_ERROR",
  ) {
    super(message);
    this.name = "DocxReadError";
  }
}

export function readDocx(filePath: string): ParsedDocx {
  let zip: AdmZip;
  try {
    zip = new AdmZip(filePath);
  } catch {
    throw new DocxReadError(
      `File not found or not readable: ${filePath}`,
      "FILE_NOT_FOUND",
    );
  }

  const documentXml = zip.getEntry("word/document.xml");
  if (!documentXml) {
    throw new DocxReadError(
      `Not a valid .docx file (missing word/document.xml): ${filePath}`,
      "NOT_A_DOCX",
    );
  }

  const xmlString = documentXml.getData().toString("utf-8");
  const declaration = extractDeclaration(xmlString);
  const bodyOnly = stripDeclaration(xmlString);

  let tree: XmlNode[];
  try {
    tree = parseXml(bodyOnly) as unknown as XmlNode[];
  } catch (e) {
    throw new DocxReadError(
      `Failed to parse document XML: ${e instanceof Error ? e.message : String(e)}`,
      "PARSE_ERROR",
    );
  }

  // Get mtime for cache invalidation
  let mtimeMs = 0;
  try {
    const { statSync } = require("fs");
    mtimeMs = statSync(filePath).mtimeMs;
  } catch {
    // ignore
  }

  return { tree, declaration, zip, filePath, mtimeMs };
}

function extractDeclaration(xml: string): string {
  const match = xml.match(/^<\?xml[^?]*\?>/);
  return match ? match[0] : "";
}

function stripDeclaration(xml: string): string {
  return xml.replace(/^<\?xml[^?]*\?>/, "");
}
