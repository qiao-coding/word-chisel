import { describe, it, expect } from "vitest";
import { replaceInParagraph } from "../src/docx/TextReplacer.js";
import type { FlatParagraph, TextSegment, XmlTagObj } from "../src/types/index.js";

function makeSegment(
  text: string,
  opts?: { bold?: boolean; italic?: boolean; fontSize?: number; trackedDel?: boolean; trackedIns?: boolean },
): TextSegment {
  return {
    text,
    paragraphIndex: 0,
    runIndex: 0,
    textIndex: 0,
    wtElem: { "w:t": [{ "#text": text }] } as unknown as XmlTagObj,
    xmlSpacePreserve: false,
    inTrackedDeletion: !!opts?.trackedDel,
    inTrackedInsertion: !!opts?.trackedIns,
    formatting: opts ? { bold: opts.bold, italic: opts.italic, fontSize: opts.fontSize } : undefined,
  };
}

function makePara(segs: TextSegment[], index = 0): FlatParagraph {
  return {
    index,
    fullText: segs.filter(s => !s.inTrackedDeletion).map(s => s.text).join(""),
    segments: segs,
    runCount: segs.length,
  };
}

describe("replaceInParagraph — single segment", () => {
  it("replaces text in a single segment", () => {
    const seg = makeSegment("Hello World");
    const para = makePara([seg]);
    const r = replaceInParagraph(para, "World", "Earth", false, "firstRunFormatting");
    expect(r.matchCount).toBe(1);
    expect(seg.text).toBe("Hello Earth");
    expect(para.fullText).toBe("Hello Earth");
  });

  it("replaces all occurrences with replaceAll", () => {
    const seg = makeSegment("foo bar foo");
    const para = makePara([seg]);
    const r = replaceInParagraph(para, "foo", "baz", true, "firstRunFormatting");
    expect(r.matchCount).toBe(2);
    expect(seg.text).toBe("baz bar baz");
  });

  it("returns 0 when no match", () => {
    const para = makePara([makeSegment("abc")]);
    const r = replaceInParagraph(para, "xyz", "123", false, "firstRunFormatting");
    expect(r.matchCount).toBe(0);
  });
});

describe("replaceInParagraph — cross-segment", () => {
  it("matches text split across two segments (bold + italic)", () => {
    const seg1 = makeSegment("Bold start", { bold: true });
    const seg2 = makeSegment(" italic end", { italic: true });
    const para = makePara([seg1, seg2]);
    const r = replaceInParagraph(para, "start italic", "MID", false, "firstRunFormatting");
    expect(r.matchCount).toBe(1);
    // Cross-run: replacement collapses into first segment, second cleared
    expect(seg1.text).toContain("MID");
    expect(seg2.text).toBe("");
  });

  it("excludes tracked deletion from fullText", () => {
    const seg1 = makeSegment("keep");
    const seg2 = makeSegment("delete", { trackedDel: true });
    const para = makePara([seg1, seg2]);
    // fullText should only contain non-deleted text
    expect(para.fullText).toBe("keep");
    // Searching for deleted text should yield no match
    const r = replaceInParagraph(para, "delete", "REPLACED", false, "firstRunFormatting");
    expect(r.matchCount).toBe(0);
  });

  it("distributes replacement proportionally across segments", () => {
    const seg1 = makeSegment("ABC", { bold: true });
    const seg2 = makeSegment("DEF", { italic: true });
    const para = makePara([seg1, seg2]);
    const r = replaceInParagraph(para, "ABCDEF", "123456", false, "distributeProportional");
    expect(r.matchCount).toBe(1);
    // Proportional: 3 chars matched in each = half of 6 replacement = 3 each
    expect(seg1.text).toBe("123");
    expect(seg2.text).toBe("456");
    expect(para.fullText).toBe("123456");
  });
});

describe("replaceInParagraph — edge cases", () => {
  it("handles replacement at start of segment", () => {
    const seg = makeSegment("Hello World");
    const para = makePara([seg]);
    replaceInParagraph(para, "Hello", "Hi", false, "firstRunFormatting");
    expect(seg.text).toBe("Hi World");
  });

  it("handles replacement at end of segment", () => {
    const seg = makeSegment("Hello World");
    const para = makePara([seg]);
    replaceInParagraph(para, "World", "Earth", false, "firstRunFormatting");
    expect(seg.text).toBe("Hello Earth");
  });

  it("handles empty paragraph gracefully", () => {
    const para = makePara([]);
    const r = replaceInParagraph(para, "anything", "nothing", false, "firstRunFormatting");
    expect(r.matchCount).toBe(0);
  });

  it("handles zero-length replacement", () => {
    const seg = makeSegment("remove-this-suffix");
    const para = makePara([seg]);
    const r = replaceInParagraph(para, "-suffix", "", false, "firstRunFormatting");
    expect(r.matchCount).toBe(1);
    expect(seg.text).toBe("remove-this");
  });
});
