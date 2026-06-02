import { statSync } from "fs";
import { readDocx } from "./DocxReader.js";
import { flattenDocument } from "./TextFlattener.js";
import { isElement, tagName, findChild } from "./XmlUtils.js";
import { prepareWorkingCopy } from "./DocConverter.js";
import type { ParsedDocx } from "./DocxReader.js";
import type { FlatDocument, XmlNode, XmlTagObj } from "../types/index.js";

interface CacheEntry {
  doc: ParsedDocx;
  flatDoc: FlatDocument;
  outputPath: string;
  note?: string;
}

const cache = new Map<string, CacheEntry>();

export function getDocument(
  filePath: string,
  outputName?: string,
): {
  doc: ParsedDocx;
  flatDoc: FlatDocument;
  outputPath: string;
  note?: string;
} {
  const absPath = filePath;

  // Always resolve the working copy path first so we can validate cache against it
  const { workingPath, wasConverted } = prepareWorkingCopy(absPath, outputName);

  // Cache is keyed on the original path the user provided
  const entry = cache.get(absPath);
  if (entry) {
    try {
      // Validate against the working copy's mtime, not the original
      const currentMtime = statSync(workingPath).mtimeMs;
      if (currentMtime <= entry.doc.mtimeMs) {
        return {
          doc: entry.doc,
          flatDoc: entry.flatDoc,
          outputPath: entry.outputPath,
          note: entry.note,
        };
      }
    } catch {
      // Working file may have been deleted
    }
    cache.delete(absPath);
  }

  const doc = readDocx(workingPath);
  const bodyElem = findBody(doc.tree);
  const flatDoc = flattenDocument(bodyElem);

  let note: string | undefined;
  if (workingPath !== absPath) {
    note = wasConverted
      ? "This .doc file was copied and converted to .docx for editing. "
      : "A working copy was created for editing. ";
    note += `Original: ${absPath} (untouched). Editing: ${workingPath}`;
  }

  cache.set(absPath, { doc, flatDoc, outputPath: workingPath, note });
  return { doc, flatDoc, outputPath: workingPath, note };
}

export function invalidateCache(filePath: string): void {
  cache.delete(filePath);
}

export function updateCachedTree(
  filePath: string,
  newTree: XmlNode[],
): void {
  const entry = cache.get(filePath);
  if (entry) {
    entry.doc.tree = newTree;
    const bodyElem = findBody(newTree);
    entry.flatDoc = flattenDocument(bodyElem);
  }
}

function findBody(tree: XmlNode[]): XmlTagObj {
  for (const node of tree) {
    if (typeof node === "string") continue;
    if (isElement(node) && tagName(node) === "w:document") {
      const body = findChild(node, "w:body");
      if (body) return body;
    }
  }
  throw new Error("Could not find w:body in document XML");
}
