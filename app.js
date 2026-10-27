import { TIMELINES, HELP, loadWorkbook, cell, playerId, isMissing, sortRows, sortSquadRows, seasonLineups, seasonTitles, titleSeasons, formatSeason, academyPlayer } from "./data.js";
import { competitionGroup, createCellFormatter } from "./formatting.js";
import { clubPlayersForSandbox } from "./sandbox-roster.js";
import { buildMovementHistories, applyActiveYears } from "./movements.js";

const view = document.querySelector("#view");
const status = document.querySelector("#status");
const errorBox = document.querySelector("#error");
const refresh = document.querySelector("#refresh");
let workbook;
let seasons;
let selectedSeason;
let metric = "Ratings_Timeline";
let query = "";
let playerNames = new Map();
let selectedTotsSeason;
const selectedSquadSources = new Set(["Active squad", "On loan"]);
let selectedProfilePeriod = "Total";
let selectedProfileMetric = "GL";
let sandboxFrame;
let sandboxRoster;
let movementHistories;

window.addEventListener("message", event => {
  if (event.origin !== location.origin || event.source !== sandboxFrame?.contentWindow || !sandboxRoster) return;
  if (event.data?.type === "touchline-ready") {
    sandboxFrame.contentWindow.postMessage(sandboxRoster, location.origin);
  } else if (event.data?.type === "touchline-height" && Number.isFinite(event.data.height) &&
             event.data.height >= 400 && event.data.height <= 8000) {
    sandboxFrame.style.height = `${Math.ceil(event.data.height)}px`;
  } else if (event.data?.type === "touchline-dialog") {
    sandboxFrame.scrollIntoView({ block: "start" });
    sandboxFrame.contentWindow.postMessage({ type: "touchline-viewport", height: window.innerHeight }, location.origin);
  }
});

function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function stars(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 5) throw new Error(`Invalid star rating: ${value}`);
  const rating = el("span", "star-rating", "\u2605".repeat(count));
  rating.setAttribute("role", "img");
  rating.setAttribute("aria-label", `${count} ${count === 1 ? "star" : "stars"}`);
  return rating;
}

function columnTitle(label) {
  return ({ "Yrs Active": "Years active", "Pl #": "Sq#", "Sq #": "Sq#" })[label] || formatSeason(label);
}

function movementType(label) {
  const loan = /^loan\s*(\d+)\s*(yr|m)$/i.exec(label);
  return loan ? `${loan[1]}-${loan[2].toLowerCase() === "yr" ? "year" : "month"} loan` : label;
}

function playerLink(id, name) {
  const link = el("a", "player-link", name);
  link.href = `#player/${encodeURIComponent(id)}`;
  return link;
}

function titleIcon(title) {
  const name = ({ UCL: "Champions League", UEL: "Europa League", UECL: "Conference League", "L. Cup": "League Cup", "L. Trophy": "League Trophy" })[title] || title;
  if (!competitionGroup(name)) return null;
  const image = el("img", "title-icon");
  image.src = `data/titles/${name.toLowerCase().replaceAll(" ", "-")}.png`;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  return image;
}

function playerRows(table) {
  return { ...table, rows: table.rows.filter(row => !isMissing(cell(row, table, "Name").value) || !isMissing(cell(row, table, "Preferred Name").value)) };
}

function playerStatus(row, table) {
  const departureType = cell(row, table, "Dep Type").value;
  if (!isMissing(departureType) && /loan/i.test(String(departureType))) return "On loan";
  if (!isMissing(cell(row, table, "Dep Date").value)) return "Departed";
  if (isMissing(cell(row, table, "Cl #").value)) return "Youth academy";
  return "Active";
}

function recordId(row, table) {
  const id = playerId(row, table);
  if (id) return id;
  const name = cell(row, table, "Preferred Name").value || cell(row, table, "Name").value;
  return isMissing(name) ? null : playerNames.get(name) || null;
}

function findPlayerRow(table, id) {
  return table?.rows.find(row => recordId(row, table) === id);
}

function statusForSeason(id, season) {
  const table = season === "Start" ? workbook.Start : workbook[season];
  const row = findPlayerRow(table, id);
  if (row) return playerStatus(row, table);
  if (season === "Start") return "Not at club";
  return "Not at club";
}

function statusForPlayerTab(row, table) {
  const id = playerId(row, table);
  if (!id) return "Departed";
  const latest = workbook[seasons.at(-1)];
  const latestRow = findPlayerRow(latest, id);
  return latestRow ? playerStatus(latestRow, latest) : "Departed";
}

function statusEntry(value) {
  return { value, text: value };
}

function withStatus(table, statusForRow) {
  const key = "__careerStatus";
  const nameIndex = table.columns.findIndex(column => ["Name", "Preferred Name"].includes(column.label));
  const columns = [...table.columns];
  if (!columns.some(column => column.label === "Status")) {
    columns.splice(nameIndex < 0 ? 0 : nameIndex + 1, 0, { key, label: "Status", type: "string" });
  }
  return {
    ...table,
    columns,
    rows: table.rows.map(row => ({ ...row, [key]: statusEntry(statusForRow(row)) })),
  };
}

