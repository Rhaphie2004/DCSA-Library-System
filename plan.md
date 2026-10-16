# DCSA Library System Implementation Plan

> Para sa implementation: gamitin ang `executing-plans` skill para sundan ang tasks at checks. Ang dokumentong ito ay planning baseline; hindi ito instruction na magsimula agad ng application implementation. Kumpirmahin muna ang pending decisions at humingi ng malinaw na instruction na mag-build. Walang automatic delegation, installation, commit, o deployment.

**Date:** October 16, 2026 (Asia/Manila)

**Goal:** Gawing maaasahang standalone library application ang existing mockup para sa actual daily operations sa isang computer, usable kahit walang internet.

**Architecture:** Panatilihin ang existing HTML, CSS, at vanilla JavaScript UI hangga't praktikal. Ang screens ay tatawag lamang ng limitadong application operations; ang validation, borrowing rules, at database access ay nasa application process. SQLite ang permanent local storage, hiwalay sa installed application files.

**Proposed tech stack:** Electron, HTML, CSS, JavaScript, at SQLite. Piliin at i-verify ang compatible supported versions, SQLite integration, at packaging tool bago mag-install; hindi pa napipili ang specific database package.

**Spec source:** Ang napag-usapang flow, findings, at scope sa kasalukuyang chat, na pinagsama sa dokumentong ito. Walang hiwalay na spec file na ginawa.

## 1. Confirmed scope at constraints

- Actual daily library operations ang paggagamitan, hindi demonstration lang.
- Isang computer lang ang deployment; offline ang buong core workflow.
- Windows ang working assumption; kumpirmahin ang target version at hardware.
- Existing mockup ang design baseline; walang unnecessary frontend rewrite.
- Unahin ang correct inventory, borrowing/return transactions, history, at recovery.
- Local staff accounts ang proposed access model; kumpirmahin ang bilang ng operators.
- Ang database ay nasa writable application-data folder, hiwalay sa installer at program files.
- Application updates must preserve records; backup bago database changes.
- Walang cloud service, remote database, online account, o internet dependency para sa core use.
- Original stage: `plan.md` lang ang authorized na bagong file. The user subsequently instructed "start building"; application implementation is now authorized. Operational cutover still requires librarian acceptance.

## 2. Deferred features

Hindi kasama sa unang release:

- Reservations.
- SMS at email reminders.
- Online student portal.
- Advanced analytics.

Automatic fines are pending an approved library policy and payment workflow; hindi mag-iimbento ng amounts o computation ang implementation.

## 3. Existing project at findings

Ang repository ay may limang HTML pages, apat na CSS files, tatlong JavaScript files, at image assets. May basic code para sa student/book management, student lookup, borrowing, mark-returned, at overdue calculation. Browser `localStorage` pa lang ang storage; wala pang desktop setup, database, installer, o automated test setup.

| Area              | Finding                                                                                                       | Required action                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Student listing   | `JS/students.js` expects `studentTableBody` at `studentCount`; hindi ito tugma sa `HTML/students.html`.       | Ayusin ang element IDs, count, at listing.                     |
| Borrowing listing | `JS/borrows.js` expects `borrowTableBody` at `borrowCount`; wala ang expected elements sa `HTML/borrow.html`. | Ayusin ang element IDs at count.                               |
| Dashboard         | Static `0` ang counts sa `HTML/homepage.html`.                                                                | Kunin ang actual totals mula sa database.                      |
| Navigation        | May links sa non-existent `borrows.html`, `return.html`, at `records.html`.                                   | Itugma sa final screens; normalize filename casing.            |
| Records screen    | `HTML/library records.html` ay placeholder na katulad ng dashboard.                                           | Gawing actual searchable loan history.                         |
| Availability      | May book quantity, pero isang active loan lang bawat Book ID ang pinapayagan.                                 | Iugnay ang loans sa available physical copies.                 |
| Return history    | Walang actual return date; nire-reset sa zero ang overdue days.                                               | Store return date at panatilihin ang historical lateness.      |
| Checkout form     | Puwedeng piliin ang `Returned` sa bagong checkout.                                                            | New checkout starts as borrowed; hiwalay ang return operation. |
| Deletion          | Walang protection sa student/book records na may active loans o history.                                      | Archive at database relationship protection.                   |
| Asset loading     | Root-based `/CSS`, `/JS`, at image paths assume a web-server root.                                            | Ayusin para sa packaged offline application.                   |
| Identifiers       | Required ang 12-digit LRN kahit college student.                                                              | Kumpirmahin ang school ID/LRN policy.                          |
| Validation        | Required sa JavaScript ang publication date; quantity is limited to 1–100 without an agreed rule.             | Itugma sa approved data requirements.                          |
| Academic options  | Hardcoded ang courses, strands, at sections.                                                                  | Kumpirmahin ang official values at maintenance procedure.      |

