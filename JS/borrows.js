const borrowForm = document.getElementById("borrowForm");
const lrnInput = document.getElementById("lrn");
const studentMessage = document.getElementById("studentMessage");
const bookIdSelect = document.getElementById("bookId");
const checkoutInput = document.getElementById("checkoutDate");
const dueInput = document.getElementById("dueDate");
const statusSelect = document.getElementById("returnStatus");
const borrowTableBody = document.getElementById("borrowTableBody");
const searchBorrow = document.getElementById("searchBorrow");

// STORAGE
let students = JSON.parse(
    localStorage.getItem("libraryStudents") || "[]"
);

let books = JSON.parse(
    localStorage.getItem("libraryBooks") || "[]"
);

let borrowRecords = JSON.parse(
    localStorage.getItem("libraryBorrowRecords") || "[]"
);

// STUDENT LOOKUP
function findStudent(lrn) {
    return students.find(student =>
        String(student.lrn).trim() === String(lrn).trim()
    );
}

function clearStudentFields() {
    [
        "fullName", "contact", "email",
        "grade", "strand", "yearLevel", "section"
    ].forEach(id => {
        document.getElementById(id).value = "";
    });
}

function lookupStudent() {
    const lrn = lrnInput.value.trim();

    clearStudentFields();

    if (!lrn) {
        studentMessage.textContent = "";
        return;
    }

    const student = findStudent(lrn);

    if (!student) {
        studentMessage.textContent =
            "Student not found. Check the LRN.";
        studentMessage.style.color = "red";
        return;
    }

    document.getElementById("fullName").value =
        student.fullName || "";

    document.getElementById("contact").value =
        student.contact || "";

    document.getElementById("email").value =
        student.email || "";

    document.getElementById("grade").value =
        student.grade || "";

    document.getElementById("strand").value =
        student.strand || "";

    document.getElementById("yearLevel").value =
        student.yearLevel || "";

    document.getElementById("section").value =
        student.section || "";

    studentMessage.textContent = "Student found!";
    studentMessage.style.color = "green";
}

// Look up after entering the LRN.
lrnInput.addEventListener("input", lookupStudent);
lrnInput.addEventListener("change", lookupStudent);

// BOOK DROPDOWN

function getBookId(book) {
    return String(book.bookId ?? book.id ?? "");
}

function getBookTitle(book) {
    return String(
        book.bookTitle ?? book.title ?? book.name ?? ""
    );
}

function loadBooks() {
    books = JSON.parse(
        localStorage.getItem("libraryBooks") || "[]"
    );

    bookIdSelect.innerHTML = "";
    bookIdSelect.add(new Option("Select Book ID", ""));

    books.forEach(book => {
        const id = getBookId(book);
        const title = getBookTitle(book);

        if (id && title) {
            bookIdSelect.add(
                new Option(`${id} - ${title}`, id)
            );
        }
    });

    if (books.length === 0) {
        bookIdSelect.add(
            new Option("No books available", "")
        );
    }
}

function updateBookTitle() {
    const selectedBook = books.find(book =>
        getBookId(book) === bookIdSelect.value
    );

    document.getElementById("bookTitle").value =
        selectedBook ? getBookTitle(selectedBook) : "";
}

bookIdSelect.addEventListener("change", updateBookTitle);

loadBooks();

// DATE HELPERS
function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function updateOverdueDays(record) {
    if (record.status === "Returned" || !record.dueDate) {
        return 0;
    }

    const today = new Date();
    const due = new Date(record.dueDate + "T00:00:00");
    const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    return Math.max(
        0,
        Math.floor((todayStart - due) / 86400000)
    );
}

function effectiveStatus(record) {
    if (record.status === "Returned") {
        return "Returned";
    }

    return updateOverdueDays(record) > 0
        ? "Overdue"
        : "Borrowed";
}

function saveBorrowRecords() {
    localStorage.setItem(
        "libraryBorrowRecords",
        JSON.stringify(borrowRecords)
    );
}

