import { POSITIONS, FORMATION, emptyState, makePlayer, placePlayer, removePlayerFromLineup, selectLineup } from "./model.js";
import { TARGETS_KEY, LINEUP_KEY, LINEUPS_KEY, isClubPlayer, validateTargets, validateLineup, validateLineups, validateClubPlayers, reconcileLineups } from "./integration.js";
import { NATIONS, nationCode, nationFlag } from "./nations.js";
import { enablePlayerDragging } from "./drag.js";
import { formatSeason, titleCase } from "../data.js";

const $ = selector => document.querySelector(selector);
const STORAGE_KEY = "touchline-fc26-v1";
const integrated = new URLSearchParams(location.search).get("integrated") === "1";
let currentSeason = null;
let clubPlayers = [];
let state = emptyState();
let selected = null;
let editing = null;
let storageBlocked = false;

function reportFrameHeight() {
  if (integrated) parent.postMessage({
    type: "touchline-height",
    height: Math.ceil(document.body.getBoundingClientRect().height) + 2,
  }, location.origin);
}

function report(error) {
  $("#error").textContent = error.message;
  $("#error").hidden = false;
  reportFrameHeight();
}

try {
  const saved = integrated ? null : localStorage.getItem(STORAGE_KEY);
  if (saved) state = validateState(JSON.parse(saved));
} catch (error) {
  storageBlocked = true;
  report(new Error(`Saved Squad Builder data could not be loaded: ${error.message} Existing saved data has not been overwritten.`));
}

