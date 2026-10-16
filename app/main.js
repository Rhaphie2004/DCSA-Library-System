const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { Library } = require("./library");
const { writeCsv } = require("./reports");

app.setName("DCSA Library");
let win, library, timer;
let backupError = "",
  lastBackup = "",
  dialogBusy = false;
const page = path.join(__dirname, "..", "HTML", "homepage.html");
const pageUrl = pathToFileURL(page).href;
const allowed = new Set([
  "status",
  "setup",
  "login",
  "logout",
  "snapshot",
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
  "backup",
  "restore",
  "export",
  "print",
]);

function automaticBackup() {
  if (!library?.db || !library.get("SELECT id FROM staff LIMIT 1")) return;
  try {
    lastBackup = library.dailyBackup(
      path.join(app.getPath("userData"), "backups"),
    );
    backupError = "";
  } catch (error) {
    backupError = `Automatic backup failed: ${error.message}. Use Backup now and check available storage.`;
  }
}

async function call(event, action, data) {
  try {
    if (
      event.sender !== win?.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      event.senderFrame.url.split("#")[0] !== pageUrl
    )
      throw new Error("Untrusted application window.");
    if (
      !allowed.has(action) ||
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    )
      throw new Error("Invalid library operation.");
    if (dialogBusy)
      throw new Error("Finish the open dialog before another operation.");
    let result;
    if (["backup", "restore", "export", "print"].includes(action)) {
      library.requireSession(["backup", "restore"].includes(action));
      dialogBusy = true;
      try {
        if (action === "backup") {
          const choice = await dialog.showSaveDialog(win, {
            title: "Save library backup (choose a new filename)",
            defaultPath: `dcsa-backup-${library.today()}-${Date.now()}.sqlite`,
            filters: [{ name: "Library backup", extensions: ["sqlite"] }],
          });
          if (choice.canceled) return { ok: true, data: null };
          result = { path: library.backup(choice.filePath) };
        } else if (action === "restore") {
          const choice = await dialog.showOpenDialog(win, {
            title: "Select DCSA library backup",
            properties: ["openFile"],
            filters: [{ name: "Library backup", extensions: ["sqlite"] }],
          });
          if (choice.canceled) return { ok: true, data: null };
          const confirmation = await dialog.showMessageBox(win, {
            type: "warning",
            buttons: ["Cancel", "Restore backup"],
            defaultId: 0,
            cancelId: 0,
            message: "Replace current records with this backup?",
            detail:
              "A safety backup of current records will be kept. You will be signed out after restoration.",
          });
          if (confirmation.response !== 1) return { ok: true, data: null };
          result = library.restore(choice.filePaths[0]);
          automaticBackup();
        } else if (action === "export") {
          if (
            !Array.isArray(data.headers) ||
            data.headers.length > 30 ||
            !Array.isArray(data.rows) ||
            data.rows.length > 100000 ||
            !data.rows.every(
              (row) =>
                Array.isArray(row) &&
                row.length === data.headers.length &&
                row.every(
                  (value) =>
                    value == null ||
                    ["string", "number", "boolean"].includes(typeof value),
                ),
            )
          )
            throw new Error("Invalid report data.");
          const choice = await dialog.showSaveDialog(win, {
            title: "Export report",
            defaultPath: `dcsa-report-${library.today()}.csv`,
            filters: [{ name: "CSV report", extensions: ["csv"] }],
          });
          if (choice.canceled) return { ok: true, data: null };
          writeCsv(choice.filePath, data.headers, data.rows);
          result = { path: choice.filePath };
        } else {
          await new Promise((resolve, reject) =>
            win.webContents.print(
              { printBackground: false },
              (success, reason) =>
                success
                  ? resolve()
                  : reject(new Error(reason || "Printing was cancelled.")),
            ),
          );
          result = true;
        }
      } finally {
        dialogBusy = false;
      }
    } else {
      result = library.execute(action, data);
      if (action === "setup" || action === "login") automaticBackup();
      if (action === "snapshot")
        result.backup = {
          path: lastBackup,
          error: backupError,
          dataFolder: app.getPath("userData"),
        };
    }
    return { ok: true, data: result };
  } catch (error) {
    console.error(
      `Library operation ${String(action)} failed: ${error.message}`,
    );
    return {
      ok: false,
      error: error.message || "Operation failed. No success was recorded.",
    };
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    show: false,
    title: "DCSA Library",
    icon: path.join(__dirname, "..", "dcsa.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (url.split("#")[0] !== pageUrl) event.preventDefault();
  });
  win.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  win.once("ready-to-show", () => win.show());
  win.on("close", (event) => {
    if (dialogBusy) event.preventDefault();
  });
  win.on("closed", () => {
    win = null;
  });
  win.loadFile(page);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    try {
      library = new Library(
        path.join(app.getPath("userData"), "library.sqlite"),
      );
      Menu.setApplicationMenu(null);
      ipcMain.handle("library:call", call);
      automaticBackup();
      timer = setInterval(automaticBackup, 60000);
      createWindow();
    } catch (error) {
      dialog.showErrorBox(
        "Library could not start",
        `${error.message}\n\nExisting records have not been reset. Check storage and file permissions.`,
      );
      app.exit(1);
    }
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    clearInterval(timer);
    library?.close();
  });
}