Ang findings ay mula sa source inspection at static element/link checks. Hindi pa pinaandar ang UI o na-test sa target computer.

## 4. Decisions bago implementation

Walang assumed borrowing policy. Kailangan ng sagot sa mga sumusunod bago i-implement ang affected workflow:

- [ ] Target Windows version, RAM, display resolution, at available storage.
- [ ] May existing accession number ba bawat physical copy? Kung wala, anong numbering at labeling ang gagamitin?
- [ ] Student number ba ang primary identifier, at kailan kailangan ang LRN?
- [ ] Students lang ba ang borrowers, o kasama ang faculty/staff?
- [ ] Maximum active loans at loan duration, kasama ang anumang borrower-type differences.
- [ ] Calendar days o school days ba ang due dates; may weekend/holiday adjustment o grace period ba?
- [ ] Harang ba ang new borrowing kapag may overdue? May authorized override ba?
- [ ] Kasama ba ang renewal sa first release? Kung oo, ano ang limit at conditions?
- [ ] Lost/damaged copy handling, replacement, at anumang approved fines/payment procedure.
- [ ] Required student fields, official courses/strands/sections, at school-year transition procedure.
- [ ] Bilang ng staff users, admin privileges, at local account recovery procedure.
- [ ] Existing student, inventory, at outstanding-loan records: source, format, volume, at quality.
- [ ] Required report columns, printing needs, at kung kailangan ang barcode scanner sa first release.
- [ ] Backup destination, retention, responsible staff, at external-copy routine.

## 5. Proposed operating flow

`Open app -> Local staff login -> Dashboard -> Students / Inventory / Borrow & Return / Records / Administration`

### Students

Register/search/edit ang student; validate unique school identifier. Gamitin ang active/inactive status at archive para mapanatili ang borrowing history. Kumpirmahin muna ang required personal details.

### Books at physical copies

Recommended ang paghihiwalay ng title at copy:

- **Book title:** title, author, edition, publication year kung available, at shelf location.
- **Physical copy:** unique accession number, linked title, condition, at circulation/disposition status.

Example: tatlong copies ng parehong title ay may `ACC-0001`, `ACC-0002`, at `ACC-0003`. Gamitin ang existing accession numbers kung mayroon; huwag awtomatikong palitan ang official identifiers.

Derived ang total at available counts. Ang active loan ang authoritative source kung borrowed ang copy; huwag mag-maintain ng hiwalay na manual borrowed counter na puwedeng hindi tumugma sa loans. Lost, damaged, at withdrawn availability must follow the agreed policy.

### Borrow & Return

Dalawang malinaw na tabs sa isang module:

- **Borrow:** search registered borrower -> validate eligibility -> select available copy -> apply due-date policy -> confirm checkout.
- **Return:** search borrower/accession number -> select active loan -> record actual return date and condition -> confirm return.

Isang loan record bawat physical copy na hiniram. Ang availability checks at save ay nasa isang database transaction, kasama ang constraint na pumipigil sa dalawang active loans para sa parehong copy. Disabled buttons are helpful feedback but not a substitute for database protection.

Overdue is computed from due date and the current local date for active loans; returned-loan lateness uses the actual return date. Hindi binubura ang historical lateness pag naibalik ang libro.

### Records at dashboard

- Dashboard: registered titles, total copies, available copies, active loans, due today, at overdue.
- Clickable counts lead to matching filtered lists.
- Search/filter: active, returned, overdue, date range, borrower, at title/accession number.
- Initial reports: active loans, overdue list, borrower history, at inventory; print at CSV export.
- Completed transactions are preserved. Corrections/cancellations record reason, staff account, and timestamp.

### Access at recovery

- Local staff login; password hashes, hindi plaintext passwords.
- Admin controls staff accounts, library rules, at restore; exact permissions await confirmation.
- Automatic daily backup habang ginagamit ang app, manual `Backup Now`, at visible backup result/failure.
- Export backup sa USB o ibang storage; huwag umasa sa parehong drive lang.
- Consistent SQLite backup procedure; huwag basta copy ng live database na puwedeng may pending journal/WAL data.
- Restore requires validation, a safety backup of current data, and exclusive database access.

## 6. Proposed implementation reach

Ito ang file-responsibility map. Implementation was authorized after this plan was saved; final runtime/UI paths and evidence are recorded below.