function save() {
  if (integrated && !currentSeason) return;
  if (storageBlocked) {
    $("#save-state").textContent = "Not Saved Locally";
    return;
  }
  try {
    if (integrated) {
      localStorage.setItem(TARGETS_KEY, JSON.stringify(state.players.filter(p => !isClubPlayer(p))));
      localStorage.setItem(LINEUP_KEY, JSON.stringify(state.lineup));
      localStorage.setItem(LINEUPS_KEY, JSON.stringify(state.lineups));
    } else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $("#save-state").textContent = "Saved on This Device";
  } catch (error) {
    $("#save-state").textContent = "Not Saved";
    report(new Error(`Local save failed: ${error.message} Browser storage is unavailable.`));
  }
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function ratingClass(ovr) {
  return ovr >= 80 ? "elite" : ovr >= 70 ? "good" : ovr >= 60 ? "medium" : "low";
}

function announce(message) {
  $("#instruction").textContent = message;
}

function render() {
  const starters = Object.values(state.lineup).map(id => state.players.find(player => player.id === id)).filter(Boolean);
  const averageAge = starters.filter(player => player.age !== null).length
    ? (starters.reduce((sum, player) => sum + (player.age ?? 0), 0) / starters.filter(player => player.age !== null).length).toFixed(1)
    : "--";
  $("#xi-count").textContent = `${starters.length} / 11`;
  $("#average").textContent = starters.length ? (starters.reduce((sum, p) => sum + p.ovr, 0) / starters.length).toFixed(1) : "--";
  $("#average-age").textContent = averageAge;
  $("#roster-count").textContent = state.players.length;
  $("#lineup-select").value = String(state.activeLineup);
  $("#slots").replaceChildren();
  for (const slot of FORMATION) {
    const player = state.players.find(p => p.id === state.lineup[slot.id]);
    const card = element("div", `slot${player ? " filled" : ""}${selected && player?.id === selected ? " selected" : ""}`);
    card.style.left = `${slot.x}%`;
    card.style.top = `${slot.y}%`;
    card.dataset.slot = slot.id;
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.setAttribute("aria-label", player ? `${slot.id}: ${player.name}, OVR ${player.ovr}. Select or swap player.` : `${slot.id}: empty. Place selected player.`);
    card.append(element("span", "slot-position", slot.id));
    if (player) {
      card.dataset.player = player.id;
      const name = element("span", "pitch-name", player.name);
      const detail = element("span", "slot-meta", `${nationFlag(player.nation)}${player.age === null ? "" : ` · ${player.age}`}`);
      card.append(name, detail, element("span", "slot-positions", player.positions.join(" / ")));
      const profile = element("div", "slot-profile");
      profile.append(playerImage(player, "slot-photo"));
      const rating = element("span", "slot-rating-group");
      rating.append(element("span", `rating ${ratingClass(player.ovr)} slot-rating`, player.ovr));
      if (player.pot !== null) {
        rating.append(element("span", "slot-rating-separator", "/"),
          element("span", `rating ${ratingClass(player.pot)} slot-rating`, player.pot));
      }
      profile.append(rating);
      card.append(profile);
      const remove = element("button", "slot-remove", "×");
      remove.type = "button";
      remove.dataset.remove = player.id;
      remove.setAttribute("aria-label", `Remove ${player.name} from ${slot.id} and return to pool`);
      card.append(remove);
    } else card.append(element("span", "empty-plus", "+"), element("span", "empty-label", "Add Player"));
    $("#slots").append(card);
  }
  renderPool();
  const player = state.players.find(p => p.id === selected);
  announce(player ? `${player.name} selected.` : "");
  reportFrameHeight();
}

function playerImage(player, className) {
  const image = element("img", className);
  image.alt = "";
  image.draggable = false;
  let filename = player.photo || "000.png";
  image.src = `../data/players/${filename}`;
  image.addEventListener("error", () => {
    if (filename.endsWith(".png") && !image.dataset.triedUppercase) {
      image.dataset.triedUppercase = "true";
      filename = filename.slice(0, -4) + ".PNG";
      image.src = `../data/players/${filename}`;
    } else if (!filename.startsWith("000.")) {
      filename = "000.png";
      image.src = `../data/players/${filename}`;
    } else image.remove();
  });
  return image;
}

function renderPool() {
  const query = $("#search").value.trim().toLowerCase();
  const position = $("#position-filter").value;
  const sources = new Set([...document.querySelectorAll("#source-filter input:checked")].map(input => input.value));
  const [sortKey, direction] = $("#pool-sort").value.split("-");
  const assigned = new Set(state.lineups.flatMap(lineup => Object.values(lineup)));
  const players = state.players.filter(p => !assigned.has(p.id) && p.name.toLowerCase().includes(query) &&
    (!position || p.positions.includes(position)) &&
    sources.has(!isClubPlayer(p) ? "created" : p.clubStatus === "On loan" ? "loan" : "active"))
    .sort((a, b) => {
      const left = sortKey === "position" ? POSITIONS.indexOf(a.positions[0]) : a[sortKey];
      const right = sortKey === "position" ? POSITIONS.indexOf(b.positions[0]) : b[sortKey];
      if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
      const comparison = typeof left === "string" ? left.localeCompare(right) : left - right;
      return comparison * (direction === "desc" ? -1 : 1) || a.name.localeCompare(b.name);
    });
  const list = $("#player-list");
  list.replaceChildren();
  for (const player of players) {
    const row = element("div", `player-row${selected === player.id ? " selected" : ""}`);
    row.dataset.player = player.id;
    const handle = element("button", "drag-handle", "::");
    handle.type = "button";
    handle.dataset.dragHandle = player.id;
    handle.setAttribute("aria-label", `Drag ${player.name} onto the board`);
    const pick = element("button", "player-pick");
    pick.type = "button";
    pick.dataset.pick = player.id;
    pick.setAttribute("aria-pressed", String(selected === player.id));
    pick.setAttribute("aria-label", `Select ${player.name}, OVR ${player.ovr}`);
    const details = element("span", "player-details");
    details.append(element("span", "player-name", player.name));
    details.append(element("span", "player-meta", `${nationFlag(player.nation)}${player.age === null ? "" : ` · ${player.age}`}`));
    details.append(element("span", "player-positions", player.positions.join(" / ")));
    details.append(element("span", isClubPlayer(player) ? "club-badge" : "target-badge", isClubPlayer(player) ? `Club Squad · ${titleCase(player.clubStatus)}` : "Created Player"));
    pick.append(details, playerImage(player, "player-photo"));
    const rating = element("span", "player-rating-group");
    rating.append(element("span", `rating ${ratingClass(player.ovr)} player-rating`, player.ovr));
    if (player.pot !== null) {
      rating.append(element("span", "rating-separator", "/"),
        element("span", `rating ${ratingClass(player.pot)} player-potential`, player.pot));
    }
    row.append(handle, pick, rating);
    if (!isClubPlayer(player)) {
      const actions = element("div", "player-actions");
      const edit = element("button", "edit-player", "Edit");
      edit.type = "button";
      edit.dataset.edit = player.id;
      edit.setAttribute("aria-label", `Edit ${player.name}`);
      const remove = element("button", "delete-player", "Delete");
      remove.type = "button";
      remove.dataset.delete = player.id;
      remove.setAttribute("aria-label", `Delete ${player.name}`);
      actions.append(edit, remove);
      row.append(actions);
    }
    list.append(row);
  }
  if (!players.length) {
    const empty = element("div", "empty-pool");
    empty.append(element("span", "empty-icon", "+"), element("h4", "", state.players.length ? "No Matching Players" : "Your Squad Starts Here"));
    empty.append(element("p", "", state.players.length ? "Try another name, position or player source." : "Add a player to start building your XI."));
    list.append(empty);
  }
  $("#list-count").textContent = `${players.length} of ${state.players.length} players`;
}

function commit(message) {
  save();
  render();
  if (message) announce(message);
}

function selectPlayer(id) {
  selected = selected === id ? null : id;
  render();
}

function assign(id, slot) {
  try {
    state = placePlayer(state, id, slot);
    const name = state.players.find(p => p.id === id).name;
    selected = null;
    commit(`${name} placed at ${slot}.`);
  } catch (error) { report(error); }
}

for (const position of POSITIONS) {
  const option = element("option", "", position);
  option.value = position;
  $("#position-filter").append(option);
}
const nationSelect = $("#player-form").elements.namedItem("nation");
nationSelect.append(new Option("Choose a Nation", ""));
for (const nation of NATIONS) nationSelect.append(new Option(`${nation.flag} ${nation.name}`, nation.code));
for (let i = 0; i < 4; i++) {
  const label = element("label", "", i ? `Position ${i + 1}` : "Primary Position");
  const select = element("select");
  select.name = `pos${i + 1}`;
  select.required = i === 0;
  select.append(new Option(i ? "None" : "Choose Position", ""));
  for (const position of POSITIONS) select.append(new Option(position, position));
  label.append(select);
  $("#position-fields").append(label);
}

$("#search").addEventListener("input", renderPool);
$("#position-filter").addEventListener("change", renderPool);
$("#source-filter").addEventListener("change", renderPool);
$("#player-list").addEventListener("click", event => {
  const edit = event.target.closest("[data-edit]");
  const remove = event.target.closest("[data-delete]");
  const pick = event.target.closest("[data-pick]");
  if (remove) {
    const id = remove.dataset.delete;
    const player = state.players.find(item => item.id === id);
    if (player && confirm(`Delete ${player.name} from your pool and all XIs?`)) {
      state = { ...state, players: state.players.filter(item => item.id !== id),
        lineups: state.lineups.map(lineup => Object.fromEntries(Object.entries(lineup).filter(([, assignedId]) => assignedId !== id))) };
      state.lineup = state.lineups[state.activeLineup];
      if (selected === id) selected = null;
      commit(`${player.name} deleted.`);
    }
  } else if (edit) openEditor(edit.dataset.edit);
  else if (pick) selectPlayer(pick.dataset.pick);
});
$("#slots").addEventListener("click", event => {
  const remove = event.target.closest("[data-remove]");
  if (remove) {
    const player = state.players.find(item => item.id === remove.dataset.remove);
    state = removePlayerFromLineup(state, remove.dataset.remove);
    selected = null;
    commit(`${player?.name || "Player"} returned to the pool.`);
    return;
  }
  const slot = event.target.closest("[data-slot]");
  if (!slot) return;
  if (selected) {
    if (state.lineup[slot.dataset.slot] === selected) { selected = null; render(); }
    else assign(selected, slot.dataset.slot);
  } else if (slot.dataset.player) selectPlayer(slot.dataset.player);
  else announce("Select a player from the pool first, then choose this position.");
});
$("#slots").addEventListener("keydown", event => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-slot]")) {
    event.preventDefault();
    event.target.click();
  }
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !document.querySelector("dialog[open]")) { selected = null; render(); }
});
$("#clear").addEventListener("click", () => {
  if (!Object.keys(state.lineup).length) return;
  if (!confirm("Clear the starting XI? All players will stay in your squad.")) return;
  const lineups = [...state.lineups];
  lineups[state.activeLineup] = {};
  state = { ...state, lineups, lineup: lineups[state.activeLineup] };
  selected = null;
  commit("Starting XI cleared. Your players are still in the pool.");
});
$("#lineup-select").addEventListener("change", event => {
  state = selectLineup(state, Number(event.target.value));
  selected = null;
  save();
  render();
});
$("#pool-sort").addEventListener("change", renderPool);

