import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDocument, invalidateCache } from "../docx/DocumentStore.js";
import { replaceInParagraph } from "../docx/TextReplacer.js";
import { saveDocx } from "../docx/DocxWriter.js";
import type { ReplaceTextOutput, ReplaceDetail } from "../types/index.js";

export function registerReplaceText(server: McpServer): void {
  server.registerTool(
    "replace_text",
    {
      description:
        "Replace text in a .docx file while preserving all formatting. Supports targeted (single paragraph) or global find-and-replace. Two replacement strategies: 'firstRunFormatting' collapses into the first run's style; 'distributeProportional' splits replacement proportionally across runs to keep each run's formatting.",
      inputSchema: z.object({
        path: z.string().describe("Absolute path to the .docx file"),
        search: z.string().describe("Text to search for"),
        replace: z.string().describe("Replacement text"),
        paragraphIndex: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Specific paragraph index to replace in. Omit to replace in all paragraphs."),
        replaceAll: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether to replace all occurrences. Defaults to true."),
        strategy: z
          .enum(["firstRunFormatting", "distributeProportional"])
          .optional()
          .default("firstRunFormatting")
          .describe("Replacement strategy. Defaults to 'firstRunFormatting'."),
        outputName: z
          .string()
          .optional()
          .describe("Custom base name for the output .docx file (without extension). If not set, defaults to '<original>_edited'."),
      }),
    },
    async ({ path, search, replace, paragraphIndex, replaceAll, strategy, outputName }) => {
      try {
        const { doc, flatDoc, outputPath, note } = getDocument(path, outputName);

        const targetParagraphs = paragraphIndex !== undefined
          ? flatDoc.paragraphs.filter((p) => p.index === paragraphIndex)
          : flatDoc.paragraphs;

        if (targetParagraphs.length === 0) {
          const output: ReplaceTextOutput = {
            changed: false,
            matchCount: 0,
            details: [],
            outputPath,
          };
          return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          };
        }

        let totalMatchCount = 0;
        const allDetails: ReplaceDetail[] = [];

        for (const paragraph of targetParagraphs) {
          const result = replaceInParagraph(
            paragraph,
            search,
            replace,
            replaceAll,
            strategy,
          );
          totalMatchCount += result.matchCount;
          allDetails.push(...result.details);
        }

        if (totalMatchCount > 0) {
          saveDocx(doc, doc.tree);
          invalidateCache(path);
        }

        const output: ReplaceTextOutput = {
          changed: totalMatchCount > 0,
          matchCount: totalMatchCount,
          details: allDetails,
          outputPath,
          ...(note && { note }),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
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
