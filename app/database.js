const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");

const APP_ID = 1145262913;
const SCHEMA_VERSION = 1;

function openDatabase(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename, { timeout: 5000 });
  try {
    db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF; PRAGMA synchronous=FULL;",
    );
    const version = db.prepare("PRAGMA user_version").get().user_version;
    const id = db.prepare("PRAGMA application_id").get().application_id;
    if (version !== 0 && (version !== SCHEMA_VERSION || id !== APP_ID))
      throw new Error(
        "Unsupported library database version. Keep a backup and use the matching app version.",
      );
    if (version === 0) {
      if (
        db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
          )
          .get()
      )
        throw new Error("This file is not an empty DCSA library database.");
      db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE staff (
          id INTEGER PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE, name TEXT NOT NULL,
          passwordHash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','staff')),
          active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
        ) STRICT;
        CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id=1), loanDays INTEGER NOT NULL CHECK(loanDays BETWEEN 1 AND 365), maxLoans INTEGER NOT NULL CHECK(maxLoans BETWEEN 1 AND 100), blockOverdue INTEGER NOT NULL CHECK(blockOverdue IN (0,1))) STRICT;
        CREATE TABLE students (
          id INTEGER PRIMARY KEY, studentNo TEXT NOT NULL COLLATE NOCASE UNIQUE, lrn TEXT NOT NULL DEFAULT '', fullName TEXT NOT NULL,
          contact TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', grade TEXT NOT NULL DEFAULT '', program TEXT NOT NULL DEFAULT '',
          yearLevel TEXT NOT NULL DEFAULT '', section TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
        ) STRICT;
        CREATE TABLE books (
          id INTEGER PRIMARY KEY, code TEXT NOT NULL COLLATE NOCASE UNIQUE, title TEXT NOT NULL, author TEXT NOT NULL,
          edition TEXT NOT NULL DEFAULT '', year TEXT NOT NULL DEFAULT '', shelf TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
        ) STRICT;
        CREATE TABLE copies (
          id INTEGER PRIMARY KEY, bookId INTEGER NOT NULL REFERENCES books(id), accession TEXT NOT NULL COLLATE NOCASE UNIQUE,
          disposition TEXT NOT NULL DEFAULT 'Available' CHECK(disposition IN ('Available','Damaged','Lost','Withdrawn'))
        ) STRICT;
        CREATE TABLE loans (
          id INTEGER PRIMARY KEY, studentId INTEGER NOT NULL REFERENCES students(id), copyId INTEGER NOT NULL REFERENCES copies(id),
          studentNo TEXT NOT NULL, borrowerName TEXT NOT NULL, bookTitle TEXT NOT NULL, accession TEXT NOT NULL,
          checkoutOn TEXT NOT NULL, dueDate TEXT NOT NULL CHECK(dueDate>=checkoutOn), returnedOn TEXT,
          condition TEXT, cancelledOn TEXT, cancelReason TEXT,
          createdBy INTEGER NOT NULL REFERENCES staff(id), returnedBy INTEGER REFERENCES staff(id), cancelledBy INTEGER REFERENCES staff(id)
        ) STRICT;
        CREATE UNIQUE INDEX one_active_loan_per_copy ON loans(copyId) WHERE returnedOn IS NULL AND cancelledOn IS NULL;
        CREATE INDEX loans_student ON loans(studentId);
        CREATE INDEX copies_book ON copies(bookId);
        CREATE TABLE audit (id INTEGER PRIMARY KEY, at TEXT NOT NULL, staffId INTEGER REFERENCES staff(id), action TEXT NOT NULL, details TEXT NOT NULL) STRICT;
        PRAGMA application_id=${APP_ID}; PRAGMA user_version=${SCHEMA_VERSION};
      COMMIT;`);
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

function transaction(db, operation) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

module.exports = { openDatabase, transaction, APP_ID, SCHEMA_VERSION };
