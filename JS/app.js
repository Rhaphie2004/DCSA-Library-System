"use strict";

const root = document.getElementById("app");
const dialog = document.getElementById("actionDialog");
let state,
  view = location.hash.slice(1) || "dashboard",
  tab = "borrow",
  page = 1,
  editing = null,
  noticeTimer,
  busy = false;
let query = "",
  filter = "all",
  fromDate = "",
  toDate = "",
  historyStudentId = null,
  historyCopyId = null,
  printAll = false;
const views = {
  dashboard: "Dashboard",
  students: "Student Management",
  books: "Book Management",
  borrow: "Borrow & Return",
  records: "Library Records",
  settings: "Administration",
};
const h = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const admin = () => state?.user.role === "admin";
const badge = (value) =>
  `<span class="badge ${["Available", "Returned", "Active", "Good"].includes(value) ? "good" : ["Overdue", "Lost", "Damaged"].includes(value) ? "bad" : value === "Borrowed" ? "out" : ""}">${h(value)}</span>`;
const button = (label, action, id, extra = "") =>
  `<button type="button" class="small secondary" data-action="${action}" data-id="${id}" ${extra}>${h(label)}</button>`;
function input(label, name, value = "", options = "") {
  return `<label>${label}<input name="${name}" value="${h(value)}" ${options}></label>`;
}
function select(label, name, options, value = "", extra = "") {
  return `<label>${label}<select name="${name}" ${extra}>${options.map(([key, label]) => `<option value="${h(key)}" ${String(key) === String(value) ? "selected" : ""}>${h(label)}</option>`).join("")}</select></label>`;
}
const errors = () => '<p class="error-message" role="alert"></p>';
function formActions(label, reset = true) {
  return `<div class="form-actions"><button type="submit">${label}</button>${reset ? '<button type="button" class="secondary" data-action="clear">Clear / cancel edit</button>' : ""}</div>${errors()}`;
}
function notice(message, error = false) {
  const box = document.getElementById("notice");
  box.textContent = message;
  box.classList.toggle("error", error);
  box.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(
    () => {
      box.hidden = true;
    },
    error ? 15000 : 7000,
  );
}
async function api(action, data = {}) {
  if (!window.library)
    throw new Error(
      "Open DCSA Library from its desktop shortcut. This page needs the desktop application.",
    );
  const response = await window.library.call(action, data);
  if (!response.ok) throw new Error(response.error);
  return response.data;
}
async function refresh() {
  state = await api("snapshot");
  render();
}
function resetView(next) {
  view = views[next] ? next : "dashboard";
  page = 1;
  query = "";
  filter = "all";
  fromDate = "";
  toDate = "";
  historyStudentId = null;
  historyCopyId = null;
  editing = null;
  location.hash = view;
  render();
}
function policyFields(settings = {}) {
  return `${input("Loan duration (calendar days) *", "loanDays", settings.loanDays ?? "", 'type="number" required min="1" max="365"')}${input("Maximum active loans per student *", "maxLoans", settings.maxLoans ?? "", 'type="number" required min="1" max="100"')}${select(
    "Block new borrowing when overdue? *",
    "blockOverdue",
    [
      ["", "Choose library policy"],
      ["true", "Yes — return overdue books first"],
      ["false", "No — allow within borrowing limit"],
    ],
    settings.blockOverdue === undefined ? "" : String(settings.blockOverdue),
    "required",
  )}`;
}
function showAuth(needsSetup) {
  state = null;
  root.innerHTML = `<main class="auth"><div class="brand"><img src="../dcsa.png" alt="DCSA logo"><h1>DCSA Library</h1><p>Datamex College of Saint Adeline</p></div><section class="panel"><h2>${needsSetup ? "Set up your library" : "Staff sign in"}</h2><p>${needsSetup ? "Create the first administrator and enter your approved lending policy. Everything stays on this computer." : "Sign in with your local staff account."}</p><form id="${needsSetup ? "setupForm" : "loginForm"}"><div class="form-grid">${needsSetup ? input("Administrator name *", "name", "", 'required maxlength="200" autocomplete="name"') : ""}${input("Username *", "username", "", 'required maxlength="60" autocomplete="username"')}<label class="password">Password *<input name="password" type="password" required ${needsSetup ? 'minlength="12" maxlength="256" autocomplete="new-password"' : 'maxlength="256" autocomplete="current-password"'}>${needsSetup ? "<small>At least 12 characters. Keep this password securely; there is no online reset.</small>" : ""}</label>${needsSetup ? policyFields() : ""}</div>${needsSetup ? '<div class="warning">Use calendar days for this version. No automatic fines or renewals are applied. Confirm these rules with the librarian before live use.</div>' : ""}${formActions(needsSetup ? "Create library" : "Sign in", false)}</form></section><p class="subtle">Offline library management · Your records stay on this computer.</p></main>`;
  root.querySelector("input")?.focus();
}
function heading(description) {
  return `<header class="page-heading"><div><h1>${views[view]}</h1><p class="subtle">${description}</p></div><span class="pill">Offline · ${h(state.today)}</span></header><p class="print-heading">DCSA Library · ${h(state.today)}</p>`;
}
function render() {
  if (!state) return;
  if (!views[view]) view = "dashboard";
  if (view === "settings" && !admin()) view = "dashboard";
  root.innerHTML = `<aside class="sidebar"><img src="../dcsa.png" alt="DCSA logo"><h2>DATAMEX COLLEGE OF SAINT ADELINE<br>LIBRARY SYSTEM</h2><nav aria-label="Library modules">${Object.entries(
    views,
  )
    .filter(([key]) => key !== "settings" || admin())
    .map(
      ([key, label]) =>
        `<button type="button" data-view="${key}" class="${view === key ? "active" : ""}" ${view === key ? 'aria-current="page"' : ""}>${label}</button>`,
    )
    .join(
      "",
    )}</nav><footer><strong>${h(state.user.name)}</strong><br>${h(state.user.role === "admin" ? "Administrator" : "Library staff")}<br><button type="button" data-action="password">Change password</button><button type="button" data-action="logout">Sign out</button></footer></aside><main class="main"><div id="view"></div></main>`;
  const content = document.getElementById("view");
  content.innerHTML = {
    dashboard: dashboardView,
    students: studentsView,
    books: booksView,
    borrow: borrowView,
    records: recordsView,
    settings: settingsView,
  }[view]();
  drawTables();
}
function dashboardView() {
  const cards = [
    ["students", "Active students", "students", "active"],
    ["titles", "Active book titles", "books", "activeTitles"],
    ["copies", "Physical copies", "books", "all"],
    ["available", "Available copies", "books", "Available"],
    ["active", "Active loans", "records", "active"],
    ["dueToday", "Due today", "records", "today"],
    ["overdue", "Overdue loans", "records", "Overdue"],
  ];
  return `${heading("Today’s inventory and circulation at a glance.")}<div class="cards">${cards.map(([key, label, target, status]) => `<button type="button" class="card" data-view="${target}" data-filter="${status}">${label}<strong data-summary="${key}">${state.summary[key]}</strong><span>View records</span></button>`).join("")}</div>${state.backup?.error ? `<div class="warning" role="alert">${h(state.backup.error)}</div>` : ""}<section class="panel"><h2>Library desk</h2><p>Register students and physical copies before checking out a book. Each physical copy needs its own accession number.</p><div class="form-actions"><button type="button" data-view="borrow">Borrow or return a book</button><button type="button" class="secondary" data-view="records" data-filter="Overdue">View overdue loans</button></div></section><section class="panel"><h2>Current lending policy</h2><p>Up to <strong>${state.settings.maxLoans} copies</strong> per student, for <strong>${state.settings.loanDays} calendar days</strong>. ${state.settings.blockOverdue ? "Overdue loans block new borrowing." : "Overdue loans do not block new borrowing within the limit."} No automatic fines.</p><p class="subtle">Daily backup: ${state.backup?.path ? h(state.backup.path) : "No backup recorded yet."} Keep an external backup as well.</p></section>`;
}
function studentsView() {
  const s = editing
    ? state.students.find((row) => row.id === editing) || {}
    : {};
  return `${heading("Register students, update details, and preserve borrowing history.")}<section class="panel form-panel"><h2>${s.id ? "Edit student" : "Register new student"}</h2><form id="studentForm" data-id="${s.id || ""}"><div class="form-grid three">${input("Student number *", "studentNo", s.studentNo, 'required maxlength="60"')}${input("Full name *", "fullName", s.fullName, 'required maxlength="200"')}${input("LRN (optional)", "lrn", s.lrn, 'inputmode="numeric" pattern="[0-9]{12}" maxlength="12"')}${input("Contact number", "contact", s.contact, 'type="tel" maxlength="60"')}${input("Email address", "email", s.email, 'type="email" maxlength="200"')}${select(
    "Grade / level",
    "grade",
    [
      ["", "Choose level"],
      ["Grade 11", "Grade 11"],
      ["Grade 12", "Grade 12"],
      ["College", "College"],
    ],
    s.grade,
  )}${input("Strand / course", "program", s.program, 'maxlength="200"')}${input("College year level", "yearLevel", s.yearLevel, 'maxlength="200"')}${input("Section", "section", s.section, 'maxlength="200"')}</div>${formActions(s.id ? "Save student changes" : "Register student")}</form></section><section class="panel"><h2>Registered students</h2>${toolbar(
    "Search student number, LRN, name, or course",
    [
      ["all", "All students"],
      ["active", "Active"],
      ["archived", "Archived"],
    ],
  )}<div id="studentRows"></div></section>`;
}
function booksView() {
  const b = editing ? state.books.find((row) => row.id === editing) || {} : {};
  return `${heading("Manage titles and each physical copy by accession number.")}<section class="panel form-panel"><h2>${b.id ? "Edit book title" : "Add a book title"}</h2><form id="bookForm" data-id="${b.id || ""}"><div class="form-grid three">${input("Book code *", "code", b.code, 'required maxlength="60"')}${input("Title *", "title", b.title, 'required maxlength="300"')}${input("Author *", "author", b.author, 'required maxlength="300"')}${input("Edition", "edition", b.edition, 'maxlength="200"')}${input("Publication year", "year", b.year, 'inputmode="numeric" pattern="[12][0-9]{3}" maxlength="4"')}${input("Shelf location", "shelf", b.shelf, 'maxlength="200"')}</div>${formActions(b.id ? "Save book changes" : "Add book title")}</form></section><section class="panel form-panel"><h2>Add a physical copy</h2><form id="copyForm"><div class="form-grid">${select("Book title *", "bookId", [["", "Select a title"], ...state.books.filter((b) => b.active).map((b) => [b.id, `${b.code} — ${b.title}`])], "", "required")}${input("Accession number *", "accession", "", 'required maxlength="80" placeholder="Use the number on the physical copy"')}</div>${formActions("Add physical copy")}</form></section><section class="panel no-print"><h2>Book titles</h2><div id="titleRows"></div></section><section class="panel"><h2>Physical copies</h2>${toolbar("Search accession, title, author, or shelf", [["all", "All copies"], ["activeTitles", "Active titles and copies"], ...["Available", "Borrowed", "Damaged", "Lost", "Withdrawn", "Archived"].map((value) => [value, value])])}<div id="copyRows"></div></section>`;
}
function borrowView() {
  return `${heading("Check out available copies and process returns.")}<div class="tabs no-print" role="group" aria-label="Circulation mode"><button type="button" data-tab="borrow" class="${tab === "borrow" ? "active" : ""}">Borrow a book</button><button type="button" data-tab="return" class="${tab === "return" ? "active" : ""}">Return a book</button></div>${tab === "borrow" ? `<section class="panel form-panel"><h2>New checkout</h2><form id="borrowForm"><div class="form-grid">${select("Student *", "studentId", [["", "Select a registered student"], ...state.students.filter((s) => s.active).map((s) => [s.id, `${s.studentNo} — ${s.fullName}`])], "", "required")}${select("Available copy *", "copyId", [["", "Select accession number"], ...state.copies.filter((c) => c.status === "Available").map((c) => [c.id, `${c.accession} — ${c.title}`])], "", "required")}${input("Checkout date", "checkoutOn", state.today, 'type="date" readonly')}${input("Due date *", "dueDate", state.defaultDueDate, `type="date" min="${state.today}" max="${state.defaultDueDate}" required`)}</div><div id="borrowDetails" class="inline-details">Select a student and a copy to review the checkout.</div>${formActions("Confirm checkout")}</form></section>` : '<section class="panel no-print"><p>Find the active loan below, then choose <strong>Process return</strong>. Record the condition before confirming. Lost and damaged copies remain unavailable until an administrator resolves them.</p></section>'}<section class="panel"><h2>Borrowing records</h2>${toolbar(
    "Search student, accession, title, or status",
    [
      ["all", "All records"],
      ["active", "Active loans"],
      ["today", "Due today"],
      ["Overdue", "Overdue"],
      ["Returned", "Returned"],
      ["Lost", "Lost"],
      ["Cancelled", "Cancelled"],
    ],
  )}<div id="loanRows"></div></section>`;
}
function recordsView() {
  const owner = historyStudentId
    ? state.students.find((s) => s.id === historyStudentId)?.fullName
    : historyCopyId
      ? state.copies.find((c) => c.id === historyCopyId)?.accession
      : null;
  return `${heading("Search the full circulation history or export a report.")}<section class="panel"><h2>Circulation history${owner ? ` — ${h(owner)}` : ""}</h2>${owner ? '<button type="button" class="secondary no-print" data-action="clearHistory">Show all borrowers and copies</button>' : ""}${toolbar(
    "Search student number, name, accession, or title",
    [
      ["all", "All records"],
      ["active", "Active loans"],
      ["today", "Due today"],
      ["Overdue", "Overdue"],
      ["Returned", "Returned"],
      ["Lost", "Lost"],
      ["Cancelled", "Cancelled"],
    ],
    true,
  )}<div id="loanRows"></div></section>`;
}
function settingsView() {
  return `${heading("Manage local policy, staff accounts, and recovery.")}<section class="panel form-panel"><h2>Lending policy</h2><p class="subtle">Changes apply to new checkouts. Existing due dates stay unchanged. This version counts calendar days and does not calculate fines or renew loans.</p><form id="policyForm"><div class="form-grid">${policyFields(state.settings)}</div>${formActions("Save library policy", false)}</form></section><section class="panel"><h2>Backup & restore</h2><p class="break">Data folder: <strong>${h(state.backup?.dataFolder)}</strong></p><p class="break">Daily backup: ${h(state.backup?.path || "No backup yet")}</p>${state.backup?.error ? `<div class="warning">${h(state.backup.error)}</div>` : ""}<p>A daily backup is kept on this computer while the app is running. Use <strong>Backup now</strong> to save a new copy to a USB drive or another storage device, especially after a day’s work.</p><div class="form-actions"><button type="button" data-action="backup">Backup now</button><button type="button" class="secondary" data-action="restore">Restore from backup</button></div><p class="subtle">Restore replaces current records, keeps a safety backup, and signs everyone out. Keep backups secure because they contain student and staff records.</p></section><section class="panel form-panel"><h2>Add staff account</h2><form id="staffForm"><div class="form-grid">${input("Staff name *", "name", "", 'required maxlength="200"')}${input("Username *", "username", "", 'required maxlength="60" autocomplete="off"')}${input("Initial password *", "password", "", 'type="password" required minlength="12" maxlength="256" autocomplete="new-password"')}${select(
    "Role *",
    "role",
    [
      ["staff", "Library staff"],
      ["admin", "Administrator"],
    ],
    "staff",
    "required",
  )}</div>${formActions("Create staff account")}</form><p class="subtle">Keep a second authorized administrator for password recovery. Staff can process circulation; only administrators can change policy, correct loans, or restore backups.</p></section><section class="panel"><h2>Staff accounts</h2><div id="staffRows"></div></section><section class="panel"><h2>Recent activity</h2><p class="subtle">Latest 500 entries. The database retains the complete activity history.</p><div id="auditRows"></div></section>`;
}
function toolbar(placeholder, options, dates = false) {
  return `<div class="toolbar no-print"><label class="search">Search<input id="search" type="search" placeholder="${placeholder}" value="${h(query)}"></label>${select("Show", "filter", options, filter, 'id="filter"')}${dates ? `${input("Checkout from", "fromDate", fromDate, 'type="date" id="fromDate"')}${input("Checkout through", "toDate", toDate, 'type="date" id="toDate"')}` : ""}<button type="button" class="secondary" data-action="export">Export CSV</button><button type="button" class="secondary" data-action="print">Print</button></div>`;
}
function table(target, headers, rows, { paginate = true } = {}) {
  const container = document.getElementById(target);
  if (!container) return;
  const total = rows.length,
    pages = Math.max(1, Math.ceil(total / 25));
  if (paginate) page = Math.min(page, pages);
  const shown =
    paginate && !printAll ? rows.slice((page - 1) * 25, page * 25) : rows;
  container.innerHTML = `<div class="table-wrap"><table><thead><tr>${headers.map((label) => `<th ${label === "Actions" ? 'class="actions"' : ""} scope="col">${h(label)}</th>`).join("")}</tr></thead><tbody>${shown.length ? shown.map((row) => `<tr>${row.map((value, index) => `<td ${headers[index] === "Actions" ? 'class="actions"' : ""}>${value}</td>`).join("")}</tr>`).join("") : `<tr><td class="empty" colspan="${headers.length}">No matching records. Add a record or change the filters.</td></tr>`}</tbody></table></div>${paginate ? `<div class="pagination no-print"><span>${total} records · page ${page} of ${pages}</span><div><button type="button" class="secondary small" data-action="prev" ${page === 1 ? "disabled" : ""}>Previous</button><button type="button" class="secondary small" data-action="next" ${page >= pages ? "disabled" : ""}>Next</button></div></div>` : ""}`;
}
function matches(row) {
  return Object.values(row).some((value) =>
    String(value ?? "")
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
}
function studentList() {
  return state.students.filter(
    (s) =>
      matches(s) &&
      (filter === "all" || (filter === "active" ? s.active : !s.active)),
  );
}
function copyList() {
  return state.copies.filter(
    (c) =>
      matches(c) &&
      (filter === "all" ||
        (filter === "activeTitles" && c.bookActive) ||
        c.status === filter),
  );
}
function loanList() {
  return state.loans.filter(
    (l) =>
      matches(l) &&
      (!historyStudentId || l.studentId === historyStudentId) &&
      (!historyCopyId || l.copyId === historyCopyId) &&
      (!fromDate || l.checkoutOn >= fromDate) &&
      (!toDate || l.checkoutOn <= toDate) &&
      (filter === "all" ||
        (filter === "active" && !l.returnedOn && !l.cancelledOn) ||
        (filter === "today" &&
          !l.returnedOn &&
          !l.cancelledOn &&
          l.dueDate === state.today) ||
        l.status === filter),
  );
}
function drawTables() {
  if (view === "students")
    table(
      "studentRows",
      [
        "Student no.",
        "Name",
        "Grade / course",
        "Section",
        "Contact",
        "Status",
        "Actions",
      ],
      studentList().map((s) => [
        h(s.studentNo),
        h(s.fullName),
        h([s.grade, s.yearLevel, s.program].filter(Boolean).join(" / ")),
        h(s.section),
        `${h(s.contact)}<br>${h(s.email)}`,
        badge(s.active ? "Active" : "Archived"),
        `${button("Edit", "editStudent", s.id)}${button("History", "studentHistory", s.id)}${button(s.active ? "Archive" : "Reactivate", "archiveStudent", s.id)}`,
      ]),
    );
  if (view === "books") {
    table(
      "titleRows",
      [
        "Code",
        "Title / author",
        "Edition / year",
        "Shelf",
        "Copies / available",
        "Status",
        "Actions",
      ],
      state.books
        .filter(matches)
        .filter((b) => filter !== "activeTitles" || b.active)
        .map((b) => {
          const copies = state.copies.filter((c) => c.bookId === b.id);
          return [
            h(b.code),
            `${h(b.title)}<br><span class="subtle">${h(b.author)}</span>`,
            h([b.edition, b.year].filter(Boolean).join(" / ")),
            h(b.shelf),
            `${copies.length} / ${copies.filter((c) => c.status === "Available").length}`,
            badge(b.active ? "Active" : "Archived"),
            `${button("Edit", "editBook", b.id)}${admin() ? button(b.active ? "Archive" : "Reactivate", "archiveBook", b.id) : ""}`,
          ];
        }),
      { paginate: false },
    );
    table(
      "copyRows",
      ["Accession", "Title", "Author", "Shelf", "Status", "Actions"],
      copyList().map((c) => [
        h(c.accession),
        h(c.title),
        h(c.author),
        h(c.shelf),
        badge(c.status),
        `${button("History", "copyHistory", c.id)}${admin() && c.status !== "Borrowed" ? button("Change status", "copyStatus", c.id) : ""}`,
      ]),
    );
  }
  if (view === "borrow" || view === "records")
    table(
      "loanRows",
      [
        "Loan",
        "Student",
        "Accession / title",
        "Checkout",
        "Due",
        "Returned / resolved",
        "Late days",
        "Status",
        "Processed by",
        "Actions",
      ],
      loanList().map((l) => [
        h(`#${l.id}`),
        `${h(l.borrowerName)}<br><span class="subtle">${h(l.studentNo)}</span>`,
        `${h(l.accession)}<br>${h(l.bookTitle)}`,
        h(l.checkoutOn),
        h(l.dueDate),
        `${h(l.returnedOn || l.cancelledOn || "—")}${l.condition ? `<br>${h(l.condition)}` : ""}`,
        h(l.overdueDays),
        badge(l.status),
        `${h(l.processedBy)}${l.receivedBy ? `<br>Return: ${h(l.receivedBy)}` : ""}`,
        !l.returnedOn && !l.cancelledOn
          ? `${button("Process return", "return", l.id)}${admin() ? button("Cancel loan", "cancelLoan", l.id) : ""}`
          : "—",
      ]),
    );
  if (view === "settings") {
    table(
      "staffRows",
      ["Name", "Username", "Role", "Status", "Actions"],
      state.staff.map((s) => [
        h(s.name),
        h(s.username),
        h(s.role),
        badge(s.active ? "Active" : "Disabled"),
        `${button("Reset password", "resetPassword", s.id)}${s.id !== state.user.id ? button(s.active ? "Disable" : "Enable", "staffActive", s.id) : ""}`,
      ]),
      { paginate: false },
    );
    table(
      "auditRows",
      ["When", "Staff", "Action", "Details"],
      state.audit.map((a) => [
        h(new Date(a.at).toLocaleString()),
        h(a.staffName || "System"),
        h(a.action),
        `<span class="break">${h(a.details)}</span>`,
      ]),
      { paginate: false },
    );
  }
}
function openDialog(title, formId, markup, operation, data = {}) {
  dialog.innerHTML = `<h2 id="dialogTitle">${h(title)}</h2><form id="${formId}" data-operation="${operation}" data-payload="${h(JSON.stringify(data))}">${markup}<div class="form-actions"><button type="submit">Confirm</button><button type="button" class="secondary" data-action="closeDialog">Cancel</button></div>${errors()}</form>`;
  dialog.showModal();
}
function report() {
  if (view === "students")
    return {
      headers: [
        "Student number",
        "Name",
        "LRN",
        "Grade",
        "Course",
        "Year",
        "Section",
        "Contact",
        "Email",
        "Status",
      ],
      rows: studentList().map((s) => [
        s.studentNo,
        s.fullName,
        s.lrn,
        s.grade,
        s.program,
        s.yearLevel,
        s.section,
        s.contact,
        s.email,
        s.active ? "Active" : "Archived",
      ]),
    };
  if (view === "books")
    return {
      headers: ["Accession", "Book code", "Title", "Author", "Shelf", "Status"],
      rows: copyList().map((c) => [
        c.accession,
        c.code,
        c.title,
        c.author,
        c.shelf,
        c.status,
      ]),
    };
  return {
    headers: [
      "Loan",
      "Student number",
      "Borrower",
      "Accession",
      "Title",
      "Checkout",
      "Due",
      "Return / resolution",
      "Condition",
      "Late days",
      "Status",
      "Processed by",
      "Returned to",
      "Cancellation reason",
    ],
    rows: loanList().map((l) => [
      l.id,
      l.studentNo,
      l.borrowerName,
      l.accession,
      l.bookTitle,
      l.checkoutOn,
      l.dueDate,
      l.returnedOn || l.cancelledOn,
      l.condition,
      l.overdueDays,
      l.status,
      l.processedBy,
      l.receivedBy,
      l.cancelReason,
    ]),
  };
}
root.addEventListener("input", (event) => {
  if (event.target.id === "search") {
    query = event.target.value;
    page = 1;
    drawTables();
  }
  if (event.target.closest("#borrowForm")) showBorrowDetails();
});
root.addEventListener("change", (event) => {
  if (event.target.id === "filter") {
    filter = event.target.value;
    page = 1;
    drawTables();
  }
  if (event.target.id === "fromDate" || event.target.id === "toDate") {
    fromDate = document.getElementById("fromDate").value;
    toDate = document.getElementById("toDate").value;
    if (fromDate && toDate && fromDate > toDate) {
      notice("Start date must not be after the end date.", true);
      return;
    }
    page = 1;
    drawTables();
  }
});
function showBorrowDetails() {
  const form = document.getElementById("borrowForm");
  if (!form) return;
  const s = state.students.find(
    (s) => s.id === Number(form.elements.studentId.value),
  );
  const c = state.copies.find(
    (c) => c.id === Number(form.elements.copyId.value),
  );
  const active = s
    ? state.loans.filter(
        (l) => l.studentId === s.id && !l.returnedOn && !l.cancelledOn,
      )
    : [];
  document.getElementById("borrowDetails").textContent =
    `${s ? `${s.fullName} · ${[s.grade, s.program, s.section].filter(Boolean).join(" / ")} · ${active.length}/${state.settings.maxLoans} active loans${active.some((l) => l.status === "Overdue") ? " · Has overdue loans" : ""}` : "Select a student."}${c ? ` | ${c.accession} · ${c.title} · ${c.shelf || "No shelf assigned"}` : ""}`;
}
document.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target || busy) return;
  if (target.dataset.view) {
    resetView(target.dataset.view);
    if (target.dataset.filter) {
      filter = target.dataset.filter;
      render();
    }
    return;
  }
  if (target.dataset.tab) {
    tab = target.dataset.tab;
    filter = tab === "return" ? "active" : "all";
    page = 1;
    render();
    return;
  }
  const action = target.dataset.action,
    recordId = Number(target.dataset.id);
  if (!action) return;
  try {
    if (action === "closeDialog") {
      dialog.close();
      return;
    }
    if (action === "clear") {
      editing = null;
      render();
      return;
    }
    if (action === "prev" || action === "next") {
      page += action === "next" ? 1 : -1;
      drawTables();
      return;
    }
    if (action === "editStudent" || action === "editBook") {
      editing = recordId;
      render();
      root.querySelector(".form-panel input")?.focus();
      window.scrollTo(0, 0);
      return;
    }
    if (action === "studentHistory" || action === "copyHistory") {
      resetView("records");
      if (action === "studentHistory") historyStudentId = recordId;
      else historyCopyId = recordId;
      render();
      return;
    }
    if (action === "clearHistory") {
      historyStudentId = null;
      historyCopyId = null;
      page = 1;
      render();
      return;
    }
    if (action === "return") {
      const loan = state.loans.find((l) => l.id === recordId);
      openDialog(
        "Process return",
        "returnForm",
        `<p><strong>${h(loan.accession)} — ${h(loan.bookTitle)}</strong><br>${h(loan.borrowerName)} · Due ${h(loan.dueDate)}</p><p>Return / resolution date: <strong>${h(state.today)}</strong></p>${select(
          "Condition *",
          "condition",
          [
            ["Good", "Good — available for borrowing"],
            ["Damaged", "Damaged — hold for assessment"],
            ["Lost", "Lost — record as unavailable"],
          ],
          "Good",
          "required",
        )}`,
        "returnLoan",
        { id: recordId },
      );
      return;
    }
    if (action === "archiveStudent" || action === "archiveBook") {
      const row = (
        action === "archiveStudent" ? state.students : state.books
      ).find((r) => r.id === recordId);
      openDialog(
        row.active ? "Archive record" : "Reactivate record",
        "reasonForm",
        `${input("Reason *", "reason", "", 'required maxlength="500"')}`,
        action,
        { id: recordId, active: !row.active },
      );
      return;
    }
    if (action === "copyStatus") {
      const copy = state.copies.find((c) => c.id === recordId);
      openDialog(
        `Update ${copy.accession}`,
        "copyStatusForm",
        `${select(
          "Copy status *",
          "status",
          ["Available", "Damaged", "Lost", "Withdrawn"].map((v) => [v, v]),
          copy.disposition,
          "required",
        )}${input("Reason *", "reason", "", 'required maxlength="500"')}`,
        "setCopyStatus",
        { id: recordId },
      );
      return;
    }
    if (action === "cancelLoan") {
      openDialog(
        "Cancel incorrect checkout",
        "reasonForm",
        `<p>The loan stays in the history and the copy becomes available. Use this only for an incorrect checkout.</p>${input("Reason *", "reason", "", 'required maxlength="500"')}`,
        "cancelLoan",
        { id: recordId },
      );
      return;
    }
    if (action === "password") {
      openDialog(
        "Change your password",
        "passwordForm",
        `${input("Current password *", "currentPassword", "", 'type="password" required autocomplete="current-password"')}${input("New password *", "password", "", 'type="password" required minlength="12" maxlength="256" autocomplete="new-password"')}`,
        "changePassword",
      );
      return;
    }
    if (action === "resetPassword") {
      openDialog(
        "Reset staff password",
        "resetPasswordForm",
        `${input("New password *", "password", "", 'type="password" required minlength="12" maxlength="256" autocomplete="new-password"')}`,
        "resetStaffPassword",
        { id: recordId },
      );
      return;
    }
    if (action === "staffActive") {
      const staff = state.staff.find((s) => s.id === recordId);
      openDialog(
        staff.active ? "Disable staff account" : "Enable staff account",
        "staffActiveForm",
        `<p>${h(staff.name)} (${h(staff.username)})</p>`,
        "setStaffActive",
        { id: recordId, active: !staff.active },
      );
      return;
    }
    busy = true;
    target.disabled = true;
    if (action === "logout") {
      await api("logout");
      showAuth(false);
      return;
    }
    if (action === "export") {
      const result = await api("export", report());
      if (result) notice(`Report saved: ${result.path}`);
      return;
    }
    if (action === "print") {
      printAll = true;
      drawTables();
      try {
        await api("print");
      } finally {
        printAll = false;
        drawTables();
      }
      return;
    }
    if (action === "backup") {
      const result = await api("backup");
      if (result) notice(`Backup saved: ${result.path}`);
      return;
    }
    if (action === "restore") {
      const result = await api("restore");
      if (result) {
        dialog.close();
        showAuth(false);
        notice(`Backup restored. Safety backup: ${result.safetyBackup}`);
      }
      return;
    }
  } catch (error) {
    notice(error.message, true);
  } finally {
    busy = false;
    target.disabled = false;
  }
});
document.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));
  let action;
  if (form.dataset.operation) {
    action = form.dataset.operation;
    Object.assign(data, JSON.parse(form.dataset.payload));
  } else
    action = {
      setupForm: "setup",
      loginForm: "login",
      studentForm: "saveStudent",
      bookForm: "saveBook",
      copyForm: "addCopy",
      borrowForm: "borrow",
      policyForm: "saveSettings",
      staffForm: "saveStaff",
    }[form.id];
  if (!action) return;
  if (form.dataset.id) data.id = Number(form.dataset.id);
  for (const key of ["loanDays", "maxLoans", "bookId", "studentId", "copyId"])
    if (key in data) data[key] = Number(data[key]);
  if ("blockOverdue" in data) data.blockOverdue = data.blockOverdue === "true";
  const submit = form.querySelector("button[type=submit]"),
    errorBox = form.querySelector(".error-message");
  errorBox.textContent = "";
  submit.disabled = true;
  busy = true;
  try {
    await api(action, data);
    if (dialog.open) dialog.close();
    editing = null;
    if (action === "setup" || action === "login") {
      view = "dashboard";
      location.hash = view;
    }
    await refresh();
    notice(
      {
        borrow: "Checkout recorded.",
        returnLoan: "Return recorded.",
        setup: "Library created. Add students and book copies to get started.",
        login: "Signed in.",
      }[action] || "Changes saved.",
    );
  } catch (error) {
    errorBox.textContent = error.message;
    notice(error.message, true);
  } finally {
    busy = false;
    submit.disabled = false;
  }
});
async function start() {
  try {
    const status = await api("status");
    if (!status.user) showAuth(status.needsSetup);
    else await refresh();
  } catch (error) {
    root.innerHTML = `<main class="auth"><h1>Unable to open the library</h1><p>${h(error.message)}</p></main>`;
  }
}
window.addEventListener("hashchange", () => {
  if (state && views[location.hash.slice(1)] && view !== location.hash.slice(1))
    resetView(location.hash.slice(1));
});
setInterval(async () => {
  if (!state || busy || dialog.open) return;
  try {
    const fresh = await api("snapshot");
    const dateChanged = fresh.today !== state.today;
    state = fresh;
    if (dateChanged) {
      render();
      notice("Library date updated. Check the due date before a new checkout.");
    } else if (fresh.backup?.error) notice(fresh.backup.error, true);
  } catch (error) {
    notice(error.message, true);
  }
}, 60000);
start();
