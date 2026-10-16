
const STORAGE_KEY = "libraryBooks";

let books = JSON.parse(
    localStorage.getItem(STORAGE_KEY) || "[]"
);

let editingId = null;

const bookForm = document.getElementById("bookForm");
const bookTableBody = document.getElementById("bookTableBody");
const searchInput = document.getElementById("searchInput");
const bookIdInput = document.getElementById("bookId");
const bookTitleInput = document.getElementById("bookTitle");
const authorInput = document.getElementById("author");
const publishedDateInput = document.getElementById("publishedDate");
const bookQuantity = document.getElementById("bookQuantity");
const formTitle = document.getElementById("form-title");
const saveBtn = document.getElementById("saveBtn");

/* SAVE BOOKS TO LOCAL STORAGE */
function saveBooks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

/* DISPLAY BOOKS */
function renderBooks() {
    const query = searchInput.value.toLowerCase().trim();

    const filteredBooks = books.filter(book =>
        String(book.id || "").toLowerCase().includes(query) ||
        String(book.title || "").toLowerCase().includes(query) ||
        String(book.author || "").toLowerCase().includes(query) ||
        String(book.date || "").includes(query) ||
        String(book.quantity ?? "").includes(query)
    );

    bookTableBody.replaceChildren();

    if (filteredBooks.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6; // ID, Title, Author, Date, Quantity, Actions
        cell.className = "empty-message";
        cell.textContent = books.length
            ? "No matching books found."
            : "No books added yet.";

        row.appendChild(cell);
        bookTableBody.appendChild(row);
        return;
    }

    filteredBooks.forEach(book => {
        const row = document.createElement("tr");

        [
            book.id,
            book.title,
            book.author,
            book.date,
            book.quantity ?? 0
        ].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actions = document.createElement("td");

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "edit-btn";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => editBook(book.id));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-btn";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteBook(book.id));

        actions.append(editButton, deleteButton);
        row.appendChild(actions);
        bookTableBody.appendChild(row);
    });
}

/* ADD OR UPDATE BOOK */
bookForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const quantityValue = bookQuantity.value.trim();
    const quantityNumber = Number(quantityValue);

    const book = {
        id: bookIdInput.value.trim(),
        title: bookTitleInput.value.trim(),
        author: authorInput.value.trim(),
        date: publishedDateInput.value,
        quantity: quantityNumber
    };

    if (
        !book.id ||
        !book.title ||
        !book.author ||
        !book.date ||
        quantityValue === "" ||
        !Number.isInteger(quantityNumber) ||
        quantityNumber < 1 ||
        quantityNumber > 100
    ) {
        alert("Please complete all fields. Quantity must be a whole number from 1 to 100.");
        return;
    }

    const duplicate = books.some(existing =>
        String(existing.id).toLowerCase() === book.id.toLowerCase() &&
        String(existing.id) !== String(editingId)
    );

    if (duplicate) {
        alert("This Book ID already exists.");
        return;
    }

    if (editingId !== null) {
        books = books.map(existing =>
            String(existing.id) === String(editingId) ? book : existing
        );

        alert("Book updated successfully.");
    } else {
        books.push(book);
        alert("Book added successfully.");
    }

    saveBooks();
    resetForm();
    renderBooks();
});

/* EDIT BOOK */
function editBook(id) {
    const book = books.find(item => String(item.id) === String(id));

    if (!book) return;

    editingId = id;

    bookIdInput.value = book.id;
    bookIdInput.readOnly = true;

    bookTitleInput.value = book.title;
    authorInput.value = book.author;
    publishedDateInput.value = book.date;
    bookQuantity.value = book.quantity ?? 1;

    formTitle.textContent = "Edit Book";
    saveBtn.textContent = "Save Changes";

    bookForm.scrollIntoView({ behavior: "smooth" });
}

/* DELETE BOOK */
function deleteBook(id) {
    if (!confirm("Are you sure you want to delete this book?")) {
        return;
    }

    books = books.filter(book => String(book.id) !== String(id));

    if (String(editingId) === String(id)) {
        resetForm();
    }

    saveBooks();
    renderBooks();
}

/* RESET FORM */
function resetForm() {
    editingId = null;

    bookForm.reset();
    bookIdInput.readOnly = false;

    formTitle.textContent = "Add New Book";
    saveBtn.textContent = "Add Book";
}

/* CLEAR BUTTON */
document.getElementById("clearBtn").addEventListener("click", () => {
    setTimeout(resetForm, 0);
});

/* SEARCH */
searchInput.addEventListener("input", renderBooks);

/* REFRESH WHEN RETURNING TO THIS PAGE */
window.addEventListener("pageshow", function() {
    books = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
    );

    renderBooks();
});

/* INITIALIZE */
renderBooks();
