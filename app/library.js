const { openDatabase, transaction } = require("./database");
const { hashPassword, verifyPassword } = require("./auth");
const { createBackup, restoreBackup, dailyBackup } = require("./backup");
const { localDate, dayNumber, addDays } = require("./dates");

function text(value, label, required = false, max = 200) {
  if (value == null) value = "";
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  value = value.trim();
  if (
    (required && !value) ||
    value.length > max ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)
  )
    throw new Error(`${label} is required or exceeds ${max} characters.`);
  return value;
}
function id(value) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error("Select a valid record.");
  return value;
}
function policy(data) {
  if (
    !Number.isInteger(data.loanDays) ||
    data.loanDays < 1 ||
    data.loanDays > 365
  )
    throw new Error("Choose a loan duration from 1 to 365 calendar days.");
  if (
    !Number.isInteger(data.maxLoans) ||
    data.maxLoans < 1 ||
    data.maxLoans > 100
  )
    throw new Error("Choose a borrowing limit from 1 to 100 copies.");
  if (typeof data.blockOverdue !== "boolean")
    throw new Error("Choose whether overdue loans block new borrowing.");
  return [data.loanDays, data.maxLoans, Number(data.blockOverdue)];
}
const ADMIN_ACTIONS = new Set([
  "saveSettings",
  "saveStaff",
  "setStaffActive",
  "resetStaffPassword",
  "cancelLoan",
  "archiveBook",
  "setCopyStatus",
]);
const MUTATIONS = new Set([
  "saveSettings",
  "saveStudent",
  "archiveStudent",
  "saveBook",
  "archiveBook",
  "addCopy",
  "setCopyStatus",
  "borrow",
  "returnLoan",
  "cancelLoan",
  "saveStaff",
  "setStaffActive",
  "resetStaffPassword",
  "changePassword",
]);