function withTimelineStatuses(table, idForRow = row => recordId(row, table)) {
  return {
    ...table,
    rows: table.rows.map(row => {
      const id = idForRow(row);
      const statuses = Object.fromEntries(
        table.columns
          .filter(column => /^\d{2}\/\d{2}$/.test(column.label))
          .map(column => [column.key, id ? statusForSeason(id, column.label) : ""])
      );
      return { ...row, __timelineStatuses: statuses };
    }),
  };
}

function statusBadge(label) {
  return el("span", `status-badge status-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`, label);
}

function timelineLegend() {
  const legend = el("div", "status-legend");
  for (const label of ["Active", "On loan", "Departed", "Youth academy"]) {
    const item = el("span", "legend-item");
    item.append(el("span", `season-indicator status-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`), el("span", "", label));
    legend.append(item);
  }
  return legend;
}

function heading(title) {
  const header = el("div", "section-heading");
  const text = el("div");
  text.append(el("h2", "", title));
  header.append(text);
  view.append(header);
  return header;
}

function selectControl(label, options, value, onChange) {
  const wrapper = el("label", "control");
  const select = el("select");
  for (const [key, text] of options) {
    const option = el("option", "", formatSeason(text));
    option.value = key;
    select.append(option);
  }
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  wrapper.append(el("span", "", label), select);
  return wrapper;
}

function renderTable(table, { columns = table.columns, linkedNames = true, searchable = true, caption = "Spreadsheet data", format = true, defaultSort = null, defaultDirection = "desc", initialSort = null } = {}) {
  const container = el("section", "table-panel");
  const tools = el("div", "table-tools");
  const formatCell = format ? createCellFormatter(table) : () => ({});
  let search;
  if (searchable) {
    search = el("input");
    search.type = "search";
    search.placeholder = "Search this table…";
    search.setAttribute("aria-label", "Search this table");
    search.value = query;
    tools.append(search);
  }
  const scroller = el("div", "table-scroll");
  scroller.tabIndex = 0;
  scroller.setAttribute("role", "region");
  scroller.setAttribute("aria-label", `${caption}. Scroll horizontally to see all columns.`);
  const grid = el("table");
  const title = el("caption", "sr-only", caption);
  const thead = el("thead");
  const head = el("tr");
  const tbody = el("tbody");
  const defaultColumn = columns.find(column => column.label === defaultSort);
  let sortedKey = defaultColumn?.key || null;
  let direction = defaultDirection;
  const headers = new Map();
  for (const column of columns) {
    const th = el("th", ["Name", "Preferred Name"].includes(column.label) ? "name-column" : "");
    if (competitionGroup(column.label)) th.classList.add(`competition-${competitionGroup(column.label)}`);
    th.scope = "col";
    th.setAttribute("aria-sort", "none");
    const button = el("button", "", `${columnTitle(column.label)} ↕`);
    button.title = ["Pl #", "Sq #"].includes(column.label) ? "Squad number" : HELP[column.label] || formatSeason(column.label);
    button.addEventListener("click", () => {
      if (sortedKey === column.key) direction = direction === "asc" ? "desc" : "asc";
      else direction = table.sheet === "Pos1_Timeline" || /^(Age|Age Now|AN)$/.test(column.label) || /^(Pos\d*|Join Pos)$/.test(column.label) ? "asc" :
        column.type === "number" ? "desc" : "asc";
      sortedKey = column.key;
      drawRows();
    });
    th.append(button);
    head.append(th);
    headers.set(column.key, { th, button, column });
  }
  function drawRows() {
    const needle = (search?.value || "").trim().toLocaleLowerCase();
    let rows = table.rows.filter(row => !needle || columns.some(column =>
      row[column.key].text.toLocaleLowerCase().includes(needle) || formatSeason(row[column.key].text).toLocaleLowerCase().includes(needle)));
    if (sortedKey) rows = sortRows(rows, sortedKey, direction,
      table.sheet === "Pos1_Timeline" ? "Pos1" : headers.get(sortedKey)?.column.label);
    else if (initialSort) rows = initialSort(rows);
    for (const [key, { th, button, column }] of headers) {
      th.setAttribute("aria-sort", key === sortedKey ? direction === "asc" ? "ascending" : "descending" : "none");
      button.textContent = `${columnTitle(column.label)} ${key === sortedKey ? direction === "asc" ? "↑" : "↓" : "↕"}`;
      if (table.sheet === "Player_Titles") {
        const icon = titleIcon(column.label);
        if (icon) button.prepend(icon);
      }
    }
    tbody.replaceChildren();
    for (const row of rows) {
      const tr = el("tr");
      const id = recordId(row, table);
      for (const column of columns) {
        const entry = row[column.key];
        const missing = isMissing(entry.value);
        const td = el("td", typeof entry.value === "number" ? "numeric" : "");
        const isName = ["Name", "Preferred Name"].includes(column.label);
        if (isName) td.classList.add("name-column");
        if (competitionGroup(column.label)) td.classList.add(`competition-${competitionGroup(column.label)}`);
        const linkedId = isName ? id || playerNames.get(entry.text) : null;
        if (column.label === "Status") td.append(statusBadge(entry.text));
        else if (linkedNames && linkedId) td.append(playerLink(linkedId, entry.text));
        else if (!missing && ["SM", "WF"].includes(column.label)) td.append(stars(entry.value));
        else td.textContent = missing ? "—" : formatSeason(entry.text);
        if (column.label === "Yrs Active" && missing && movementHistories?.get(id)?.issues.length) {
          td.title = movementHistories.get(id).issues.join(" ");
        }
        Object.assign(td.style, entry.style || formatCell(column, entry.value));
        const seasonStatus = row.__timelineStatuses?.[column.key];
        if (seasonStatus && !["Not at club", "Not played yet"].includes(seasonStatus)) {
          const indicator = el("span", `season-indicator status-${seasonStatus.toLowerCase().replace(/[^a-z]+/g, "-")}`);
          indicator.title = `${formatSeason(column.label)}: ${seasonStatus}`;
          indicator.setAttribute("aria-label", `${formatSeason(column.label)}: ${seasonStatus}`);
          td.append(indicator);
        }
        tr.append(td);
      }
      tbody.append(tr);
    }
    if (!rows.length) {
      const td = el("td", "empty", "No matching rows.");
      td.colSpan = columns.length;
      const tr = el("tr");
      tr.append(td);
      tbody.append(tr);
    }
  }
  search?.addEventListener("input", () => { query = search.value; drawRows(); });
  thead.append(head);
  grid.append(title, thead, tbody);
  scroller.append(grid);
  if (searchable) container.append(tools);
  container.append(scroller);
  view.append(container);
  drawRows();
}

