export const POSITIONS = ["GK", "RB", "CB", "LB", "CDM", "RM", "CM", "LM", "CAM", "RW", "ST", "LW"];
export const FORMATION = [
  { id: "ST", position: "ST", x: 50, y: 12 },
  { id: "LM", position: "LM", x: 16, y: 33 },
  { id: "CAM", position: "CAM", x: 50, y: 33 },
  { id: "RM", position: "RM", x: 84, y: 33 },
  { id: "LDM", position: "CDM", x: 34, y: 53 },
  { id: "RDM", position: "CDM", x: 66, y: 53 },
  { id: "LB", position: "LB", x: 13, y: 73 },
  { id: "LCB", position: "CB", x: 38, y: 73 },
  { id: "RCB", position: "CB", x: 62, y: 73 },
  { id: "RB", position: "RB", x: 87, y: 73 },
  { id: "GK", position: "GK", x: 50, y: 91 },
];
export const emptyState = () => {
  const lineups = [{}, {}, {}];
  return { version: 1, players: [], activeLineup: 0, lineups, lineup: lineups[0] };
};

export function validateLineup(value, ids) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Saved XI is invalid.");
  const used = new Set();
  for (const [slot, id] of Object.entries(value)) {
    if (!FORMATION.some(s => s.id === slot) || typeof id !== "string" || !id ||
        (ids && !ids.has(id)) || used.has(id)) throw new Error("Saved XI has invalid or repeated assignments.");
    used.add(id);
  }
  return { ...value };
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function number(value, label, min, max, required = false) {
  const raw = text(value);
  if (!raw || raw === "-") {
    if (required) throw new Error(`${label} is required.`);
    return null;
  }
  const result = Number(raw);
  if (!Number.isInteger(result) || result < min || result > max) {
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return result;
}

export function makePlayer(values, id = crypto.randomUUID()) {
  const name = text(values.name);
  if (!name || name.length > 100) throw new Error("Player name is required (maximum 100 characters).");
  const nation = text(values.nation);
  if (nation.length > 80) throw new Error("Nation must be at most 80 characters.");
  if (!Array.isArray(values.positions)) throw new Error("Player positions must be a list.");
  const positions = [...new Set(values.positions.map(p => text(p).toUpperCase()).filter(p => p && p !== "-"))];
  if (!positions.length || positions.length > 4 || positions.some(p => !POSITIONS.includes(p))) {
    throw new Error("Choose one to four valid positions.");
  }
  return {
    id, name, ovr: number(values.ovr, "OVR", 1, 99, true),
    pot: number(values.pot, "POT", 1, 99), age: number(values.age, "Age", 14, 60),
    nation, positions,
    photo: /^\d{3}\.png$/i.test(text(values.photo)) ? text(values.photo) : "",
  };
}

export function placePlayer(state, playerId, slotId) {
  if (!state.players.some(p => p.id === playerId)) throw new Error("That player is no longer in the squad.");
  if (!FORMATION.some(s => s.id === slotId)) throw new Error("Unknown formation position.");
  const activeLineup = state.activeLineup || 0;
  if ((state.lineups || []).some((lineup, index) => index !== activeLineup && Object.values(lineup).includes(playerId))) {
    throw new Error("That player is already assigned to another XI.");
  }
  const lineup = { ...state.lineup };
  const source = Object.keys(lineup).find(key => lineup[key] === playerId);
  if (source === slotId) return state;
  const displaced = lineup[slotId];
  if (source) {
    if (displaced) lineup[source] = displaced;
    else delete lineup[source];
  }
  lineup[slotId] = playerId;
  const lineups = [...(state.lineups || [state.lineup, {}, {}])];
  lineups[activeLineup] = lineup;
  return { ...state, lineups, lineup };
}

export function selectLineup(state, index) {
  if (!Number.isInteger(index) || index < 0 || index > 2) throw new Error("Unknown XI.");
  const lineups = state.lineups || [state.lineup, {}, {}];
  return { ...state, activeLineup: index, lineups, lineup: lineups[index] };
}

export function removePlayerFromLineup(state, playerId) {
  const lineup = Object.fromEntries(Object.entries(state.lineup).filter(([, id]) => id !== playerId));
  const lineups = [...(state.lineups || [state.lineup, {}, {}])];
  lineups[state.activeLineup || 0] = lineup;
  return { ...state, lineups, lineup };
}

export function validateState(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.players) ||
      (!value.lineup && !Array.isArray(value.lineups))) {
    throw new Error("This is not a supported Touchline squad backup.");
  }
  const ids = new Set();
  const players = value.players.map(p => {
    if (!p || typeof p.id !== "string" || !p.id || ids.has(p.id)) throw new Error("Backup contains invalid or duplicate player IDs.");
    ids.add(p.id);
    return makePlayer(p, p.id);
  });
  const rawLineups = Array.isArray(value.lineups) ? [...value.lineups] : [value.lineup, {}, {}];
  if (rawLineups.length !== 3) throw new Error("A squad plan must contain exactly three XIs.");
  const activeLineup = Number.isInteger(value.activeLineup) && value.activeLineup >= 0 && value.activeLineup < 3 ? value.activeLineup : 0;
  if (value.lineup && JSON.stringify(rawLineups[activeLineup]) !== JSON.stringify(value.lineup)) {
    rawLineups[activeLineup] = value.lineup;
  }
  const usedAcrossXIs = new Set();
  const lineups = rawLineups.map(lineup => {
    const validated = validateLineup(lineup, ids);
    const unique = Object.fromEntries(Object.entries(validated).filter(([, id]) => {
      if (usedAcrossXIs.has(id)) return false;
      usedAcrossXIs.add(id);
      return true;
    }));
    return unique;
  });
  return { version: 1, players, activeLineup, lineups, lineup: lineups[activeLineup] };
}

