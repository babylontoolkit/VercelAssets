#!/usr/bin/env python3
"""
Zero-dependency MCP server (raw JSON-RPC 2.0 over stdio) exposing kie.ai
Kling 3.0 video generation. Works on Python 3.9+ (Windows, macOS, Linux)
with only the stdlib, so it runs identically from Claude Code and VS Code Copilot.

This server is project-local (lives in <project>/tools). Configs that point at
it (.mcp.json, .vscode/mcp.json) use relative paths so they are portable across
machines when this project is cloned from a starter template.

Tool: generate_video
  - prompt (str, required)
  - out_path (str, required): path to save the resulting video (.mp4)
  - image_paths (list[str], optional): local image files used as first / last
    frame guidance (uploaded to kie.ai, passed as image_urls for image-to-video).
    1 image = first frame, 2 images = first and last frame.
  - duration (str, default "5"): total seconds, "3"..."15"
  - aspect_ratio (str, default "16:9"): 16:9 | 9:16 | 1:1 (auto-adapts if images given)
  - mode (str, default "pro"): std | pro | 4K (output resolution tier)
  - sound (bool, default False): generate audio with the video
  - model (str, default "kling-3.0/video"): kie.ai video model id

API key resolution order:
  1. $KIE_KEY / $KIE_AI_API_KEY environment variables
  2. KIE_KEY (or KIE_AI_API_KEY) in the project-root `.env` file (gitignored)
Never prefix the key with VITE_, or Vite would bundle it into the public
browser build.
"""
import sys, os, json, time, base64, mimetypes, urllib.request

API = "https://api.kie.ai"
UPLOAD = "https://kieai.redpandaai.co"
UA = "Mozilla/5.0 (compatible; kie-video-mcp/1.0)"
SERVER_NAME = "kie-video"
SERVER_VERSION = "1.0.0"
DEFAULT_PROTOCOL = "2025-06-18"
DEFAULT_MODEL = "kling-3.0/video"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def log(*a):
    print("[kie-video]", *a, file=sys.stderr, flush=True)


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
        "uploadPath": "mcp-video",
        "fileName": os.path.basename(path),
    })
    url = (res.get("data") or {}).get("downloadUrl")
    if not url:
        raise RuntimeError(f"upload failed for {path}: {json.dumps(res)[:300]}")
    log("uploaded", path, "->", url)
    return url


def generate_video(args):
    prompt = args["prompt"]
    out_path = os.path.expanduser(args["out_path"])
    imgs = args.get("image_paths") or []
    duration = str(args.get("duration", "5"))
    aspect = args.get("aspect_ratio", "16:9")
    mode = args.get("mode", "pro")
    sound = bool(args.get("sound", False))
    model = args.get("model", DEFAULT_MODEL)

    image_urls = [_upload(os.path.expanduser(p)) for p in imgs]

    payload = {
        "prompt": prompt,
        "duration": duration,
        "aspect_ratio": aspect,
        "mode": mode,
        "sound": sound,
    }
    if image_urls:
        payload["image_urls"] = image_urls

    task = _req(f"{API}/api/v1/jobs/createTask", "POST", {
        "model": model,
        "input": payload,
    })
    tid = (task.get("data") or {}).get("taskId")
    if not tid:
        raise RuntimeError(f"createTask failed: {json.dumps(task)[:300]}")
    log("task", tid, "submitted; polling")

    result_url = None
    deadline = time.time() + 900  # video renders are slower than images
    while time.time() < deadline:
        time.sleep(10)
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
        raise RuntimeError("timed out waiting for result (900s)")

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    req = urllib.request.Request(result_url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=300) as r, open(out_path, "wb") as f:
        f.write(r.read())
    log("saved ->", out_path)
    return f"Video generated and saved to {out_path}\nSource URL (expires ~3 days): {result_url}"


TOOLS = [{
    "name": "generate_video",
    "description": (
        "Generate a video with kie.ai Kling 3.0 and save it to a local path. "
        "Optionally pass local image files (image_paths) for image-to-video: "
        "1 image = first frame, 2 images = first and last frame."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "description": "Text description of the video to generate."},
            "out_path": {"type": "string", "description": "Path to save the resulting video (.mp4)."},
            "image_paths": {
                "type": "array", "items": {"type": "string"},
                "description": "Optional local image paths for image-to-video (1 = first frame, 2 = first+last frame).",
            },
            "duration": {"type": "string", "description": "Total seconds, '3'..'15'. Default '5'."},
            "aspect_ratio": {"type": "string", "enum": ["16:9", "9:16", "1:1"], "description": "Default 16:9 (auto-adapts if images given)."},
            "mode": {"type": "string", "enum": ["std", "pro", "4K"], "description": "Resolution tier. Default pro."},
            "sound": {"type": "boolean", "description": "Generate audio with the video. Default false."},
            "model": {"type": "string", "description": "kie.ai video model id. Default kling-3.0/video."},
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
        if name != "generate_video":
            send({"jsonrpc": "2.0", "id": rid, "result": {
                "content": [{"type": "text", "text": f"Unknown tool: {name}"}], "isError": True}})
            return
        try:
            text = generate_video(args)
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
