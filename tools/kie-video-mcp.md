# kie-video MCP server (per-project AI video generation)

A zero-dependency MCP server that generates videos with **kie.ai Kling 3.0**
and saves them into the project. It runs identically from Claude Code and VS Code
Copilot on Windows, macOS, and Linux. Everything is project-local and uses relative
paths, so it survives being cloned from the starter template onto any machine.

## Files (from the template)

| File | Purpose |
|------|---------|
| `tools/kie-video-server.py` | The MCP server (Python stdlib only — no `pip install`). |
| `.mcp.json` | Claude Code project config → `python3 tools/kie-video-server.py`. |
| `.vscode/mcp.json` | VS Code Copilot config → `${workspaceFolder}/tools/kie-video-server.py`. |
| `.env` | KIE_KEY=your-api-key; (gitignore). |

## Setup on install

1. Provide your kie.ai API key by **one** of these (resolved in this order):
   - **Environment variable** — export `KIE_KEY` (or `KIE_AI_API_KEY`).
   - **`.env` (recommended)** — set `KIE_KEY=your-api-key`.
     ⚠️ Do **not** name it `VITE_KIE_KEY` — Vite would bundle it into the public browser build. Keep it unprefixed; it's a server-only secret.
   - The same `KIE_KEY` is shared with the `kie-image` server — one key covers both.
2. **Claude Code:** run `claude`, approve the project MCP server when prompted (or `/mcp`).
3. **VS Code:** open the repo, enable Copilot **agent mode**, Start the `kie-video` server in the MCP view.

### Python command per OS

The configs launch the server with `python3` (macOS/Linux). On Windows the
interpreter is usually `python` or `py`, so change the `command` field in
`.mcp.json` and `.vscode/mcp.json` to `python` if `python3` isn't on PATH.

## Usage

Ask the assistant in plain language, e.g.:

> Use generate_video to animate `src/assets/hero-car.jpg` — a slow cinematic
> dolly push toward the car as the headlights switch on. Save it to
> `src/assets/hero.mp4`.

Tool: `generate_video(prompt, out_path, image_paths?, duration?, aspect_ratio?, mode?, sound?, model?)`.

| Param | Default | Notes |
|-------|---------|-------|
| `prompt` | required | Text description of the video / motion. |
| `out_path` | required | Where to save the `.mp4`. |
| `image_paths` | – | Local images for **image-to-video**: 1 = first frame, 2 = first + last frame. |
| `duration` | `"5"` | Seconds, `"3"`…`"15"`. |
| `aspect_ratio` | `"16:9"` | `16:9` \| `9:16` \| `1:1` (auto-adapts when `image_paths` are given). |
| `mode` | `"pro"` | `std` \| `pro` \| `4K` resolution tier. |
| `sound` | `false` | Generate audio with the video. |
| `model` | `kling-3.0/video` | Override to use another kie.ai video model. |

## Notes
- Key resolution order: `$KIE_KEY` / `$KIE_AI_API_KEY` → `KIE_KEY` in root `.env`.
- If a render fails with an auth error, the key was likely rotated — update your `.env` (or env var).
- Video renders take longer than images; the server polls for up to 15 minutes before timing out.
- Generated source URLs on kie.ai expire after ~3 days; the server downloads the result into `out_path` immediately, so the saved file is permanent.
