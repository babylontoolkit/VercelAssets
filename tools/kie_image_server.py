#!/usr/bin/env python3
"""
Zero-dependency MCP server (raw JSON-RPC 2.0 over stdio) exposing kie.ai
Nano Banana 2 image generation. Works on Python 3.9+ (Windows, macOS, Linux)
with only the stdlib, so it runs identically from Claude Code and VS Code Copilot.

This server is project-local (lives in <project>/tools). Configs that point at
it (.mcp.json, .vscode/mcp.json) use relative paths so they are portable across
machines when this project is cloned from a starter template.

Tool: generate_image
  - prompt (str, required)
  - out_path (str, required): path to save the resulting image
  - reference_paths (list[str], optional): local image files to feed as
    references (uploaded to kie.ai, used as image_input for compositing/editing)
  - aspect_ratio (str, default "16:9")
  - resolution (str, default "2K"): 1K | 2K | 4K
  - output_format (str, default "jpg"): jpg | png

API key resolution order:
  1. $KIE_KEY / $KIE_AI_API_KEY environment variables
  2. KIE_KEY (or KIE_AI_API_KEY) in the project-root `.env` file (gitignored)
Never prefix the key with VITE_, or Vite would bundle it into the public
browser build.
"""
import sys, os, json, time, base64, mimetypes, urllib.request

API = "https://api.kie.ai"
UPLOAD = "https://kieai.redpandaai.co"
UA = "Mozilla/5.0 (compatible; kie-image-mcp/1.0)"
SERVER_NAME = "kie-image"
SERVER_VERSION = "1.0.0"
DEFAULT_PROTOCOL = "2025-06-18"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def log(*a):
    print("[kie-image]", *a, file=sys.stderr, flush=True)


def _parse_env_file(path):
    """Minimal, dependency-free .env parser (KEY=VALUE lines)."""
    vals = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key = key.strip()
                if key.startswith("export "):
                    key = key[len("export "):].strip()
                vals[key] = val.strip().strip('"').strip("'")
    except OSError:
        pass
    return vals


def get_key():
    # 1. environment variables
    for var in ("KIE_KEY", "KIE_AI_API_KEY"):
        v = os.environ.get(var)
        if v:
            return v.strip()
    # 2. project-root .env (parsed manually to stay dependency-free)
    env = _parse_env_file(os.path.join(os.path.dirname(SCRIPT_DIR), ".env"))
    for var in ("KIE_KEY", "KIE_AI_API_KEY"):
        if env.get(var):
            return env[var].strip()
    raise RuntimeError("No API key: set $KIE_KEY or add KIE_KEY=... to the root .env file")


def _req(url, method="GET", body=None):
    headers = {"Authorization": f"Bearer {get_key()}", "User-Agent": UA, "Accept": "application/json"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode())


def _upload(path):
    with open(path, "rb") as f:
        raw = f.read()
    mime = mimetypes.guess_type(path)[0] or "image/jpeg"
    b64 = base64.b64encode(raw).decode()
    res = _req(f"{UPLOAD}/api/file-base64-upload", "POST", {
        "base64Data": f"data:{mime};base64,{b64}",
        "uploadPath": "mcp-image",
        "fileName": os.path.basename(path),
    })
    url = (res.get("data") or {}).get("downloadUrl")
    if not url:
        raise RuntimeError(f"upload failed for {path}: {json.dumps(res)[:300]}")
    log("uploaded", path, "->", url)
    return url


