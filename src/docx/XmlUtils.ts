import type { XmlNode, XmlTagObj, XmlChild } from "../types/index.js";

export const isString = (child: XmlChild): child is string => typeof child === "string";
export const isElement = (child: XmlChild): child is XmlTagObj => typeof child === "object" && child !== null;
export const tagName = (elem: XmlTagObj): string => Object.keys(elem).find((k) => k !== ":@") || "";

export function childrenOf(elem: XmlTagObj): XmlChild[] {
  const name = tagName(elem);
  if (!name) return [];
  const val = elem[name];
  if (Array.isArray(val)) return val;
  return val !== undefined ? [val as unknown as XmlChild] : [];
}

export function attrsOf(elem: XmlTagObj): Record<string, string> {
  const raw = elem[":@"];
  return (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw as Record<string, string> : {};
}

export const attr = (elem: XmlTagObj, name: string): string | undefined => attrsOf(elem)[`@_${name}`];
export const findChildren = (elem: XmlTagObj, tag: string): XmlTagObj[] => childrenOf(elem).filter(isElement).filter((c) => tagName(c) === tag);
export const findChild = (elem: XmlTagObj, tag: string): XmlTagObj | undefined => childrenOf(elem).filter(isElement).find((c) => tagName(c) === tag);

export function textContent(elem: XmlTagObj): string {
  const tc = findChild(elem, "#text");
  if (!tc) return "";
  const c = childrenOf(tc);
  return c.length > 0 ? String(c[0]) : "";
}

export function setTextContent(elem: XmlTagObj, newText: string): void {
  const tc = findChild(elem, "#text");
  if (tc) {
    const raw = tc["#text"];
    if (Array.isArray(raw)) { raw.length > 0 ? raw[0] = newText : raw.push(newText); }
    else { tc["#text"] = newText as unknown as typeof raw; }
  } else {
    const arr = elem[tagName(elem)] as XmlChild[];
    arr.push({ "#text": [newText] } as unknown as XmlTagObj);
  }
}

export function removeChild(parent: XmlTagObj, child: XmlTagObj): boolean {
  const idx = childrenOf(parent).indexOf(child as XmlChild);
  if (idx < 0) return false;
  childrenOf(parent).splice(idx, 1);
  return true;
}
