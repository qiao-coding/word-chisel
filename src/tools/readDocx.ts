import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDocument } from "../docx/DocumentStore.js";
import type { ReadDocxOutput, ParagraphDetail, RunDetail } from "../types/index.js";

export function registerReadDocx(server: McpServer): void {
  server.registerTool(
    "read_docx",
    {
      description:
        "Read text content from a .docx file with structural information. Returns paragraph indices and optional run-level formatting details.",
      inputSchema: z.object({
        path: z.string().describe("Absolute path to the .docx file"),
        paragraphs: z
          .array(z.number().int().min(0))
          .optional()
          .describe("Specific paragraph indices to read. Omit to read all."),
        includeRunDetail: z
          .boolean()
          .optional()
          .default(false)
          .describe("Whether to include per-run text and formatting details"),
        outputName: z
          .string()
          .optional()
          .describe("Custom base name for the output .docx file (without extension). If not set, defaults to '<original>_edited'."),
      }),
    },
    async ({ path, paragraphs, includeRunDetail, outputName }) => {
      try {
        const { flatDoc, outputPath, note } = getDocument(path, outputName);

        const targetParas = paragraphs
          ? flatDoc.paragraphs.filter((p) => paragraphs.includes(p.index))
          : flatDoc.paragraphs;

        const result: ParagraphDetail[] = targetParas.map((p) => {
          const detail: ParagraphDetail = {
            index: p.index,
            fullText: p.fullText,
            style: p.style,
            runCount: p.runCount,
          };

          if (includeRunDetail && p.segments.length > 0) {
            detail.runs = p.segments.map((seg) => {
              const run: RunDetail = {
                runIndex: seg.runIndex,
                text: seg.text,
              };
              if (seg.formatting) {
                if (seg.formatting.bold) run.bold = seg.formatting.bold;
                if (seg.formatting.italic) run.italic = seg.formatting.italic;
                if (seg.formatting.underline) run.underline = seg.formatting.underline;
                if (seg.formatting.fontSize) run.fontSize = seg.formatting.fontSize;
                if (seg.formatting.font) run.font = seg.formatting.font;
              }
              return run;
            });
          }

          return detail;
        });

        const output: ReadDocxOutput = {
          paragraphs: result,
          hasTrackChanges: flatDoc.hasTrackChanges,
          outputPath,
          ...(note && { note }),
        };

        return {
          content: [
            { type: "text", text: JSON.stringify(output, null, 2) },
          ],
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${e instanceof Error ? e.message : String(e)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
