import type { FlatParagraph, MatchLocation, AffectedSegmentInfo, ReplacementStrategy, ReplaceDetail } from "../types/index.js";
import { setTextContent } from "./XmlUtils.js";

export interface ReplaceResult { matchCount: number; details: ReplaceDetail[]; }

export function replaceInParagraph(para: FlatParagraph, search: string, replacement: string, all: boolean, strategy: ReplacementStrategy): ReplaceResult {
  const details: ReplaceDetail[] = [];
  const matches = findMatches(para, search, all);
  if (!matches.length) return { matchCount: 0, details: [] };
  for (let i = matches.length - 1; i >= 0; i--)
    strategy === "firstRunFormatting" ? execFirst(matches[i], replacement, details) : execProp(matches[i], replacement, details);
  para.fullText = para.segments.filter(s => !s.inTrackedDeletion).map(s => s.text).join("");
  return { matchCount: matches.length, details };
}

function findMatches(para: FlatParagraph, search: string, all: boolean): MatchLocation[] {
  const m: MatchLocation[] = []; let pos = 0;
  while (pos < para.fullText.length) {
    const at = para.fullText.indexOf(search, pos);
    if (at === -1) break;
    const r = resolveMatch(para, at, at + search.length);
    if (r && !r.inTrackedDeletion) m.push(r);
    if (!all) break;
    pos = at + Math.max(1, search.length);
  }
  return m;
}

function resolveMatch(para: FlatParagraph, start: number, end: number): MatchLocation | null {
  const affected: AffectedSegmentInfo[] = []; let pos = 0, inDel = false;
  for (const seg of para.segments) {
    const segEnd = pos + seg.text.length;
    if (segEnd > start && pos < end) {
      affected.push({ segment: seg, localStart: Math.max(0, start - pos), localEnd: Math.min(seg.text.length, end - pos) });
      if (seg.inTrackedDeletion) inDel = true;
    }
    pos = segEnd;
    if (pos >= end) break;
  }
  return affected.length ? { paragraphIndex: para.index, startOffset: start, endOffset: end, affectedSegments: affected, inTrackedDeletion: inDel } : null;
}

function execFirst(match: MatchLocation, replacement: string, details: ReplaceDetail[]): void {
  const segs = match.affectedSegments;
  if (segs.length === 1) {
    const { segment: s, localStart: ls, localEnd: le } = segs[0];
    const old = s.text.substring(ls, le);
    const t = s.text.substring(0, ls) + replacement + s.text.substring(le);
    setTextContent(s.wtElem, t); s.text = t;
    details.push({ paragraphIndex: s.paragraphIndex, runIndex: s.runIndex, oldTextFragment: old, newTextFragment: replacement });
  } else {
    const first = segs[0], last = segs[segs.length - 1];
    const t = first.segment.text.substring(0, first.localStart) + replacement + last.segment.text.substring(last.localEnd);
    setTextContent(first.segment.wtElem, t);
    details.push({ paragraphIndex: first.segment.paragraphIndex, runIndex: first.segment.runIndex, oldTextFragment: first.segment.text.substring(first.localStart), newTextFragment: replacement + last.segment.text.substring(last.localEnd) });
    first.segment.text = t;
    for (let i = 1; i < segs.length; i++) {
      const { segment: s, localStart: ls, localEnd: le } = segs[i];
      setTextContent(s.wtElem, "");
      details.push({ paragraphIndex: s.paragraphIndex, runIndex: s.runIndex, oldTextFragment: s.text.substring(ls, le), newTextFragment: "" });
      s.text = "";
    }
  }
}

function execProp(match: MatchLocation, replacement: string, details: ReplaceDetail[]): void {
  const segs = match.affectedSegments;
  let total = 0; for (const s of segs) total += s.localEnd - s.localStart;
  let offset = 0;
  for (let i = 0; i < segs.length; i++) {
    const { segment, localStart: ls, localEnd: le } = segs[i];
    const prefix = segment.text.substring(0, ls), suffix = segment.text.substring(le);
    const prop = total > 0 ? (le - ls) / total : 1 / segs.length;
    const len = i === segs.length - 1 ? replacement.length - offset : Math.min(Math.round(prop * replacement.length), replacement.length - offset);
    const part = replacement.substring(offset, offset + len);
    const t = prefix + part + suffix;
    setTextContent(segment.wtElem, t);
    details.push({ paragraphIndex: segment.paragraphIndex, runIndex: segment.runIndex, oldTextFragment: segment.text.substring(ls, le), newTextFragment: part });
    segment.text = t;
    offset += len;
  }
}
