#!/usr/bin/env node
/**
 * The content installer's build step for Next.js (pwa-content-installer D23), the Next.js twin of AppTemplate's
 * `vite-content-installer.ts` plugin:
 *   node scripts/content-installer-build.mjs worker   (predev, prebuild)
 *     copies `bt-content-worker.js` from `@babylonjs-toolkit/next/workers/` to `public/`, the site root, so `next dev`,
 *     `next start` and a Vercel deployment all serve it at `/bt-content-worker.js`.
 *   node scripts/content-installer-build.mjs shell    (postbuild)
 *     copies the worker too, then writes `public/bt-shell-manifest.json` (format 1, group "shell", navigationFallback
 *     "index.html") over the built app shell: every file of `.next/static/` under its served `_next/static/` path,
 *     every file of `public/` (a public file wins over an app metadata route of the same path, such as
 *     `src/app/favicon.ico`, so the public bytes are listed), and the prerendered Home page as `index.html` (served there by
 *     next.config.ts's rewrite), each with size, contentSize, SHA-256 and type.
 * When this @babylonjs-toolkit/next has no worker it prints one warning and writes nothing (D34): the installer stays off.
 * Both files are generated (git-ignored). Run from the project root.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { gunzipSync } from "node:zlib";

/** The project root (the folder npm runs scripts in). */
const PROJECT_ROOT = process.cwd();
/** The folder Next.js serves at the site root. */
const PUBLIC_FOLDER = path.join(PROJECT_ROOT, "public");
/** The Next.js build folder. */
const BUILD_FOLDER = path.join(PROJECT_ROOT, ".next");
/** The built client files, served under `STATIC_URL_PREFIX`. */
const STATIC_FOLDER = path.join(BUILD_FOLDER, "static");
/** The served path prefix of the built client files. */
const STATIC_URL_PREFIX = "_next/static/";
/** The prerendered Home page (App Router output). */
const HOME_PAGE_FILE = path.join(BUILD_FOLDER, "server", "app", "index.html");
/** The worker's module specifier in the toolkit package. */
const WORKER_SPECIFIER = "@babylonjs-toolkit/next/workers/bt-content-worker.js";
/** The worker file name, served at the app root. */
const WORKER_FILE_NAME = "bt-content-worker.js";
/** The shell manifest file name at the app root. */
const SHELL_MANIFEST_FILE_NAME = "bt-shell-manifest.json";
/** The shell manifest's one group. */
const SHELL_GROUP_ID = "shell";
/** The page the worker answers offline navigations with. */
const NAVIGATION_FALLBACK = "index.html";
/** The manifest format the installer reads. */
const MANIFEST_FORMAT = 1;
/** The manifest's generator text. */
const GENERATOR = "next-content-installer";
/** Paths (relative, "/" separators) left out of the shell manifest. */
const EXCLUDE_PATTERNS = [/\.map$/];
/** System files never listed, wherever they sit (the exporter's manifest leaves them out too, D11). */
const ALWAYS_EXCLUDED_FILE_NAMES = [".DS_Store", "Thumbs.db"];
/** A file whose last path segment contains this is served gzip encoded (the exporter's rule). */
const GZIP_MARKER = ".gz.";
/** Media type of an extension the table does not list. */
const DEFAULT_MEDIA_TYPE = "application/octet-stream";
/** Media types by lowercase extension. */
const MEDIA_TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".wasm": "application/wasm",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".ktx2": "image/ktx2",
    ".gltf": "model/gltf+json",
    ".glb": "model/gltf-binary",
    ".bin": "application/octet-stream",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".txt": "text/plain",
};

/**
 * @typedef {object} ShellManifestFile One file of the shell manifest (format 1, the content manifest's shape).
 * @property {number} size Bytes on disk (what the network sends).
 * @property {number} contentSize Bytes the browser delivers (decoded for `.gz.` files).
 * @property {string} hash Lowercase hex SHA-256 of the delivered bytes.
 * @property {string} type Media type.
 * @property {"gzip"} [encoding] "gzip" for `.gz.` files only.
 */

