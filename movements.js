import { cell, isMissing, playerId } from "./data.js";

const DAY = 86400000;
const YEAR = 365.25 * DAY;

export function spreadsheetDate(value) {
  const text = String(value);
  const google = /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,.*)?\)$/.exec(text);
  const display = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const parts = google ? [Number(google[1]), Number(google[2]), Number(google[3])] :
    display ? [Number(display[3]), Number(display[2]) - 1, Number(display[1])] :
    iso ? [Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])] : null;
  if (!parts) return null;
  const date = new Date(Date.UTC(...parts));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] && date.getUTCDate() === parts[2]
    ? date.getTime() : null;
}

function dateText(value) {
  const date = new Date(value);
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

export function buildMovementHistories(workbook, seasons) {
  const clock = workbook.Settings;
  const currentDate = spreadsheetDate(cell(clock.rows[0], clock, "Current date").value);
  if (currentDate === null) throw new Error("Settings must contain a valid current in-game date in A5.");
  const histories = new Map();
  const names = new Map();
  for (const row of workbook.Players.rows) {
    const id = playerId(row, workbook.Players);
    if (!id) continue;
    histories.set(id, { events: [], totalYears: null, issues: [], currentDate: dateText(currentDate) });
    for (const label of ["Preferred Name", "Full Name", "Name"]) {
      const name = cell(row, workbook.Players, label).value;
      if (!isMissing(name)) {
        const ids = names.get(name) || new Set();
        ids.add(id);
        names.set(name, ids);
      }
    }
  }
  const text = entry => isMissing(entry.value) ? "-" : entry.text;
  for (const table of [workbook.Players, workbook.Start, ...seasons.map(season => workbook[season])]) {
    for (const row of table.rows) {
      const name = cell(row, table, "Name").value;
      const matches = names.get(name);
      const id = playerId(row, table) || (matches?.size === 1 ? [...matches][0] : null);
      if (!id) continue;
      if (!histories.has(id)) histories.set(id, { events: [], totalYears: null, issues: [], currentDate: dateText(currentDate) });
      const history = histories.get(id);
      for (const [prefix, kind, clubField] of [["Join", "Joined", "From"], ["Dep", "Departed", "To"]]) {
        const sourceDate = cell(row, table, `${prefix} Date`);
        if (isMissing(sourceDate.value)) continue;
        const date = spreadsheetDate(sourceDate.value);
        if (date === null) {
          history.issues.push(`Invalid ${kind.toLowerCase()} date: ${sourceDate.text}.`);
          continue;
        }
        const event = {
          kind, date, dateText: dateText(date),
          club: text(cell(row, table, `${prefix} ${clubField}`)),
          age: text(cell(row, table, `${prefix} Age`)),
          fee: text(cell(row, table, `${prefix} Fee`)),
          transferType: text(cell(row, table, `${prefix} Type`)),
          yearsActive: null,
        };
        const duplicate = history.events.find(entry => entry.kind === kind && entry.date === date);
        if (duplicate) {
          for (const field of ["club", "age", "fee", "transferType"]) {
            if (duplicate[field] === "-") duplicate[field] = event[field];
          }
        } else history.events.push(event);
      }
    }
  }
  for (const [id, history] of histories) {
    const recorded = [...history.events];
    for (const departure of recorded.filter(event => event.kind === "Departed" && /loan/i.test(event.transferType))) {
      const duration = /loan\s*(?:(\d+)\s*yr|(\d+)\s*m)\b/i.exec(departure.transferType);
      if (!duration || (duration[2] && Number(duration[2]) !== 6)) {
        history.issues.push(`Loan return date cannot be determined for ${departure.dateText} (${departure.transferType}).`);
        continue;
      }
      const date = new Date(departure.date);
      const seasonStart = date.getUTCFullYear() - (date.getUTCMonth() < 6 ? 1 : 0);
      const returnDate = duration[1] ? Date.UTC(seasonStart + Number(duration[1]), 6, 1) :
        date.getUTCMonth() >= 6 ? Date.UTC(seasonStart + 1, 0, 1) : Date.UTC(seasonStart + 1, 6, 1);
      if (returnDate > currentDate || recorded.some(event =>
        event.date > departure.date && event.date <= returnDate &&
        (event.kind === "Joined" || !/loan/i.test(event.transferType)))) continue;
      const person = workbook.Players.rows.find(row => playerId(row, workbook.Players) === id);
      const birthDate = spreadsheetDate(cell(person, workbook.Players, "DOB").value);
      const birth = birthDate === null ? null : new Date(birthDate);
      const returned = new Date(returnDate);
      const age = birth ? returned.getUTCFullYear() - birth.getUTCFullYear() -
        (returned.getUTCMonth() < birth.getUTCMonth() ||
          (returned.getUTCMonth() === birth.getUTCMonth() && returned.getUTCDate() < birth.getUTCDate()) ? 1 : 0) : null;
      history.events.push({
        kind: "Returned from loan", date: returnDate, dateText: dateText(returnDate),
        club: departure.club, age: age === null ? "-" : String(age), fee: "-",
        transferType: "Loan return", yearsActive: null,
      });
    }
    history.events.sort((a, b) => a.date - b.date || Number(a.kind === "Departed") - Number(b.kind === "Departed"));
    let active = null;
    let total = 0;
    let joined = false;
    for (const event of history.events) {
      if (event.date > currentDate) continue;
      if (event.kind === "Departed") {
        if (active) {
          active.yearsActive = (event.date - active.date) / YEAR;
          total += active.yearsActive;
          active = null;
        } else if (!joined) history.issues.push("A departure is recorded without an earlier joining date.");
      } else {
        if (active) history.issues.push(`The joining date ${event.dateText} overlaps an active spell.`);
        active = event;
        joined = true;
      }
    }
    if (active) {
      active.yearsActive = (currentDate - active.date) / YEAR;
      total += active.yearsActive;
    }
    if (!joined) history.issues.push("No joining date recorded.");
    history.issues = [...new Set(history.issues)];
    if (!history.issues.length) history.totalYears = total;
  }
  return histories;
}

export function applyActiveYears(workbook, histories) {
  const players = workbook.Players;
  let column = players.columns.find(column => column.label === "Yrs Active");
  if (!column) {
    column = { key: "__yearsActive", label: "Yrs Active", type: "number" };
    players.columns.push(column);
  }
  for (const row of players.rows) {
    const history = histories.get(playerId(row, players));
    const value = history?.totalYears ?? null;
    row[column.key] = { value, text: value === null ? "" : value.toFixed(1) };
  }
}
