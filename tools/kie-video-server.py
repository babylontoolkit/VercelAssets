#!/usr/bin/env python3
"""
Zero-dependency MCP server (raw JSON-RPC 2.0 over stdio) exposing kie.ai
Google **Veo 3.1** video generation. Works on Python 3.9+ (Windows, macOS,
Linux) with only the stdlib, so it runs identically from Claude Code and VS Code
Copilot.

This server is project-local (lives in <project>/tools). It is a companion to
`kie-video-server.py` (Kling) and `kie-image-server.py` (Nano Banana) and shares
the same KIE_KEY. Veo 3.1 uses dedicated endpoints rather than the generic
/jobs API:
  - create:  POST https://api.kie.ai/api/v1/veo/generate
  - poll:    GET  https://api.kie.ai/api/v1/veo/record-info?taskId=...

Tool: generate_video
  - prompt (str, required): text description of the video / motion.
  - out_path (str, required): path to save the resulting video (.mp4).
  - image_paths (list[str], optional): local image files for image-to-video.
      * 1 image  -> the video animates around that image
      * 2 images -> first image = first frame, second = last frame (transition)
      * up to 3 images with generation_type=REFERENCE_2_VIDEO (fast/lite only)
  - model (str, default "veo3_fast"): veo3 | veo3_fast | veo3_lite
  - aspect_ratio (str, default "16:9"): 16:9 | 9:16 | Auto
  - resolution (str, default "720p"): 720p | 1080p | 4k (4k costs extra credits)
  - duration (int, default 8): 4 | 6 | 8 seconds
  - generation_type (str, optional): TEXT_2_VIDEO |
      FIRST_AND_LAST_FRAMES_2_VIDEO | REFERENCE_2_VIDEO (auto-detected if omitted)
  - watermark (str, optional): watermark text to burn into the video.
  - enable_translation (bool, default True): translate prompt to English first.

API key resolution order:
  1. $KIE_KEY / $KIE_AI_API_KEY environment variables
  2. KIE_KEY (or KIE_AI_API_KEY) in the project-root `.env` file (gitignored)
Never prefix the key with VITE_, or Vite would bundle it into the public
browser build.
"""
import sys, os, json, time, base64, mimetypes, urllib.request

API = "https://api.kie.ai"
UPLOAD = "https://kieai.redpandaai.co"
UA = "Mozilla/5.0 (compatible; kie-veo-mcp/1.0)"
SERVER_NAME = "kie-veo"
SERVER_VERSION = "1.0.0"
DEFAULT_PROTOCOL = "2025-06-18"
DEFAULT_MODEL = "veo3_fast"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def log(*a):
    print("[kie-veo]", *a, file=sys.stderr, flush=True)


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
        "uploadPath": "mcp-veo",
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
    model = args.get("model", DEFAULT_MODEL)
    aspect = args.get("aspect_ratio", "16:9")
    resolution = args.get("resolution", "720p")
    duration = int(args.get("duration", 8))
    gen_type = args.get("generation_type")
    watermark = args.get("watermark")
    enable_translation = bool(args.get("enable_translation", True))

    image_urls = [_upload(os.path.expanduser(p)) for p in imgs]

    # Veo 3.1 uses a flat request body (not the {model, input} jobs wrapper).
    payload = {
        "prompt": prompt,
        "model": model,
        "aspect_ratio": aspect,
        "resolution": resolution,
        "duration": duration,
        "enableTranslation": enable_translation,
    }
    if image_urls:
        payload["imageUrls"] = image_urls
    if gen_type:
        payload["generationType"] = gen_type
    if watermark:
        payload["watermark"] = watermark

    task = _req(f"{API}/api/v1/veo/generate", "POST", payload)
    if task.get("code") != 200:
        raise RuntimeError(f"generate failed: {json.dumps(task)[:300]}")
    tid = (task.get("data") or {}).get("taskId")
    if not tid:
        raise RuntimeError(f"generate failed (no taskId): {json.dumps(task)[:300]}")
    log("task", tid, "submitted; polling")

    result_url = None
    deadline = time.time() + 900  # video renders are slower than images
    while time.time() < deadline:
        time.sleep(10)
        info = _req(f"{API}/api/v1/veo/record-info?taskId={tid}")
        d = info.get("data") or {}
        flag = d.get("successFlag")
        log("successFlag:", flag)
        if flag == 1:
            resp = d.get("response") or {}
            urls = resp.get("resultUrls") or resp.get("fullResultUrls")
            if not urls:
                raise RuntimeError(f"succeeded but no result url: {json.dumps(info)[:300]}")
            result_url = urls[0]
            break
        if flag in (2, 3):
            msg = d.get("errorMessage") or d.get("msg") or json.dumps(info)[:300]
            raise RuntimeError(f"generation failed (flag={flag}): {msg}")
    if not result_url:
        raise RuntimeError("timed out waiting for result (900s)")

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    req = urllib.request.Request(result_url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=300) as r, open(out_path, "wb") as f:
        f.write(r.read())
    log("saved ->", out_path)
    return f"Veo 3.1 video generated and saved to {out_path}\nSource URL (expires ~14 days): {result_url}"


TOOLS = [{
    "name": "generate_video",
    "description": (
        "Generate a video with kie.ai Google Veo 3.1 and save it to a local "
        "path. Optionally pass local image files (image_paths) for "
        "image-to-video: 1 image animates around it, 2 images = first + last "
        "frame transition, up to 3 images with generation_type=REFERENCE_2_VIDEO."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "description": "Text description of the video to generate."},
            "out_path": {"type": "string", "description": "Path to save the resulting video (.mp4)."},
            "image_paths": {
                "type": "array", "items": {"type": "string"},
                "description": "Optional local image paths. 1 = animate around image, 2 = first+last frame, up to 3 = reference (fast/lite).",
            },
            "model": {"type": "string", "enum": ["veo3", "veo3_fast", "veo3_lite"], "description": "Veo 3.1 model. Default veo3_fast (veo3 = highest quality)."},
            "aspect_ratio": {"type": "string", "enum": ["16:9", "9:16", "Auto"], "description": "Aspect ratio. Default 16:9."},
            "resolution": {"type": "string", "enum": ["720p", "1080p", "4k"], "description": "Output resolution. Default 720p (4k costs extra credits)."},
            "duration": {"type": "integer", "enum": [4, 6, 8], "description": "Video length in seconds. Default 8."},
            "generation_type": {
                "type": "string",
                "enum": ["TEXT_2_VIDEO", "FIRST_AND_LAST_FRAMES_2_VIDEO", "REFERENCE_2_VIDEO"],
                "description": "Optional generation mode. Auto-detected from image_paths if omitted.",
            },
            "watermark": {"type": "string", "description": "Optional watermark text to burn into the video."},
            "enable_translation": {"type": "boolean", "description": "Translate prompt to English before generating. Default true."},
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