function profileBio(record, source, person, name, portrait, target) {
  const bioFields = [
    "Cl #", "Yt #", "Yt#", "Full Name", "Nat", "DOB", "Age Now",
    "Foot", "Height (cm)", "Weight (kg)", "Body Type", "Gen", "Academy",
    "Birthplace", "Yrs Active",
  ];
  const bio = new Map();
  const addFields = (table, row, fields) => {
    if (!row) return;
    for (const label of fields) {
      const value = cell(row, table, label);
      if (!isMissing(value.value) && !bio.has(label)) bio.set(label, { label, value });
    }
  };
  addFields(source, record, bioFields);
  if (!bio.has("Age Now")) addFields(source, record, ["Age"]);

  const players = workbook.Players;
  const youthId = cell(person || record, person ? players : source, "Yt #").value ||
    cell(person || record, person ? players : source, "Yt#").value;
  if (!isMissing(youthId)) {
    const youth = workbook.Youth;
    const youthRecord = youth.rows.find(row => cell(row, youth, "Yt #").value === youthId);
    addFields(youth, youthRecord, ["Academy", "Birthplace"]);
  }
  const history = movementHistories.get(playerId(record, source));
  bio.set("Yrs Active", { label: "Yrs Active", value: statusEntry(history?.totalYears === null || !history ? "-" : history.totalYears.toFixed(1)) });
  if (bio.has("Age Now")) {
    bio.set("Age", { label: "Age", value: bio.get("Age Now").value });
    bio.delete("Age Now");
  }
  bio.delete("Sq #");

  const section = el("section", "detail-section");
  const header = el("div", "bio-header");
  const identity = el("div", "bio-identity");
  identity.append(el("h2", "", name), statusBadge(person ? statusForPlayerTab(person, players) : playerStatus(record, source)));
  header.append(portrait, identity);
  section.append(header);
  const list = el("dl", "details");
  for (const { label, value } of bio.values()) {
    const item = el("div");
    const unit = label === "Height (cm)" ? "cm" : label === "Weight (kg)" ? "kg" : "";
    let display = unit && !new RegExp(`\\s${unit}$`, "i").test(value.text) ? `${value.text} ${unit}` : value.text;
    if (label === "Gen") display = ({ Y: "Yes", N: "No" })[value.text.toUpperCase()] || value.text;
    if (label === "Foot") display = ({ R: "Right", L: "Left" })[value.text.toUpperCase()] || value.text;
    const title = ({ Gen: "Generated" })[label] || HELP[label] || label;
    item.append(el("dt", "", title), el("dd", "", display));
    list.append(item);
  }
  section.append(list);
  target.append(section);
}