| Files                                                        | Responsibility                                                                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Existing `HTML/*.html`, `CSS/*.css`, at `JS/*.js`            | Preserve the UI baseline; fix IDs, links, loading, forms, and module behavior. Replace `localStorage` as the authoritative record store. |
| `package.json`, dependency lockfile, packaging configuration | Desktop launch, verification commands, pinned dependencies, at installer build.                                                          |
| `app/main.js`                                                | App lifecycle, local window, single-instance handling, at allowed operation handlers.                                                    |
| `app/preload.js`                                             | Limited bridge from UI to specific application operations; no arbitrary filesystem, SQL, or IPC access from screens.                     |
| `app/database.js`                                            | SQLite connection, schema/version upgrades, constraints, at transactions.                                                                |
| `app/library.js`                                             | Student/inventory operations, borrowing/return rules, summaries, at reports. Split only if responsibilities become unwieldy.             |
| `app/auth.js`                                                | Local authentication at permission enforcement.                                                                                          |
| `app/backup.js`                                              | Consistent backups, validation, at restore.                                                                                              |
| Additional local HTML/JS screens as needed                   | Login, administration/settings, at reporting behavior missing from the mockup.                                                           |
| `tests/*.test.js` at synthetic fixtures                      | Meaningful checks for rules, transactions, recovery, at permissions; no real student data in fixtures.                                   |

Do not add React, a web API server, an ORM, or another abstraction without a concrete need. Final operation names and schema details will be pinned after the decisions in Section 4, before coding the affected module.

## 7. Build sequence at acceptance gates

### Phase 1: Requirements and design

- [ ] Resolve the decisions required for each first-release workflow.
- [ ] Confirm the title/copy model, screen flow, permissions, report requirements, at backup procedure.
- [x] Review this plan with the user; get an explicit instruction to start implementation.

**Gate:** Walang invented library rules o unresolved decision na humaharang sa task na sisimulan.

### Phase 2: Desktop foundation and persistence

- [x] Verify target compatibility; choose the minimal SQLite integration and packaging tooling.
- [x] Set up local Electron loading with isolated UI and a limited preload bridge.
- [x] Create database schema/version handling in a writable application-data location; enable relationship constraints.
- [x] Reject invalid input at application boundaries; show useful save/startup errors.
- [x] Verify database initialization, restart persistence, single-instance behavior, and safe failure when storage is unavailable.

**Gate:** App opens offline and saved records survive closing/reopening; startup and database errors do not silently reset existing records.

### Phase 3: Students and inventory

- [x] Fix broken elements/navigation and align validation with agreed requirements.
- [x] Connect student/title/copy create, search, edit, at archive to SQLite.
- [x] Preserve official identifiers as text, including leading zeros.
- [x] Prevent duplicate identifiers and unsafe archive/delete actions.
- [x] Verify availability counts and history preservation after edits.

**Gate:** Unique records, correct copy counts, and intact relationships. A copy with an active loan cannot disappear through inventory actions.

### Phase 4: Borrow and return

- [x] Write failing checks for eligibility, copy availability, due-date rules, duplicate checkout, duplicate return, at late-return history.
- [x] Implement the minimum transaction logic and run the checks until they pass.
- [x] Connect the Borrow and Return tabs with clear confirmation and error feedback.
- [x] Verify repeated clicks, stale selections, invalid IDs/dates, and simulated failure during a save.
- [x] Cover lost/damaged dispositions and renewal only according to the approved first-release policy.

**Gate:** Loan records and available inventory always agree; failed operations leave no partial changes; a second return does not increase availability again.

### Phase 5: Dashboard, records, and reports

- [x] Replace static dashboard values with database queries and matching filters.
- [x] Complete the records screen and borrower/copy history.
- [x] Add agreed print and CSV reports, with proper CSV escaping and protection against spreadsheet formula interpretation.
- [x] Verify totals against known sample loans and copies, including no-record and no-match cases.
- [x] Verify local-date behavior across due-date boundaries and app refresh/reopen.

**Gate:** Dashboard, lists, printouts, and exports reconcile and use the same status/date rules.

### Phase 6: Staff access, accountability, and recovery

- [x] Implement staff login, logout, password handling, and permissions; require it before operational trial.
- [x] Record the responsible staff account for transactions and reasoned corrections.
- [x] Implement daily/manual backup and external export with visible results.
- [x] Implement validated restore with a safety backup before replacement.
- [ ] Test unauthorized operations, wrong passwords, unavailable/full backup destinations, corrupt/incompatible backups, and a successful full restoration.

**Gate:** Protected operations are enforced in application logic. Restored data is complete and reconciles with the source backup; a rejected restore preserves current data.

### Phase 7: Packaging, operational trial, and cutover

- [x] Build the installer and desktop shortcut; verify all required assets/runtime dependencies are included for offline use.
- [ ] Run the complete workflow on the actual library computer without internet or development tools.
- [ ] Verify install/update preserves the application database.
- [ ] Trial with the librarian using synthetic records; resolve blocking findings.
- [ ] Inspect, map, validate, and deduplicate existing official records before import. Keep an untouched source backup and review rejects instead of silently dropping rows.
- [ ] Reconcile student/title/copy totals and outstanding loans with the librarian before official cutover.
- [ ] Provide a short operating and recovery guide during implementation; confirm staff can perform backup and restore.

