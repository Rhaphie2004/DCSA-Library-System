function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function dayNumber(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Enter a valid date.");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new Error("Enter a valid date.");
  return parsed.getTime() / 86400000;
}
function addDays(date, count) {
  return new Date((dayNumber(date) + count) * 86400000)
    .toISOString()
    .slice(0, 10);
}
module.exports = { localDate, dayNumber, addDays };
