const { app } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const dir = process.argv[2];
const phase = process.argv[3];
app.setPath("userData", dir);
app.on("browser-window-created", (_event, win) => {
  win.webContents.setBackgroundThrottling(false);
  const errors = [];
  win.webContents.on("console-message", (_event, level, message) => {
    if (level === 3) errors.push(message);
  });
  win.webContents.on("did-finish-load", async () => {
    const run = (code) =>
      Promise.race([
        win.webContents.executeJavaScript(code, true),
        new Promise((_, reject) => {
          const timeout = setTimeout(
            () => reject(new Error(`Renderer did not respond: ${code}`)),
            10000,
          );
          timeout.unref();
        }),
      ]);
    const wait = async (code) => {
      for (let i = 0; i < 200; i++) {
        if (await run(code)) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`UI timeout: ${code}; ${errors.join("; ")}`);
    };
    const submit = (form, values) =>
      run(
        `(() => { const form=document.getElementById(${JSON.stringify(form)}); for(const [name,value] of Object.entries(${JSON.stringify(values)})){ const input=form.elements.namedItem(name); if(!input) throw new Error('Missing input '+name); input.value=String(value); input.dispatchEvent(new Event('input',{bubbles:true})); } if(!form.reportValidity()) throw new Error('Invalid form '+form.id); form.requestSubmit(); })()`,
      );
    try {
      await wait("document.querySelector('form') !== null");
      if (phase === "create") {
        await submit("setupForm", {
          name: "Test Librarian",
          username: "admin",
          password: "DesktopPassword123!",
          loanDays: 7,
          maxLoans: 2,
          blockOverdue: "true",
        });
        await wait("document.querySelector('[data-view=students]') !== null");
        await run("document.querySelector('[data-view=students]').click()");
        await wait("document.getElementById('studentForm') !== null");
        await submit("studentForm", {
          studentNo: "00123",
          fullName: "Ana Cruz",
          grade: "College",
          program: "BSIT",
          section: "A",
        });
        await wait(
          "document.getElementById('view').textContent.includes('Ana Cruz') && !document.getElementById('studentForm').elements.fullName.value",
        );
        await run("document.querySelector('[data-view=books]').click()");
        await wait("document.getElementById('bookForm') !== null");
        await submit("bookForm", {
          code: "BK001",
          title: "Programming",
          author: "A. Author",
          shelf: "Shelf A",
        });
        await wait(
          "document.querySelector('#copyForm [name=bookId] option[value=\"1\"]') !== null",
        );
        await submit("copyForm", { bookId: 1, accession: "ACC-001" });
        await wait(
          "document.getElementById('view').textContent.includes('ACC-001')",
        );
        await run("document.querySelector('[data-view=borrow]').click()");
        await wait(
          "document.querySelector('#borrowForm [name=copyId] option[value=\"1\"]') !== null",
        );
        await submit("borrowForm", { studentId: 1, copyId: 1 });
        await wait(
          "document.querySelector('#loanRows [data-action=return]') !== null",
        );
        assert.ok(
          (await run("document.getElementById('view').textContent")).includes(
            "Ana Cruz",
          ),
        );
        await run(
          "document.querySelector('#loanRows [data-action=return]').click()",
        );
        await wait("document.getElementById('returnForm') !== null");
        await submit("returnForm", { condition: "Good" });
        await wait(
          "document.querySelector('#loanRows')?.textContent.includes('Returned')",
        );
        await run("document.querySelector('[data-view=records]').click()");
        await wait(
          "document.querySelector('#loanRows')?.textContent.includes('ACC-001')",
        );
        await run("document.querySelector('[data-view=students]').click()");
        await wait(
          "document.querySelector('[data-action=editStudent][data-id=\"1\"]') !== null",
        );
        await run(
          "document.querySelector('[data-action=editStudent][data-id=\"1\"]').click()",
        );
        await submit("studentForm", { studentNo: "00999" });
        await wait(
          "document.querySelector('#studentRows')?.textContent.includes('00999') && !document.querySelector('#studentForm [name=fullName]').value",
        );
        await run(
          "document.querySelector('[data-action=studentHistory][data-id=\"1\"]').click()",
        );
        await wait(
          "document.querySelector('#loanRows')?.textContent.includes('Ana Cruz')",
        );
        assert.ok(
          (
            await run("document.getElementById('loanRows').textContent")
          ).includes("00123"),
          "History must retain the identifier recorded at checkout",
        );
        await run("document.querySelector('[data-view=dashboard]').click()");
        await wait(
          "document.querySelector('[data-summary=available]')?.textContent === '1'",
        );
        console.log(
          "Setup, registration, inventory, checkout and return UI passed.",
        );
        await run(
          "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
        );
        await win.webContents
          .capturePage()
          .then((img) =>
            fs.writeFileSync(
              path.join(__dirname, "..", "test-results", "dashboard.png"),
              img.toPNG(),
            ),
          );
      } else {
        await submit("loginForm", {
          username: "admin",
          password: "DesktopPassword123!",
        });
        await wait(
          "document.querySelector('[data-summary=available]')?.textContent === '1'",
        );
        await run("document.querySelector('[data-view=records]').click()");
        await wait(
          "document.querySelector('#loanRows')?.textContent.includes('Returned')",
        );
        assert.equal(
          (await run("window.library.call('snapshot')")).data.students[0]
            .studentNo,
          "00999",
        );
        await run(
          "(async()=>{for(let i=2;i<=25;i++){const result=await window.library.call('addCopy',{bookId:1,accession:'ACC-'+String(i).padStart(3,'0')});if(!result.ok)throw new Error(result.error);}})()",
        );
        await run("document.querySelector('[data-view=books]').click()");
        await wait("document.getElementById('copyForm') !== null");
        await submit("copyForm", { bookId: 1, accession: "ACC-026" });
        await wait(
          "document.querySelector('#copyRows .pagination')?.textContent.includes('26 records')",
        );
        await run(
          "document.querySelector('#copyRows [data-action=next]').click()",
        );
        await wait(
          "document.querySelector('#copyRows')?.textContent.includes('ACC-026')",
        );
        assert.ok(
          !(
            await run("document.getElementById('copyRows').textContent")
          ).includes("ACC-001"),
          "Second page must not repeat the first copy",
        );
        win.webContents.debugger.attach("1.3");
        await win.webContents.debugger.sendCommand(
          "Emulation.setEmulatedMedia",
          { media: "print" },
        );
        assert.equal(
          await run(
            "getComputedStyle(document.getElementById('titleRows').closest('section')).display",
          ),
          "none",
          "Inventory print must show the filtered copies report, not unfiltered titles",
        );
        await win.webContents.debugger.sendCommand(
          "Emulation.setEmulatedMedia",
          { media: "" },
        );
        win.webContents.debugger.detach();
        await run(
          "(async()=>{await window.library.call('saveStudent',{studentNo:'ARCHIVED',fullName:'Archived Student'});await window.library.call('archiveStudent',{id:2,active:false,reason:'Graduated'});await window.library.call('saveBook',{code:'ARCHIVED',title:'Archived Title',author:'Old Author'});await window.library.call('archiveBook',{id:2,active:false,reason:'Withdrawn'});})()",
        );
        await submit("copyForm", { bookId: 1, accession: "ACC-027" });
        await wait(
          "document.querySelector('#copyRows .pagination')?.textContent.includes('27 records')",
        );
        await run("document.querySelector('[data-view=dashboard]').click()");
        await wait(
          "document.querySelector('[data-summary=students]')?.textContent==='1'",
        );
        await run(
          "document.querySelector('[data-summary=students]').closest('button').click()",
        );
        assert.ok(
          !(
            await run("document.getElementById('studentRows').textContent")
          ).includes("Archived Student"),
          "Active-student card must open only active students",
        );
        await run("document.querySelector('[data-view=dashboard]').click()");
        await run(
          "document.querySelector('[data-summary=titles]').closest('button').click()",
        );
        assert.ok(
          !(
            await run("document.getElementById('titleRows').textContent")
          ).includes("Archived Title"),
          "Active-title card must open only active titles",
        );
      }
      assert.deepEqual(errors, []);
      console.log(`DESKTOP ${phase} PASSED`);
      app.exit(0);
    } catch (error) {
      console.error(error.stack);
      app.exit(1);
    }
  });
});
fs.mkdirSync(path.join(__dirname, "..", "test-results"), { recursive: true });
require("../app/main");
