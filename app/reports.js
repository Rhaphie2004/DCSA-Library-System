function toCsv(headers, rows) {
  function cell(value) {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }
  return (
    "\ufeff" +
    [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") +
    "\r\n"
  );
}
function writeCsv(filename, headers, rows) {
  if (require("node:path").extname(filename).toLowerCase() !== ".csv")
    throw new Error("Choose a CSV filename ending in .csv.");
  const csv = toCsv(headers, rows);
  if (csv.length > 50000000)
    throw new Error("Report is too large. Select a narrower range.");
  require("node:fs").writeFileSync(filename, csv, { encoding: "utf8" });
}
module.exports = { toCsv, writeCsv };