class Library {
  constructor(filename, { today = localDate } = {}) {
    this.filename = filename;
    this.today = today;
    this.db = openDatabase(filename);
    this.session = null;
    this.loginAttempts = new Map();
  }
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.session = null;
  }
  all(sql, ...args) {
    return this.db
      .prepare(sql)
      .all(...args)
      .map((row) => ({ ...row }));
  }
  get(sql, ...args) {
    const row = this.db.prepare(sql).get(...args);
    return row ? { ...row } : null;
  }
  run(sql, ...args) {
    return this.db.prepare(sql).run(...args);
  }
  audit(action, details, staffId = this.session?.id ?? null) {
    this.run(
      "INSERT INTO audit(at,staffId,action,details) VALUES(?,?,?,?)",
      new Date().toISOString(),
      staffId,
      action,
      details,
    );
  }
  requireSession(admin = false) {
    const user =
      this.session &&
      this.get(
        "SELECT id,username,name,role,active FROM staff WHERE id=?",
        this.session.id,
      );
    if (!user?.active) {
      this.session = null;
      throw new Error("Please sign in to continue.");
    }
    if (admin && user.role !== "admin")
      throw new Error("Administrator access is required.");
    this.session = user;
    return user;
  }
  execute(action, data = {}) {
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("Invalid operation data.");
    if (action === "status")
      return {
        needsSetup: !this.get("SELECT id FROM staff LIMIT 1"),
        user: this.session ? this.requireSession() : null,
      };
    if (action === "setup") return this.setup(data);
    if (action === "login") return this.login(data);
    if (action === "logout") {
      this.session = null;
      return true;
    }
    this.requireSession(ADMIN_ACTIONS.has(action));
    if (action === "snapshot") return this.snapshot();
    if (!MUTATIONS.has(action)) throw new Error("Unknown library operation.");
    try {
      return transaction(this.db, () => {
        const result = this[action](data);
        const { password, currentPassword, ...safe } = data;
        this.audit(action, JSON.stringify(safe));
        return result;
      });
    } catch (error) {
      if (/UNIQUE constraint failed/.test(error.message))
        throw new Error("This identifier already exists. Use a unique value.");
      throw error;
    }
  }
  setup(data) {
    if (this.get("SELECT id FROM staff LIMIT 1"))
      throw new Error("Library is already set up.");
    const values = policy(data);
    const username = text(data.username, "Username", true, 60);
    const name = text(data.name, "Staff name", true);
    const hash = hashPassword(data.password);
    transaction(this.db, () => {
      this.run(
        "INSERT INTO staff(username,name,passwordHash,role) VALUES(?,?,?,'admin')",
        username,
        name,
        hash,
      );
      this.run("INSERT INTO settings VALUES(1,?,?,?)", ...values);
      this.audit(
        "setup",
        "Initial administrator and calendar-day lending policy created",
        1,
      );
    });
    this.session = this.get(
      "SELECT id,username,name,role,active FROM staff WHERE id=1",
    );
    return this.session;
  }
  login(data) {
    const username = text(data.username, "Username", true, 60);
    const key = username.toLowerCase();
    const attempt = this.loginAttempts.get(key);
    if (attempt?.until > Date.now())
      throw new Error(
        "Too many attempts. Wait one minute before trying again.",
      );
    const user = this.get("SELECT * FROM staff WHERE username=?", username);
    if (!user?.active || !verifyPassword(data.password, user.passwordHash)) {
      const count = (attempt?.count || 0) + 1;
      this.loginAttempts.set(key, {
        count,
        until: count >= 5 ? Date.now() + 60000 : 0,
      });
      throw new Error("Incorrect username or password.");
    }
    this.loginAttempts.delete(key);
    this.session = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      active: user.active,
    };
    this.audit("login", "Staff signed in");
    return this.session;
  }
  saveSettings(data) {
    this.run(
      "UPDATE settings SET loanDays=?,maxLoans=?,blockOverdue=? WHERE id=1",
      ...policy(data),
    );
    return true;
  }
  saveStudent(data) {
    const values = [
      text(data.studentNo, "Student number", true, 60),
      text(data.lrn, "LRN", false, 12),
      text(data.fullName, "Full name", true),
      text(data.contact, "Contact", false, 60),
      text(data.email, "Email"),
      text(data.grade, "Grade / level"),
      text(data.program, "Strand / course"),
      text(data.yearLevel, "Year level"),
      text(data.section, "Section"),
    ];
    if (values[1] && !/^\d{12}$/.test(values[1]))
      throw new Error("LRN must contain 12 digits, or be left blank.");
    if (values[4] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[4]))
      throw new Error("Enter a valid email address or leave it blank.");
    if (data.id != null) {
      if (!this.get("SELECT id FROM students WHERE id=?", id(data.id)))
        throw new Error("Student not found.");
      this.run(
        "UPDATE students SET studentNo=?,lrn=?,fullName=?,contact=?,email=?,grade=?,program=?,yearLevel=?,section=? WHERE id=?",
        ...values,
        data.id,
      );
      return { id: data.id };
    }
    return {
      id: Number(
        this.run(
          "INSERT INTO students(studentNo,lrn,fullName,contact,email,grade,program,yearLevel,section) VALUES(?,?,?,?,?,?,?,?,?)",
          ...values,
        ).lastInsertRowid,
      ),
    };
  }
  archiveStudent(data) {
    id(data.id);
    text(data.reason, "Reason", true, 500);
    if (typeof data.active !== "boolean")
      throw new Error("Choose active or archived.");
    if (!this.get("SELECT id FROM students WHERE id=?", data.id))
      throw new Error("Student not found.");
    if (
      !data.active &&
      this.get(
        "SELECT id FROM loans WHERE studentId=? AND returnedOn IS NULL AND cancelledOn IS NULL",
        data.id,
      )
    )
      throw new Error(
        "Student has an active loan. Process it before archiving.",
      );
    this.run(
      "UPDATE students SET active=? WHERE id=?",
      Number(data.active),
      data.id,
    );
    return true;
  }
  saveBook(data) {
    const values = [
      text(data.code, "Book code", true, 60),
      text(data.title, "Title", true, 300),
      text(data.author, "Author", true, 300),
      text(data.edition, "Edition"),
      text(data.year, "Publication year", false, 4),
      text(data.shelf, "Shelf location"),
    ];
    if (values[4] && !/^(1[0-9]{3}|2[0-9]{3})$/.test(values[4]))
      throw new Error("Enter a four-digit publication year or leave it blank.");
    if (data.id != null) {
      if (!this.get("SELECT id FROM books WHERE id=?", id(data.id)))
        throw new Error("Book not found.");
      this.run(
        "UPDATE books SET code=?,title=?,author=?,edition=?,year=?,shelf=? WHERE id=?",
        ...values,
        data.id,
      );
      return { id: data.id };
    }
    return {
      id: Number(
        this.run(
          "INSERT INTO books(code,title,author,edition,year,shelf) VALUES(?,?,?,?,?,?)",
          ...values,
        ).lastInsertRowid,
      ),
    };
  }
  archiveBook(data) {
    id(data.id);
    text(data.reason, "Reason", true, 500);
    if (typeof data.active !== "boolean")
      throw new Error("Choose active or archived.");
    if (!this.get("SELECT id FROM books WHERE id=?", data.id))
      throw new Error("Book not found.");
    if (
      !data.active &&
      this.get(
        "SELECT l.id FROM loans l JOIN copies c ON c.id=l.copyId WHERE c.bookId=? AND l.returnedOn IS NULL AND l.cancelledOn IS NULL",
        data.id,
      )
    )
      throw new Error("Book has an active loan. Process it before archiving.");
    this.run(
      "UPDATE books SET active=? WHERE id=?",
      Number(data.active),
      data.id,
    );
    return true;
  }
  addCopy(data) {
    if (
      !this.get("SELECT id FROM books WHERE id=? AND active=1", id(data.bookId))
    )
      throw new Error("Choose an active book title.");
    return {
      id: Number(
        this.run(
          "INSERT INTO copies(bookId,accession) VALUES(?,?)",
          data.bookId,
          text(data.accession, "Accession number", true, 80),
        ).lastInsertRowid,
      ),
    };
  }
  setCopyStatus(data) {
    id(data.id);
    text(data.reason, "Reason", true, 500);
    if (!["Available", "Damaged", "Lost", "Withdrawn"].includes(data.status))
      throw new Error("Invalid copy status.");
    if (!this.get("SELECT id FROM copies WHERE id=?", data.id))
      throw new Error("Copy not found.");
    if (
      this.get(
        "SELECT id FROM loans WHERE copyId=? AND returnedOn IS NULL AND cancelledOn IS NULL",
        data.id,
      )
    )
      throw new Error("Copy has an active loan. Process the return first.");
    this.run(
      "UPDATE copies SET disposition=? WHERE id=?",
      data.status,
      data.id,
    );
    return true;
  }
  borrow(data) {
    const today = this.today();
    dayNumber(today);
    dayNumber(data.dueDate);
    const settings = this.get("SELECT * FROM settings WHERE id=1");
    if (
      data.dueDate < today ||
      data.dueDate > addDays(today, settings.loanDays)
    )
      throw new Error(
        "Due date must be today or within the configured loan duration.",
      );
    const student = this.get(
      "SELECT * FROM students WHERE id=? AND active=1",
      id(data.studentId),
    );
    if (!student) throw new Error("Choose an active registered student.");
    const copy = this.get(
      "SELECT c.*,b.title FROM copies c JOIN books b ON b.id=c.bookId WHERE c.id=? AND c.disposition='Available' AND b.active=1 AND NOT EXISTS(SELECT 1 FROM loans l WHERE l.copyId=c.id AND l.returnedOn IS NULL AND l.cancelledOn IS NULL)",
      id(data.copyId),
    );
    if (!copy)
      throw new Error(
        "This copy is no longer available. Refresh and choose another copy.",
      );
    const active = this.all(
      "SELECT dueDate FROM loans WHERE studentId=? AND returnedOn IS NULL AND cancelledOn IS NULL",
      student.id,
    );
    if (settings.blockOverdue && active.some((loan) => loan.dueDate < today))
      throw new Error(
        "Student has an overdue loan. Return it before borrowing again.",
      );
    if (active.length >= settings.maxLoans)
      throw new Error("Student has reached the borrowing limit.");
    return {
      id: Number(
        this.run(
          "INSERT INTO loans(studentId,copyId,studentNo,borrowerName,bookTitle,accession,checkoutOn,dueDate,createdBy) VALUES(?,?,?,?,?,?,?,?,?)",
          student.id,
          copy.id,
          student.studentNo,
          student.fullName,
          copy.title,
          copy.accession,
          today,
          data.dueDate,
          this.session.id,
        ).lastInsertRowid,
      ),
    };
  }
  returnLoan(data) {
    const loan = this.get("SELECT * FROM loans WHERE id=?", id(data.id));
    if (!loan || loan.returnedOn || loan.cancelledOn)
      throw new Error("Loan is already completed or is not active.");
    if (!["Good", "Damaged", "Lost"].includes(data.condition))
      throw new Error("Choose a return condition.");
    const today = this.today();
    dayNumber(today);
    if (today < loan.checkoutOn)
      throw new Error(
        "Return date precedes checkout. Check the computer date.",
      );
    this.run(
      "UPDATE loans SET returnedOn=?,condition=?,returnedBy=? WHERE id=?",
      today,
      data.condition,
      this.session.id,
      loan.id,
    );
    this.run(
      "UPDATE copies SET disposition=? WHERE id=?",
      data.condition === "Good" ? "Available" : data.condition,
      loan.copyId,
    );
    return true;
  }
  cancelLoan(data) {
    const reason = text(data.reason, "Reason", true, 500);
    const loan = this.get("SELECT * FROM loans WHERE id=?", id(data.id));
    if (!loan || loan.returnedOn || loan.cancelledOn)
      throw new Error(
        "Only an active loan can be cancelled. Returned records are preserved.",
      );
    this.run(
      "UPDATE loans SET cancelledOn=?,cancelReason=?,cancelledBy=? WHERE id=?",
      this.today(),
      reason,
      this.session.id,
      loan.id,
    );
    return true;
  }
  saveStaff(data) {
    if (!["admin", "staff"].includes(data.role))
      throw new Error("Choose a staff role.");
    const hash = hashPassword(data.password);
    return {
      id: Number(
        this.run(
          "INSERT INTO staff(username,name,passwordHash,role) VALUES(?,?,?,?)",
          text(data.username, "Username", true, 60),
          text(data.name, "Name", true),
          hash,
          data.role,
        ).lastInsertRowid,
      ),
    };
  }
  setStaffActive(data) {
    id(data.id);
    if (typeof data.active !== "boolean")
      throw new Error("Choose an account status.");
    if (data.id === this.session.id)
      throw new Error(
        "You cannot disable your own administrator/session account.",
      );
    if (!this.get("SELECT id FROM staff WHERE id=?", data.id))
      throw new Error("Staff account not found.");
    this.run(
      "UPDATE staff SET active=? WHERE id=?",
      Number(data.active),
      data.id,
    );
    return true;
  }
  resetStaffPassword(data) {
    if (!this.get("SELECT id FROM staff WHERE id=?", id(data.id)))
      throw new Error("Staff account not found.");
    this.run(
      "UPDATE staff SET passwordHash=? WHERE id=?",
      hashPassword(data.password),
      data.id,
    );
    return true;
  }
  changePassword(data) {
    const user = this.get("SELECT * FROM staff WHERE id=?", this.session.id);
    if (!verifyPassword(data.currentPassword, user.passwordHash))
      throw new Error("Current password is incorrect.");
    this.run(
      "UPDATE staff SET passwordHash=? WHERE id=?",
      hashPassword(data.password),
      user.id,
    );
    return true;
  }
  snapshot() {
    const today = this.today();
    const settings = this.get(
      "SELECT loanDays,maxLoans,blockOverdue FROM settings WHERE id=1",
    );
    settings.blockOverdue = Boolean(settings.blockOverdue);
    const students = this.all(
      "SELECT * FROM students ORDER BY fullName COLLATE NOCASE",
    );
    const books = this.all("SELECT * FROM books ORDER BY title COLLATE NOCASE");
    const copies = this
      .all(`SELECT c.*,b.code,b.title,b.author,b.shelf,b.active AS bookActive,
      CASE WHEN EXISTS(SELECT 1 FROM loans l WHERE l.copyId=c.id AND l.returnedOn IS NULL AND l.cancelledOn IS NULL) THEN 'Borrowed'
      WHEN b.active=0 THEN 'Archived' ELSE c.disposition END AS status
      FROM copies c JOIN books b ON b.id=c.bookId ORDER BY c.accession COLLATE NOCASE`);
    const loans = this.all(
      "SELECT l.*,s.name AS processedBy,r.name AS receivedBy FROM loans l JOIN staff s ON s.id=l.createdBy LEFT JOIN staff r ON r.id=l.returnedBy ORDER BY l.id DESC",
    ).map((loan) => {
      const status = loan.cancelledOn
        ? "Cancelled"
        : loan.returnedOn
          ? loan.condition === "Lost"
            ? "Lost"
            : "Returned"
          : loan.dueDate < today
            ? "Overdue"
            : "Borrowed";
      return {
        ...loan,
        status,
        overdueDays: loan.cancelledOn
          ? 0
          : Math.max(
              0,
              dayNumber(loan.returnedOn || today) - dayNumber(loan.dueDate),
            ),
      };
    });
    const active = loans.filter(
      (loan) => !loan.returnedOn && !loan.cancelledOn,
    );
    const admin = this.session.role === "admin";
    return {
      user: this.session,
      today,
      defaultDueDate: addDays(today, settings.loanDays),
      settings,
      students,
      books,
      copies,
      loans,
      summary: {
        students: students.filter((s) => s.active).length,
        titles: books.filter((b) => b.active).length,
        copies: copies.length,
        available: copies.filter((c) => c.status === "Available").length,
        active: active.length,
        dueToday: active.filter((l) => l.dueDate === today).length,
        overdue: active.filter((l) => l.dueDate < today).length,
      },
      staff: admin
        ? this.all(
            "SELECT id,username,name,role,active FROM staff ORDER BY name",
          )
        : [],
      audit: admin
        ? this.all(
            "SELECT a.*,s.name AS staffName FROM audit a LEFT JOIN staff s ON s.id=a.staffId ORDER BY a.id DESC LIMIT 500",
          )
        : [],
    };
  }
  backup(destination) {
    this.requireSession(true);
    createBackup(this, destination);
    this.audit("backup", "Database backup created");
    return destination;
  }
  dailyBackup(folder) {
    return dailyBackup(this, folder);
  }
  restore(source) {
    this.requireSession(true);
    return restoreBackup(this, source);
  }
}

module.exports = { Library, localDate, dayNumber, addDays, text };
