import { buildXml } from "./XmlTree.js";
import type { ParsedDocx } from "./DocxReader.js";
import type { XmlNode } from "../types/index.js";

export function saveDocx(doc: ParsedDocx, tree: XmlNode[]): void {
  const xmlString = buildXml(tree, doc.declaration);
  const buf = Buffer.from(xmlString, "utf-8");
  doc.zip.updateFile("word/document.xml", buf);
  doc.zip.writeZip(doc.filePath);
}