def generate_image(args):
    prompt = args["prompt"]
    out_path = os.path.expanduser(args["out_path"])
    refs = args.get("reference_paths") or []
    aspect = args.get("aspect_ratio", "16:9")
    resolution = args.get("resolution", "2K")
    out_format = args.get("output_format", "jpg")

    image_input = [_upload(os.path.expanduser(p)) for p in refs]

    task = _req(f"{API}/api/v1/jobs/createTask", "POST", {
        "model": "nano-banana-2",
        "input": {
            "prompt": prompt,
            "image_input": image_input,
            "aspect_ratio": aspect,
            "resolution": resolution,
            "output_format": out_format,
        },
    })
    tid = (task.get("data") or {}).get("taskId")
    if not tid:
        raise RuntimeError(f"createTask failed: {json.dumps(task)[:300]}")
    log("task", tid, "submitted; polling")

    result_url = None
    deadline = time.time() + 300
    while time.time() < deadline:
        time.sleep(6)
        info = _req(f"{API}/api/v1/jobs/recordInfo?taskId={tid}")
        d = info.get("data") or {}
        state = d.get("state") or d.get("status")
        log("state:", state)
        if state in ("success", "completed") or d.get("successFlag") == 1:
            rj = d.get("resultJson") or d.get("response")
            urls = None
            if isinstance(rj, str) and rj:
                try:
                    urls = json.loads(rj).get("resultUrls")
                except Exception:
                    pass
            urls = urls or d.get("resultUrls")
            if not urls:
                raise RuntimeError(f"succeeded but no result url: {json.dumps(info)[:300]}")
            result_url = urls[0]
            break
        if state in ("fail", "failed") or d.get("successFlag") in (2, 3):
            raise RuntimeError(f"generation failed: {json.dumps(info)[:300]}")
    if not result_url:
        raise RuntimeError("timed out waiting for result (300s)")

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    req = urllib.request.Request(result_url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as r, open(out_path, "wb") as f:
        f.write(r.read())
    log("saved ->", out_path)
    return f"Image generated and saved to {out_path}\nSource URL (expires ~3 days): {result_url}"


TOOLS = [{
    "name": "generate_image",
    "description": (
        "Generate an image with kie.ai Nano Banana 2 and save it to a local path. "
        "Optionally pass local reference image files (reference_paths) to composite/edit from."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "description": "Text description of the image to generate."},
            "out_path": {"type": "string", "description": "Path to save the resulting image."},
            "reference_paths": {
                "type": "array", "items": {"type": "string"},
                "description": "Optional local image file paths to use as references (up to 14).",
            },
            "aspect_ratio": {"type": "string", "description": "e.g. 16:9, 1:1, 4:3, 9:16. Default 16:9."},
            "resolution": {"type": "string", "enum": ["1K", "2K", "4K"], "description": "Default 2K."},
            "output_format": {"type": "string", "enum": ["jpg", "png"], "description": "Default jpg."},
        },
        "required": ["prompt", "out_path"],
    },
}]


def send(msg):
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def handle(req):
    method = req.get("method")
    rid = req.get("id")
    params = req.get("params") or {}

    if method == "initialize":
        send({"jsonrpc": "2.0", "id": rid, "result": {
            "protocolVersion": params.get("protocolVersion", DEFAULT_PROTOCOL),
            "capabilities": {"tools": {}},
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
        }})
    elif method == "notifications/initialized":
        pass  # notification, no response
    elif method == "tools/list":
        send({"jsonrpc": "2.0", "id": rid, "result": {"tools": TOOLS}})
    elif method == "tools/call":
        name = params.get("name")
        args = params.get("arguments") or {}
        if name != "generate_image":
            send({"jsonrpc": "2.0", "id": rid, "result": {
                "content": [{"type": "text", "text": f"Unknown tool: {name}"}], "isError": True}})
            return
        try:
            text = generate_image(args)
            send({"jsonrpc": "2.0", "id": rid, "result": {"content": [{"type": "text", "text": text}]}})
        except Exception as e:
            log("ERROR:", repr(e))
            send({"jsonrpc": "2.0", "id": rid, "result": {
                "content": [{"type": "text", "text": f"Error: {e}"}], "isError": True}})
    elif method == "ping":
        send({"jsonrpc": "2.0", "id": rid, "result": {}})
    elif rid is not None:
        send({"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": f"Method not found: {method}"}})


def main():
    log("server started")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception as e:
            log("bad json:", e)
            continue
        try:
            handle(req)
        except Exception as e:
            log("handler crash:", repr(e))


if __name__ == "__main__":
    main()
