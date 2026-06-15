# kie-image MCP server (AI image generation)

A zero-dependency MCP server that generates images with **kie.ai** (Nano Banana 2
and many other models) and saves them into the project. It runs identically from
Claude Code and VS Code Copilot on Windows, macOS, and Linux.

> **Companion servers:**
> - `kie-google` (Veo 3.1) — Google Veo video generation.
> - `kie-video` (Kling / Bytedance / Grok) — other video generation.

## Files

| File | Purpose |
|------|---------|
| `tools/kie-image-server.py` | The MCP server (Python stdlib only — no `pip install`). |
| `.mcp.json` | Claude Code project config → `python3 tools/kie-image-server.py`. |
| `.vscode/mcp.json` | VS Code Copilot config → `${workspaceFolder}/tools/kie-image-server.py`. |
| `.env` | `KIE_KEY=your-api-key` (gitignored). |

## Setup

1. Provide your kie.ai API key (**same key** as the other kie servers):
   - **Environment variable** — `export KIE_KEY=...` (or `KIE_AI_API_KEY`).
   - **`.env` (recommended)** — `KIE_KEY=your-api-key` in the project root.
     ⚠️ Do **not** prefix with `VITE_` — Vite would bundle it into the browser build.
2. **Claude Code:** run `claude`, approve the server when prompted (or `/mcp`).
3. **VS Code:** enable Copilot **agent mode**, start `kie-image` in the MCP view.

### Python command per OS

The configs launch the server with `python3` (macOS/Linux). On Windows use
`python` or `py` — update the `command` field in `.mcp.json` / `.vscode/mcp.json`.

## Usage

Ask the assistant in plain language, e.g.:

> Use generate_image to make a daytime hero from `src/assets/PC1.webp` and
> `src/assets/hero-car.jpg`, save it to `src/assets/hero.jpg`.

Tool: `generate_image(prompt, out_path, reference_paths?, model?, aspect_ratio?, resolution?, output_format?)`.

| Param | Default | Notes |
|-------|---------|-------|
| `prompt` | required | Text description of the image to generate. |
| `out_path` | required | Where to save the image. |
| `reference_paths` | – | Local image files to use as references / edit from (up to 14). |
| `model` | `nano-banana-2` | See model list below. |
| `aspect_ratio` | `16:9` | e.g. `16:9` \| `1:1` \| `4:3` \| `9:16`. |
| `resolution` | `2K` | `1K` \| `2K` \| `4K`. |
| `output_format` | `jpg` | `jpg` \| `png`. |

## Available models

All models use the same `/api/v1/jobs/createTask` endpoint. Pass the exact slug as `model`.

### Google / Nano Banana

| Slug | Description |
|------|-------------|
| `nano-banana-2` | **Default.** Text-to-image, up to 14 reference images |
| `nano-banana-pro` | Pro image-to-image, up to 8 reference images |
| `google/nano-banana-edit` | Image editing with prompt + reference images |
| `google/imagen4-fast` | Google Imagen 4 Fast |
| `google/imagen4` | Google Imagen 4 |
| `google/imagen4-ultra` | Google Imagen 4 Ultra (highest quality) |

### Seedream (ByteDance)

| Slug | Description |
|------|-------------|
| `bytedance/seedream` | Seedream 3.0 |
| `bytedance/seedream-v4-text-to-image` | Seedream 4.0 |
| `seedream/4.5-text-to-image` | Seedream 4.5 |
| `seedream/5-lite-text-to-image` | Seedream 5.0 Lite |

### Flux-2

| Slug | Description |
|------|-------------|
| `flux-2/flex-text-to-image` | Flux-2 text-to-image |
| `flux-2/flex-image-to-image` | Flux-2 image-to-image |
| `flux-2/pro-text-to-image` | Flux-2 Pro text-to-image |
| `flux-2/pro-image-to-image` | Flux-2 Pro image-to-image (up to 8 reference images) |

### Other

| Slug | Description |
|------|-------------|
| `z-image` | Z-Image photorealistic |
| `grok-imagine/text-to-image` | Grok Imagine text-to-image |
| `grok-imagine/image-to-image` | Grok Imagine image-to-image |
| `qwen/text-to-image` | Qwen text-to-image |
| `qwen/image-to-image` | Qwen image-to-image |

> Some models have unique input parameters (e.g. `image_size`, `guidance_scale`)
> that are not exposed by this server — they will use model defaults.
> See [docs.kie.ai](https://docs.kie.ai/market/quickstart) for full schemas.

## Notes

- Key resolution order: `$KIE_KEY` / `$KIE_AI_API_KEY` → `KIE_KEY` in root `.env`.
- Source URLs on kie.ai expire after ~3 days; the server downloads to `out_path` immediately.
