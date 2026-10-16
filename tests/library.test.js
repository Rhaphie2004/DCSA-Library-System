const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Library } = require("../app/library");

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dcsa-test-"));
  const file = path.join(dir, "library.sqlite");
  let day = "2026-10-16";
  const lib = new Library(file, { today: () => day });
  t.after(() => {
    lib.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  lib.execute("setup", {
    username: "admin",
    name: "Librarian",
    password: "StrongPassword123!",
    loanDays: 7,
    maxLoans: 2,
    blockOverdue: true,
  });
  lib.execute("saveStudent", {
    studentNo: "0000123",
    fullName: "Ana Cruz",
    grade: "College",
    program: "BSIT",
    section: "A",
  });
  const book = lib.execute("saveBook", {
    code: "BK001",
    title: "Programming",
    author: "A. Author",
  });
  lib.execute("addCopy", { bookId: book.id, accession: "ACC-001" });
  lib.execute("addCopy", { bookId: book.id, accession: "ACC-002" });
  return {
    lib,
    dir,
    file,
    book,
    setDay: (value) => {
      day = value;
    },
  };
}

test("setup is one-time, requires chosen policy and does not expose password hashes", (t) => {
  const { lib } = fixture(t);
  assert.throws(() => lib.execute("setup", {}), /already/i);
  const state = lib.execute("snapshot");
  assert.equal(state.students[0].studentNo, "0000123");
  assert.equal(state.staff[0].passwordHash, undefined);
  assert.equal(state.settings.loanDays, 7);
});

test("logout blocks protected operations and wrong password cannot create a session", (t) => {
  const { lib } = fixture(t);
  lib.execute("logout");
  assert.throws(() => lib.execute("snapshot"), /sign in/i);
  assert.throws(
    () => lib.execute("login", { username: "admin", password: "wrong" }),
    /incorrect/i,
  );
  assert.throws(() => lib.execute("saveStudent", {}), /sign in/i);
  lib.execute("login", { username: "ADMIN", password: "StrongPassword123!" });
  assert.equal(lib.execute("snapshot").students.length, 1);
});

test("duplicate identifiers are rejected without losing leading zeros or existing records", (t) => {
  const { lib } = fixture(t);
  assert.throws(
    () =>
      lib.execute("saveStudent", {
        studentNo: "0000123",
        fullName: "Duplicate",
      }),
    /already|unique/i,
  );
  assert.throws(
    () => lib.execute("addCopy", { bookId: 1, accession: "acc-001" }),
    /already|unique/i,
  );
  assert.equal(lib.execute("snapshot").students.length, 1);
});

test("different physical copies can circulate and one copy cannot be checked out twice", (t) => {
  const { lib } = fixture(t);
  lib.execute("borrow", { studentId: 1, copyId: 1, dueDate: "2026-10-23" });
  assert.throws(
    () =>
      lib.execute("borrow", { studentId: 1, copyId: 1, dueDate: "2026-10-23" }),
    /available/i,
  );
  lib.execute("borrow", { studentId: 1, copyId: 2, dueDate: "2026-10-23" });
  const state = lib.execute("snapshot");
  assert.equal(state.summary.active, 2);
  assert.equal(state.summary.available, 0);
});

test("loan limit and overdue policy are enforced at the data boundary", (t) => {
  const { lib, book, setDay } = fixture(t);
  lib.execute("addCopy", { bookId: book.id, accession: "ACC-003" });
  lib.execute("borrow", { studentId: 1, copyId: 1, dueDate: "2026-10-16" });
  setDay("2026-10-17");
  assert.throws(
    () =>
      lib.execute("borrow", { studentId: 1, copyId: 2, dueDate: "2026-10-24" }),
    /overdue/i,
  );
  lib.execute("saveSettings", {
    loanDays: 7,
    maxLoans: 2,
    blockOverdue: false,
  });
  lib.execute("borrow", { studentId: 1, copyId: 2, dueDate: "2026-10-24" });
  assert.throws(
    () =>
      lib.execute("borrow", { studentId: 1, copyId: 3, dueDate: "2026-10-24" }),
    /limit/i,
  );
});

test("invalid dates and an excessive due date cannot create loans", (t) => {
  const { lib } = fixture(t);
  for (const dueDate of [
    "2026-02-30",
    "2026-10-15",
    "2026-11-30",
    "",
    "not-a-date",
  ]) {
    assert.throws(
      () => lib.execute("borrow", { studentId: 1, copyId: 1, dueDate }),
      /date|duration/i,
    );
  }
  assert.equal(lib.execute("snapshot").loans.length, 0);
});

test("late return preserves the actual date and historical lateness; duplicate return fails", (t) => {
  const { lib, setDay } = fixture(t);
  const loan = lib.execute("borrow", {
    studentId: 1,
    copyId: 1,
    dueDate: "2026-10-20",
  });
  setDay("2026-10-23");
  assert.equal(lib.execute("snapshot").loans[0].overdueDays, 3);
  lib.execute("returnLoan", { id: loan.id, condition: "Good" });
  setDay("2026-10-30");
  const state = lib.execute("snapshot");
  assert.equal(state.loans[0].returnedOn, "2026-10-23");
  assert.equal(state.loans[0].overdueDays, 3);
  assert.equal(state.loans[0].status, "Returned");
  assert.equal(state.summary.available, 2);
  assert.throws(
    () => lib.execute("returnLoan", { id: loan.id, condition: "Good" }),
    /already|active/i,
  );
});

test("damaged and lost returns are unavailable until an audited resolution", (t) => {
  const { lib } = fixture(t);
  const loan = lib.execute("borrow", {
    studentId: 1,
    copyId: 1,
    dueDate: "2026-10-23",
  });
  lib.execute("returnLoan", { id: loan.id, condition: "Damaged" });
  assert.equal(lib.execute("snapshot").summary.available, 1);
  assert.throws(
    () =>
      lib.execute("setCopyStatus", { id: 1, status: "Available", reason: "" }),
    /reason/i,
  );
  lib.execute("setCopyStatus", {
    id: 1,
    status: "Available",
    reason: "Repaired and checked",
  });
  assert.equal(lib.execute("snapshot").summary.available, 2);
});

test("archive and status changes cannot hide active loans", (t) => {
  const { lib } = fixture(t);
  lib.execute("borrow", { studentId: 1, copyId: 1, dueDate: "2026-10-23" });
  assert.throws(
    () =>
      lib.execute("archiveStudent", {
        id: 1,
        active: false,
        reason: "Graduated",
      }),
    /active loan/i,
  );
  assert.throws(
    () =>
      lib.execute("archiveBook", { id: 1, active: false, reason: "Withdrawn" }),
    /active loan/i,
  );
  assert.throws(
    () =>
      lib.execute("setCopyStatus", {
        id: 1,
        status: "Withdrawn",
        reason: "Old",
      }),
    /active loan/i,
  );
});

test("reasoned loan cancellation releases the copy and keeps the audit and record", (t) => {
  const { lib } = fixture(t);
  const loan = lib.execute("borrow", {
    studentId: 1,
    copyId: 1,
    dueDate: "2026-10-23",
  });
  assert.throws(
    () => lib.execute("cancelLoan", { id: loan.id, reason: "" }),
    /reason/i,
  );
  lib.execute("cancelLoan", { id: loan.id, reason: "Wrong borrower selected" });
  const state = lib.execute("snapshot");
  assert.equal(state.loans.length, 1);
  assert.equal(state.loans[0].status, "Cancelled");
  assert.equal(state.summary.available, 2);
  assert.ok(
    state.audit.some(
      (row) =>
        row.action === "cancelLoan" && row.details.includes("Wrong borrower"),
    ),
  );
});

test("staff cannot change policies, create accounts or cancel loans", (t) => {
  const { lib } = fixture(t);
  lib.execute("saveStaff", {
    username: "staff",
    name: "Assistant",
    password: "OtherPassword123!",
    role: "staff",
  });
  lib.execute("logout");
  lib.execute("login", { username: "staff", password: "OtherPassword123!" });
  assert.throws(() => lib.execute("saveSettings", {}), /admin/i);
  assert.throws(() => lib.execute("saveStaff", {}), /admin/i);
  assert.throws(
    () => lib.execute("cancelLoan", { id: 1, reason: "test" }),
    /admin/i,
  );
  assert.equal(lib.execute("snapshot").staff.length, 0);
});

test("last admin cannot be disabled; password change requires the current password", (t) => {
  const { lib } = fixture(t);
  assert.throws(
    () => lib.execute("setStaffActive", { id: 1, active: false }),
    /own|admin/i,
  );
  assert.throws(
    () =>
      lib.execute("changePassword", {
        currentPassword: "wrong",
        password: "NewPassword123!",
      }),
    /incorrect/i,
  );
  lib.execute("changePassword", {
    currentPassword: "StrongPassword123!",
    password: "NewPassword123!",
  });
  lib.execute("logout");
  lib.execute("login", { username: "admin", password: "NewPassword123!" });
});

test("database restart preserves records and never authenticates a previous session", (t) => {
  const { lib, file } = fixture(t);
  lib.execute("borrow", { studentId: 1, copyId: 1, dueDate: "2026-10-23" });
  lib.close();
  const reopened = new Library(file);
  try {
    assert.throws(() => reopened.execute("snapshot"), /sign in/i);
    reopened.execute("login", {
      username: "admin",
      password: "StrongPassword123!",
    });
    assert.equal(reopened.execute("snapshot").summary.active, 1);
  } finally {
    reopened.close();
  }
});

test("database error rolls back loan and audit changes together", (t) => {
  const { lib } = fixture(t);
  lib.db.exec(
    "CREATE TEMP TRIGGER fail_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT, 'disk failure simulation'); END;",
  );
  assert.throws(
    () =>
      lib.execute("borrow", { studentId: 1, copyId: 1, dueDate: "2026-10-23" }),
    /disk failure/i,
  );
  lib.db.exec("DROP TRIGGER fail_audit");
  assert.equal(lib.execute("snapshot").loans.length, 0);
  assert.equal(lib.execute("snapshot").summary.available, 2);
});

test("consistent backup can restore complete records and rejects corrupt input safely", (t) => {
  const { lib, dir } = fixture(t);
  const backup = path.join(dir, "backup.sqlite");
  lib.backup(backup);
  lib.execute("saveStudent", { studentNo: "new", fullName: "New Student" });
  const bad = path.join(dir, "bad.sqlite");
  fs.writeFileSync(bad, "not sqlite");
  assert.throws(() => lib.restore(bad), /backup|database|file/i);
  assert.equal(lib.execute("snapshot").students.length, 2);
  const result = lib.restore(backup);
  assert.ok(fs.existsSync(result.safetyBackup));
  assert.throws(() => lib.execute("snapshot"), /sign in/i);
  lib.execute("login", { username: "admin", password: "StrongPassword123!" });
  assert.equal(lib.execute("snapshot").students.length, 1);
});

test("daily backup creates only one backup per date and retries after destination failure", (t) => {
  const { lib, dir } = fixture(t);
  const blocked = path.join(dir, "blocked");
  fs.writeFileSync(blocked, "file");
  assert.throws(() => lib.dailyBackup(blocked));
  const folder = path.join(dir, "daily");
  lib.dailyBackup(folder);
  lib.dailyBackup(folder);
  assert.equal(fs.readdirSync(folder).length, 1);
});

test("daily backup replaces an incomplete automatic file instead of accepting it as success", (t) => {
  const { lib, dir } = fixture(t);
  const folder = path.join(dir, "daily");
  fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, "dcsa-2026-10-16.sqlite"), "incomplete");
  const backup = lib.dailyBackup(folder);
  assert.ok(fs.statSync(backup).size > 1000);
  const result = lib.restore(backup);
  assert.ok(fs.existsSync(result.safetyBackup));
});