enablePlayerDragging(document.querySelector(".workspace"), assign);

function openEditor(id = null) {
  if (id && state.players.some(p => p.id === id && isClubPlayer(p))) {
    report(new Error("Club player details are read-only. Update the spreadsheet and refresh data."));
    return;
  }
  editing = id;
  $("#player-form").reset();
  $("#player-error").textContent = "";
  $("#player-dialog-title").textContent = id ? "Edit Player" : "Add Player";
  $("#delete-player").hidden = !id;
  const player = state.players.find(p => p.id === id);
  if (player) {
    for (const key of ["name", "ovr", "pot", "age"]) $("#player-form").elements.namedItem(key).value = player[key] ?? "";
    nationSelect.value = nationCode(player.nation);
    for (let i = 0; i < 4; i++) $("#player-form").elements.namedItem(`pos${i + 1}`).value = player.positions[i] || "";
  }
  $("#player-dialog").showModal();
  if (integrated) parent.postMessage({ type: "touchline-dialog" }, location.origin);
}
$("#add-player").addEventListener("click", () => openEditor());
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.close).close()));
$("#player-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const form = new FormData(event.target);
    const player = makePlayer({
      ...Object.fromEntries(form),
      photo: state.players.find(p => p.id === editing)?.photo || "000.png",
      positions: [1, 2, 3, 4].map(i => form.get(`pos${i}`)),
    }, editing || crypto.randomUUID());
    state = { ...state, players: editing ? state.players.map(p => p.id === editing ? player : p) : [...state.players, player] };
    $("#player-dialog").close();
    commit(`${player.name} saved.`);
  } catch (error) { $("#player-error").textContent = error.message; }
});
$("#delete-player").addEventListener("click", () => {
  const player = state.players.find(p => p.id === editing);
  if (!player || !confirm(`Delete ${player.name} from your squad and lineup?`)) return;
  state = { ...state, players: state.players.filter(p => p.id !== editing),
    lineups: state.lineups.map(lineup => Object.fromEntries(Object.entries(lineup).filter(([, id]) => id !== editing))) };
  state.lineup = state.lineups[state.activeLineup];
  if (selected === editing) selected = null;
  $("#player-dialog").close();
  commit(`${player.name} deleted.`);
});
if (integrated) {
  document.body.classList.add("integrated");
  $("#add-player").disabled = true;
  window.addEventListener("message", event => {
    if (event.origin !== location.origin || event.source !== parent) return;
    if (event.data?.type === "touchline-viewport") {
      if (Number.isFinite(event.data.height) && event.data.height > 0) {
        document.documentElement.style.setProperty("--host-height", `${event.data.height}px`);
      }
      return;
    }
    if (event.data?.type !== "touchline-roster") return;
    try {
      if (!/^(Start|\d{2}\/\d{2})$/.test(event.data.season)) throw new Error("Invalid squad season.");
      clubPlayers = validateClubPlayers(event.data.players);
      currentSeason = event.data.season;
      let targets = [];
      let lineups = [{}, {}, {}];
      let duplicateAssignmentsRemoved = 0;
      try {
        const savedTargets = localStorage.getItem(TARGETS_KEY);
        const savedLineups = localStorage.getItem(LINEUPS_KEY);
        const savedLineup = localStorage.getItem(LINEUP_KEY);
        if (savedTargets) targets = validateTargets(JSON.parse(savedTargets));
        if (savedLineups) {
          const storedLineups = JSON.parse(savedLineups);
          lineups = validateLineups(storedLineups);
          duplicateAssignmentsRemoved = storedLineups.reduce((count, lineup) => count + Object.keys(lineup).length, 0) -
            lineups.reduce((count, lineup) => count + Object.keys(lineup).length, 0);
        }
        else if (savedLineup) lineups[0] = validateLineup(JSON.parse(savedLineup));
      } catch (error) {
        storageBlocked = true;
        report(new Error(`Saved Squad Builder data could not be loaded: ${error.message} It has not been overwritten.`));
      }
      const players = [...clubPlayers, ...targets];
      const reconciled = reconcileLineups(lineups, players);
      const removed = lineups.reduce((sum, lineup, index) => sum + Object.keys(lineup).length - Object.keys(reconciled[index]).length, 0);
      state = { version: 1, players, activeLineup: 0, lineups: reconciled, lineup: reconciled[0] };
      selected = null;
      $("#season-label").textContent = `Squad Ratings (${formatSeason(currentSeason)})`;
      $("#add-player").disabled = false;
      const notices = [];
      if (duplicateAssignmentsRemoved) notices.push(`${duplicateAssignmentsRemoved} repeat assignment(s) across XIs were returned to the pool.`);
      if (removed) notices.push(`${removed} unavailable player assignment(s) were removed after refreshing the latest squad.`);
      commit(notices.join(" ") || `Loaded ${clubPlayers.length} club players from the latest squad (${formatSeason(currentSeason)}).`);
    } catch (error) {
      report(new Error(`Club squad could not be loaded: ${error.message}`));
    }
  });
  parent.postMessage({ type: "touchline-ready" }, location.origin);
  new ResizeObserver(reportFrameHeight).observe(document.body);
  window.addEventListener("resize", reportFrameHeight);
}
if (storageBlocked) $("#save-state").textContent = "Not Saved Locally";
render();
