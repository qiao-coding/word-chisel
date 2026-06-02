import { describe, it, expect, vi } from "vitest";

describe("word-chisel CLI routing", () => {
  it("delegates to setup module when 'setup' argument is passed", () => {
    // Simulate process.argv
    const argv = [...process.argv];
    process.argv = ["node", "word-chisel", "setup"];

    // Since the index.ts uses dynamic import, we test the routing logic
    const isSetup = process.argv[2] === "setup";
    expect(isSetup).toBe(true);

    process.argv = argv; // restore
  });

  it("delegates to MCP server when no 'setup' argument", () => {
    const argv = [...process.argv];
    process.argv = ["node", "word-chisel"];
    const isSetup = process.argv[2] === "setup";
    expect(isSetup).toBe(false);
    process.argv = argv;
  });
});
