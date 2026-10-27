import { playerId } from "./data.js";

const RED = "#e67c73";
const WHITE = "#ffffff";
const GREEN = "#57bb8a";
const statistics = new Set(["AP", "GL", "AS", "CS", "GL/G", "AS/G", "CS%", "TAP", "TGL", "TAS", "TCS", "FAP", "FGL", "FAS", "FCS"]);
const matchRatings = new Set(["MR", "TMR", "FMR"]);
const competitionGroups = new Map([
  ["UCL", "continental"], ["UEL", "continental"], ["UECL", "continental"],
  ["Champions League", "continental"], ["Europa League", "continental"], ["Conference League", "continental"],
  ["Premier League", "league"], ["Championship", "league"], ["League One", "league"], ["League Two", "league"],
  ["League", "league"],
  ["FA Cup", "cup"], ["League Cup", "cup"], ["League Trophy", "cup"], ["L. Cup", "cup"], ["L. Trophy", "cup"],
  ["Super Cup", "one-off"], ["Community Shield", "one-off"], ["C. Shield", "one-off"],
]);
const competitionColors = {
  continental: "#e8f0fe",
  league: "#ddf2f0",
  cup: "#ffe6dd",
  "one-off": "#f4e5f7",
};

export function competitionGroup(label) {
  return competitionGroups.get(label) || null;
}

function blend(start, end, amount) {
  const channels = [1, 3, 5].map(index => {
    const from = parseInt(start.slice(index, index + 2), 16);
    const to = parseInt(end.slice(index, index + 2), 16);
    return Math.round(from + (to - from) * Math.max(0, Math.min(1, amount)));
  });
  return `rgb(${channels.join(", ")})`;
}

function scale(value, minimum, maximum, midpoint) {
  if (midpoint !== undefined) {
    return value < midpoint
      ? blend(RED, WHITE, midpoint === minimum ? 1 : (value - minimum) / (midpoint - minimum))
      : blend(WHITE, GREEN, maximum === midpoint ? 0 : (value - midpoint) / (maximum - midpoint));
  }
  return blend(WHITE, GREEN, maximum === minimum ? 0 : (value - minimum) / (maximum - minimum));
}

export function createCellFormatter(table) {
  const values = columns => table.rows.flatMap(row => columns.flatMap(column => {
    const value = row[column.key]?.value;
    return typeof value === "number" && Number.isFinite(value) ? [value] : [];
  }));
  const bounds = numbers => {
    if (!numbers.length) return { min: 0, max: 0, median: 0 };
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return {
      min: sorted[0],
      max: sorted.at(-1),
      median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    };
  };
  const ranges = new Map(table.columns.map(column => [column.key, bounds(values([column]))]));
  const timelineColumns = table.columns.filter(column => column.label === "Start" || /^\d{2}\/\d{2}$/.test(column.label));
  const timelineRange = bounds(values(timelineColumns));
  const honours = table.sheet === "Player_Titles";
  const titleColumns = honours ? table.columns.slice(table.columns.findIndex(column => column.label === "Titles") + 1).map(column => column.label) : [];
  const totalRanges = new Map();
  if (honours) {
    for (const label of ["Titles", "TotS"]) {
      totalRanges.set(label, bounds(table.rows.filter(row => playerId(row, table) !== null)
        .map(row => row[table.columns.find(column => column.label === label)?.key]?.value)
        .filter(value => typeof value === "number" && Number.isFinite(value))));
    }
  }
  return (column, value) => {
    const label = column.label;
    const group = honours || table.sheet === "Team_Stats" ? competitionGroup(label) : null;
    const groupStyle = group ? { backgroundColor: competitionColors[group] } : {};
    if (typeof value !== "number" || !Number.isFinite(value)) return groupStyle;
    const range = ranges.get(column.key);
    const timeline = timelineColumns.includes(column);
    if (honours) {
      if (titleColumns.includes(label) && value > 0) return { ...groupStyle, color: "#34a853" };
      if (totalRanges.has(label)) {
        const totalRange = totalRanges.get(label);
        return { backgroundColor: scale(value, totalRange.min, totalRange.max) };
      }
    }
    if (table.sheet === "Players" && label === "Yrs Active") return { backgroundColor: scale(value, range.min, range.max) };
    if (["Ovr", "Pot"].includes(label) || (table.sheet === "Ratings_Timeline" && (timeline || ["Min", "Max"].includes(label)))) {
      return { backgroundColor: scale(value, 50, 95, 70) };
    }
    if (matchRatings.has(label) || (table.sheet === "MR_Timeline" && (timeline || label === "Max"))) {
      return { backgroundColor: scale(value, 4, 10, 7) };
    }
    if (["Gr", "CV", "CW"].includes(label)) {
      if (table.sheet === "Val_Timeline" && label === "CV") return { backgroundColor: scale(value, range.min, range.max, 0) };
      return value === 0 ? {} : { color: value > 0 ? "#00a931" : "#ff0000" };
    }
    if ((label === "Inj Wks" && value > 0) || (label === "Cnt YR" && value === 0)) return { color: "#ff0000" };
    if (table.sheet === "Team_Stats") {
      if (label === "W%") return { backgroundColor: scale(value, 0, 1, 0.5) };
      if (label === "Squad Value") return { backgroundColor: scale(value, range.min, range.max) };
      if (["GD", "Transfer Profit"].includes(label) && value !== 0) return { color: value > 0 ? "#00a931" : "#ff0000" };
    }
    if (groupStyle.backgroundColor) return { ...groupStyle, ...(titleColumns.includes(label) && value > 0 ? { color: "#34a853" } : {}) };
    if (table.sheet === "Val_Timeline" && timeline) return { backgroundColor: scale(value, 0, timelineRange.max) };
    if (statistics.has(label)) return { backgroundColor: scale(value, range.min, range.max) };
    if (["AP_Timeline", "GL_Timeline", "AS_Timeline", "CS_Timeline", "GL_G_Timeline", "AS_G_Timeline", "CS_Pct_Timeline", "Wage_Timeline"].includes(table.sheet) && (timeline || label === "Total")) {
      const group = timeline ? timelineRange : range;
      return { backgroundColor: scale(value, group.min, group.max) };
    }
    return {};
  };
}
