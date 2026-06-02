#!/usr/bin/env node
import { homedir, platform } from "os";
import { join, dirname } from "path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "fs";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getClaudeDesktopConfigPath(): string {
  switch (platform()) {
    case "win32":
      return join(
        process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
        "Claude",
        "claude_desktop_config.json",
      );
    case "darwin":
      return join(
        homedir(),
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json",
      );
    default:
      return join(homedir(), ".config", "Claude", "claude_desktop_config.json");
  }
}

function getClaudeCodeConfigPath(): string {
  return join(homedir(), ".claude", ".mcp.json");
}

function getSkillsDir(): string {
  return join(homedir(), ".claude", "skills");
}

function readJsonSafe(filePath: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

function writeJson(filePath: string, data: Record<string, unknown>): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

const MCP_SERVER_CONFIG = {
  command: "npx",
  args: ["-y", "word-chisel@latest"],
};

function installMcpServer(configPath: string, targetName: string): string {
  const config = readJsonSafe(configPath);
  const servers = (config.mcpServers as Record<string, unknown>) || {};
  servers["word-chisel"] = MCP_SERVER_CONFIG;
  config.mcpServers = servers;
  writeJson(configPath, config);
  return configPath;
}

function installSkill(skillsDir: string, sourceSkillPath: string): string {
  mkdirSync(skillsDir, { recursive: true });
  const dest = join(skillsDir, "word-chisel.md");
  copyFileSync(sourceSkillPath, dest);
  return dest;
}

function main() {
  console.log(`
██     ██  ██████  ██████  ██████      ██████ ██   ██ ██ ███████ ███████ ██
██     ██ ██    ██ ██   ██ ██   ██    ██      ██   ██ ██ ██      ██      ██
██  █  ██ ██    ██ ██████  ██   ██    ██      ███████ ██ ███████ █████   ██
██ ███ ██ ██    ██ ██   ██ ██   ██    ██      ██   ██ ██      ██ ██      ██
 ███ ███   ██████  ██   ██ ██████      ██████ ██   ██ ██ ███████ ███████ ███████
`);

  console.log("word-chisel setup — install MCP server + skill\n");

  // --- Install MCP server ---
  console.log("Installing MCP server...\n");

  const desktopPath = getClaudeDesktopConfigPath();
  try {
    const path = installMcpServer(desktopPath, "Claude Desktop");
    const status = existsSync(desktopPath) ? "updated" : "created";
    console.log(`  Claude Desktop (${status})`);
    console.log(`    "command": "npx", "args": ["-y", "word-chisel@latest"]`);
    console.log(`    -> ${path}`);
  } catch (e) {
    console.log(`  Claude Desktop - ${e instanceof Error ? e.message : String(e)}`);
  }

  const cliPath = getClaudeCodeConfigPath();
  try {
    const path = installMcpServer(cliPath, "Claude Code CLI");
    const status = existsSync(cliPath) ? "updated" : "created";
    console.log(`  Claude Code CLI (${status})`);
    console.log(`    -> ${path}`);
  } catch (e) {
    console.log(`  Claude Code CLI - ${e instanceof Error ? e.message : String(e)}`);
  }

  // --- Install skill ---
  console.log("\nInstalling skill...\n");

  const skillsDir = getSkillsDir();
  // skill.md is in the package root (two dirs up from dist/cli/setup.js)
  const sourceSkill = join(__dirname, "..", "..", "skill.md");

  if (!existsSync(sourceSkill)) {
    console.log("  Skill file not found in package. Skipping skill install.");
  } else {
    try {
      const dest = installSkill(skillsDir, sourceSkill);
      console.log(`  word-chisel skill installed`);
      console.log(`    -> ${dest}`);
    } catch (e) {
      console.log(`  Skill install failed - ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // --- Summary ---
  console.log("\n------------------------------------------");
  console.log("word-chisel setup complete!");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Restart your MCP client (Claude Desktop / Claude Code)");
  console.log("  2. Type /word-chisel in Claude to load the skill");
  console.log("  3. Edit Word documents without touching originals");
  console.log("------------------------------------------\n");
}

main();
