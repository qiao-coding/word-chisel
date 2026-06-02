import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDocument } from "../docx/DocumentStore.js";
import type { ParagraphSummary, ListParagraphsOutput } from "../types/index.js";

export function registerListParagraphs(server: McpServer): void {
  server.registerTool(
    "list_paragraphs",
    {
      description:
        "List all paragraphs in a .docx file with indices and preview text. Use this to navigate the document before making targeted edits.",
      inputSchema: z.object({
        path: z.string().describe("Absolute path to the .docx file"),
        includeEmpty: z
          .boolean()
          .optional()
          .default(false)
          .describe("Whether to include empty paragraphs in the listing"),
        outputName: z
          .string()
          .optional()
          .describe("Custom base name for the output .docx file (without extension). If not set, defaults to '<original>_edited'."),
      }),
    },
    async ({ path, includeEmpty, outputName }) => {
      try {
        const { flatDoc, outputPath, note } = getDocument(path, outputName);

        const paragraphs: ParagraphSummary[] = flatDoc.paragraphs
          .filter((p) => includeEmpty || p.fullText.trim().length > 0)
          .map((p) => ({
            index: p.index,
            text: p.fullText.length > 200
              ? p.fullText.substring(0, 200) + "..."
              : p.fullText,
            characterCount: p.fullText.length,
            runCount: p.runCount,
            style: p.style,
          }));

        const output: ListParagraphsOutput = {
          totalParagraphs: paragraphs.length,
          paragraphs,
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
