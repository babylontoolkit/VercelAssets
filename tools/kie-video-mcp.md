# kie-video MCP server (Kling / Bytedance / Grok video generation)

A zero-dependency MCP server that generates videos using kie.ai models on the
**generic `/api/v1/jobs/createTask` endpoint** — Kling, Bytedance Seedance, and
Grok Imagine Video. It runs identically from Claude Code and VS Code Copilot on
Windows, macOS, and Linux.

> **Companion servers:**
> - `kie-google` (Veo 3.1) — dedicated endpoint, Google Veo models only.
> - `kie-image` — image generation (Nano Banana 2, Imagen, Seedream, Flux-2, etc.).

## Files

| File | Purpose |
|------|---------|
| `tools/kie-video-server.py` | The MCP server (Python stdlib only — no `pip install`). |
| `.mcp.json` | Claude Code project config → `python3 tools/kie-video-server.py`. |
| `.vscode/mcp.json` | VS Code Copilot config → `${workspaceFolder}/tools/kie-video-server.py`. |
| `.env` | `KIE_KEY=your-api-key` (gitignored). |

## Setup

1. Provide your kie.ai API key (**same key** as the other kie servers):
   - **Environment variable** — `export KIE_KEY=...` (or `KIE_AI_API_KEY`).
   - **`.env` (recommended)** — `KIE_KEY=your-api-key` in the project root.
     ⚠️ Do **not** prefix with `VITE_` — Vite would bundle it into the browser build.
2. **Claude Code:** run `claude`, approve the server when prompted (or `/mcp`).
3. **VS Code:** enable Copilot **agent mode**, start `kie-video` in the MCP view.

## Usage

Ask the assistant in plain language, e.g.:

> Use generate_video with model kling-3.0/video to animate `src/assets/hero.jpg` —
> slow cinematic push toward the car, headlights switching on. Save to `src/assets/hero.mp4`.

Tool: `generate_video(prompt, out_path, model?, image_paths?, aspect_ratio?, duration?, sound?, resolution?, mode?)`.

| Param | Default | Notes |
|-------|---------|-------|
| `prompt` | required | Text description of the video / motion. |
| `out_path` | required | Where to save the `.mp4`. |
| `model` | `kling-3.0/video` | See model list below. |
| `image_paths` | – | Local images for image-to-video. |
| `aspect_ratio` | `16:9` | `16:9` \| `9:16` \| `1:1`. |
| `duration` | `5` | Seconds. Valid range varies by model. |
| `sound` | `false` | Generate audio (Kling / Bytedance). |
| `resolution` | – | `480p` \| `720p` \| `1080p` (Bytedance / Grok). |
| `mode` | `pro` | `std` \| `pro` \| `4K` — Kling 3.0 only. |

## Available models

### Kling

| Slug | Description |
|------|-------------|
| `kling-3.0/video` | **Default.** Multi-shot, std/pro/4K modes, 3–15 s, optional audio |
| `kling-2.6/text-to-video` | Kling 2.6 text-to-video (5 or 10 s) |
| `kling-2.6/image-to-video` | Kling 2.6 image-to-video (5 or 10 s) |
| `kling-2.5/turbo-text-to-video-pro` | Kling 2.5 Turbo text-to-video Pro |
| `kling-2.5/turbo-image-to-video-pro` | Kling 2.5 Turbo image-to-video Pro |
| `kling-v2.1/master-text-to-video` | Kling V2.1 Master text-to-video |
| `kling-v2.1/master-image-to-video` | Kling V2.1 Master image-to-video |

### Bytedance (Seedance)

| Slug | Description |
|------|-------------|
| `bytedance/seedance-2` | Seedance 2.0 — text/image-to-video, optional audio, 4–15 s, up to 1080p |
| `bytedance/seedance-2-fast` | Seedance 2.0 Fast — same as above, faster/cheaper |
| `bytedance/seedance-1.5-pro` | Seedance 1.5 Pro — 4/8/12 s durations, optional audio |
| `bytedance/v1-pro-text-to-video` | Bytedance V1 Pro text-to-video |
| `bytedance/v1-pro-image-to-video` | Bytedance V1 Pro image-to-video |
| `bytedance/v1-lite-text-to-video` | Bytedance V1 Lite text-to-video |
| `bytedance/v1-lite-image-to-video` | Bytedance V1 Lite image-to-video |

### Grok Imagine (Video)

| Slug | Description |
|------|-------------|
| `grok-imagine-video-1-5-preview` | Grok Imagine Video 1.5 Preview — 1–15 s, 480p/720p |

## Image-to-video behavior by model family

| Family | `image_paths[0]` | `image_paths[1]` |
|--------|-----------------|-----------------|
| Kling | first frame (`image_urls[0]`) | last frame (`image_urls[1]`) |
| Bytedance | `first_frame_url` | `last_frame_url` |
| Grok | `image_urls[0]` (first frame / reference) | — |

## Notes

- Key resolution order: `$KIE_KEY` / `$KIE_AI_API_KEY` → `KIE_KEY` in root `.env`.
- Video renders poll for up to 15 minutes before timing out.
- Source URLs on kie.ai expire after ~14 days; the server downloads to `out_path` immediately.
- Some model-specific parameters (e.g. Kling element references, Bytedance reference videos/audio) are not exposed by this server's schema — use the kie.ai API directly for those advanced features.
