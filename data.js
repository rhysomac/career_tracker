export const SHEET_ID = "13Cvuf9mP9oOWTY9i4w54VQyFszhQJTd1oVAE-JrFS_E";

export const TIMELINES = {
  Ratings_Timeline: "Overall rating",
  AP_Timeline: "Appearances",
  GL_Timeline: "Goals",
  AS_Timeline: "Assists",
  CS_Timeline: "Clean sheets",
  GL_G_Timeline: "Goals per game",
  AS_G_Timeline: "Assists per game",
  CS_Pct_Timeline: "Clean sheet percentage",
  MR_Timeline: "Match rating",
  Pos1_Timeline: "Position",
  Val_Timeline: "Market value",
  Wage_Timeline: "Wage",
};

export const HELP = {
  "Cl #": "Club number", "Pl #": "Player number", Nat: "Nationality",
  AN: "Age at season end", Age: "Age at season end", Pos1: "Primary position", Ovr: "Overall rating",
  Pot: "Potential", Gr: "Overall growth", SM: "Skill moves", WF: "Weak foot",
  AP: "Appearances", GL: "Goals", AS: "Assists", CS: "Clean sheets",
  MR: "Match rating", "GL/G": "Goals per game", "AS/G": "Assists per game",
  "CS%": "Clean sheet percentage", "Height (cm)": "Height (cm)", "Weight (kg)": "Weight (kg)",
  Val: "Market value", CV: "Change in value",
  CW: "Change in wage", "Cnt YR": "Contract years", "Inj Wks": "Injury weeks",
  TAP: "Total appearances", TGL: "Total goals", TAS: "Total assists",
  TCS: "Total clean sheets", TMR: "Total match rating",
  FAP: "Friendly appearances", FGL: "Friendly goals", FAS: "Friendly assists",
  FCS: "Friendly clean sheets", FMR: "Friendly match rating",
  "Yrs Active": "Years active",
};

export const POSITION_ORDER = ["GK", "RB", "CB", "LB", "CDM", "RM", "CM", "LM", "CAM", "RW", "ST", "LW"];

export function formatSeason(value) {
  const match = /^(\d{2})\/(\d{2})$/.exec(String(value));
  if (!match) return String(value);
  const start = 2000 + Number(match[1]);
  const end = 2000 + Number(match[2]) + (Number(match[2]) < Number(match[1]) ? 100 : 0);
  return `${start}-${String(end).slice(-2)}`;
}

export function parseResponse(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Google returned an unreadable response.");
  const response = JSON.parse(text.slice(start, end + 1));
  if (response.status !== "ok" || !response.table) {
    throw new Error(response.errors?.map(error => error.detailed_message || error.message).join("; ") || "Google could not read this tab.");
  }
  return response.table;
}

