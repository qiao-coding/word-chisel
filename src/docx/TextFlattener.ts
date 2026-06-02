import type { XmlTagObj, FlatDocument, FlatParagraph, TextSegment } from "../types/index.js";
import { isElement, tagName, childrenOf, findChild, attr, textContent } from "./XmlUtils.js";
import type { RunFormatting } from "../types/index.js";

export function flattenDocument(bodyElem: XmlTagObj): FlatDocument {
  const paragraphs: FlatParagraph[] = [];
  let hasTrackChanges = false;
  for (const child of childrenOf(bodyElem)) {
    if (!isElement(child)) continue;
    if (tagName(child) === "w:p") {
      const r = flattenParagraph(child, paragraphs.length);
      paragraphs.push(r.paragraph);
      if (r.hasTrackChanges) hasTrackChanges = true;
    }
  }
  return { paragraphs, hasTrackChanges };
}

function flattenParagraph(pElem: XmlTagObj, paraIndex: number): { paragraph: FlatParagraph; hasTrackChanges: boolean } {
  const segments: TextSegment[] = [];
  let fullText = "", runIndex = 0, hasTrackChanges = false;
  const style = extractParagraphStyle(pElem);
  walk(pElem, false, false);
  return { paragraph: { index: paraIndex, fullText, segments, style, runCount: runIndex }, hasTrackChanges };

  function walk(elem: XmlTagObj, inIns: boolean, inDel: boolean): void {
    for (const child of childrenOf(elem)) {
      if (!isElement(child)) continue;
      switch (tagName(child)) {
        case "w:r": run(child, inIns, inDel); break;
        case "w:ins": hasTrackChanges = true; walk(child, true, false); break;
        case "w:del": hasTrackChanges = true; walk(child, false, true); break;
        case "w:hyperlink": case "w:smartTag": case "w:dir": walk(child, inIns, inDel); break;
        case "w:sdt": { const c = findChild(child, "w:sdtContent"); if (c) walk(c, inIns, inDel); } break;
        case "w:subDoc": break;
      }
    }
  }

  function run(rElem: XmlTagObj, inIns: boolean, inDel: boolean): void {
    let ti = 0;
    const fmt = extractRunFormatting(rElem);
    for (const child of childrenOf(rElem)) {
      if (!isElement(child) || tagName(child) !== "w:t") continue;
      const text = textContent(child);
      segments.push({ text, paragraphIndex: paraIndex, runIndex, textIndex: ti, wtElem: child, xmlSpacePreserve: attr(child, "xml:space") === "preserve", inTrackedInsertion: inIns, inTrackedDeletion: inDel, formatting: fmt });
      if (!inDel) fullText += text;
      ti++;
    }
    if (ti > 0) runIndex++;
  }
}

function extractRunFormatting(rElem: XmlTagObj): RunFormatting | undefined {
  const rPr = findChild(rElem, "w:rPr");
  if (!rPr) return;
  const fmt: RunFormatting = {};
  if (findChild(rPr, "w:b")) fmt.bold = true;
  if (findChild(rPr, "w:i")) fmt.italic = true;
  if (findChild(rPr, "w:strike")) fmt.strike = true;
  const u = findChild(rPr, "w:u");
  if (u) { const v = attr(u, "w:val"); fmt.underline = v === "double" ? "double" : v === "none" ? "none" : "single"; }
  const sz = findChild(rPr, "w:sz"); if (sz) { const v = attr(sz, "w:val"); if (v) fmt.fontSize = parseInt(v, 10); }
  const rf = findChild(rPr, "w:rFonts"); if (rf) fmt.font = attr(rf, "w:ascii") || attr(rf, "w:eastAsia") || undefined;
  const hl = findChild(rPr, "w:highlight"); if (hl) fmt.highlight = attr(hl, "w:val") || "yellow";
  const co = findChild(rPr, "w:color"); if (co) fmt.color = attr(co, "w:val") || "auto";
  const va = findChild(rPr, "w:vertAlign"); if (va) { const v = attr(va, "w:val"); if (v === "superscript" || v === "subscript" || v === "baseline") fmt.vertAlign = v; }
  return fmt;
}

function extractParagraphStyle(pElem: XmlTagObj): string | undefined {
  const pPr = findChild(pElem, "w:pPr");
  if (!pPr) return;
  const ps = findChild(pPr, "w:pStyle");
  return ps ? attr(ps, "w:val") : undefined;
}
