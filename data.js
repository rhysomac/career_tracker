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
};

export const HELP = {
  "Cl #": "Club number", "Pl #": "Player number", Nat: "Nationality",
  AN: "Age", Age: "Age", "Age Now": "Age", Pos: "Position 1", Pos1: "Position 1", Pos2: "Position 2", Pos3: "Position 3", Pos4: "Position 4", Ovr: "Overall rating",
  Pot: "Potential", Gr: "Overall growth", SM: "Skill moves", WF: "Weak foot",
  AP: "Appearances", GL: "Goals", AS: "Assists", CS: "Clean sheets",
  MR: "Match rating", "GL/G": "Goals per game", "AS/G": "Assists per game",
  "CS%": "Clean sheet percentage", "Height (cm)": "Height (cm)", "Weight (kg)": "Weight (kg)",
  Val: "Market value", CV: "Change in value",
  CW: "Change in wage", "Cnt YR": "Contract years", "Inj Wks": "Weeks injured",
  TAP: "Total appearances", TGL: "Total goals", TAS: "Total assists",
  TCS: "Total clean sheets", TMR: "Total match rating",
  FAP: "Friendly appearances", FGL: "Friendly goals", FAS: "Friendly assists",
  FCS: "Friendly clean sheets", FMR: "Friendly match rating",
  "Yrs Active": "Years Active",
};

export const POSITION_ORDER = ["GK", "RB", "CB", "LB", "CDM", "RM", "CM", "LM", "CAM", "RW", "ST", "LW"];

export function titleCase(value) {
  const minor = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or", "per", "the", "to", "with"]);
  return String(value).split(" ").map((word, index) =>
    index > 0 && minor.has(word.toLowerCase()) ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export function awardTitle(label) {
  return ({ PotS: "Player of the Season", YPotS: "Young Player of the Season", "Most CS": "Most Clean Sheets" })[label] || titleCase(label);
}

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
  if (sheet === "Season_Awards") return normalizeSeasonAwards(table);
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
  const result = { sheet, columns, rows };
  if (sheet === "Players_Stats") result.leaderboards = statsLeaderboards(table);
  return result;
}

export const LEADERBOARD_METRICS = ["AP", "GL", "AS", "CS", "MR", "GL/G", "AS/G", "CS%"];

function statsLeaderboards(table) {
  const blocks = table.rows.filter(row => row.c.filter(entry => entry?.v === "Name").length >= 4);
  return Object.fromEntries(LEADERBOARD_METRICS.map((metric, index) => {
    const header = blocks[Math.floor(index / 4)];
    if (!header) return [metric, null];
    const nameIndex = header.c.flatMap((entry, offset) => entry?.v === "Name" ? [offset] : [])[index % 4];
    const start = table.rows.indexOf(header) + 1;
    const rows = [];
    for (const row of table.rows.slice(start)) {
      const rank = row.c[nameIndex - 1];
      if (typeof rank?.v !== "number") break;
      const entry = offset => ({ value: row.c[offset]?.v ?? null, text: row.c[offset]?.f ?? String(row.c[offset]?.v ?? "") });
      rows.push({ rank: entry(nameIndex - 1), name: entry(nameIndex), position: entry(nameIndex + 1), stat: entry(nameIndex + 2) });
    }
    return [metric, {
      sheet: "Players_Stats",
      isLeaderboard: true,
      columns: [{ key: "rank", label: "#", type: "number" }, { key: "name", label: "Name", type: "string" },
        { key: "position", label: "Pos", type: "string" }, { key: "stat", label: metric, type: "number" }],
      rows,
    }];
  }));
}

export function normalizeSeasonAwards(table) {
  const positions = ["GK", "RB", "RCB", "LCB", "LB", "RDM", "LDM", "RM", "LM", "CAM", "ST"];
  const heading = table.rows.findIndex(row => row.c.some(entry => entry?.v === "GK") && row.c.some(entry => entry?.v === "ST"));
  const other = table.rows.findIndex(row => row.c[0]?.v === "Other");
  if (heading < 0 || other < 0) throw new Error("Season_Awards must contain ToTS position headings and an Other block.");
  const parseBlock = (headerIndex, end, labels, numericSelections = false) => {
    const header = table.rows[headerIndex];
    const seen = new Set();
    const columns = [{ key: "season", label: "Season", type: "string" },
      ...labels.map((label, index) => ({ key: `selection${index}`, label, type: "string" }))];
    const rows = table.rows.slice(headerIndex + 1, end).filter(row => {
      const season = row.c[0]?.v;
      if (!/^\d{2}\/\d{2}$/.test(String(season)) || seen.has(season)) return false;
      seen.add(season);
      return true;
    }).map(row => {
      const idStart = row.c.findIndex((entry, index) => index > labels.length && entry?.v === row.c[0].v);
      return Object.fromEntries(columns.map((column, index) => {
        if (!index) return [column.key, timelineCell(row.c[0].v)];
        const source = header.c.findIndex(entry => entry?.v === column.label);
        const id = idStart >= 0 ? row.c[idStart + index]?.v : null;
        const text = numericSelections && idStart >= 0 && typeof id !== "number" ? null : source >= 0 ? row.c[source]?.v : null;
        const name = isMissing(text) && typeof id === "number" ? `Player ${id}` : text;
        return [column.key, { ...timelineCell(name), players: isMissing(name) ? [] : [{ id: typeof id === "number" ? String(id) : null, text: String(name) }] }];
      }));
    });
    return { sheet: "Season_Awards", columns, rows };
  };
  const lineup = parseBlock(heading, other, positions, true);
  const awardsHeader = other + 1;
  const labels = table.rows[awardsHeader]?.c.slice(1).map(entry => entry?.v).filter(value => typeof value === "string" && value.trim());
  if (!labels?.length) throw new Error("Season_Awards Other block has no award headings.");
  const awards = parseBlock(awardsHeader, table.rows.length, labels);
  // Keep the numeric selections authoritative while retaining names for unlinked records.
  lineup.columns.slice(1).forEach(column => {
    for (const row of lineup.rows) {
      const selection = row[column.key].players[0];
      row[column.key].value = selection?.id ? Number(selection.id) : row[column.key].value;
    }
  });
  lineup.columns.slice(1).forEach(column => { column.type = "number"; });
  return { ...lineup, awards };
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
  if (isMissing(cell(row, table, "Cl #").value)) return true;
  const youth = cell(row, table, "Yt#").value ?? cell(row, table, "Yt #").value;
  return table.columns.some(column => column.label === "Pl #") && !isMissing(youth) &&
    ["Pl #", "Join Date", "Dep Date"].every(label => isMissing(cell(row, table, label).value));
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
      const id = idColumn && typeof selection === "number" ? String(selection) : null;
      const nameSelection = idColumn && table.sheet === "Season_Awards" ? row[idColumn.key]?.text : selection;
      const roster = squadBySeason[cell(row, table, "Season").value];
      const player = id ? roster?.rows.find(entry => playerId(entry, roster) === id) : null;
      const profile = id && squadBySeason.Players?.rows.find(entry => playerId(entry, squadBySeason.Players) === id);
      const name = profile ? cell(profile, squadBySeason.Players, "Preferred Name").value :
        player ? cell(player, roster, "Name").value : id ? `Player ${id}` : isMissing(nameSelection) ? null : nameSelection;
      return { position, x, y, id: id || (player ? playerId(player, roster) : null), name, number: player ? cell(player, roster, "Pl #").text : "" };
    }),
  }));
}

