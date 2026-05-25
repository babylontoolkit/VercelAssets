import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// MIME type map for static assets served from /public.
// Strips query strings before matching so ?v=123 cache-busters don't break lookups.
// Mirrors the Vite media-content-type-plugin.
// ---------------------------------------------------------------------------
const MEDIA_MIME_TYPES: Record<string, string> = {
  // 3D models
  ".gltf":   "model/gltf+json",
  ".glb":    "model/gltf-binary",
  ".bin":    "application/octet-stream",
  // Images — raster
  ".png":    "image/png",
  ".jpg":    "image/jpeg",
  ".jpeg":   "image/jpeg",
  ".webp":   "image/webp",
  ".gif":    "image/gif",
  ".bmp":    "image/bmp",
  ".tiff":   "image/tiff",
  ".tif":    "image/tiff",
  ".avif":   "image/avif",
  ".ico":    "image/x-icon",
  ".svg":    "image/svg+xml",
  // Images — HDR / compressed textures (Babylon)
  ".hdr":    "application/octet-stream",
  ".exr":    "application/octet-stream",
  ".ktx":    "image/ktx",
  ".ktx2":   "image/ktx2",
  ".basis":  "application/octet-stream",
  ".dds":    "application/octet-stream",
  // Audio
  ".mp3":    "audio/mpeg",
  ".ogg":    "audio/ogg",
  ".wav":    "audio/wav",
  ".aac":    "audio/aac",
  ".flac":   "audio/flac",
  ".m4a":    "audio/mp4",
  ".opus":   "audio/opus",
  ".weba":   "audio/webm",
  // Video
  ".mp4":    "video/mp4",
  ".m4v":    "video/mp4",
  ".webm":   "video/webm",
  ".ogv":    "video/ogg",
  ".mov":    "video/quicktime",
  ".avi":    "video/x-msvideo",
};

// Extensions that also need CORS method/header headers (3D model fetches from BabylonJS loaders)
const CORS_FULL_EXTS = new Set([".gltf", ".glb"]);

// ---------------------------------------------------------------------------
// Build Next.js header entries from the MIME map.
// /(.*)\\.ext naturally matches both /model.ext and /model.gz.ext, so each
// entry covers both plain and gzip-compressed variants without duplication.
// The separate gzip catch-all below adds Content-Encoding for .gz. files.
// ---------------------------------------------------------------------------
type HeaderEntry = { source: string; headers: Array<{ key: string; value: string }> };

function buildMediaHeaderEntries(): HeaderEntry[] {
  const corsExtra = [
    { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
    { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
  ];

  return Object.entries(MEDIA_MIME_TYPES).map(([ext, mime]) => {
    const e = ext.slice(1); // ".gltf" → "gltf"
    return {
      source: `/(.*)\\.${e}`,
      headers: [
        { key: "Content-Type", value: mime },
        { key: "Access-Control-Allow-Origin", value: "*" },
        ...(CORS_FULL_EXTS.has(ext) ? corsExtra : []),
      ],
    };
  });
}

const nextConfig: NextConfig = {
  turbopack: {},
  // reactStrictMode: true, // Enable Strict Mode
  // output: "export",      // Enable Static Export

  async headers() {
    return [
      // Required for BabylonJS Havok physics (SharedArrayBuffer support)
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      // Mirrors wasm-content-type-plugin
      {
        source: "/(.*)\\.wasm",
        headers: [{ key: "Content-Type", value: "application/wasm" }],
      },
      // Mirrors gzip-response-headers plugin — catch-all for any .gz.<ext> asset
      {
        source: "/(.*)\\.gz\\.(.*)",
        headers: [{ key: "Content-Encoding", value: "gzip" }],
      },
      // Mirrors media-content-type-plugin — per-extension MIME types + CORS
      ...buildMediaHeaderEntries(),
    ];
  },

  // Disable static image imports so PNG imports resolve as plain string URLs
  images: {
    disableStaticImages: true,
  },

  // The src/babylon git submodule imports PNGs with plain <img src={logo}>, expecting
  // a string URL. Next.js's next-image-loader would return a StaticImageData object
  // instead, causing <img src="[object Object]">.  The fix: intercept those two imports
  // before any loader runs and replace them with inline data-URI modules that export
  // the public path strings. webpack: true is set in server-classic.ts so this runs.
  webpack(config, { webpack }) {
    config.resolve.symlinks = false; // resolve from symlink path, not real path
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /assets[\/\\]babylon\.png$/,
        (res: { request: string }) => {
          res.request = "data:text/javascript,export default '/babylon.png'";
        }
      ),
      new webpack.NormalModuleReplacementPlugin(
        /assets[\/\\]spinner\.png$/,
        (res: { request: string }) => {
          res.request = "data:text/javascript,export default '/spinner.png'";
        }
      )
    );

    // Keep all Babylon packages in a single chunk — mirrors Vite manualChunks({ id }) { if (id.includes("babylonjs")) return "babylon" }
    const splitChunks = config.optimization?.splitChunks as
      | { cacheGroups?: Record<string, unknown> }
      | false
      | undefined;
    if (splitChunks !== false) {
      config.optimization ??= {};
      config.optimization.splitChunks = {
        ...splitChunks,
        cacheGroups: {
          ...(splitChunks?.cacheGroups ?? {}),
          babylon: {
            test: /[\\/]node_modules[\\/]babylonjs/,
            name: "babylon",
            chunks: "all" as const,
            priority: 30,
            enforce: true,
          },
        },
      };
    }

    // babylonjs-inspector references Babylon internals as 'package::BABYLON.*' module IDs
    // (a Rolldown/Rollup convention). Webpack 5 processes UMD bundles differently and may
    // not encounter these specifiers — but if it does, intercept them and redirect to
    // data-URI virtual modules that proxy the matching namespace from the global BABYLON
    // object at runtime. Mirrors resolve-babylon-inspector-internals Vite plugin.
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /.*::.*/,
        (resource: { request: string }) => {
          const namespacePath = resource.request.split("::")[1] ?? "BABYLON";
          const access = namespacePath.split(".").join("?.");
          const code = `module.exports=(typeof globalThis!=="undefined"?globalThis:window).${access}??{};`;
          resource.request = `data:text/javascript,${encodeURIComponent(code)}`;
        }
      )
    );

    return config;
  },
};

export default nextConfig;