test("restore rejects a same-version backup with missing account columns before replacing usable data", (t) => {
  const { lib, dir } = fixture(t);
  const file = path.join(dir, "broken-schema.sqlite");
  lib.backup(file);
  const { DatabaseSync } = require("node:sqlite");
  const modified = new DatabaseSync(file);
  modified.exec(
    "ALTER TABLE staff RENAME COLUMN passwordHash TO brokenPasswordHash",
  );
  modified.close();
  assert.throws(() => lib.restore(file), /schema|backup/i);
  assert.equal(lib.execute("snapshot").students.length, 1);
  lib.execute("logout");
  lib.execute("login", { username: "admin", password: "StrongPassword123!" });
});

test("restore rejects invalid loan dates and missing active-loan uniqueness protection", (t) => {
  const { lib, dir } = fixture(t);
  lib.execute("borrow", { studentId: 1, copyId: 1, dueDate: "2026-10-23" });
  const { DatabaseSync } = require("node:sqlite");
  for (const [name, sql] of [
    ["date", "UPDATE loans SET dueDate='not-a-date'"],
    ["index", "DROP INDEX one_active_loan_per_copy"],
  ]) {
    const file = path.join(dir, `${name}.sqlite`);
    lib.backup(file);
    const db = new DatabaseSync(file);
    db.exec(sql);
    db.close();
    assert.throws(() => lib.restore(file), /backup|date|schema/i);
    assert.equal(lib.execute("snapshot").summary.active, 1);
  }
});