function profileStats(record, table, target, career = false) {
  if (!record) {
    target.append(el("p", "empty", "No statistics recorded."));
    return;
  }
  const formatter = createCellFormatter(table);
  const labels = { MR: "Average match rating", "Inj Wks": "Weeks injured", CV: "Change in value", CW: "Change in wage" };
  const groups = career ? [["Career stats", ["AP", "GL", "AS", "CS", "MR", "GL/G", "AS/G", "CS%"]]] : [
    ["Attributes", ["Positions", "Ovr", "Pot", "Gr", "SM", "WF"]],
    [formatSeason(table.sheet), ["AP", "GL", "AS", "CS", "MR", "GL/G", "AS/G", "CS%", "Inj Wks"]],
    ["Value", ["Val", "Wage", "CV", "CW"]],
  ];
  for (const [title, fields] of groups) {
    const section = el("section", "detail-section");
    section.append(el("h3", "", title));
    const list = el("dl", "details profile-stats");
    for (const label of fields) {
      const positions = label === "Positions" ? [...new Set([1, 2, 3, 4].map(i => cell(record, table, `Pos${i}`).text).filter(value => !isMissing(value)))] : [];
      const value = label === "Positions" ? { value: positions.join("/"), text: positions.join("/") } : cell(record, table, label);
      if (isMissing(value.value)) continue;
      const item = el("div");
      const detail = el("dd");
      if (["SM", "WF"].includes(label)) detail.append(stars(value.value));
      else detail.textContent = value.text;
      item.append(el("dt", "", labels[label] || HELP[label] || label), detail);
      const column = table.columns.find(column => column.label === label);
      if (column && ["Ovr", "Pot", "Gr", "MR", "CV", "CW"].includes(label)) Object.assign(item.style, formatter(column, value.value));
      list.append(item);
    }
    if (list.childElementCount) { section.append(list); target.append(section); }
  }
}

function profileMovements(id, target, season = null) {
  const section = el("section", "detail-section profile-movements");
  section.append(el("h3", "", "Movements"));
  const history = movementHistories.get(id);
  const startYear = season ? 2000 + Number(season.slice(0, 2)) : null;
  const events = (history?.events || []).filter(event => startYear === null ||
    (event.date >= Date.UTC(startYear, 6, 1) && event.date < Date.UTC(startYear + 1, 6, 1)));
  if (!history || history.issues.length) {
    section.append(el("p", "profile-note movement-warning", `Years active unavailable: ${history ? history.issues.join(" ") : "No movement records found."}`));
  }
  if (events.length) {
    const scroller = el("div", "table-scroll");
    scroller.tabIndex = 0;
    scroller.setAttribute("role", "region");
    scroller.setAttribute("aria-label", "Player movements. Scroll horizontally to see all columns.");
    const table = el("table");
    table.append(el("caption", "sr-only", "Player movements"));
    const head = el("thead");
    const headings = el("tr");
    for (const label of ["Movement", "Date", "From / To", "Age", "Fee", "Transfer type", "Years active"]) {
      const th = el("th", "", label);
      th.scope = "col";
      headings.append(th);
    }
    head.append(headings);
    const body = el("tbody");
    for (const event of events) {
      const row = el("tr");
      for (const value of [event.kind, event.dateText, event.club, event.age, event.fee, movementType(event.transferType),
        event.kind === "Departed" || event.yearsActive === null ? "-" : event.yearsActive.toFixed(1)]) {
        row.append(el("td", "", value));
      }
      body.append(row);
    }
    table.append(head, body);
    scroller.append(table);
    section.append(scroller);
  } else section.append(el("p", "profile-note", season ? "No movements recorded this season." : "No movements recorded."));
  target.append(section);
}

