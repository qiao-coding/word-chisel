import type { XmlNode, XmlTagObj, XmlChild } from "../types/index.js";

/** Check if an XmlChild is a string (text node) */
export function isString(child: XmlChild): child is string {
  return typeof child === "string";
}

/** Check if an XmlChild is an element { tagName: [...] } (not a string) */
export function isElement(child: XmlChild): child is XmlTagObj {
  return typeof child === "object" && child !== null;
}

/** Get the tag name of an XmlTagObj (the first key that is not ":@") */
export function tagName(elem: XmlTagObj): string {
  return Object.keys(elem).find((k) => k !== ":@") || "";
}

/** Get children array of an XmlTagObj */
export function childrenOf(elem: XmlTagObj): XmlChild[] {
  const name = tagName(elem);
  if (!name) return [];
  const val = elem[name];
  if (Array.isArray(val)) return val;
  if (val !== undefined) return [val as unknown as XmlChild];
  return [];
}

/** Get attributes of an XmlTagObj directly from the ":@" key */
export function attrsOf(elem: XmlTagObj): Record<string, string> {
  const raw = elem[":@"];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, string>;
  }
  return {};
}

/** Get a specific attribute value */
export function attr(elem: XmlTagObj, name: string): string | undefined {
  return attrsOf(elem)[`@_${name}`];
}

/** Find child elements (not text nodes) with a specific tag name */
export function findChildren(elem: XmlTagObj, tag: string): XmlTagObj[] {
  return childrenOf(elem).filter(isElement).filter((c) => tagName(c) === tag);
}

/** Find the first child element with a specific tag name */
export function findChild(
  elem: XmlTagObj,
  tag: string,
): XmlTagObj | undefined {
  return childrenOf(elem)
    .filter(isElement)
    .find((c) => tagName(c) === tag);
}

/** Get the "#text" content of a leaf element like <w:t> */
export function textContent(elem: XmlTagObj): string {
  const tc = findChild(elem, "#text");
  if (!tc) return "";
  const children = childrenOf(tc);
  return children.length > 0 ? String(children[0]) : "";
}

/** Set the "#text" content of a leaf element like <w:t> (modifies in-place) */
export function setTextContent(elem: XmlTagObj, newText: string): void {
  const tc = findChild(elem, "#text");
  if (tc) {
    // fast-xml-parser may represent #text as a string or an array of strings
    const raw = tc["#text"];
    if (Array.isArray(raw)) {
      if (raw.length > 0) {
        raw[0] = newText;
      } else {
        raw.push(newText);
      }
    } else {
      tc["#text"] = newText as unknown as typeof raw;
    }
  } else {
    // No #text child - create one
    const eName = tagName(elem);
    const arr = elem[eName] as XmlChild[];
    arr.push({ "#text": [newText] } as unknown as XmlTagObj);
  }
}

/** Remove a child element from its parent's children array */
export function removeChild(
  parent: XmlTagObj,
  child: XmlTagObj,
): boolean {
  const pChildren = childrenOf(parent);
  const idx = pChildren.indexOf(child as XmlChild);
  if (idx >= 0) {
    pChildren.splice(idx, 1);
    return true;
  }
  return false;
}
