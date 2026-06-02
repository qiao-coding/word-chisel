import type {
  FlatParagraph,
  TextSegment,
  MatchLocation,
  AffectedSegmentInfo,
  ReplacementStrategy,
  ReplaceDetail,
} from "../types/index.js";
import { setTextContent } from "./XmlUtils.js";

export interface ReplaceResult {
  matchCount: number;
  details: ReplaceDetail[];
}

export function replaceInParagraph(
  paragraph: FlatParagraph,
  search: string,
  replacement: string,
  replaceAll: boolean,
  strategy: ReplacementStrategy,
): ReplaceResult {
  const details: ReplaceDetail[] = [];

  const matches = findMatches(paragraph, search, replaceAll);
  if (matches.length === 0) {
    return { matchCount: 0, details: [] };
  }

  // Process from end to start to preserve offsets
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    executeReplacement(match, replacement, strategy, details);
  }

  // Update paragraph fullText
  rebuildParagraphText(paragraph);

  return { matchCount: matches.length, details };
}

function findMatches(
  paragraph: FlatParagraph,
  search: string,
  replaceAll: boolean,
): MatchLocation[] {
  const matches: MatchLocation[] = [];
  const fullText = paragraph.fullText;
  let searchStart = 0;

  while (searchStart < fullText.length) {
    const foundAt = fullText.indexOf(search, searchStart);
    if (foundAt === -1) break;

    const match = resolveMatch(paragraph, foundAt, foundAt + search.length);
    if (match && !match.inTrackedDeletion) {
      matches.push(match);
    }

    if (!replaceAll) break;

    // Move past this match (avoid infinite loop on zero-length matches)
    searchStart = foundAt + Math.max(1, search.length);
  }

  return matches;
}

function resolveMatch(
  paragraph: FlatParagraph,
  startOffset: number,
  endOffset: number,
): MatchLocation | null {
  const affectedSegments: AffectedSegmentInfo[] = [];
  let currentPos = 0;
  let inDeletion = false;

  for (const segment of paragraph.segments) {
    const segStart = currentPos;
    const segEnd = currentPos + segment.text.length;

    if (segEnd > startOffset && segStart < endOffset) {
      const localStart = Math.max(0, startOffset - segStart);
      const localEnd = Math.min(segment.text.length, endOffset - segStart);

      affectedSegments.push({ segment, localStart, localEnd });

      if (segment.inTrackedDeletion) {
        inDeletion = true;
      }
    }

    currentPos = segEnd;
    if (segStart >= endOffset) break;
  }

  if (affectedSegments.length === 0) return null;

  return {
    paragraphIndex: paragraph.index,
    startOffset,
    endOffset,
    affectedSegments,
    inTrackedDeletion: inDeletion,
  };
}

function executeReplacement(
  match: MatchLocation,
  replacement: string,
  strategy: ReplacementStrategy,
  details: ReplaceDetail[],
): void {
  if (strategy === "firstRunFormatting") {
    executeFirstRunReplacement(match, replacement, details);
  } else {
    executeProportionalReplacement(match, replacement, details);
  }
}

function executeFirstRunReplacement(
  match: MatchLocation,
  replacement: string,
  details: ReplaceDetail[],
): void {
  const segs = match.affectedSegments;

  if (segs.length === 1) {
    // Simple single-run replacement
    const { segment, localStart, localEnd } = segs[0];
    const oldText = segment.text;
    const prefix = oldText.substring(0, localStart);
    const suffix = oldText.substring(localEnd);
    const newText = prefix + replacement + suffix;

    setTextContent(segment.wtElem, newText);
    segment.text = newText;

    details.push({
      paragraphIndex: segment.paragraphIndex,
      runIndex: segment.runIndex,
      oldTextFragment: oldText.substring(localStart, localEnd),
      newTextFragment: replacement,
    });
  } else {
    // Cross-run replacement: collapse into first run's formatting
    const firstSeg = segs[0];
    const lastSeg = segs[segs.length - 1];

    const prefix = firstSeg.segment.text.substring(0, firstSeg.localStart);
    const suffix = lastSeg.segment.text.substring(lastSeg.localEnd);

    const newText = prefix + replacement + suffix;

    // Update first segment
    setTextContent(firstSeg.segment.wtElem, newText);
    details.push({
      paragraphIndex: firstSeg.segment.paragraphIndex,
      runIndex: firstSeg.segment.runIndex,
      oldTextFragment: firstSeg.segment.text.substring(firstSeg.localStart),
      newTextFragment: replacement + suffix,
    });
    firstSeg.segment.text = newText;

    // Clear all other affected segments
    for (let i = 1; i < segs.length; i++) {
      const { segment, localStart, localEnd } = segs[i];
      const oldFragment = segment.text.substring(localStart, localEnd);

      setTextContent(segment.wtElem, "");
      details.push({
        paragraphIndex: segment.paragraphIndex,
        runIndex: segment.runIndex,
        oldTextFragment: oldFragment,
        newTextFragment: "",
      });
      segment.text = "";
    }
  }
}

function executeProportionalReplacement(
  match: MatchLocation,
  replacement: string,
  details: ReplaceDetail[],
): void {
  const segs = match.affectedSegments;

  // Calculate total matched length
  let totalMatchedLength = 0;
  for (const s of segs) {
    totalMatchedLength += s.localEnd - s.localStart;
  }

  let replacementOffset = 0;

  for (let i = 0; i < segs.length; i++) {
    const { segment, localStart, localEnd } = segs[i];
    const oldText = segment.text;
    const prefix = oldText.substring(0, localStart);
    const suffix = oldText.substring(localEnd);

    const matchedLen = localEnd - localStart;
    const proportion = totalMatchedLength > 0
      ? matchedLen / totalMatchedLength
      : 1 / segs.length;

    const replaceLen = Math.round(proportion * replacement.length);
    // Last segment gets the remainder to avoid rounding errors
    const actualReplaceLen = i === segs.length - 1
      ? replacement.length - replacementOffset
      : Math.min(replaceLen, replacement.length - replacementOffset);

    const replacePart = replacement.substring(
      replacementOffset,
      replacementOffset + actualReplaceLen,
    );

    const newText = prefix + replacePart + suffix;
    setTextContent(segment.wtElem, newText);
    segment.text = newText;

    details.push({
      paragraphIndex: segment.paragraphIndex,
      runIndex: segment.runIndex,
      oldTextFragment: oldText.substring(localStart, localEnd),
      newTextFragment: replacePart,
    });

    replacementOffset += actualReplaceLen;
  }
}

function rebuildParagraphText(paragraph: FlatParagraph): void {
  paragraph.fullText = paragraph.segments
    .filter((s) => !s.inTrackedDeletion)
    .map((s) => s.text)
    .join("");
}
