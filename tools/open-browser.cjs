#!/usr/bin/env node
// Dev launcher: starts Next.js and auto-opens the browser,
// equivalent to Vite's server.open option.

const { spawn } = require("child_process");
const http = require("http");

const PORT = parseInt(process.env.PORT || "3000");
const URL = `http://localhost:${PORT}`;

// Spawn next dev --webpack directly to avoid a circular npm run dev call
const nextBin = require.resolve("next/dist/bin/next");
const proc = spawn(
  process.execPath,
  [nextBin, "dev", "--webpack", "--port", String(PORT)],
  { stdio: "inherit", shell: false }
);

proc.on("error", (err) => {
  console.error("Failed to start dev server:", err);
  process.exit(1);
});

// Poll until the server responds, then open the browser once
function waitAndOpen(retries = 40) {
  http
    .get(URL, () => {
      const cmd =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
          ? "start"
          : "xdg-open";
      spawn(cmd, [URL], { shell: process.platform === "win32", detached: true, stdio: "ignore" }).unref();
      console.log(`\nOpened browser at ${URL}\n`);
    })
    .on("error", () => {
      if (retries > 0) {
        setTimeout(() => waitAndOpen(retries - 1), 500);
      }
    });
}

// Give the server a moment to start before polling
setTimeout(() => waitAndOpen(), 1500);
