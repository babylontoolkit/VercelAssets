# kie-google MCP server (Google Veo 3.1 video generation)

A zero-dependency MCP server that generates videos with **kie.ai Google Veo 3.1**
and saves them into the project. It runs identically from Claude Code and VS Code
Copilot on Windows, macOS, and Linux.

> **Companion servers:**
> - `kie-video` (Kling / Bytedance / Grok) — uses the generic jobs endpoint.
> - `kie-image` — image generation (Nano Banana 2, Imagen, Seedream, Flux-2, etc.).

## Files

| File | Purpose |
|------|---------|
| `tools/kie-google-server.py` | The MCP server (Python stdlib only — no `pip install`). |
| `.mcp.json` | Claude Code project config → `python3 tools/kie-google-server.py`. |
| `.vscode/mcp.json` | VS Code Copilot config → `${workspaceFolder}/tools/kie-google-server.py`. |
| `.env` | `KIE_KEY=your-api-key` (gitignored). |

## Setup

1. Provide your kie.ai API key (**same key** as the other kie servers):
   - **Environment variable** — `export KIE_KEY=...` (or `KIE_AI_API_KEY`).
   - **`.env` (recommended)** — `KIE_KEY=your-api-key` in the project root.
     ⚠️ Do **not** prefix with `VITE_` — Vite would bundle it into the browser build.
2. **Claude Code:** run `claude`, approve the server when prompted (or `/mcp`).
3. **VS Code:** enable Copilot **agent mode**, start `kie-google` in the MCP view.

### Python command per OS

The configs launch the server with `python3` (macOS/Linux). On Windows use
`python` or `py` — update the `command` field in `.mcp.json` / `.vscode/mcp.json`.

## Usage

Ask the assistant in plain language, e.g.:

> Use generate_google_video to animate `src/assets/hero-car.jpg` — a slow cinematic
> dolly push toward the car as the headlights switch on. Save to `src/assets/hero.mp4`.

Tool: `generate_google_video(prompt, out_path, image_paths?, model?, aspect_ratio?, resolution?, duration?, generation_type?, watermark?, enable_translation?)`.

| Param | Default | Notes |
|-------|---------|-------|
| `prompt` | required | Text description of the video / motion. |
| `out_path` | required | Where to save the `.mp4`. |
| `model` | `veo3_fast` | See model list below. |
| `image_paths` | – | Local images for image-to-video: 1 = animate around it, 2 = first + last frame, up to 3 = reference (veo3_lite only). |
| `aspect_ratio` | `16:9` | `16:9` \| `9:16` \| `Auto`. |
| `resolution` | `720p` | `720p` \| `1080p` \| `4k` (4k costs extra credits). |
| `duration` | `8` | `4` \| `6` \| `8` seconds. |
| `generation_type` | auto | `TEXT_2_VIDEO` \| `FIRST_AND_LAST_FRAMES_2_VIDEO` \| `REFERENCE_2_VIDEO`. |
| `watermark` | – | Text to burn into the video. |
| `enable_translation` | `true` | Translate prompt to English before generating. |

## Available models

| Slug | Description |
|------|-------------|
| `veo3_fast` | **Default.** Good balance of quality and speed |
| `veo3` | Highest quality, most credits |
| `veo3_lite` | Fastest/cheapest; supports `REFERENCE_2_VIDEO` with up to 3 reference images |

> These are the **only** models compatible with this server's dedicated Veo 3.1 endpoint
> (`/api/v1/veo/generate`). For Kling, Bytedance, and Grok video models use `kie-video`.

## Notes

- Key resolution order: `$KIE_KEY` / `$KIE_AI_API_KEY` → `KIE_KEY` in root `.env`.
- Video renders poll for up to 15 minutes before timing out.
- Source URLs on kie.ai expire after ~14 days; the server downloads to `out_path` immediately.