/**
 * Finds the content installer's service worker in the toolkit package.
 * @returns {string} The worker's absolute path, or "" when this @babylonjs-toolkit/next has none.
 */
function resolveWorkerSource() {
    try {
        return createRequire(path.join(PROJECT_ROOT, "package.json")).resolve(WORKER_SPECIFIER);
    } catch {
        return "";
    }
}

/**
 * Copies the worker to the site root.
 * @returns {boolean} True when the worker was copied; false (after one warning) when the toolkit has none.
 */
function copyWorker() {
    const workerSourcePath = resolveWorkerSource();
    if (workerSourcePath === "" || !existsSync(workerSourcePath)) {
        console.warn(`[content-installer] ${WORKER_FILE_NAME} was not found in @babylonjs-toolkit/next: the content installer stays off (no worker, no shell manifest).`);
        return false;
    }
    copyFileSync(workerSourcePath, path.join(PUBLIC_FOLDER, WORKER_FILE_NAME));
    return true;
}

/**
 * Lists every file under a folder.
 * @param {string} rootFolder The folder.
 * @returns {string[]} Paths relative to it, with "/" separators.
 */
function listFiles(rootFolder) {
    const relativePaths = [];
    const visit = (folder) => {
        for (const entry of readdirSync(folder, { withFileTypes: true })) {
            const absolutePath = path.join(folder, entry.name);
            if (entry.isDirectory()) visit(absolutePath);
            else if (entry.isFile()) relativePaths.push(path.relative(rootFolder, absolutePath).split(path.sep).join("/"));
        }
    };
    visit(rootFolder);
    return relativePaths;
}

/**
 * Tells whether a served path is listed.
 * @param {string} servedPath The path relative to the site root.
 * @returns {boolean} False for the shell manifest itself, system files and excluded patterns.
 */
function isListed(servedPath) {
    if (servedPath === SHELL_MANIFEST_FILE_NAME) return false;
    if (ALWAYS_EXCLUDED_FILE_NAMES.includes(path.posix.basename(servedPath))) return false;
    return !EXCLUDE_PATTERNS.some((pattern) => pattern.test(servedPath));
}

/**
 * The served app shell: each served path with the file whose bytes the server sends for it.
 * @returns {Map<string, string>} Absolute source files by served path (relative to the site root).
 */
function collectShellFiles() {
    const sourcesByServedPath = new Map();
    for (const relativePath of listFiles(PUBLIC_FOLDER)) sourcesByServedPath.set(relativePath, path.join(PUBLIC_FOLDER, relativePath));
    for (const relativePath of listFiles(STATIC_FOLDER)) {
        sourcesByServedPath.set(`${STATIC_URL_PREFIX}${relativePath}`, path.join(STATIC_FOLDER, relativePath));
    }
    if (existsSync(HOME_PAGE_FILE)) {
        sourcesByServedPath.set(NAVIGATION_FALLBACK, HOME_PAGE_FILE);
    } else {
        console.warn(`[content-installer] the Home page is not prerendered (${path.relative(PROJECT_ROOT, HOME_PAGE_FILE)} is missing): an installed app has no offline page.`);
    }
    for (const servedPath of [...sourcesByServedPath.keys()]) {
        if (!isListed(servedPath)) sourcesByServedPath.delete(servedPath);
    }
    return sourcesByServedPath;
}

/**
 * Describes one file: wire size, delivered size, SHA-256 of the delivered bytes, media type and encoding.
 * @param {string} servedPath The file's served path (its media type and encoding follow this name).
 * @param {string} sourceFile The file whose bytes are served.
 * @returns {ShellManifestFile} The manifest entry.
 */
