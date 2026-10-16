const studentForm = document.getElementById("studentForm");
const gradeSelect = document.getElementById("grade");
const strandSelect = document.getElementById("strand");
const tableBody = document.getElementById("studentTableBody");
const searchInput = document.getElementById("searchStudent");
const submitBtn = document.getElementById("submitBtn");
const cancelBtn = document.getElementById("cancelBtn");
const formTitle = document.getElementById("formTitle");
const sectionSelect = document.getElementById("section");
const yearLevelGroup = document.getElementById("yearLevelGroup");
const yearLevelSelect = document.getElementById("yearLevel");


const rowsPerPageSelect = document.getElementById("rowsPerPage");
const pagination = document.getElementById("pagination");

let currentPage = 1;
let rowsPerPage = 10;

// STRANDS AND COURSES
const programs = {
    "Grade 11": [
        "ACADEMICS",
        "TECHNICAL PROFESSIONAL"
    ],
    "Grade 12": [
        "STEM",
        "ABM",
        "HUMSS",
        "TVL-ICT",
        "TVL-HE"
    ],
    "College": [
        "BS Information Technology",
        "BS Hospitality Management"
    ]
};

// SECTION OPTIONS
const sections = {
    "Grade 11": {
        "ACADEMICS": ["A"],
        "TECHNICAL PROFESSIONAL": ["A"]
    },

    "Grade 12": {
        "STEM": ["A", "B"],
        "ABM": ["A", "B"],
        "HUMSS": ["A", "B"],
        "TVL-ICT": ["A", "B"],
        "TVL-HE": ["A", "B"]
    },

    "College": {
        "BS Information Technology": ["A", "B", "C", "D"],
        "BS Hospitality Management": [
            "A", "B", "C", "D", "E", "F", "G"
        ]
    }
};

// LOAD SAVED STUDENTS
let students = JSON.parse(
    localStorage.getItem("libraryStudents") || "[]"
);

let editingLRN = null;

// SAVE STUDENTS
function saveStudents() {
    localStorage.setItem(
        "libraryStudents",
        JSON.stringify(students)
    );
}

// UPDATE STRAND / COURSE AND YEAR LEVEL
function updatePrograms(selectedProgram = "", selectedYear = "") {
    const grade = gradeSelect.value;

    strandSelect.innerHTML = "";

    // COLLEGE YEAR LEVEL
    if (grade === "College") {
        yearLevelGroup.style.display = "flex";
        yearLevelSelect.required = true;

        yearLevelSelect.innerHTML = `
            <option value="">Select Year Level</option>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
        `;

        if (selectedYear) {
            yearLevelSelect.value = selectedYear;
        }
    } else {
        yearLevelGroup.style.display = "none";
        yearLevelSelect.required = false;
        yearLevelSelect.value = "";
    }

    // STRAND / COURSE OPTIONS
    if (!grade || !programs[grade]) {
        strandSelect.add(
            new Option("Select Grade Level First", "")
        );

        strandSelect.disabled = true;
    } else {
        strandSelect.disabled = false;

        strandSelect.add(
            new Option("Select Strand / Course", "")
        );

        programs[grade].forEach(program => {
            strandSelect.add(new Option(program, program));
        });

        if (selectedProgram &&
            programs[grade].includes(selectedProgram)) {
            strandSelect.value = selectedProgram;
        }
    }

    updateSections();
}

// UPDATE SECTION DROPDOWN
function updateSections(selectedSection = "") {
    const grade = gradeSelect.value;
    const program = strandSelect.value;

    sectionSelect.innerHTML = "";

    if (!grade || !program ||
        !sections[grade] ||
        !sections[grade][program]) {

        sectionSelect.add(
            new Option("Select Course / Strand First", "")
        );

        sectionSelect.disabled = true;
        return;
    }

    sectionSelect.disabled = false;

    sectionSelect.add(
        new Option("Select Section", "")
    );

    sections[grade][program].forEach(section => {
        sectionSelect.add(
            new Option(section, section)
        );
    });

    if (selectedSection &&
        sections[grade][program].includes(selectedSection)) {
        sectionSelect.value = selectedSection;
    }
}

// UPDATE DROPDOWNS WHEN GRADE CHANGES
gradeSelect.addEventListener("change", () => {
    updatePrograms();
    updateSections();
});

strandSelect.addEventListener("change", () => {
    updateSections();
});

