import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerListParagraphs } from "./tools/listParagraphs.js";
import { registerReadDocx } from "./tools/readDocx.js";
import { registerReplaceText } from "./tools/replaceText.js";

const server = new McpServer({ name: "word-chisel", version: "1.0.0" });
registerListParagraphs(server);
registerReadDocx(server);
registerReplaceText(server);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("word-chisel MCP server running");
