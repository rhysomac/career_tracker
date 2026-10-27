import { makePlayer, validateState, validateLineup as validateModelLineup } from "./model.js";

export const TARGETS_KEY = "african-salford-sandbox-targets-v1";
export const LINEUP_KEY = "african-salford-sandbox-xi-v1";
export const LINEUPS_KEY = "african-salford-sandbox-lineups-v2";
export const isClubPlayer = player => player.id.startsWith("club:");

export function validateTargets(value) {
  const players = validateState({ version: 1, players: value, lineup: {} }).players;
  if (players.some(isClubPlayer)) throw new Error("Transfer target data contains a club player.");
  return players;
}

export function validateLineup(value) {
  return validateModelLineup(value);
}

export function validateLineups(value) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error("Saved plans must contain exactly three XIs.");
  const usedAcrossXIs = new Set();
  return value.map(lineup => Object.fromEntries(Object.entries(validateLineup(lineup)).filter(([, id]) => {
    if (usedAcrossXIs.has(id)) return false;
    usedAcrossXIs.add(id);
    return true;
  })));
}

export function validateClubPlayers(value) {
  if (!Array.isArray(value)) throw new Error("Club squad must be a list.");
  const ids = new Set();
  return value.map(p => {
    if (!p || typeof p.id !== "string" || !isClubPlayer(p) || ids.has(p.id) ||
        !["Active", "On loan"].includes(p.clubStatus)) throw new Error("Invalid club squad identity or status.");
    ids.add(p.id);
    return { ...makePlayer(p, p.id), clubStatus: p.clubStatus };
  });
}

export function reconcileLineup(lineup, players) {
  const ids = new Set(players.map(p => p.id));
  return Object.fromEntries(Object.entries(lineup).filter(([, id]) => ids.has(id)));
}

export function reconcileLineups(lineups, players) {
  return validateLineups(lineups).map(lineup => reconcileLineup(lineup, players));
}

export function restoreIntegratedBackup(value, clubPlayers) {
  const restored = validateState(value);
  const targets = restored.players.filter(p => !isClubPlayer(p));
  const players = [...clubPlayers, ...targets];
  const lineups = reconcileLineups(restored.lineups, players);
  return {
    version: 1, players,
    activeLineup: restored.activeLineup,
    lineups,
    lineup: lineups[restored.activeLineup],
  };
}