// DISPLAY STUDENTS WITH PAGINATION
function displayStudents() {
    const search = searchInput.value.toLowerCase().trim();

    // Filter student records
    const filteredStudents = students.filter(student =>
        [
            student.lrn,
            student.fullName,
            student.gender,
            student.contact,
            student.email,
            student.grade,
            student.strand,
            student.yearLevel || "",
            student.section || ""
        ].some(value =>
            String(value || "").toLowerCase().includes(search)
        )
    );

    // Calculate pagination
    const totalStudents = filteredStudents.length;
    const totalPages = Math.ceil(totalStudents / rowsPerPage);

    // Keep current page valid after searching or deleting
    if (totalPages === 0) {
        currentPage = 1;
    } else if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(
        startIndex + rowsPerPage,
        totalStudents
    );

    const pageStudents = filteredStudents.slice(
        startIndex,
        endIndex
    );

    // Clear table
    tableBody.innerHTML = "";

    // Empty state
    if (pageStudents.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();

        cell.colSpan = 10;
        cell.textContent = students.length > 0
            ? "No matching students found."
            : "No students registered yet.";

        cell.style.textAlign = "center";
    }

    // Display current page only
    pageStudents.forEach(student => {
        const row = tableBody.insertRow();

        [
            student.lrn,
            student.fullName,
            student.gender,
            student.contact,
            student.email,
            student.grade,
            student.strand,
            student.yearLevel || "N/A",
            student.section || "N/A"
        ].forEach(value => {
            const cell = row.insertCell();
            cell.textContent = value;
        });

        const actions = row.insertCell();

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";

        editButton.addEventListener("click", () => {
            editStudent(student.lrn);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", () => {
            deleteStudent(student.lrn);
        });

        actions.append(editButton, deleteButton);
    });

    // Update total count and displayed range
    const studentCount = document.getElementById("studentCount");

    if (totalStudents === 0) {
        studentCount.textContent = "Total Students: 0";
    } else {
        studentCount.textContent =
            `Showing ${startIndex + 1}-${endIndex} of ${totalStudents} students`;
    }

    // Create pagination buttons
    pagination.innerHTML = "";

    function addPageButton(label, page, disabled = false, active = false) {
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = label;
        button.disabled = disabled;

        if (active) {
            button.classList.add("active");
            button.setAttribute("aria-current", "page");
        }

        button.addEventListener("click", () => {
            currentPage = page;
            displayStudents();
        });

        pagination.appendChild(button);
    }

    addPageButton(
        "Previous",
        currentPage - 1,
        currentPage === 1 || totalPages === 0
    );

    for (let page = 1; page <= totalPages; page++) {
        addPageButton(
            page,
            page,
            false,
            page === currentPage
        );
    }

    addPageButton(
        "Next",
        currentPage + 1,
        currentPage === totalPages || totalPages === 0
    );
}

// REGISTER OR UPDATE STUDENT
studentForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const student = {
        lrn: document.getElementById("lrn").value.trim(),
        fullName: document.getElementById("fullName").value.trim(),
        gender: document.getElementById("gender").value,
        contact: document.getElementById("contact").value.trim(),
        email: document.getElementById("email").value.trim(),
        grade: gradeSelect.value,
        strand: strandSelect.value,
        yearLevel: gradeSelect.value === "College"
            ? yearLevelSelect.value
            : "",
        section: sectionSelect.value
    };

    // PREVENT DUPLICATE LRN
    if (students.some(existing =>
        existing.lrn === student.lrn &&
        existing.lrn !== editingLRN
    )) {
        alert("This LRN is already registered.");
        return;
    }

    const isEditing = editingLRN !== null;

    if (isEditing) {
        const index = students.findIndex(
            existing => existing.lrn === editingLRN
        );

        if (index !== -1) {
            students[index] = student;
        }
    } else {
        students.push(student);
    }

    saveStudents();
    displayStudents();
    resetForm();

    alert(isEditing
        ? "Student information updated successfully!"
        : "Student registered successfully!");
});

// EDIT STUDENT
function editStudent(lrn) {
    const student = students.find(item => item.lrn === lrn);

    if (!student) return;

    editingLRN = lrn;

    document.getElementById("lrn").value = student.lrn;
    document.getElementById("fullName").value = student.fullName;
    document.getElementById("gender").value = student.gender;
    document.getElementById("contact").value = student.contact;
    document.getElementById("email").value = student.email;

    gradeSelect.value = student.grade;

    updatePrograms(
        student.strand,
        student.yearLevel || ""
    );

    updateSections(student.section || "");

    document.getElementById("lrn").readOnly = true;

    formTitle.textContent = "Edit Student Information";
    submitBtn.textContent = "Update Student";
    cancelBtn.style.display = "inline-block";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// DELETE STUDENT
function deleteStudent(lrn) {
    const confirmed = confirm(
        "Are you sure you want to delete this student?"
    );

    if (!confirmed) return;

    students = students.filter(student =>
        student.lrn !== lrn
    );

    saveStudents();
    displayStudents();

    if (editingLRN === lrn) {
        resetForm();
    }
}

// RESET FORM
function resetForm() {
    studentForm.reset();
    editingLRN = null;

    document.getElementById("lrn").readOnly = false;

    formTitle.textContent = "Register New Student";
    submitBtn.textContent = "Register Student";
    cancelBtn.style.display = "none";

    // Refresh dropdowns after resetting the form
    updatePrograms();
    updateSections();

    // Hide College Year Level by default
    if (gradeSelect.value !== "College") {
        yearLevelGroup.style.display = "none";
        yearLevelSelect.required = false;
        yearLevelSelect.value = "";
    } else {
        yearLevelGroup.style.display = "flex";
        yearLevelSelect.required = true;
    }
}

// CANCEL EDIT
cancelBtn.addEventListener("click", resetForm);

// SEARCH STUDENTS
searchInput.addEventListener("input", displayStudents);

// INITIAL PAGE SETUP
updatePrograms();
displayStudents();
