const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const result = spawnSync(
  process.execPath,
  [require.resolve("electron-builder/cli.js"), "--win", "nsis", "--x64"],
  { stdio: "inherit", windowsHide: true },
);
assert.equal(result.status, 0, "Installer build failed");
const installer = fs
  .readdirSync(path.join(__dirname, "..", "dist"))
  .find((file) => file.endsWith(".exe"));
assert.ok(installer, "Installer is missing");
assert.ok(
  fs.statSync(path.join(__dirname, "..", "dist", installer)).size > 1000000,
  "Installer is incomplete",
);
console.log(`INSTALLER CHECK PASSED: ${installer}`);
