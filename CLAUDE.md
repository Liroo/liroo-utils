# WoW Log Analyzer

Tool to analyze World of Warcraft logs (Warcraft Logs API v2) and improve gameplay, focused on Preservation Evoker.

## Monorepo Structure

- `packages/wlogs` — Shared library: WCL GraphQL client, analysis modules, types, constants
- `packages/mcp-server` — MCP server (stdio) exposing WCL tools to Claude Code
- `packages/web` — Next.js 15 web app for visualization and analysis

## Tech Stack

- **wlogs**: TypeScript, Node16 modules, no dependencies
- **mcp-server**: @modelcontextprotocol/sdk, zod, imports @liroo/wlogs
- **web**: Next.js 15 (App Router), React 19, TanStack Query, Zustand, Tailwind CSS, Lucide icons

## Architecture Rules

- No barrel/index.ts files — always import directly from source files
- `wlogs` is the single source of truth for all WCL logic (client, queries, analysis)
- MCP tools are thin wrappers: validate params → call wlogs method → return JSON
- Web API routes import from @liroo/wlogs server-side, never expose WCL credentials to client
- Feature-based folder structure in web app (`src/features/`)
- Use `registerTool()` (not deprecated `tool()`) for MCP SDK

## Build

```bash
npm install                    # root, installs all workspaces
cd packages/wlogs && npm run build    # must build first (dependency)
cd packages/mcp-server && npm run build
cd packages/web && npm run build
```

## Key Patterns

- WCL API uses OAuth2 client credentials flow, GraphQL endpoint at `https://www.warcraftlogs.com/api/v2/client`
- Essence = resource type 19 (max 5), only present in classResources when a cast costs essence
- Essence Burst (buff 369299) makes Echo/Emerald Blossom free — no type 19 data on free casts
- All timestamps in WCL events are relative to report start (ms)
- Fight events need pagination via `nextPageTimestamp`
- Rate limit: 3600 points/hour (free tier)

## Conventions

- TypeScript strict mode everywhere
- ESM (`"type": "module"`) in all packages
- .js extensions in imports for Node16 resolution (wlogs, mcp-server)
- Bundler resolution in web (Next.js handles it)
- French for conversation, English for code/comments