export function parseDelimited(input) {
  // Detect the delimiter outside quoted fields, so commas in CSV names remain intact.
  let quoted = false;
  let delimiter = ",";
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '"') {
      if (quoted && input[i + 1] === '"') i++;
      else quoted = !quoted;
    }
    if (!quoted && input[i] === "\t") { delimiter = "\t"; break; }
    if (!quoted && /[\r\n]/.test(input[i])) break;
  }
  const rows = [];
  let row = [], field = "", inQuotes = false, closedQuote = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; closedQuote = true; }
      } else field += char;
    } else if (char === delimiter || char === "\n" || char === "\r") {
      row.push(field); field = ""; closedQuote = false;
      if (char !== delimiter) {
        rows.push(row); row = [];
        if (char === "\r" && input[i + 1] === "\n") i++;
      }
    } else if (char === '"' && !field && !closedQuote) {
      inQuotes = true;
    } else {
      if (closedQuote || char === '"') throw new Error("Malformed quoted field in pasted data.");
      field += char;
    }
  }
  if (inQuotes) throw new Error("Unclosed quote in pasted data.");
  row.push(field); rows.push(row);
  return rows;
}

export function playersFromRows(rows) {
  const players = [];
  rows.forEach((row, index) => {
    if (row.every(cell => !text(cell))) return;
    if (text(row[0]).replace(/^\uFEFF/, "").toLowerCase() === "name" && text(row[1]).toUpperCase() === "OVR") return;
    try {
      players.push(makePlayer({
        name: row[0], ovr: row[1], pot: row[2], age: row[3], nation: row[4],
        positions: row.slice(5, 9),
      }));
    } catch (error) {
      throw new Error(`Row ${index + 1}: ${error.message}`);
    }
  });
  if (!players.length) throw new Error("No player rows found. Copy columns A-I, including at least a name, OVR and primary position.");
  return players;
}

export function playersFromGoogle(textResponse) {
  const start = textResponse.indexOf("{"), end = textResponse.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Google returned an unreadable response. Try Paste rows instead.");
  const response = JSON.parse(textResponse.slice(start, end + 1));
  if (response.status !== "ok" || !response.table) throw new Error("Google could not read the sheet. Check sharing permissions or use Paste rows.");
  const columns = response.table.cols.map(c => text(c.label).toLowerCase());
  const headers = ["name", "ovr", "pot", "age", "nation", "pos1", "pos2", "pos3", "pos4"];
  if (headers.some(h => !columns.includes(h))) throw new Error("The sheet must contain Name, OVR, POT, Age, Nation and Pos1-Pos4 headers.");
  return playersFromRows(response.table.rows.map(row => headers.map(h => row.c[columns.indexOf(h)]?.v ?? "")));
}
