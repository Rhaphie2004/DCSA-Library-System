const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { openDatabase, APP_ID, SCHEMA_VERSION } = require("./database");
const { dayNumber } = require("./dates");

const schemaSql =
  "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name";
const reference = openDatabase(":memory:");
const expectedSchema = JSON.stringify(reference.prepare(schemaSql).all());
reference.close();

function createBackup(library, destination) {
  if (path.resolve(destination) === path.resolve(library.filename))
    throw new Error("Choose a different backup file, not the live database.");
  if (fs.existsSync(destination))
    throw new Error(
      "Choose a new backup filename; existing backups are preserved.",
    );
  const staged = `${destination}.partial-${randomUUID()}`;
  try {
    // Stage and validate a committed SQLite copy before publishing its final filename.
    library.db.prepare("VACUUM INTO ?").run(staged);
    validateBackup(staged);
    if (fs.existsSync(destination))
      throw new Error("This backup filename already exists.");
    fs.renameSync(staged, destination);
  } finally {
    if (fs.existsSync(staged)) fs.unlinkSync(staged);
  }
}
function validateBackup(source) {
  let db;
  try {
    if (!fs.statSync(source).isFile())
      throw new Error("Choose a database backup file.");
    db = new DatabaseSync(source, { readOnly: true });
    db.exec("PRAGMA trusted_schema=OFF");
    if (
      db.prepare("PRAGMA application_id").get().application_id !== APP_ID ||
      db.prepare("PRAGMA user_version").get().user_version !== SCHEMA_VERSION
    )
      throw new Error("Incompatible backup version.");
    if (
      db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok" ||
      db.prepare("PRAGMA foreign_key_check").get()
    )
      throw new Error("Backup integrity check failed.");
    if (JSON.stringify(db.prepare(schemaSql).all()) !== expectedSchema)
      throw new Error("Backup schema does not match this application version.");
    if (
      !db
        .prepare("SELECT id FROM staff WHERE active=1 AND role='admin'")
        .get() ||
      !db
        .prepare(
          "SELECT loanDays,maxLoans,blockOverdue FROM settings WHERE id=1",
        )
        .get()
    )
      throw new Error("Backup has no active administrator or policy.");
    for (const staff of db.prepare("SELECT passwordHash FROM staff").all()) {
      if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(staff.passwordHash))
        throw new Error("Backup contains an invalid staff credential.");
    }
    for (const loan of db
      .prepare(
        "SELECT checkoutOn,dueDate,returnedOn,cancelledOn,condition FROM loans",
      )
      .all()) {
      const checkout = dayNumber(loan.checkoutOn),
        due = dayNumber(loan.dueDate);
      if (due < checkout)
        throw new Error("Backup contains an invalid due date.");
      for (const value of [loan.returnedOn, loan.cancelledOn])
        if (value !== null && dayNumber(value) < checkout)
          throw new Error("Backup contains a resolution date before checkout.");
      if (
        loan.returnedOn !== null &&
        (!["Good", "Damaged", "Lost"].includes(loan.condition) ||
          loan.cancelledOn !== null)
      )
        throw new Error("Backup contains an invalid completed loan.");
    }
  } catch (error) {
    throw new Error(`Cannot restore backup: ${error.message}`);
  } finally {
    db?.close();
  }
}
function restoreBackup(library, source) {
  if (path.resolve(source) === path.resolve(library.filename))
    throw new Error("Choose a backup, not the open database.");
  const staged = `${library.filename}.restore-${randomUUID()}`;
  const safetyBackup = `${library.filename}.before-restore-${Date.now()}.sqlite`;
  try {
    fs.copyFileSync(source, staged, fs.constants.COPYFILE_EXCL);
    validateBackup(staged);
    createBackup(library, safetyBackup);
    library.db.close();
    library.db = null;
    try {
      fs.renameSync(staged, library.filename);
      library.db = openDatabase(library.filename);
    } catch (error) {
      library.db?.close();
      library.db = null;
      fs.copyFileSync(safetyBackup, library.filename);
      library.db = openDatabase(library.filename);
      throw error;
    }
    library.session = null;
    library.loginAttempts.clear();
    library.audit(
      "restore",
      "Restored validated backup; pre-restore database preserved",
      null,
    );
    return { safetyBackup };
  } finally {
    if (fs.existsSync(staged)) fs.unlinkSync(staged);
  }
}
function dailyBackup(library, folder) {
  fs.mkdirSync(folder, { recursive: true });
  const destination = path.join(folder, `dcsa-${library.today()}.sqlite`);
  if (fs.existsSync(destination)) {
    try {
      validateBackup(destination);
    } catch {
      fs.renameSync(destination, `${destination}.invalid-${Date.now()}`);
    }
  }
  if (!fs.existsSync(destination)) createBackup(library, destination);
  return destination;
}

module.exports = { createBackup, validateBackup, restoreBackup, dailyBackup };
