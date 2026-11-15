#!/usr/bin/env node
/**
 * The lowercase output check (postbuild, before the shell manifest): fails the build when any file the site serves — the
 * built client files in `.next/static/`, the files in `public/`, and `out/` after a static export — has an uppercase
 * letter in its path. A build that goes into a Unity project's export is copied by the Babylon Toolkit exporter, which
 * (with its Force Lower Casing option) lowercases every file name it copies: a mixed-case name would be renamed while the
 * page still asks for the old name, and a case-sensitive host would answer 403 or 404 for it.
 * `next.config.ts` keeps Next.js's own output lowercase (a lowercase hex build id, lowercase media file names; chunk
 * names already are). Next.js's fixed `_buildManifest.js` and `_ssgManifest.js` are allowed: App Router pages never
 * request them, and the shell manifest leaves them out, so nothing ever asks for them by name. Run from the project root.
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/** The project root (the folder npm runs scripts in). */
const PROJECT_ROOT = process.cwd();
/** The folders whose files are served, relative to the project root (a missing one is skipped). */
const SERVED_FOLDERS = [path.join(".next", "static"), "public", "out"];
/** File names allowed whatever their case: system files, and Next.js's fixed build manifests. */
const ALLOWED_FILE_NAMES = new Set([".DS_Store", "Thumbs.db", "_buildManifest.js", "_ssgManifest.js"]);
/** How many offending paths the error lists. */
const LISTED_PATH_COUNT = 10;

/**
 * Every file under a folder, as paths relative to the project root ("/" separators).
 * @param {string} folder The folder, relative to the project root.
 * @returns {string[]} The file paths.
 */
function listFiles(folder) {
    const files = [];
    for (const entry of readdirSync(path.join(PROJECT_ROOT, folder), { withFileTypes: true })) {
        const relativePath = path.join(folder, entry.name);
        if (entry.isDirectory()) files.push(...listFiles(relativePath));
        else files.push(relativePath.split(path.sep).join("/"));
    }
    return files;
}

/**
 * The paths that break the lowercase rule.
 * @param {string[]} relativePaths Served file paths.
 * @returns {string[]} The ones with an uppercase letter that are not allowed by name.
 */
function findUppercasePaths(relativePaths) {
    return relativePaths.filter((relativePath) => !ALLOWED_FILE_NAMES.has(path.basename(relativePath)) && relativePath !== relativePath.toLowerCase());
}

/**
 * Checks every served folder and exits with an error listing the uppercase paths, if any.
 */
function run() {
    const servedFiles = SERVED_FOLDERS.filter((folder) => existsSync(path.join(PROJECT_ROOT, folder))).flatMap(listFiles);
    const uppercasePaths = findUppercasePaths(servedFiles);
    if (uppercasePaths.length === 0) {
        console.info(`[build] lowercase output: ${servedFiles.length} files checked`);
        return;
    }
    console.error(`[build] ${uppercasePaths.length} output file(s) have uppercase letters; the Babylon Toolkit Unity export lowercases the files `
        + `it copies, which would break them on the hosted game. Rename them lowercase (and their references): ${uppercasePaths.slice(0, LISTED_PATH_COUNT).join(", ")}`);
    process.exit(1);
}

run();