function profileHonours(id, target = view, season = null) {
  const selections = seasonLineups(workbook.TotS, workbook).filter(lineup =>
    lineup.players.some(player => (player.id || playerNames.get(player.name)) === id));
  if (season) {
    const selected = selections.some(lineup => lineup.season === season);
    const section = el("section", "detail-section honours-section");
    section.append(el("h3", "", "Honours"));
    const list = el("dl", "season-selection");
    const item = el("div");
    item.append(el("dt", "", "Team of the Season"), el("dd", "", selected ? "Yes" : "No"));
    list.append(item);
    section.append(list);
    const titles = seasonTitles(workbook.Titles_Timeline, id, season);
    if (titles.length) {
      const titleList = el("ul", "season-titles");
      for (const title of titles) {
        const item = el("li");
        const icon = titleIcon(title);
        if (icon) item.append(icon);
        item.append(el("span", "", title));
        titleList.append(item);
      }
      section.append(titleList);
    } else section.append(el("p", "profile-note", "No titles won this season."));
    target.append(section);
    return;
  }
  const honours = workbook.Player_Titles;
  const record = honours.rows.find(row => recordId(row, honours) === id);
  const rows = [];
  if (record) {
    for (const label of ["TotS", "Titles", "Champions League", "Europa League", "Conference League", "Premier League", "Championship", "League One", "League Two", "FA Cup", "League Cup", "League Trophy", "Super Cup", "Community Shield"]) {
      const value = cell(record, honours, label);
      if (typeof value.value === "number" && (value.value > 0 || ["TotS", "Titles"].includes(label))) rows.push({ honour: { value: label, text: label }, count: { value: value.value, text: value.text } });
    }
  }
  const section = el("section", "detail-section honours-section");
  section.append(el("h3", "", "Honours"));
  if (!rows.length) {
    section.append(el("p", "empty", "No honours recorded."));
    target.append(section);
    return;
  }
  const list = el("dl", "details profile-honours");
  const totals = ["Titles", "TotS"].flatMap(label => rows.filter(row => row.honour.text === label));
  const competitionRows = rows.filter(row => !["TotS", "Titles"].includes(row.honour.text));
  if (totals.length) {
    const totalList = el("dl", "profile-honour-totals");
    for (const row of totals) {
      const item = el("div");
      const detail = el("dd");
      detail.append(el("span", "honour-count", row.count.text));
      if (row.honour.text === "TotS" && (selections.length || row.count.value > 0)) {
        if (selections.length > 1) item.classList.add("multi-season");
        detail.append(el("span", "tots-seasons", selections.length
          ? selections.map(lineup => formatSeason(lineup.season)).join(", ")
          : "Selection seasons not recorded."));
      }
      item.append(el("dt", "", row.honour.text === "Titles" ? "Total titles" : "Team of the Season selections"), detail);
      totalList.append(item);
    }
    section.append(totalList);
  }
  for (const row of competitionRows) {
    const item = el("div");
    const name = el("dt");
    const icon = titleIcon(row.honour.text);
    if (icon) name.append(icon);
    name.append(el("span", "", row.honour.text));
    const detail = el("dd");
    detail.append(el("span", "honour-count", row.count.text));
    const wonSeasons = titleSeasons(workbook.Titles_Timeline, id, row.honour.text);
    if (wonSeasons.length > 1) item.classList.add("multi-season");
    const seasonList = el("span", "honour-seasons", wonSeasons.length ? wonSeasons.map(formatSeason).join(", ") : "Winning seasons not recorded.");
    detail.append(seasonList);
    item.append(name, detail);
    list.append(item);
  }
  section.append(list);
  target.append(section);
}

