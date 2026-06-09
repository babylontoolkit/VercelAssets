# kie-image MCP server (per-project AI image generation)

A zero-dependency MCP server that generates images with **kie.ai Nano Banana 2**
and saves them into the project. It runs identically from Claude Code and VS Code
Copilot on Windows, macOS, and Linux. Everything is project-local and uses relative
paths, so it survives being cloned from the starter template onto any machine.

## Files (from the template)

| File | Purpose |
|------|---------|
| `tools/kie_image_server.py` | The MCP server (Python stdlib only — no `pip install`). |
| `.mcp.json` | Claude Code project config → `python3 tools/kie_image_server.py`. |
| `.vscode/mcp.json` | VS Code Copilot config → `${workspaceFolder}/tools/kie_image_server.py`. |
| `.env` | KIE_KEY=your-api-key; (gitignore). |

## Setup on install

1. Provide your kie.ai API key by **one** of these (resolved in this order):
   - **Environment variable** — export `KIE_KEY` (or `KIE_AI_API_KEY`).
   - **`.env` (recommended)** — set `KIE_KEY=your-api-key`.
     ⚠️ Do **not** name it `VITE_KIE_KEY` — Vite would bundle it into the public browser build. Keep it unprefixed; it's a server-only secret.
2. **Claude Code:** run `claude`, approve the project MCP server when prompted (or `/mcp`).
3. **VS Code:** open the repo, enable Copilot **agent mode**, Start the `kie-image` server in the MCP view.

### Python command per OS

The configs launch the server with `python3` (macOS/Linux). On Windows the
interpreter is usually `python` or `py`, so change the `command` field in
`.mcp.json` and `.vscode/mcp.json` to `python` if `python3` isn't on PATH.

## Usage

Ask the assistant in plain language, e.g.:

> Use generate_image to make a daytime hero from `src/assets/PC1.webp` and
> `src/assets/hero-car.jpg`, save it to `src/assets/hero-car.jpg`.

Tool: `generate_image(prompt, out_path, reference_paths?, aspect_ratio?, resolution?, output_format?)`.

## Notes
- Key resolution order: `$KIE_KEY` / `$KIE_AI_API_KEY` → `KIE_KEY` in root `.env`.
- If a render fails with an auth error, the key was likely rotated — update your `.env` (or env var).
- Generated source URLs on kie.ai expire after ~3 days; the server downloads the result into `out_path` immediately, so the saved file is permanent.
