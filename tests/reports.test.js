const { test } = require("node:test");
const assert = require("node:assert/strict");
const { toCsv, writeCsv } = require("../app/reports");

test("CSV preserves commas, quotes and newlines while neutralizing spreadsheet formulas", () => {
  const csv = toCsv(
    ["Name", "Title"],
    [
      ["Ana, Cruz", 'A "book"'],
      ["=2+2", "line1\nline2"],
      ["\t@SUM(A1)", "normal"],
    ],
  );
  assert.equal(
    csv,
    '\ufeff"Name","Title"\r\n"Ana, Cruz","A ""book"""\r\n"\'=2+2","line1\nline2"\r\n"\'\t@SUM(A1)","normal"\r\n',
  );
});

test("report export refuses a database filename and preserves the existing file", (t) => {
  const fs = require("node:fs"),
    os = require("node:os"),
    path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dcsa-report-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const database = path.join(dir, "library.sqlite");
  fs.writeFileSync(database, "preserve");
  assert.throws(() => writeCsv(database, ["Name"], [["Ana"]]), /CSV filename/i);
  assert.equal(fs.readFileSync(database, "utf8"), "preserve");
  const report = path.join(dir, "report.csv");
  writeCsv(report, ["Name"], [["Ana"]]);
  assert.equal(fs.readFileSync(report, "utf8"), '\ufeff"Name"\r\n"Ana"\r\n');
});
