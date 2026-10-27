import { cell, playerId } from "./data.js";
import { makePlayer } from "./sandbox/model.js";

export function clubPlayersForSandbox(table, statusForRow, idForRow, isAcademy, playerTable) {
  const players = [];
  const ids = new Set();
  const currentAges = new Map(playerTable.rows.map(row => [
    playerId(row, playerTable), cell(row, playerTable, "Age Now").value,
  ]));
  for (const row of table.rows) {
    const status = statusForRow(row);
    if (!["Active", "On loan"].includes(status) || isAcademy(row)) continue;
    const name = cell(row, table, "Name").value || cell(row, table, "Preferred Name").value;
    const id = idForRow(row);
    if (!id || ids.has(id)) throw new Error(`${name}: missing or duplicate club identity.`);
    ids.add(id);
    try {
      const player = makePlayer({
        name,
        ovr: cell(row, table, "Ovr").text,
        pot: cell(row, table, "Pot").text,
        age: currentAges.get(playerId(row, table)),
        nation: cell(row, table, "Nat").value,
        photo: `${String(Number(cell(row, table, "Cl #").value)).padStart(3, "0")}.png`,
        positions: [1, 2, 3, 4].map(i => cell(row, table, `Pos${i}`).value),
      }, `club:${id}`);
      players.push({ ...player, clubStatus: status });
    } catch (error) {
      throw new Error(`${name}: ${error.message}`, { cause: error });
    }
  }
  return players;
}
