import { XMLParser, XMLBuilder } from "fast-xml-parser";
import type { XmlNode } from "../types/index.js";

const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: false, htmlEntities: false, trimValues: false });
const builder = new XMLBuilder({ preserveOrder: true, format: false, ignoreAttributes: false, attributeNamePrefix: "@_", suppressEmptyNode: true });

export const parseXml = (xml: string): XmlNode[] => parser.parse(xml.replace(/^<\?xml[^?]*\?>/, "")) as XmlNode[];
export const buildXml = (nodes: XmlNode[], decl: string): string => decl + builder.build(nodes);