**Gate:** Librarian can independently complete daily operations and recovery; official opening inventory and outstanding loans are reconciled.

## 8. Review focus

| Failure mode                                          | Owning phase and required evidence                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Repeated checkout/return or stale UI state            | Phase 4: transaction/constraint tests show no duplicate active loan or double return effect.                                    |
| Crash or write failure during transaction             | Phases 2 and 4: simulated failure rolls back; reopen preserves consistent committed records.                                    |
| Changed student/book details or identifier collisions | Phase 3: leading-zero/duplicate tests and archive/edit checks preserve links and loan history.                                  |
| Incorrect dates or historical overdue values          | Phases 4 and 5: due-date boundary and returned-late checks preserve correct history; PC clock dependence is explained to staff. |
| Corrupt backup or interrupted restore/update          | Phases 6 and 7: rejected restore leaves current data intact; successful restore reconciles; installer update preserves data.    |

## 9. Skills and development discipline

| Skill                            | Purpose                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `brainstorming`                  | Clarify intent, rules, and design before implementation.                                |
| `ponytail` (full)                | Smallest complete solution; reuse existing patterns and avoid unnecessary dependencies. |
| `writing-plans`                  | Maintain concrete task order, implementation reach, and acceptance checks.              |
| `executing-plans`                | Implement approved phases in sequence when explicitly instructed.                       |
| `frontend-design`                | Improve usability/accessibility while preserving the mockup baseline.                   |
| `test-driven-development`        | Pin important business rules and failure cases before non-trivial implementation.       |
| `systematic-debugging`           | Trace failures to their root cause.                                                     |
| `verification-before-completion` | Require fresh evidence before claiming a workflow or build is complete.                 |
| `ponytail-review`                | Review correctness, data safety, connected callers, and unnecessary code.               |

For each implemented task: read affected callers and fixtures, write meaningful checks for non-trivial logic, observe the expected failure, implement minimally, rerun the checks, and review the diff. Trivial copy/style changes need no artificial tests. Browser/UI checks supplement business-rule checks; the packaged desktop app must also be tested on the target machine.

## 10. Completion definition

- [ ] Complete core workflow works offline: login -> student/inventory lookup -> borrow -> return -> history/report.
- [ ] Records persist after restart and application updates.
- [ ] Unavailable copies cannot be checked out; repeated actions do not corrupt inventory.
- [ ] Due dates and historical lateness follow the approved policy.
- [ ] Staff permissions and correction history are enforced.
- [ ] Backups work, external copies are operationally assigned, and restore has been demonstrated.
- [ ] Dashboard, reports, inventory, and outstanding loans reconcile.
- [ ] Installer and librarian trial pass on the actual target computer.
- [ ] Existing official records are validated before cutover.

## 11. Build progress — October 16, 2026

- Implemented on `codex/standalone-library` in the requested folder; no commit, push, or deployment to official records.
- Electron 44.8.0 and its bundled Node SQLite provide the offline runtime and database; no external SQLite service or runtime database dependency.
- The vanilla UI uses `HTML/homepage.html`, `CSS/LS.css`, and `JS/app.js`; previous page URLs redirect to the matching view. Unused old browser-storage scripts and duplicate styles were removed to avoid maintaining two record systems.
- Implemented first-run admin/policy setup, individual staff accounts, student records, titles/copies, borrow/return, reasoned archive/status/cancellation operations, dashboard, filtered history, CSV/printing, audit history, daily/manual backup, and validated restore with a safety copy.
- No lending limits/duration are invented: first-run setup requires those choices. The implemented baseline uses calendar days and student borrowers. Automatic fines and renewals remain excluded until policy is agreed.
- Existing records are not silently imported or erased. Import mapping awaits the actual source data; hardware, policy, official inventory reconciliation and librarian acceptance remain manual deployment gates.
- `README.md` contains operating, backup/recovery, setup and verification instructions. `GATES.md` tracks automated verification and the operational handoff separately.
- Final verification: 21/21 Node checks passed. Actual Electron UI checks passed for setup, login, registration, checkout/return, restart persistence, history after student-number edits, copy pagination beyond 25 rows, filtered print scope, and dashboard active filters. Independent review findings were fixed with regression checks.
- Windows x64 installer produced at `dist/DCSA Library Setup 1.0.0.exe`. The three automated gates in `GATES.md` passed; the one manual operational-acceptance gate remains pending, with no abandoned gates. No official records were imported and the installer was not deployed to the library computer.

**Current status:** Working application and Windows installer built; automated checks and independent code review fixes verified. Ready for a librarian trial, not yet accepted for official operational cutover. Remaining operational decisions are listed in Section 4 and must be confirmed before live use.
