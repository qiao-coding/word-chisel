// ---- XML Tree Types (fast-xml-parser preserveOrder format) ----

/** A node in a preserveOrder parsed tree */
export type XmlNode = string | XmlTagObj;

/**
 * An XML element in preserveOrder format.
 * The tag key (e.g. "w:p") maps to an array of children.
 * The ":@" key (if present) maps to attributes object directly.
 */
export interface XmlTagObj {
  [tagName: string]: XmlChild[] | Record<string, string> | undefined;
}

/** Children of an XmlTagObj: strings (text), or child XmlTagObj elements */
export type XmlChild = string | XmlTagObj;

// ---- Document Structure ----

export interface TextSegment {
  text: string;
  paragraphIndex: number;
  runIndex: number;
  textIndex: number;
  /** Reference to the w:t element for in-place mutation */
  wtElem: XmlTagObj;
  xmlSpacePreserve: boolean;
  inTrackedInsertion: boolean;
  inTrackedDeletion: boolean;
  /** Run formatting properties (extracted during flattening) */
  formatting?: RunFormatting;
}

export interface RunFormatting {
  bold?: boolean;
  italic?: boolean;
  underline?: "single" | "double" | "none";
  strike?: boolean;
  fontSize?: number;
  font?: string;
  highlight?: string;
  color?: string;
  vertAlign?: "superscript" | "subscript" | "baseline";
}

export interface FlatParagraph {
  index: number;
  fullText: string;
  segments: TextSegment[];
  style?: string;
  runCount: number;
}

export interface FlatDocument {
  paragraphs: FlatParagraph[];
  hasTrackChanges: boolean;
}

export interface MatchLocation {
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  affectedSegments: AffectedSegmentInfo[];
  inTrackedDeletion: boolean;
}

export interface AffectedSegmentInfo {
  segment: TextSegment;
  /** Offset within this segment's text where the match starts (0 = beginning) */
  localStart: number;
  /** Offset within this segment's text where the match ends */
  localEnd: number;
}

export type ReplacementStrategy =
  | "firstRunFormatting"
  | "distributeProportional";

// ---- Tool Input/Output Types ----

export interface ListParagraphsInput {
  path: string;
  includeEmpty?: boolean;
}

export interface ParagraphSummary {
  index: number;
  text: string;
  characterCount: number;
  runCount: number;
  style?: string;
}

export interface ListParagraphsOutput {
  totalParagraphs: number;
  paragraphs: ParagraphSummary[];
  outputPath: string;
  note?: string;
}

export interface ReadDocxInput {
  path: string;
  paragraphs?: number[];
  includeRunDetail?: boolean;
}

export interface RunDetail {
  runIndex: number;
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: string;
  fontSize?: number;
  font?: string;
}

export interface ParagraphDetail {
  index: number;
  fullText: string;
  style?: string;
  runCount: number;
  runs?: RunDetail[];
}

export interface ReadDocxOutput {
  paragraphs: ParagraphDetail[];
  hasTrackChanges: boolean;
  outputPath: string;
  note?: string;
}

export interface ReplaceTextInput {
  path: string;
  search: string;
  replace: string;
  paragraphIndex?: number;
  replaceAll?: boolean;
  strategy?: ReplacementStrategy;
}

export interface ReplaceDetail {
  paragraphIndex: number;
  runIndex: number;
  oldTextFragment: string;
  newTextFragment: string;
}

export interface ReplaceTextOutput {
  changed: boolean;
  matchCount: number;
  details: ReplaceDetail[];
  outputPath: string;
  note?: string;
}
