const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dcsa-desktop-"));
const exe = require("electron");
try {
  for (const phase of ["create", "reopen"]) {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const result = spawnSync(
      exe,
      [path.join(__dirname, "electron-harness.js"), dir, phase],
      { env, encoding: "utf8", timeout: 60000, windowsHide: true },
    );
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    assert.ifError(result.error);
    assert.equal(result.status, 0, `Desktop ${phase} failed`);
    assert.ok(result.stdout.includes(`DESKTOP ${phase} PASSED`));
  }
  console.log("DESKTOP CHECK PASSED");
} finally {
  fs.rmSync(dir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
