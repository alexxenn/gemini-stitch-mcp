# gemini-stitch-mcp

A unified MCP server that lets Claude Code delegate UI work to **Google Gemini** (code generation) and **Google Stitch** (visual design). Claude Code stays in control as the architect while Gemini generates frontend code and Stitch generates visual designs.

**Pipeline:** Stitch (design) → Gemini (code) → Claude Code (review/integrate)

## Features

- **4 Gemini tools** — Generate UI components, refine code, review accessibility/responsiveness, chat about frontend topics
- **5 Stitch tools** — Generate screen designs, extract HTML/CSS, edit screens, get design variants, list screens
- **2 Pipeline tools** — `design_to_code` chains Stitch→Gemini in one call; `iterate_design` refines with feedback
- **Multi-framework** — React, Vue, and plain HTML output with Tailwind, CSS, or styled-components
- **Smart defaults** — Gemini Pro for quality-critical generation, Flash for speed-sensitive tasks
- **Built-in resilience** — Exponential backoff retry, per-API rate limiting, LRU caching

## Architecture

```
Claude Code
    │ stdio (JSON-RPC 2.0)
    ▼
gemini-stitch-mcp server
    ├── GeminiClient  → Gemini API (via Vertex AI or API key)
    ├── StitchClient  → Stitch API (OAuth or API key)
    ├── ScreenCache   → In-memory LRU (50 entries, 30min TTL)
    └── PipelineStore → In-memory context for iteration
```

## Installation

```bash
npm install -g gemini-stitch-mcp
```

Or run directly:

```bash
npx gemini-stitch-mcp
```

## Authentication

Two modes are supported:

### Option A: API Key (quick start)

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Configure the MCP server with `GEMINI_API_KEY`

### Option B: Google OAuth 2.0 (full access, both Gemini + Stitch)

1. Create a Google Cloud project and enable the Gemini API
2. Create OAuth 2.0 credentials (Desktop app type) to get a `client_id` and `client_secret`
3. On first server start, an auth URL is printed to stderr — open it in your browser and grant consent
4. Tokens are saved to `~/.gemini-stitch-mcp/tokens.json` and auto-refresh on subsequent starts

**Required env vars for OAuth:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CLOUD_PROJECT` — your GCP project ID
- `GOOGLE_CLOUD_LOCATION` — (optional, defaults to `us-central1`)

## Claude Code Configuration

Add to your Claude Code MCP settings (`.claude/settings.json` or project `.mcp.json`):

### With API key

```json
{
  "mcpServers": {
    "gemini-stitch": {
      "command": "npx",
      "args": ["-y", "gemini-stitch-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-api-key"
      }
    }
  }
}
```

### With OAuth

```json
{
  "mcpServers": {
    "gemini-stitch": {
      "command": "npx",
      "args": ["-y", "gemini-stitch-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id",
        "GOOGLE_CLIENT_SECRET": "your-client-secret",
        "GOOGLE_CLOUD_PROJECT": "your-project-id"
      }
    }
  }
}
```

### Local development

```json
{
  "mcpServers": {
    "gemini-stitch": {
      "command": "node",
      "args": ["path/to/gemini-stitch-mcp/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Tools

### Gemini Tools

| Tool | Description | Default Model |
|------|-------------|---------------|
| `gemini_generate_ui` | Generate UI components from a text prompt | gemini-2.5-pro |
| `gemini_refine_code` | Improve existing frontend code | gemini-2.5-flash |
| `gemini_review_ui` | Accessibility/responsive/best-practice review | gemini-2.5-pro |
| `gemini_chat` | Frontend development Q&A and brainstorming | gemini-2.5-flash |

### Stitch Tools

| Tool | Description |
|------|-------------|
| `stitch_generate_screen` | Generate a UI design from text |
| `stitch_get_html` | Extract HTML/CSS from a screen |
| `stitch_edit_screen` | Modify an existing screen |
| `stitch_get_variants` | Generate design variations |
| `stitch_list_screens` | List screens in a project |

### Pipeline Tools

| Tool | Description |
|------|-------------|
| `design_to_code` | Full pipeline: Stitch design → HTML extraction → Gemini converts to React/Vue/HTML component |
| `iterate_design` | Take feedback, re-generate via Stitch, re-convert via Gemini |

## Pipeline Example

```
1. Call design_to_code with "A modern login page with email and password"
   → Stitch generates a visual design
   → HTML/CSS is extracted
   → Gemini converts to a React + Tailwind component
   → Returns: contextId, previewUrl, generated code

2. Call iterate_design with contextId + "add a forgot password link"
   → Stitch updates the design
   → Gemini re-generates the component with the change
   → Returns: updated code, new preview
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | One of API key or OAuth | Gemini API key for direct access |
| `GOOGLE_CLIENT_ID` | For OAuth | OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | For OAuth | OAuth 2.0 client secret |
| `GOOGLE_CLOUD_PROJECT` | For OAuth | Google Cloud project ID |
| `GOOGLE_CLOUD_LOCATION` | No | GCP region (default: `us-central1`) |
| `GOOGLE_REFRESH_TOKEN` | No | Pre-obtained refresh token (skips browser flow) |
| `STITCH_API_KEY` | No | Stitch API key (alternative to OAuth) |
| `STITCH_API_URL` | No | Stitch API base URL override |
| `STITCH_PROJECT_ID` | No | Default Stitch project ID |
| `GEMINI_DEFAULT_MODEL` | No | Default Gemini model (default: `gemini-2.5-flash`) |

## Development

```bash
git clone https://github.com/alexxenn/gemini-stitch-mcp.git
cd gemini-stitch-mcp
npm install
npm run build
npm run dev    # watch mode
```

## License

MIT
