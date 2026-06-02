import { statSync } from "fs";
import { readDocx } from "./DocxReader.js";
import { flattenDocument } from "./TextFlattener.js";
import { isElement, tagName, findChild } from "./XmlUtils.js";
import { prepareWorkingCopy } from "./DocConverter.js";
import type { ParsedDocx } from "./DocxReader.js";
import type { FlatDocument, XmlNode, XmlTagObj } from "../types/index.js";

interface CacheEntry { doc: ParsedDocx; flatDoc: FlatDocument; outputPath: string; note?: string; }
const cache = new Map<string, CacheEntry>();

export function getDocument(filePath: string, outputName?: string): { doc: ParsedDocx; flatDoc: FlatDocument; outputPath: string; note?: string } {
  const { workingPath, wasConverted } = prepareWorkingCopy(filePath, outputName);
  const entry = cache.get(filePath);
  if (entry) {
    try { if (statSync(workingPath).mtimeMs <= entry.doc.mtimeMs) return { doc: entry.doc, flatDoc: entry.flatDoc, outputPath: entry.outputPath, note: entry.note }; }
    catch {}
    cache.delete(filePath);
  }
  const doc = readDocx(workingPath);
  const bodyElem = findBody(doc.tree);
  const flatDoc = flattenDocument(bodyElem);
  let note: string | undefined;
  if (workingPath !== filePath) {
    note = wasConverted ? "This .doc file was converted to .docx for editing. " : "A working copy was created for editing. ";
    note += `Original: ${filePath} (untouched). Editing: ${workingPath}`;
  }
  cache.set(filePath, { doc, flatDoc, outputPath: workingPath, note });
  return { doc, flatDoc, outputPath: workingPath, note };
}

export const invalidateCache = (p: string) => { cache.delete(p); };

export function updateCachedTree(filePath: string, newTree: XmlNode[]): void {
  const e = cache.get(filePath);
  if (e) { e.doc.tree = newTree; e.flatDoc = flattenDocument(findBody(newTree)); }
}

function findBody(tree: XmlNode[]): XmlTagObj {
  for (const node of tree) {
    if (typeof node === "string" || !isElement(node)) continue;
    if (tagName(node) === "w:document") { const b = findChild(node, "w:body"); if (b) return b; }
  }
  throw new Error("Could not find w:body in document XML");
}