export function normalizeTable(table, sheet) {
  if (sheet === "Titles_Timeline") return normalizeTitlesTimeline(table);
  const columns = table.cols.flatMap((column, index) => {
    const sourceLabel = column.label.trim();
    if (["Age Frac", "Age Frac Dep"].includes(sourceLabel) || /^Sq\s*#$/i.test(sourceLabel)) return [];
    const label = ({ Height: "Height (cm)", Weight: "Weight (kg)" })[sourceLabel] ||
      sourceLabel || (index === 0 && ["Team_Stats", "TotS"].includes(sheet) ? "Season" :
        index === 0 && sheet === "Settings" ? "Current date" : "");
    return label ? [{ key: column.id, label, type: column.type, index }] : [];
  });
  const rows = table.rows.map(row => Object.fromEntries(columns.map(column => {
    const cell = row.c[column.index];
    return [column.key, { value: cell?.v ?? null, text: cell?.f ?? String(cell?.v ?? "") }];
  }))).filter(row => columns.some(column => !isMissing(row[column.key].value)));
  return { sheet, columns, rows };
}

export function normalizeTitlesTimeline(table) {
  const header = table.rows[0]?.c;
  const starts = table.cols.flatMap((column, index) => column.label.trim() ? [{ index, competition: column.label.trim() }] : []);
  if (!header || !starts.length || header[1]?.v !== "Name") {
    throw new Error("Titles_Timeline must have competition headings followed by the player/season header row.");
  }
  const first = starts[0].index;
  const end = starts[1]?.index ?? table.cols.length;
  const seasonsByOffset = new Map();
  for (let index = first; index < end; index++) {
    if (/^\d{2}\/\d{2}$/.test(String(header[index]?.v))) seasonsByOffset.set(index - first, header[index].v);
  }
  if (!seasonsByOffset.size) throw new Error("Titles_Timeline has no season headings.");
  const columns = [{ key: table.cols[0].id, label: "Cl #", type: "number", index: 0 }];
  for (let group = 0; group < starts.length; group++) {
    const { index: start, competition } = starts[group];
    const next = starts[group + 1]?.index ?? table.cols.length;
    for (let index = start; index < next; index++) {
      const season = header[index]?.v || seasonsByOffset.get(index - start);
      if (!/^\d{2}\/\d{2}$/.test(String(season))) continue;
      columns.push({ key: table.cols[index].id, label: `${competition} ${season}`, competition, season, type: table.cols[index].type, index });
    }
  }
  const rows = table.rows.slice(1).filter(row => typeof row.c[0]?.v === "number").map(row =>
    Object.fromEntries(columns.map(column => {
      const entry = row.c[column.index];
      return [column.key, { value: entry?.v ?? null, text: entry?.f ?? String(entry?.v ?? "") }];
    })));
  return { sheet: "Titles_Timeline", columns, rows };
}

export function seasonTitles(table, id, season) {
  const row = table.rows.find(row => playerId(row, table) === id);
  if (!row) return [];
  return [...new Set(table.columns.filter(column => column.season === season && Number(row[column.key]?.value) > 0)
    .map(column => column.competition))];
}

export function titleSeasons(table, id, competition) {
  const row = table.rows.find(row => playerId(row, table) === id);
  if (!row) return [];
  return [...new Set(table.columns.filter(column => column.competition === competition && Number(row[column.key]?.value) > 0)
    .map(column => column.season))].sort();
}

export function isMissing(value) {
  return value === null || value === undefined || value === "" || value === "-";
}

export function cell(row, table, label) {
  return row?.[table.columns.find(column => column.label === label)?.key] ?? { value: null, text: "" };
}

export function playerId(row, table) {
  const value = cell(row, table, "Cl #").value;
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

export function academyPlayer(row, table) {
  return isMissing(cell(row, table, "Cl #").value);
}

export const FORMATION = [
  ["ST", 50, 12], ["LM", 15, 32], ["CAM", 50, 32], ["RM", 85, 32],
  ["LDM", 33, 53], ["RDM", 67, 53],
  ["LB", 12, 73], ["LCB", 37, 73], ["RCB", 63, 73], ["RB", 88, 73],
  ["GK", 50, 90],
];

export function seasonLineups(table, squadBySeason = {}) {
  const seen = new Set();
  return table.rows.filter(row => {
    const season = cell(row, table, "Season").value;
    if (!/^\d{2}\/\d{2}$/.test(season) || seen.has(season)) return false;
    seen.add(season);
    return true;
  }).map(row => ({
    season: cell(row, table, "Season").value,
    players: FORMATION.map(([position, x, y]) => {
      const idColumn = table.columns.find(column => column.label === position && column.type === "number");
      const selection = idColumn ? row[idColumn.key]?.value : cell(row, table, position).value;
      const id = idColumn && !isMissing(selection) ? String(selection) : null;
      const roster = squadBySeason[cell(row, table, "Season").value];
      const player = roster?.rows.find(entry => idColumn ? playerId(entry, roster) === id : cell(entry, roster, "Name").value === selection);
      const profile = id && squadBySeason.Players?.rows.find(entry => playerId(entry, squadBySeason.Players) === id);
      const name = profile ? cell(profile, squadBySeason.Players, "Preferred Name").value :
        player ? cell(player, roster, "Name").value : idColumn ? (id ? `Player ${id}` : null) : selection;
      return { position, x, y, id: id || (player ? playerId(player, roster) : null), name, number: player ? cell(player, roster, "Pl #").text : "" };
    }),
  }));
}

function timelineCell(value) {
  return value === undefined || value === null || value === ""
    ? { value: null, text: "" }
    : { value, text: String(value) };
}

export function createSeasonStatTimeline(workbook, seasons, sourceLabel, sheet, totalLabel = sourceLabel) {
  const columns = [
    { key: "id", label: "Cl #", type: "number" },
    { key: "name", label: "Name", type: "string" },
    { key: "Start", label: "Start", type: "number" },
    ...seasons.map(season => ({ key: season, label: season, type: "number" })),
    { key: "Total", label: "Total", type: "number" },
  ];
  const players = new Map();
  for (const season of ["Start", ...seasons]) {
    const table = workbook[season];
    if (!table) continue;
    for (const row of table.rows) {
      const id = playerId(row, table);
      const name = cell(row, table, "Preferred Name").value || cell(row, table, "Name").value;
      if (!name) continue;
      const key = id || String(name);
      if (!players.has(key)) players.set(key, { id, name, values: {} });
      const value = cell(row, table, sourceLabel).value;
      if (!isMissing(value)) players.get(key).values[season] = value;
    }
  }
  const career = workbook.Players_Stats;
  for (const row of career?.rows || []) {
    const id = playerId(row, career);
    const name = cell(row, career, "Preferred Name").value || cell(row, career, "Name").value;
    const player = players.get(id || String(name));
    if (player && !isMissing(cell(row, career, totalLabel).value)) {
      player.values.Total = cell(row, career, totalLabel).value;
    }
  }
  return {
    sheet,
    columns,
    rows: [...players.values()].map(player => ({
      id: timelineCell(player.id === null ? null : Number(player.id)),
      name: timelineCell(player.name),
      Start: timelineCell(player.values.Start),
      ...Object.fromEntries(seasons.map(season => [season, timelineCell(player.values[season])])),
      Total: timelineCell(player.values.Total),
    })),
  };
}

export function createWageTimeline(workbook, seasons) {
  const timeline = createSeasonStatTimeline(workbook, seasons, "Wage", "Wage_Timeline");
  for (const row of timeline.rows) {
    if (!isMissing(row.Total.value)) continue;
    const latestWage = [...seasons].reverse().map(season => row[season]).find(value => !isMissing(value.value));
    if (latestWage) row.Total = latestWage;
  }
  return timeline;
}

export function sortRows(rows, key, direction = "asc", label = "") {
  const sign = direction === "asc" ? 1 : -1;
  const positionPriority = new Map(POSITION_ORDER.map((position, index) => [position, index]));
  return [...rows].sort((a, b) => {
    const left = a[key]?.value;
    const right = b[key]?.value;
    if (isMissing(left) || isMissing(right)) return isMissing(left) === isMissing(right) ? 0 : isMissing(left) ? 1 : -1;
    if (typeof left === "number" && typeof right === "number") return (left - right) * sign;
    if (label === "DOB") {
      const dateValue = value => {
        const match = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        return match ? Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : null;
      };
      const leftDate = dateValue(left);
      const rightDate = dateValue(right);
      if (leftDate !== null && rightDate !== null) return (leftDate - rightDate) * sign;
    }
    if (/^(Pos\d*|Join Pos)$/.test(label)) {
      const leftPosition = positionPriority.get(String(left).toUpperCase());
      const rightPosition = positionPriority.get(String(right).toUpperCase());
      if (leftPosition !== undefined || rightPosition !== undefined) {
        if (leftPosition === undefined) return 1;
        if (rightPosition === undefined) return -1;
        return (leftPosition - rightPosition) * sign;
      }
    }
    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" }) * sign;
  });
}

export async function fetchSheet(name) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`);
  url.search = new URLSearchParams({ tqx: "out:json", headers: "1", sheet: name, cache: Date.now().toString() });
  if (name === "Settings") {
    url.searchParams.set("range", "A4:A5");
    url.searchParams.set("headers", "0");
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), cache: "no-store" });
  if (!response.ok) throw new Error(`${name}: Google returned HTTP ${response.status}.`);
  return normalizeTable(parseResponse(await response.text()), name);
}

export function sortSquadRows(rows, table, statusForRow) {
  let sorted = [...rows];
  for (const [label, direction] of [["DOB", "asc"], ["Pot", "desc"], ["Ovr", "desc"], ["Pos1", "asc"]]) {
    const column = table.columns.find(column => column.label === label);
    if (column) sorted = sortRows(sorted, column.key, direction, label);
  }
  const ranks = { Active: 0, "On loan": 1, Departed: 2, "Youth academy": 3 };
  return sorted.sort((a, b) => {
    const rank = row => academyPlayer(row, table) ? 3 : ranks[statusForRow(row)] ?? 3;
    return rank(a) - rank(b);
  });
}

export async function loadWorkbook(onProgress) {
  const derivedTimelines = new Set(["GL_G_Timeline", "AS_G_Timeline", "CS_Pct_Timeline", "Wage_Timeline"]);
  const names = ["Settings", "Players", "Start", "Youth", "Players_Stats", "Player_Titles", "Titles_Timeline", "TotS", "Team_Stats",
    ...Object.keys(TIMELINES).filter(name => !derivedTimelines.has(name))];
  const workbook = {};
  // Keep requests bounded to avoid overwhelming Google's public endpoint.
  for (let i = 0; i < names.length; i += 4) {
    const results = await Promise.allSettled(names.slice(i, i + 4).map(async name => {
      try {
        workbook[name] = await fetchSheet(name);
        onProgress(`Reading spreadsheet (${Object.keys(workbook).length}/${names.length} tabs)…`);
      } catch (error) {
        throw new Error(`Could not load ${name}: ${error.message}`, { cause: error });
      }
    }));
    const failure = results.find(result => result.status === "rejected");
    if (failure) throw failure.reason;
  }
  const ratings = workbook.Ratings_Timeline;
  const seasons = ratings.columns.filter(column => /^\d{2}\/\d{2}$/.test(column.label) &&
    ratings.rows.some(row => !isMissing(row[column.key].value))).map(column => column.label);
  if (!seasons.length) throw new Error("No populated seasons were found in Ratings_Timeline.");
  await Promise.all(seasons.map(async season => { workbook[season] = await fetchSheet(season); }));
  workbook.GL_G_Timeline = createSeasonStatTimeline(workbook, seasons, "GL/G", "GL_G_Timeline");
  workbook.AS_G_Timeline = createSeasonStatTimeline(workbook, seasons, "AS/G", "AS_G_Timeline");
  workbook.CS_Pct_Timeline = createSeasonStatTimeline(workbook, seasons, "CS%", "CS_Pct_Timeline");
  workbook.Wage_Timeline = createWageTimeline(workbook, seasons);
  return { workbook, seasons };
}