function describeFile(servedPath, sourceFile) {
    const wireBytes = readFileSync(sourceFile);
    const isGzipEncoded = path.posix.basename(servedPath).toLowerCase().includes(GZIP_MARKER);
    const deliveredBytes = isGzipEncoded ? gunzipSync(wireBytes) : wireBytes;
    const entry = {
        size: wireBytes.length,
        contentSize: deliveredBytes.length,
        hash: createHash("sha256").update(deliveredBytes).digest("hex"),
        type: MEDIA_TYPES[path.posix.extname(servedPath).toLowerCase()] ?? DEFAULT_MEDIA_TYPE,
    };
    if (isGzipEncoded) entry.encoding = "gzip";
    return entry;
}

/**
 * Ordinal (UTF-16 code unit) string order, the exporter's StringComparer.Ordinal.
 * @param {string} first A string.
 * @param {string} second Another string.
 * @returns {number} Negative, zero or positive.
 */
function compareOrdinal(first, second) {
    if (first === second) return 0;
    return first < second ? -1 : 1;
}

/**
 * The manifest version (D10, the exporter's ComputeVersion): SHA-256 hex of the canonical text — "F\t<path>\t<hash>\t<size>\n"
 * per file in ordinal path order, "G\t<group>\t<path>\n" per group file in ordinal order, then "N\t<navigationFallback>\n".
 * @param {Object<string, ShellManifestFile>} files The files.
 * @param {Object<string, { files: string[] }>} groups The groups.
 * @param {string} navigationFallback The offline navigation page.
 * @returns {string} The version.
 */
function computeVersion(files, groups, navigationFallback) {
    let canonicalText = "";
    for (const filePath of Object.keys(files).sort(compareOrdinal)) {
        canonicalText += `F\t${filePath}\t${files[filePath].hash}\t${files[filePath].size}\n`;
    }
    for (const groupId of Object.keys(groups).sort(compareOrdinal)) {
        for (const filePath of [...groups[groupId].files].sort(compareOrdinal)) canonicalText += `G\t${groupId}\t${filePath}\n`;
    }
    canonicalText += `N\t${navigationFallback}\n`;
    return createHash("sha256").update(canonicalText, "utf8").digest("hex");
}

/**
 * Builds the shell manifest of the built app.
 * @returns {object} The manifest (format 1, the shape `vite-content-installer.ts` writes).
 */
function buildShellManifest() {
    const sourcesByServedPath = collectShellFiles();
    const servedPaths = [...sourcesByServedPath.keys()].sort(compareOrdinal);
    const files = {};
    for (const servedPath of servedPaths) files[servedPath] = describeFile(servedPath, sourcesByServedPath.get(servedPath));
    const groups = { [SHELL_GROUP_ID]: { scene: NAVIGATION_FALLBACK, files: servedPaths } };
    return {
        format: MANIFEST_FORMAT,
        version: computeVersion(files, groups, NAVIGATION_FALLBACK),
        generated: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        generator: GENERATOR,
        navigationFallback: NAVIGATION_FALLBACK,
        files,
        groups,
    };
}

/**
 * Copies the worker and, after a build, writes the shell manifest.
 * @param {string} mode "worker" or "shell".
 */
function run(mode) {
    if (mode !== "worker" && mode !== "shell") throw new Error("usage: node scripts/content-installer-build.mjs worker|shell");
    if (!copyWorker() || mode === "worker") return;
    if (!existsSync(STATIC_FOLDER)) throw new Error(`[content-installer] ${path.relative(PROJECT_ROOT, STATIC_FOLDER)} is missing: run it after next build.`);
    const manifest = buildShellManifest();
    writeFileSync(path.join(PUBLIC_FOLDER, SHELL_MANIFEST_FILE_NAME), `${JSON.stringify(manifest, null, 2)}\n`);
    console.info(`[content-installer] ${SHELL_MANIFEST_FILE_NAME}: ${Object.keys(manifest.files).length} files, version ${manifest.version.slice(0, 12)}`);
}

run(process.argv[2]);
