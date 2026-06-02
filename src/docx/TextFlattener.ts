import type {
  XmlNode,
  XmlTagObj,
  FlatDocument,
  FlatParagraph,
  TextSegment,
} from "../types/index.js";
import {
  isElement,
  isString,
  tagName,
  childrenOf,
  findChild,
  attr,
  textContent,
} from "./XmlUtils.js";

export function flattenDocument(bodyElem: XmlTagObj): FlatDocument {
  const paragraphs: FlatParagraph[] = [];
  let hasTrackChanges = false;

  const bodyChildren = childrenOf(bodyElem);

  for (const child of bodyChildren) {
    if (!isElement(child)) continue;
    const tName = tagName(child);

    if (tName === "w:p") {
      const result = flattenParagraph(child, paragraphs.length);
      paragraphs.push(result.paragraph);
      if (result.hasTrackChanges) hasTrackChanges = true;
    }
    // w:tbl (tables) skipped in MVP
  }

  return { paragraphs, hasTrackChanges };
}

function flattenParagraph(
  pElem: XmlTagObj,
  paraIndex: number,
): { paragraph: FlatParagraph; hasTrackChanges: boolean } {
  const segments: TextSegment[] = [];
  let fullText = "";
  let runIndex = 0;
  let hasTrackChanges = false;

  const style = extractParagraphStyle(pElem);

  walkParagraphChildren(pElem, false, false);

  return {
    paragraph: {
      index: paraIndex,
      fullText,
      segments,
      style,
      runCount: runIndex,
    },
    hasTrackChanges,
  };

  function walkParagraphChildren(
    elem: XmlTagObj,
    inInsertion: boolean,
    inDeletion: boolean,
  ): void {
    for (const child of childrenOf(elem)) {
      if (!isElement(child)) continue;
      const childTag = tagName(child);

      switch (childTag) {
        case "w:r":
          processRun(child, inInsertion, inDeletion);
          break;
        case "w:ins":
          hasTrackChanges = true;
          walkParagraphChildren(child, true, false);
          break;
        case "w:del":
          hasTrackChanges = true;
          walkParagraphChildren(child, false, true);
          break;
        case "w:hyperlink":
          walkParagraphChildren(child, inInsertion, inDeletion);
          break;
        case "w:sdt":
          // Structured document tag - recurse into sdtContent
          {
            const sdtContent = findChild(child, "w:sdtContent");
            if (sdtContent) {
              walkParagraphChildren(sdtContent, inInsertion, inDeletion);
            }
          }
          break;
        case "w:smartTag":
          walkParagraphChildren(child, inInsertion, inDeletion);
          break;
        case "w:dir":
          walkParagraphChildren(child, inInsertion, inDeletion);
          break;
        case "w:subDoc":
          // Embedded sub-document reference - skip
          break;
      }
    }
  }

  function processRun(
    rElem: XmlTagObj,
    inInsertion: boolean,
    inDeletion: boolean,
  ): void {
    let textIndex = 0;
    const formatting = extractRunFormatting(rElem);

    for (const child of childrenOf(rElem)) {
      if (!isElement(child)) continue;
      const childTag = tagName(child);

      if (childTag === "w:t") {
        const text = textContent(child);
        const preserve = attr(child, "xml:space") === "preserve";

        const segment: TextSegment = {
          text,
          paragraphIndex: paraIndex,
          runIndex,
          textIndex,
          wtElem: child,
          xmlSpacePreserve: preserve,
          inTrackedInsertion: inInsertion,
          inTrackedDeletion: inDeletion,
          formatting,
        };

        segments.push(segment);

        if (!inDeletion) {
          fullText += text;
        }
        textIndex++;
      }
    }

    if (textIndex > 0) {
      runIndex++;
    }
  }
}

function extractRunFormatting(rElem: XmlTagObj): import("../types/index.js").RunFormatting | undefined {
  const rPr = findChild(rElem, "w:rPr");
  if (!rPr) return undefined;

  const fmt: import("../types/index.js").RunFormatting = {};

  if (findChild(rPr, "w:b")) fmt.bold = true;
  if (findChild(rPr, "w:i")) fmt.italic = true;
  if (findChild(rPr, "w:strike")) fmt.strike = true;
  if (findChild(rPr, "w:smallCaps")) fmt.vertAlign = undefined; // small caps handled separately

  const u = findChild(rPr, "w:u");
  if (u) {
    const val = attr(u, "w:val");
    fmt.underline = val === "double" ? "double" : val === "none" ? "none" : "single";
  }

  const sz = findChild(rPr, "w:sz");
  if (sz) {
    const val = attr(sz, "w:val");
    if (val) fmt.fontSize = parseInt(val, 10);
  }

  const rFonts = findChild(rPr, "w:rFonts");
  if (rFonts) {
    fmt.font = attr(rFonts, "w:ascii") || attr(rFonts, "w:eastAsia") || undefined;
  }

  const highlight = findChild(rPr, "w:highlight");
  if (highlight) {
    fmt.highlight = attr(highlight, "w:val") || "yellow";
  }

  const color = findChild(rPr, "w:color");
  if (color) {
    fmt.color = attr(color, "w:val") || "auto";
  }

  const vertAlign = findChild(rPr, "w:vertAlign");
  if (vertAlign) {
    const val = attr(vertAlign, "w:val");
    if (val === "superscript" || val === "subscript" || val === "baseline") {
      fmt.vertAlign = val;
    }
  }

  return fmt;
}

function extractParagraphStyle(pElem: XmlTagObj): string | undefined {
  const pPr = findChild(pElem, "w:pPr");
  if (!pPr) return undefined;
  const pStyle = findChild(pPr, "w:pStyle");
  if (!pStyle) return undefined;
  return attr(pStyle, "w:val");
}
