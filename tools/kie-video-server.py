#!/usr/bin/env python3
"""
Zero-dependency MCP server (raw JSON-RPC 2.0 over stdio) for kie.ai video
models that use the generic /api/v1/jobs/createTask endpoint.
Works on Python 3.9+ (Windows, macOS, Linux) with only the stdlib.

This is a companion to kie-google-server.py (Veo 3.1, dedicated endpoint).
Use THIS server for Kling, Bytedance Seedance, and Grok Imagine Video.

  create:  POST https://api.kie.ai/api/v1/jobs/createTask
  poll:    GET  https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...

Tool: generate_video
  - prompt (str, required): text description of the video / motion.
  - out_path (str, required): path to save the resulting video (.mp4).
  - model (str, default "kling-3.0/video"): see model list below.
  - image_paths (list[str], optional): local image files for image-to-video.
      Kling:     up to 2 images (1 = first frame, 2 = first + last frame).
      Bytedance: index 0 = first_frame_url, index 1 = last_frame_url.
      Grok:      1 image (first frame / reference).
  - aspect_ratio (str, default "16:9"): 16:9 | 9:16 | 1:1
  - duration (int, default 5): seconds (valid range varies by model).
  - sound (bool, default False): generate audio with the video (Kling / Bytedance).
  - resolution (str, optional): 480p | 720p | 1080p (Bytedance / Grok).
  - mode (str, default "pro"): std | pro | 4K — Kling 3.0 only.

Available models (pass exact slug as "model"):

  Kling:
    kling-3.0/video                    Default. Multi-shot, std/pro/4K modes, 3-15s
    kling-2.6/text-to-video            Kling 2.6 text-to-video (5 or 10s)
    kling-2.6/image-to-video           Kling 2.6 image-to-video (5 or 10s)
    kling-2.5/turbo-text-to-video-pro  Kling 2.5 Turbo text-to-video Pro
    kling-2.5/turbo-image-to-video-pro Kling 2.5 Turbo image-to-video Pro
    kling-v2.1/master-text-to-video    Kling V2.1 Master text-to-video
    kling-v2.1/master-image-to-video   Kling V2.1 Master image-to-video

  Bytedance (Seedance):
    bytedance/seedance-2               Seedance 2.0 (text/image-to-video, audio, 4-15s)
    bytedance/seedance-2-fast          Seedance 2.0 Fast (text/image-to-video, 4-15s)
    bytedance/seedance-1.5-pro         Seedance 1.5 Pro (4/8/12s, optional audio)
    bytedance/v1-pro-text-to-video     Bytedance V1 Pro text-to-video
    bytedance/v1-pro-image-to-video    Bytedance V1 Pro image-to-video
    bytedance/v1-lite-text-to-video    Bytedance V1 Lite text-to-video
    bytedance/v1-lite-image-to-video   Bytedance V1 Lite image-to-video

  Grok Imagine (Video):
    grok-imagine-video-1-5-preview     Grok Imagine Video 1.5 Preview (1-15s, 480p/720p)

  Note: model-specific parameters beyond prompt/image_paths/aspect_ratio/duration
  may require the model to use its defaults. For full parameter control, call
  the kie.ai API directly with the exact input schema from docs.kie.ai.

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
        "uploadPath": "mcp-video-other",
        "fileName": os.path.basename(path),
    })
    url = (res.get("data") or {}).get("downloadUrl")
    if not url:
        raise RuntimeError(f"upload failed for {path}: {json.dumps(res)[:300]}")
    log("uploaded", path, "->", url)
    return url


def _build_input(model, prompt, image_urls, aspect, duration, sound, resolution, mode):
    """Build the model-specific input dict for createTask."""
    if model.startswith("kling"):
        inp = {
            "prompt": prompt,
            "sound": sound,
            "aspect_ratio": aspect,
            "duration": str(duration),
        }
        if model == "kling-3.0/video":
            inp["mode"] = mode
            inp["multi_shots"] = False
        if image_urls:
            inp["image_urls"] = image_urls

    elif model.startswith("bytedance"):
        inp = {
            "prompt": prompt,
            "aspect_ratio": aspect,
            "duration": duration,
            "generate_audio": sound,
        }
        if resolution:
            inp["resolution"] = resolution
        if len(image_urls) >= 1:
            inp["first_frame_url"] = image_urls[0]
        if len(image_urls) >= 2:
            inp["last_frame_url"] = image_urls[1]

    else:
        # Grok Imagine and any future models
        inp = {
            "prompt": prompt,
            "aspect_ratio": aspect,
            "duration": duration,
        }
        if resolution:
            inp["resolution"] = resolution
        if image_urls:
            inp["image_urls"] = image_urls

    return inp


def generate_video(args):
    prompt = args["prompt"]
    out_path = os.path.expanduser(args["out_path"])
    model = args.get("model", DEFAULT_MODEL)
    imgs = args.get("image_paths") or []
    aspect = args.get("aspect_ratio", "16:9")
    duration = int(args.get("duration", 5))
    sound = bool(args.get("sound", False))
    resolution = args.get("resolution")
    mode = args.get("mode", "pro")

    image_urls = [_upload(os.path.expanduser(p)) for p in imgs]
    inp = _build_input(model, prompt, image_urls, aspect, duration, sound, resolution, mode)

    task = _req(f"{API}/api/v1/jobs/createTask", "POST", {
        "model": model,
        "input": inp,
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
        flag = d.get("successFlag")
        log("state:", state, "flag:", flag)
        if state in ("success", "completed") or flag == 1:
            # Try multiple result URL field locations
            rj = d.get("resultJson") or d.get("response")
            if isinstance(rj, str) and rj:
                try:
                    parsed = json.loads(rj)
                    urls = parsed.get("resultUrls") or parsed.get("fullResultUrls")
                    if urls:
                        result_url = urls[0]
                    else:
                        result_url = parsed.get("videoUrl") or parsed.get("mp4Url")
                except Exception:
                    pass
            if not result_url:
                urls = d.get("resultUrls") or d.get("fullResultUrls")
                if urls:
                    result_url = urls[0]
            if not result_url:
                raise RuntimeError(f"succeeded but no result url: {json.dumps(info)[:300]}")
            break
        if state in ("fail", "failed") or flag in (2, 3):
            msg = d.get("errorMessage") or d.get("msg") or json.dumps(info)[:300]
            raise RuntimeError(f"generation failed: {msg}")
    if not result_url:
        raise RuntimeError("timed out waiting for result (900s)")

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    req = urllib.request.Request(result_url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=300) as r, open(out_path, "wb") as f:
        f.write(r.read())
    log("saved ->", out_path)
    return f"Video generated and saved to {out_path}\nModel: {model}\nSource URL (expires ~14 days): {result_url}"


TOOLS = [{
    "name": "generate_video",
    "description": (
        "Generate a video with kie.ai (Kling, Bytedance Seedance, or Grok Imagine) "
        "using the /api/v1/jobs/createTask endpoint, and save it to a local path. "
        "Optionally pass local image files (image_paths) for image-to-video: "
        "1 image = first frame, 2 images = first + last frame (Kling/Bytedance). "
        "Default model is kling-3.0/video."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "description": "Text description of the video to generate."},
            "out_path": {"type": "string", "description": "Path to save the resulting video (.mp4)."},
            "model": {
                "type": "string",
                "description": (
                    "kie.ai video model slug. Default kling-3.0/video. "
                    "Options: kling-3.0/video, kling-2.6/text-to-video, kling-2.6/image-to-video, "
                    "kling-2.5/turbo-text-to-video-pro, kling-2.5/turbo-image-to-video-pro, "
                    "kling-v2.1/master-text-to-video, kling-v2.1/master-image-to-video, "
                    "bytedance/seedance-2, bytedance/seedance-2-fast, bytedance/seedance-1.5-pro, "
                    "bytedance/v1-pro-text-to-video, bytedance/v1-pro-image-to-video, "
                    "bytedance/v1-lite-text-to-video, bytedance/v1-lite-image-to-video, "
                    "grok-imagine-video-1-5-preview."
                ),
            },
            "image_paths": {
                "type": "array", "items": {"type": "string"},
                "description": "Optional local image paths. 1 = first frame, 2 = first + last frame.",
            },
            "aspect_ratio": {"type": "string", "enum": ["16:9", "9:16", "1:1"], "description": "Aspect ratio. Default 16:9."},
            "duration": {"type": "integer", "description": "Video duration in seconds. Default 5. Valid range varies by model."},
            "sound": {"type": "boolean", "description": "Generate audio with the video (Kling / Bytedance). Default false."},
            "resolution": {"type": "string", "enum": ["480p", "720p", "1080p"], "description": "Output resolution (Bytedance / Grok). Optional."},
            "mode": {"type": "string", "enum": ["std", "pro", "4K"], "description": "Resolution tier for kling-3.0/video only. Default pro."},
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
