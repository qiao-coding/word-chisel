import { describe, it, expect } from "vitest";
import {
  isString, isElement, tagName, childrenOf, attrsOf, attr,
  findChild, findChildren, textContent, setTextContent, removeChild,
} from "../src/docx/XmlUtils.js";
import type { XmlTagObj } from "../src/types/index.js";

// ---- Helpers to build typed test nodes ----
const t = (text: string): XmlTagObj =>
  ({ "#text": text }) as unknown as XmlTagObj;

const el = (tag: string, ...children: unknown[]): XmlTagObj => {
  const obj: Record<string, unknown> = {};
  obj[tag] = children;
  return obj as unknown as XmlTagObj;
};

const elA = (tag: string, attrs: Record<string, string>, ...children: unknown[]): XmlTagObj => {
  const obj: Record<string, unknown> = {};
  obj[tag] = children;
  obj[":@"] = Object.fromEntries(
    Object.entries(attrs).map(([k, v]) => [`@_${k}`, v])
  );
  return obj as unknown as XmlTagObj;
};

// ============================================================
describe("isString / isElement", () => {
  it("isString returns true for strings", () => {
    expect(isString("hello")).toBe(true);
    expect(isString("")).toBe(true);
  });
  it("isString returns false for objects", () => {
    expect(isString(el("w:p"))).toBe(false);
  });
  it("isElement returns false for strings", () => {
    expect(isElement("hello")).toBe(false);
  });
  it("isElement returns true for objects", () => {
    expect(isElement(el("w:p"))).toBe(true);
  });
});

// ============================================================
describe("tagName", () => {
  it("extracts tag name from element", () => {
    expect(tagName(el("w:p"))).toBe("w:p");
    expect(tagName(el("w:r"))).toBe("w:r");
    expect(tagName(el("w:t"))).toBe("w:t");
  });
  it("returns empty string for element with no tag key", () => {
    expect(tagName({ ":@": { "@_foo": "bar" } } as unknown as XmlTagObj)).toBe("");
  });
});

// ============================================================
describe("childrenOf", () => {
  it("returns children array", () => {
    const elem = el("w:p", el("w:r"), "text node");
    const c = childrenOf(elem);
    expect(c).toHaveLength(2);
    expect(tagName(c[0] as XmlTagObj)).toBe("w:r");
    expect(c[1]).toBe("text node");
  });
  it("returns empty array for tag-less element", () => {
    expect(childrenOf({ ":@": {} } as unknown as XmlTagObj)).toEqual([]);
  });
  it("wraps non-array string value in array", () => {
    const wt = { "w:t": "hello" } as unknown as XmlTagObj;
    const c = childrenOf(wt);
    expect(c).toEqual(["hello"]);
  });
});

// ============================================================
describe("attrsOf / attr", () => {
  it("reads attributes from :@ key", () => {
    const elem = elA("w:r", { "w:val": "32" });
    expect(attrsOf(elem)).toEqual({ "@_w:val": "32" });
  });
  it("attr extracts single attribute", () => {
    const elem = elA("w:pStyle", { "w:val": "Heading1" });
    expect(attr(elem, "w:val")).toBe("Heading1");
  });
  it("returns undefined for missing attribute", () => {
    expect(attr(el("w:p"), "w:val")).toBeUndefined();
  });
});

// ============================================================
describe("findChild / findChildren", () => {
  it("findChild returns first matching element", () => {
    const elem = el("w:p", el("w:r", t("A")), el("w:r", t("B")));
    const r = findChild(elem, "w:r");
    expect(r).toBeDefined();
    expect(textContent(r!)).toBe("A");
  });
  it("findChild returns undefined when not found", () => {
    expect(findChild(el("w:p"), "w:r")).toBeUndefined();
  });
  it("findChildren returns all matching elements", () => {
    const elem = el("w:p", el("w:r", t("A")), "text", el("w:r", t("B")));
    const runs = findChildren(elem, "w:r");
    expect(runs).toHaveLength(2);
  });
});

// ============================================================
describe("textContent / setTextContent", () => {
  it("reads text from w:t element with string #text", () => {
    const wt = { "w:t": [{ "#text": "Hello" }] } as unknown as XmlTagObj;
    expect(textContent(wt)).toBe("Hello");
  });
  it("reads text from w:t with #text node in array", () => {
    // fast-xml-parser preserveOrder format: { "w:t": [{ "#text": "World" }] }
    const wt = { "w:t": [{ "#text": "World" }] } as unknown as XmlTagObj;
    expect(textContent(wt)).toBe("World");
  });
  it("sets text on existing #text child", () => {
    const wt = { "w:t": [{ "#text": "Old" }] } as unknown as XmlTagObj;
    setTextContent(wt, "New");
    expect(textContent(wt)).toBe("New");
  });
  it("creates #text child when missing", () => {
    const wt = { "w:t": [] } as unknown as XmlTagObj;
    setTextContent(wt, "Fresh");
    expect(textContent(wt)).toBe("Fresh");
  });
});

// ============================================================
describe("removeChild", () => {
  it("removes a child from parent", () => {
    const child = el("w:r", t("remove me"));
    const parent = el("w:p", el("w:r", t("keep")), child);
    expect(childrenOf(parent)).toHaveLength(2);
    expect(removeChild(parent, child)).toBe(true);
    expect(childrenOf(parent)).toHaveLength(1);
  });
  it("returns false for non-child", () => {
    const parent = el("w:p");
    const child = el("w:r");
    expect(removeChild(parent, child)).toBe(false);
  });
});
