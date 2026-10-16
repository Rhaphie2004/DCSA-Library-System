# DCSA Library

Standalone Windows library inventory and circulation. The application works offline, uses a local SQLite database, and keeps the mockup's maroon sidebar and DCSA branding.

## Open the application

Use `dist/DCSA Library Setup 1.0.0.exe` to install, then open **DCSA Library** from the desktop shortcut. The installer bundles the runtime; the library computer does not need Node.js, VS Code, or an internet connection to run it.

For development (Node.js 24.15 or newer):

```powershell
npm ci
npm start
```

Development dependency installation needs internet. Opening the HTML files directly is not a supported way to save official records.

## First launch

1. Create the initial local administrator with a password of at least 12 characters. There is no shared/default password.
2. Enter the approved maximum active loans, loan duration in calendar days, and whether overdue loans block new borrowing. These fields have no preselected policy.
3. In Administration, create individual accounts for other staff. Keep a second authorized administrator for account recovery. Passwords are stored as salted hashes; another administrator can reset an account's password.
4. Confirm the computer date, library policy, and backup routine before entering official records.

This version supports student borrowers, calendar-day loans, manual due dates within the configured duration, and no automatic fines or renewals. Faculty borrowing, school-day calendars, and renewal/payment rules need a separately confirmed workflow.

## Daily workflow

- **Student Management:** register using the school student number. Leading zeros are preserved. LRN, contact, email, course, year, and section are optional. Archive inactive students rather than deleting their history. Students with active loans cannot be archived.
- **Book Management:** add a title, then add each physical copy using its existing unique accession number. The app does not automatically renumber official inventory. Titles without copies remain visible but cannot be borrowed.
- **Borrow & Return:** choose a student, available copy and due date, review the summary, then confirm checkout. The checkout date is the current computer date. Each copy can have only one active loan.
- **Return:** find the active loan and select Process return. Confirm the date and condition. Damaged/lost copies stay unavailable until an administrator updates their status with a reason. Marking lost records the disposition; it does not collect a payment or determine replacement liability.
- **Corrections:** administrators can cancel an incorrect active checkout with a reason. Its record and activity entry remain. Completed returns cannot be silently edited or deleted.
- **Records:** search and filter history, active loans, due-today or overdue lists; use checkout-date filters, CSV export, or Print. Export and print use all matching rows, including rows beyond the displayed page. Historical student/title details are saved on each loan so edits do not rewrite past transactions.
- **End of work:** use Administration > Backup now to save a new external backup, then sign out. Do not give an administrator password to a general staff account.

## Data and recovery

Administration displays the actual application-data directory, daily-backup location and any automatic-backup error. The live database is `library.sqlite` in that data directory, separate from the program installation. Development and installed builds use the DCSA Library app name; do not use development runs against official data without a backup.

- A self-contained daily backup is created on startup/sign-in and checked every minute while the application is running. There is one automatic backup per local calendar date; it is not a backup after every transaction. The first backup of a day may precede that day's work.
- Automatic backups stay on the same computer. Use **Backup now** and choose a new filename on an external drive after significant work. Existing backup files are not silently overwritten.
- Automatic and pre-restore safety backups are retained; monitor available disk space and agree a retention routine before live use.
- **Restore from backup** is admin-only. It checks the file, asks for confirmation, creates a safety backup of current data, restores the selected database, and signs out. Log in using an account/password contained in the restored backup. A safety backup path is shown after success.
- Keep the live database and backups restricted to authorized staff. A local app login does not encrypt SQLite files or replace Windows account/file access controls.
- If startup fails, the application reports the error instead of silently creating replacement records. Preserve the data folder; do not delete the database to clear an error.
- An app update preserves the data directory. Back up before upgrading and never install an older schema-incompatible app over a newer database.

## Existing records and operational trial

The old mockup stored data in a browser profile's `localStorage`; the desktop app cannot assume it can access that profile. It does not automatically import or erase that storage. Export and preserve existing records before migration. The import mapping must be prepared after the actual source format is supplied; do not hand-enter duplicates or assume old outstanding loans migrated.

Before official use, have the librarian trial the app using sample records on the actual library computer. Confirm hardware compatibility, access roles, policies, complete inventory/accession labels, and outstanding loans. Demonstrate external backup and restore. Reconcile official records before cutover; this build alone does not certify operational acceptance.

## Development verification

```powershell
npm test
npm run test:desktop
npm run dist
```

- Unit/integration tests use real temporary SQLite files and synthetic student data, including failure rollback, availability, history, permissions, CSV escaping and backup restoration.
- The desktop check launches the actual Electron UI, performs setup, registration, inventory, checkout and return, and relaunches to verify persistence. It uses a disposable profile, never official library data. A UI screenshot is written under ignored `test-results/`.
- `npm run dist` produces the offline Windows x64 NSIS installer under ignored `dist/`. `node scripts/build-check.js` also checks that the installer was produced.
- The build is unsigned. Windows may ask the user to confirm an unknown publisher. Signing requires the organization's certificate and is not configured in this repository.
- Physical printer output, USB hardware, installation on another computer, library staff acceptance and official-data import remain deployment checks.

See [plan.md](plan.md) for the roadmap and remaining operational decisions.
