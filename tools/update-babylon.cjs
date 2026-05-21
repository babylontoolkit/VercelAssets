#!/usr/bin/env node

const { spawnSync } = require("child_process");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

const SUBMODULE_URL = "https://github.com/babylontoolkit/ReactFramework.git";
const SUBMODULE_PATH = "src/babylon";

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function run(command, args, allowFailure = false) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0 && !allowFailure) {
    process.exit(result.status || 1);
  }

  return result.status === 0;
}

function runText(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim();
}

function getGitCommonDir() {
  return runText("git", ["rev-parse", "--git-common-dir"]) || ".git";
}

async function main() {
  const answer = await ask(
    "Overwrite Babylon Toolkit React Framework submodule at src/babylon? [y/N] "
  );

  if (answer !== "y" && answer !== "yes") {
    console.log("Cancelled.");
    return;
  }

  const gitCommonDir = getGitCommonDir();
  const gitModulePath = path.join(gitCommonDir, "modules", "src", "babylon");

  console.log("\nRemoving existing Babylon Toolkit React Framework submodule...\n");

  // These cleanup steps intentionally continue even if any individual command fails.
  run("git", ["submodule", "deinit", "-f", SUBMODULE_PATH], true);
  run("git", ["rm", "-r", "-f", SUBMODULE_PATH], true);

  fs.rmSync(gitModulePath, { recursive: true, force: true });
  fs.rmSync(SUBMODULE_PATH, { recursive: true, force: true });

  console.log("\nInstalling clean Babylon Toolkit React Framework submodule...\n");

  run("git", ["submodule", "add", SUBMODULE_URL, SUBMODULE_PATH]);
  run("git", ["add", ".gitmodules", SUBMODULE_PATH]);
  run("git", ["commit", "-m", "Update Babylon Toolkit React Framework submodule"]);

  console.log("\nBabylon Toolkit React Framework submodule updated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