function profileChart(seasonRecords, target) {
  const metrics = { AP: "Appearances", GL: "Goals", AS: "Assists", CS: "Clean sheets", "GL/G": "Goals per game", "AS/G": "Assists per game", "CS%": "Clean sheet percentage", MR: "Average match rating", Ovr: "Overall rating", Pot: "Potential", Val: "Market value", Wage: "Wage" };
  const section = el("section", "detail-section profile-chart");
  const header = el("div", "profile-section-heading");
  header.append(el("h3", "", "Stats timeline"), selectControl("Statistic", Object.entries(metrics), selectedProfileMetric, value => {
    selectedProfileMetric = value;
    section.replaceWith(profileChart(seasonRecords, target));
  }));
  section.append(header);
  const points = seasonRecords.map(entry => ({ season: formatSeason(entry.season), ...cell(entry.row, entry.table, selectedProfileMetric) }));
  const values = points.filter(point => typeof point.value === "number" && Number.isFinite(point.value));
  if (!values.length) {
    section.append(el("p", "empty", "No seasonal values recorded for this statistic."));
  } else {
    const svgNode = (tag, attributes, text) => {
      const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const svg = svgNode("svg", { viewBox: "0 0 640 260", role: "img", "aria-label": `${metrics[selectedProfileMetric]} by season` });
    svg.append(svgNode("title", {}, `${metrics[selectedProfileMetric]} by season`));
    const maximum = Math.max(1, ...values.map(point => point.value));
    const minimum = Math.min(0, ...values.map(point => point.value));
    const x = index => points.length === 1 ? 340 : 66 + index * 540 / (points.length - 1);
    const y = value => 206 - (value - minimum) * 176 / (maximum - minimum);
    const wholeNumbers = ["Ovr", "Pot"].includes(selectedProfileMetric);
    const number = value => selectedProfileMetric === "MR" ? value.toFixed(1) :
      selectedProfileMetric === "CS%" ? `${Math.round(value * 100)}%` :
        new Intl.NumberFormat(undefined, { notation: wholeNumbers ? "standard" : "compact", maximumFractionDigits: wholeNumbers ? 0 : 2 }).format(value);
    const ticks = [...new Set(Array.from({ length: 5 }, (_, step) => {
      const value = minimum + (maximum - minimum) * step / 4;
      return wholeNumbers ? Math.round(value) : value;
    }))];
    for (const value of ticks) {
      svg.append(svgNode("line", { x1: 66, x2: 606, y1: y(value), y2: y(value), class: "chart-grid" }),
        svgNode("text", { x: 57, y: y(value) + 4, "text-anchor": "end", class: "chart-y-label" }, number(value)));
    }
    svg.append(svgNode("rect", { x: 66, y: 30, width: 540, height: 176, class: "chart-border" }));
    let previous = null;
    points.forEach((point, index) => {
      const valid = typeof point.value === "number" && Number.isFinite(point.value);
      if (index % Math.max(1, Math.ceil(points.length / 8)) === 0 || index === points.length - 1) {
        svg.append(svgNode("text", { x: x(index), y: 239, "text-anchor": "middle" }, point.season));
      }
      if (!valid) { previous = null; return; }
      if (previous) svg.append(svgNode("line", { x1: previous.x, y1: previous.y, x2: x(index), y2: y(point.value), class: "chart-line" }));
      const dot = svgNode("circle", { cx: x(index), cy: y(point.value), r: 4, tabindex: "0", class: "chart-dot", "aria-label": `${point.season}: ${point.text}` });
      dot.append(svgNode("title", {}, `${point.season}: ${point.text}`));
      svg.append(dot);
      previous = { x: x(index), y: y(point.value) };
    });
    section.append(svg);
    const list = el("dl", "chart-values");
    for (const point of points) {
      const item = el("div");
      item.append(el("dt", "", point.season), el("dd", "", isMissing(point.value) ? "—" : point.text));
      list.append(item);
    }
    section.append(list);
  }
  target.append(section);
  return section;
}

function profile(id) {
  const players = workbook.Players;
  const person = players.rows.find(row => recordId(row, players) === id);
  let source = players;
  let record = person;
  if (!record) {
    for (const table of [workbook.Start, ...[...seasons].reverse().map(season => workbook[season])]) {
      record = table.rows.find(row => playerId(row, table) !== null && recordId(row, table) === id);
      if (record) { source = table; break; }
    }
  }
  if (!record || !id || !/^\d+$/.test(id)) {
    heading("Player not found");
    view.append(Object.assign(el("a", "", "Back to players"), { href: "#players" }));
    return;
  }
  const name = cell(record, source, "Preferred Name").text || cell(record, source, "Name").text;
  const back = el("a", "back-link", "← Back to players");
  back.href = "#players";
  const toolbar = el("div", "profile-toolbar");
  toolbar.append(back);
  view.append(toolbar);
  const portrait = el("div", "portrait");
  const image = el("img");
  image.alt = `Portrait of ${name}`;
  const placeholder = el("span", "", name.split(/\s+/).map(word => word[0]).slice(0, 2).join(""));
  portrait.append(placeholder);
  const photoStatus = el("p", "photo-status", "Photo not yet added");
  const clubNumber = Number(cell(record, source, "Cl #").value);
  const imageStem = Number.isInteger(clubNumber) ? String(clubNumber).padStart(3, "0") : "000";
  const photoSources = [`data/players/${imageStem}.png`, `data/players/${imageStem}.PNG`];
  if (imageStem !== "000") photoSources.push("data/players/000.png");
  let photoIndex = 0;
  image.addEventListener("load", () => { placeholder.replaceWith(image); photoStatus.remove(); });
  image.addEventListener("error", () => {
    photoIndex += 1;
    if (photoIndex < photoSources.length) image.src = photoSources[photoIndex];
    else {
      image.remove();
      photoStatus.remove();
    }
  });
  image.src = photoSources[photoIndex];
  portrait.append(photoStatus);

  const layout = el("div", "profile-layout");
  const bioColumn = el("aside", "profile-bio");
  const statsColumn = el("div", "profile-main");
  layout.append(bioColumn, statsColumn);
  view.append(layout);
  profileBio(record, source, person, name, portrait, bioColumn);
  const career = workbook.Players_Stats;
  const careerRecord = career.rows.find(row => recordId(row, career) === id);
  const seasonRecords = seasons.map(season => {
    const table = workbook[season];
    const row = findPlayerRow(table, id);
    return row ? { season, table, row } : null;
  }).filter(Boolean);
  const periods = [["Total", "Career"], ...seasonRecords.map(entry => [entry.season, entry.season])];
  if (!periods.some(([value]) => value === selectedProfilePeriod)) selectedProfilePeriod = "Total";
  toolbar.append(selectControl("Period", periods, selectedProfilePeriod, value => {
    selectedProfilePeriod = value;
    render();
  }));
  if (selectedProfilePeriod === "Total") {
    profileStats(careerRecord, career, statsColumn, true);
  } else {
    const selected = seasonRecords.find(entry => entry.season === selectedProfilePeriod);
    if (selected) {
      profileStats(selected.row, selected.table, statsColumn);
    }
  }
  profileHonours(id, bioColumn, selectedProfilePeriod === "Total" ? null : selectedProfilePeriod);
  if (selectedProfilePeriod === "Total") profileChart(seasonRecords, statsColumn);
  profileMovements(id, statsColumn, selectedProfilePeriod === "Total" ? null : selectedProfilePeriod);
}

function renderTeamOfSeason() {
  const lineups = seasonLineups(workbook.TotS, workbook);
  const header = heading("Team of the Season");
  if (!lineups.length) {
    view.append(el("p", "empty", "No Team of the Season records found."));
    return;
  }
  if (!lineups.some(lineup => lineup.season === selectedTotsSeason)) {
    selectedTotsSeason = [...lineups].reverse().find(lineup => lineup.players.some(player => !isMissing(player.name)))?.season || lineups[0].season;
  }
  header.append(selectControl("Season", lineups.map(lineup => [lineup.season, lineup.season]), selectedTotsSeason, value => { selectedTotsSeason = value; render(); }));
  const lineup = lineups.find(entry => entry.season === selectedTotsSeason);
  const panel = el("section", "formation-panel");
  panel.append(el("h3", "formation-title", formatSeason(lineup.season)));
  if (lineup.players.every(player => isMissing(player.name))) panel.append(el("p", "lineup-empty", `No Team of the Season recorded for ${formatSeason(lineup.season)} yet.`));
  const pitch = el("div", "pitch");
  pitch.setAttribute("role", "group");
  pitch.setAttribute("aria-label", `${formatSeason(lineup.season)} Team of the Season, 4-2-3-1 wide formation`);
  pitch.append(el("div", "pitch-lines"), el("div", "centre-circle"), el("div", "penalty-area top"), el("div", "penalty-area bottom"));
  for (const player of lineup.players) {
    const slot = el("div", "formation-player");
    slot.style.left = `${player.x}%`;
    slot.style.top = `${player.y}%`;
    slot.dataset.position = player.position;
    const shirt = el("span", "shirt", player.number || "—");
    shirt.setAttribute("aria-hidden", "true");
    const card = el("div", "formation-name");
    const name = isMissing(player.name) ? "Not selected" : player.name;
    card.append(el("span", "sr-only", `${player.position}, number ${player.number || "unknown"}: `));
    const id = player.id || playerNames.get(player.name);
    const playerRecord = id && workbook.Players.rows.find(row => playerId(row, workbook.Players) === id);
    const clubNumber = Number(cell(playerRecord, workbook.Players, "Cl #").value);
    const imageStem = Number.isInteger(clubNumber) ? String(clubNumber).padStart(3, "0") : "000";
    const portrait = el("img", "tots-player-photo");
    portrait.alt = isMissing(player.name) ? "" : `Portrait of ${player.name}`;
    const photoSources = [`data/players/${imageStem}.png`, `data/players/${imageStem}.PNG`];
    if (imageStem !== "000") photoSources.push("data/players/000.png");
    let photoIndex = 0;
    portrait.addEventListener("error", () => {
      photoIndex += 1;
      if (photoIndex < photoSources.length) portrait.src = photoSources[photoIndex];
      else portrait.remove();
    });
    portrait.src = photoSources[photoIndex];
    card.append(id ? playerLink(id, name) : el("span", "", name));
    if (!isMissing(player.name)) card.prepend(portrait);
    slot.append(shirt, card);
    pitch.append(slot);
  }
  panel.append(pitch);
  view.append(panel);
}

function render() {
  if (!workbook) return;
  view.replaceChildren();
  const [page, id] = location.hash.slice(1).split("/");
  const route = page || "squad";
  sandboxFrame = null;
  sandboxRoster = null;
  document.querySelectorAll("[data-nav]").forEach(link => {
    if (link.dataset.nav === (route === "player" ? "players" : route)) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (route === "player") {
    profile(decodeURIComponent(id || ""));
    return;
  }
  if (route === "squad") {
    const header = heading("Squad");
    header.append(selectControl("Season", [...seasons].reverse().map(season => [season, season]).concat([["Start", "Start"]]), selectedSeason, value => { selectedSeason = value; render(); }));
    const roster = playerRows(workbook[selectedSeason]);
    const rows = roster.rows.filter(row => {
      const currentStatus = playerStatus(row, roster);
      const source = academyPlayer(row, roster) ? "Youth academy" : currentStatus === "Active" ? "Active squad" : currentStatus;
      return selectedSquadSources.has(source);
    });
    const table = withStatus({ ...roster, rows }, row => playerStatus(row, roster));
    const sources = el("fieldset", "player-sources");
    sources.append(el("legend", "", "Player source"));
    for (const source of ["Active squad", "On loan", "Departed", "Youth academy"]) {
      const label = el("label");
      const checkbox = el("input");
      checkbox.type = "checkbox";
      checkbox.checked = selectedSquadSources.has(source);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selectedSquadSources.add(source);
        else selectedSquadSources.delete(source);
        render();
      });
      label.append(checkbox, source);
      sources.append(label);
    }
    view.append(sources);
    const compact = ["Pl #", "Sq #", "Name", "Nat", "Age", "AN", "Pos1", "Pos2", "Pos3", "Pos4", "Ovr", "Pot", "Gr", "SM", "WF", "AP", "GL", "AS", "CS", "MR", "GL/G", "AS/G", "CS%", "Cnt YR", "Val", "Value", "CV", "Wage", "CW", "Inj Wks", "Status"];
    const initialSquadSort = rows => sortSquadRows(rows, roster, row => playerStatus(row, roster));
    renderTable(table, { columns: table.columns.filter(column => compact.includes(column.label)), caption: `Squad ${formatSeason(selectedSeason)}`, initialSort: initialSquadSort });
  } else if (route === "sandbox") {
    heading("Squad sandbox");
    const latestSeason = seasons.at(-1);
    try {
      const table = playerRows(workbook[latestSeason]);
      const players = clubPlayersForSandbox(table,
        row => playerStatus(row, table),
        row => recordId(row, table),
        row => academyPlayer(row, table), workbook.Players);
      sandboxRoster = { type: "touchline-roster", season: latestSeason, players };
      sandboxFrame = el("iframe", "sandbox-frame");
      sandboxFrame.title = "Latest squad sandbox";
      sandboxFrame.src = "sandbox/index.html?integrated=1";
      view.append(sandboxFrame);
    } catch (error) {
      view.append(el("p", "sandbox-error", `Sandbox could not load the squad: ${error.message} Check the latest squad's player details and refresh data.`));
    }
  } else if (route === "timelines") {
    const header = heading("Timelines");
    header.append(selectControl("Timeline", Object.entries(TIMELINES), metric, value => { metric = value; render(); }));
    view.append(timelineLegend());
    const timeline = withTimelineStatuses(playerRows(workbook[metric]));
    renderTable(timeline, {
      caption: `${TIMELINES[metric]} timeline`,
      defaultSort: "Cl #",
      defaultDirection: "asc",
    });
  } else if (route === "tots") {
    renderTeamOfSeason();
  } else {
    const pages = {
      players: ["Players", "Players"],
      career: ["Players_Stats", "Career stats"],
      honours: ["Player_Titles", "Honours"],
      youth: ["Youth", "Youth academy graduates"],
      team: ["Team_Stats", "Club stats"],
    };
    const config = pages[route];
    if (!config) { heading("Page not found"); return; }
    heading(config[1]);
    let table = ["players", "career"].includes(route) ? playerRows(workbook[config[0]]) : workbook[config[0]];
    if (route === "players") {
      table = withStatus(table, row => statusForPlayerTab(row, workbook.Players));
      const incomplete = [...movementHistories.values()].filter(history => history.issues.length).length;
      if (incomplete) view.append(el("p", "profile-note movement-warning", `Years active is unavailable for ${incomplete} players with incomplete movement records. Open a player profile for details.`));
    }
    if (["honours", "team"].includes(route)) {
      const legend = el("div", "competition-legend");
      for (const [label, group] of [["European competitions", "continental"], ["League titles", "league"], ["Domestic cups", "cup"], ["One-off cups", "one-off"]]) {
        legend.append(el("span", `competition-legend-item competition-${group}`, label));
      }
      view.append(legend);
    }
    renderTable(table, {
      caption: config[1],
      defaultSort: route === "players" ? "Cl #" : route === "career" ? "Total" : route === "honours" ? "Titles" : null,
      defaultDirection: route === "players" ? "asc" : "desc",
    });
  }
}

async function refreshData() {
  refresh.disabled = true;
  view.setAttribute("aria-busy", "true");
  errorBox.hidden = true;
  try {
    const result = await loadWorkbook(message => { status.textContent = message; });
    const histories = buildMovementHistories(result.workbook, result.seasons);
    applyActiveYears(result.workbook, histories);
    workbook = result.workbook;
    seasons = result.seasons;
    movementHistories = histories;
    playerNames = new Map();
    const ambiguousNames = new Set();
    for (const row of workbook.Players.rows) {
      const id = playerId(row, workbook.Players);
      if (!id) continue;
      for (const label of ["Preferred Name", "Full Name"]) {
        const name = cell(row, workbook.Players, label).text;
        if (!name) continue;
        if (playerNames.has(name) && playerNames.get(name) !== id) ambiguousNames.add(name);
        playerNames.set(name, id);
      }
    }
    for (const name of ambiguousNames) playerNames.delete(name);
    if (!selectedSeason || ![...seasons, "Start"].includes(selectedSeason)) selectedSeason = seasons.at(-1);
    status.textContent = `Live sheet loaded · ${seasons.length} seasons · updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    render();
  } catch (error) {
    status.textContent = workbook ? "Refresh failed. Previously loaded data is still displayed." : "Spreadsheet could not be loaded.";
    errorBox.textContent = `${error.message} Check your connection and that the spreadsheet is shared with anyone with the link, then press Refresh data.`;
    errorBox.hidden = false;
  } finally {
    refresh.disabled = false;
    view.setAttribute("aria-busy", "false");
  }
}

window.addEventListener("hashchange", () => { query = ""; render(); window.scrollTo(0, 0); });
refresh.addEventListener("click", refreshData);
refreshData();
