# 🐉 WoW Log Analyzer

A tool to analyze **World of Warcraft** combat logs from [Warcraft Logs](https://www.warcraftlogs.com/) (API v2), focused on **Preservation Evoker** gameplay optimization.

Built as a **Next.js web app** with an **MCP server** for Claude Code integration — analyze your logs visually or conversationally.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![MCP](https://img.shields.io/badge/MCP-stdio-green)

---

## 📋 What it does

- **Cast Timeline** — Interactive timeline of all casts with ability icons, buff lanes (Essence Burst, Twin Echoes), and resource tracking
- **Raid Frames** — Live HP visualization with buff indicators (Echo, Reversion, Dream Breath)
- **Charts** — HPS, DTPS, Essence, and Echo count graphs with pan/zoom
- **Cast Analysis** — Warnings for suboptimal plays (Emerald Blossom without Essence Burst, overcapped Twin Echoes, etc.)
- **Boss Timers** — Collapsible enemy spell timelines with Wowhead tooltips
- **Damage Spikes** — Automatic detection of raid-wide damage spikes with ability breakdown
- **Player Comparison** — Side-by-side analysis of two players on the same fight
- **MCP Tools** — All analysis available as Claude Code tools for conversational analysis

---

## 🏗️ Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/wcl/            # API routes (proxy to WCL)
│   └── analyze/            # Analysis page
├── features/               # Feature modules
│   └── log-analysis/       # Cast timeline, damage profile, selectors
├── lib/wlogs/              # Shared WCL library (source of truth)
│   ├── client/             # WCL GraphQL client + queries
│   ├── analysis/           # Analysis modules (essence timeline, etc.)
│   ├── constants/          # Spell IDs, names, icons
│   └── types/              # TypeScript types for all WCL data
├── mcp-server/             # MCP server (standalone Node process)
│   ├── src/tools/          # Tool definitions (report, events, analysis...)
│   └── src/analysis/       # Preservation-specific analysis modules
├── components/             # Shared UI components
├── stores/                 # Zustand stores
└── providers/              # React context providers
```

---

## ⚡ Prerequisites

- **Node.js** 20+
- **Warcraft Logs API credentials** — [Create an API client here](https://www.warcraftlogs.com/api/clients/)
  - You need a **Client ID** and **Client Secret** (OAuth2 client credentials flow)

---

## 🚀 Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create a `.env` file at the root:

```env
WCL_CLIENT_ID=your_client_id_here
WCL_CLIENT_SECRET=your_client_secret_here
```

### 3. Run the web app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be prompted to enter your WCL credentials on first visit (stored in browser localStorage).

---

## 🤖 MCP Server Setup

The MCP server exposes all WCL tools to **Claude Code** via stdio transport.

### Build

```bash
cd mcp-server && npm install && npm run build
```

### Configure Claude Code

Create a `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "wcl": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "env": {
        "WCL_CLIENT_ID": "your_client_id_here",
        "WCL_CLIENT_SECRET": "your_client_secret_here"
      }
    }
  }
}
```

Then open the project in Claude Code — the MCP server starts automatically.

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `get-report` | Fetch report metadata, fights, and player roster |
| `get-player-details` | Get player specs, talents, gear for selected fights |
| `get-fight-events` | Fetch detailed events (Casts, Healing, Buffs, DamageTaken...) |
| `get-fight-table` | Get aggregated table data (totals, uptimes) |
| `get-encounter-rankings` | Top players for a boss encounter |
| `get-character-rankings` | Character's performance across encounters |
| `analyze-preservation` | Run modular Preservation Evoker analysis |
| `compare-preservation` | Side-by-side comparison of two players |
| `get-essence-timeline` | Detailed essence resource tracking |
| `wcl-query` | Execute raw GraphQL against WCL API |
| `get-rate-limit` | Check API quota (3600 pts/hour free tier) |

---

## 🔧 Build

```bash
# Web app
npm run build

# MCP server
cd mcp-server && npm run build
```

> The MCP server compiles `lib/wlogs` alongside its own source (shared TypeScript, no separate build step for wlogs).

---

## 🎮 Tech Stack

| Layer | Stack |
|-------|-------|
| **Web** | Next.js 16, React 19, TanStack Query, Zustand, Tailwind CSS 4, Lucide icons |
| **MCP Server** | @modelcontextprotocol/sdk, Zod, Node.js stdio transport |
| **Shared Library** | TypeScript (strict), ESM, WCL GraphQL client |

---

## 📝 Key Concepts

- **WCL API** uses OAuth2 client credentials and a GraphQL endpoint
- **All timestamps** in fight events are relative to report start (milliseconds)
- **Essence** = resource type 19 (max 5) — only present in `classResources` when a cast costs essence
- **Essence Burst** (buff 369299) makes Echo/Emerald Blossom free — no essence data on free casts
- Fight events are **paginated** via `nextPageTimestamp`
- **Rate limit**: 3600 points/hour on free tier

---

## 📄 License

Private project — not for redistribution.