function timelineCell(value) {
  return value === undefined || value === null || value === ""
    ? { value: null, text: "" }
    : { value, text: String(value) };
}

export function createSeasonStatTimeline(workbook, seasons, sourceLabel, sheet) {
  const template = workbook[({ "GL/G": "GL_Timeline", "AS/G": "AS_Timeline", "CS%": "CS_Timeline" })[sourceLabel]];
  const columns = template ? template.columns.map(column => ({
    key: ({ "Cl #": "id", Name: "name", Total: "Max" })[column.label] || column.label,
    label: column.label === "Total" ? "Max" : column.label,
    type: column.type,
  })) : [
    { key: "id", label: "Cl #", type: "number" },
    { key: "name", label: "Name", type: "string" },
    { key: "Start", label: "Start", type: "number" },
    ...seasons.map(season => ({ key: season, label: season, type: "number" })),
    { key: "Max", label: "Max", type: "number" },
  ];
  const timelineSeasons = columns.filter(column => /^\d{2}\/\d{2}$/.test(column.label)).map(column => column.label);
  const templateRows = new Map((template?.rows || []).flatMap(row => {
    const id = playerId(row, template);
    return id ? [[id, row]] : [];
  }));
  const players = new Map();
  for (const season of ["Start", ...seasons]) {
    const table = workbook[season];
    if (!table) continue;
    for (const row of table.rows) {
      const id = playerId(row, table);
      const name = cell(row, table, "Preferred Name").value || cell(row, table, "Name").value;
      if (!name) continue;
      const key = id || row;
      if (!players.has(key)) players.set(key, { id, name, values: {} });
      const entry = cell(row, table, sourceLabel);
      if (!isMissing(entry.value)) players.get(key).values[season] = entry;
    }
  }
  for (const player of players.values()) {
    for (const season of timelineSeasons) {
      const entry = player.values[season];
      if (typeof entry?.value === "number" && Number.isFinite(entry.value) &&
          (!player.values.Max || entry.value > player.values.Max.value)) {
        player.values.Max = entry;
      }
    }
  }
  return {
    sheet,
    columns,
    rows: [...players.values()].map(player => Object.fromEntries(columns.map(column => {
      if (column.label === "Cl #") return [column.key, timelineCell(player.id === null ? null : Number(player.id))];
      if (column.label === "Name") return [column.key, timelineCell(player.name)];
      if (["Start", "Max", ...timelineSeasons].includes(column.label)) {
        return [column.key, player.values[column.label] || timelineCell(null)];
      }
      const source = templateRows.get(player.id);
      return [column.key, source ? cell(source, template, column.label) : timelineCell(null)];
    }))),
  };
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
  if (name === "Season_Awards") url.searchParams.set("headers", "0");
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
  const derivedTimelines = new Set(["GL_G_Timeline", "AS_G_Timeline", "CS_Pct_Timeline"]);
  const names = ["Settings", "Players", "Start", "Youth", "Players_Stats", "Player_Titles", "Titles_Timeline", "Season_Awards", "Team_Stats",
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
  workbook.TotS = workbook.Season_Awards;
  const seasons = ratings.columns.filter(column => /^\d{2}\/\d{2}$/.test(column.label) &&
    ratings.rows.some(row => !isMissing(row[column.key].value))).map(column => column.label);
  if (!seasons.length) throw new Error("No populated seasons were found in Ratings_Timeline.");
  await Promise.all(seasons.map(async season => { workbook[season] = await fetchSheet(season); }));
  workbook.GL_G_Timeline = createSeasonStatTimeline(workbook, seasons, "GL/G", "GL_G_Timeline");
  workbook.AS_G_Timeline = createSeasonStatTimeline(workbook, seasons, "AS/G", "AS_G_Timeline");
  workbook.CS_Pct_Timeline = createSeasonStatTimeline(workbook, seasons, "CS%", "CS_Pct_Timeline");
  return { workbook, seasons };
}
