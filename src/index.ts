#!/usr/bin/env node
if (process.argv[2] === "setup") {
  (async () => { await import("./cli/setup.js"); })();
} else {
  (async () => { await import("./mcp.js"); })();
}