// SAVE BORROWING RECORD
borrowForm.addEventListener("submit", function(event) {
    event.preventDefault();

    // Refresh student data before saving.
    students = JSON.parse(
        localStorage.getItem("libraryStudents") || "[]"
    );

    books = JSON.parse(
        localStorage.getItem("libraryBooks") || "[]"
    );

    const student = findStudent(lrnInput.value.trim());

    if (!student) {
        alert("Please enter a valid registered student LRN.");
        return;
    }

    const book = books.find(item =>
        getBookId(item) === bookIdSelect.value
    );

    if (!book) {
        alert("Please select a valid book.");
        return;
    }

    const checkoutDate = checkoutInput.value;
    const dueDate = dueInput.value;

    if (dueDate < checkoutDate) {
        alert("The due date cannot be earlier than the checkout date.");
        return;
    }

    // Prevent borrowing the same book while it is still out.
    const alreadyBorrowed = borrowRecords.some(record =>
        record.bookId === bookIdSelect.value &&
        record.status !== "Returned"
    );

    if (alreadyBorrowed) {
        alert("This book already has an active borrowing record.");
        return;
    }

    const record = {
        transactionId:
            Date.now().toString() + Math.random().toString(36).slice(2, 7),

        lrn: student.lrn,
        fullName: student.fullName,
        contact: student.contact || "",
        email: student.email || "",

        bookId: getBookId(book),
        bookTitle: getBookTitle(book),

        checkoutDate: checkoutDate,
        dueDate: dueDate,

        grade: student.grade || "",
        strand: student.strand || "",
        yearLevel: student.yearLevel || "",
        section: student.section || "",

        status: statusSelect.value
    };

    borrowRecords.push(record);

    saveBorrowRecords();
    displayBorrowRecords();

    borrowForm.reset();
    clearStudentFields();
    studentMessage.textContent = "";

    checkoutInput.value = localDateString();
    dueInput.min = checkoutInput.value;

    document.getElementById("overdueDays").value = 0;
    document.getElementById("bookTitle").value = "";

    alert("Borrowing record saved successfully!");
});

// DISPLAY BORROWING RECORDS
function displayBorrowRecords() {
    borrowRecords = JSON.parse(
        localStorage.getItem("libraryBorrowRecords") || "[]"
    );

    const search = searchBorrow.value.toLowerCase().trim();

    const filteredRecords = borrowRecords.filter(record =>
        [
            record.lrn,
            record.fullName,
            record.bookId,
            record.bookTitle,
            record.grade,
            record.strand,
            record.yearLevel,
            record.section,
            effectiveStatus(record)
        ].some(value =>
            String(value || "").toLowerCase().includes(search)
        )
    );

    borrowTableBody.innerHTML = "";

    if (filteredRecords.length === 0) {
        const row = borrowTableBody.insertRow();
        const cell = row.insertCell();

        cell.colSpan = 11;
        cell.textContent = "No borrowing records found.";
        cell.style.textAlign = "center";
    }

    filteredRecords.forEach(record => {
        const row = borrowTableBody.insertRow();

        const values = [
            record.lrn,
            record.fullName,
            record.bookId,
            record.bookTitle,
            record.checkoutDate,
            record.dueDate,
            [
                record.grade,
                record.yearLevel,
                record.strand
            ].filter(Boolean).join(" / "),
            record.section || "N/A",
            updateOverdueDays(record),
            effectiveStatus(record)
        ];

        values.forEach(value => {
            const cell = row.insertCell();
            cell.textContent = value;
        });

        const actions = row.insertCell();

        if (record.status !== "Returned") {
            const returnButton = document.createElement("button");

            returnButton.type = "button";
            returnButton.textContent = "Mark Returned";

            returnButton.addEventListener("click", () => {
                markReturned(record.transactionId);
            });

            actions.appendChild(returnButton);
        } else {
            actions.textContent = "Completed";
        }
    });

    document.getElementById("borrowCount").textContent =
        "Total Records: " + borrowRecords.length;

    // Refresh overdue-day display daily when the page is opened.
    borrowRecords.forEach(record => {
        record.overdueDays = updateOverdueDays(record);
    });

    saveBorrowRecords();
}

// MARK BOOK AS RETURNED
function markReturned(transactionId) {
    const confirmed = confirm(
        "Confirm that this book has been returned?"
    );

    if (!confirmed) return;

    const record = borrowRecords.find(item =>
        item.transactionId === transactionId
    );

    if (!record) return;

    record.status = "Returned";
    record.overdueDays = 0;

    saveBorrowRecords();
    displayBorrowRecords();
}

// UPDATE DUE DATE MINIMUM
checkoutInput.addEventListener("change", () => {
    dueInput.min = checkoutInput.value;

    if (dueInput.value && dueInput.value < checkoutInput.value) {
        dueInput.value = "";
    }
});

// SEARCH
searchBorrow.addEventListener("input", displayBorrowRecords);

// INITIALIZE
checkoutInput.value = localDateString();
dueInput.min = checkoutInput.value;

loadBooks();
displayBorrowRecords();