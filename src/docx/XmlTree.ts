import { XMLParser, XMLBuilder } from "fast-xml-parser";
import type { XmlNode } from "../types/index.js";

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: false,
  htmlEntities: false,
  trimValues: false,
});

const builder = new XMLBuilder({
  preserveOrder: true,
  format: false,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  suppressEmptyNode: true,
});

export function parseXml(xmlString: string): XmlNode[] {
  // fast-xml-parser strips the XML declaration. We save it for later reassembly.
  const declaration = extractDeclaration(xmlString);
  const bodyOnly = stripDeclaration(xmlString);
  const parsed = parser.parse(bodyOnly) as XmlNode[];
  return parsed;
}

export function buildXml(nodes: XmlNode[], declaration: string): string {
  const body = builder.build(nodes);
  return declaration + body;
}

function extractDeclaration(xml: string): string {
  const match = xml.match(/^<\?xml[^?]*\?>/);
  return match ? match[0] : "";
}

function stripDeclaration(xml: string): string {
  return xml.replace(/^<\?xml[^?]*\?>/, "");
}
