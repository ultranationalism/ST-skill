# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code plugin for writing SillyTavern (ST) character cards. Ships as a `.claude-plugin` with 9 skills (in `skills/*/SKILL.md`) covering fullfront card design, embedded card writing, API implementation, debugging, and lorebook authoring. Also includes optional CLI preview/parse tools.

Language: Chinese (Simplified) — skills, README, and most documentation are written in Chinese.

## Commands

```bash
# Preview a character card (JSON or PNG) — requires Bun
bun run preview card.json
bun run preview card.json --port 8080 --mode frontend

# Extract JSON from a PNG card
bun run parse card.png
bun run parse card.png -o output.json
```

No build step, no tests, no linter configured. TypeScript (`src/`) is run directly via Bun.

## Architecture

### Plugin structure
- `.claude-plugin/plugin.json` — plugin manifest (name, version, description)
- `skills/*/SKILL.md` — each skill is a standalone markdown file with YAML frontmatter (`name`, `description`) followed by the full skill prompt. Skills are the core deliverable of this repo.

### Skill categories
| Skill | Purpose |
|---|---|
| `write-fullfront-card` | Design fully frontend-driven ST cards (HTML app injected via regex, IndexedDB/Dexie, multi-channel AI) |
| `fullfront-prompt` | Prompt orchestration: ordered_prompts, generate/generateRaw |
| `fullfront-data-ops` | AI instruction parsing, DB ops, variable protection |
| `fullfront-structured-output` | Function calling & JSON Schema structured output |
| `st-card-toolkit` | Common JS toolkit API reference for frontend cards |
| `write-embedded-card` | Cards that embed UI within ST's native chat framework (MVU, status bar, EJS templates) |
| `write-lorebook-entry` | World book / lorebook entry format spec |
| `st-card-debug` | End-to-end card debugging via Chrome DevTools MCP + ST REST API |

### API reference docs (`docs/`)
| Doc | Content |
|---|---|
| `tavernhelper-api.md` | TavernHelper generate/generateRaw, streaming, world book R/W, abort control, dual-source calling |

### Preview tools (`src/`)
- `cli.ts` — Bun-based dev server; auto-detects card type (fullfront → frontend view, embedded → data view)
- `parse-png.ts` — extracts character card JSON from PNG tEXt chunks
- `template.html` — data view template for card inspection

### Reference projects (gitignored, not part of this repo)
- `JS-Slash-Runner/` — SillyTavern extension ("酒馆助手") fork; used as type/API reference
- `SillyTavern/` — local ST instance for testing card imports and debugging

### SillyTavern local instance
```bash
# Start SillyTavern (from project root)
cd SillyTavern && node server.js
# Listens on http://127.0.0.1:14998
```

### MCP servers (`mcp/`)
- `lorebook-editor/` — Node.js MCP server for lorebook editing
- `start-chrome-mcp.sh` — launches headless Chrome + chrome-devtools-mcp for card debugging on WSL2

## Key Concepts

- **Fullfront card**: A character card where the entire UI is an HTML application injected via ST regex scripts (can be 1MB+). Uses IndexedDB (Dexie) for state, multi-channel AI calls for game logic.
- **Embedded card**: A card that works within ST's native chat UI, using MVU variables (Zod + YAML + JSONPatch), status bar rendering, and EJS dynamic prompts.
- **TavernHelper**: The parent-window API bridge that fullfront cards use to call ST's generate endpoints, read/write world book entries, etc.
- **JS-Slash-Runner (酒馆助手)**: ST extension that provides the script execution environment for embedded cards.
