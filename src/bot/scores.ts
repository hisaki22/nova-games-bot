import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { logger } from "../lib/logger.js";

const DATA_DIR = path.join(process.cwd(), "data");
const SCORES_FILE = path.join(DATA_DIR, "scores.json");

export interface UserRecord {
  userId: string;
  username: string;
  points: number;
  scrambleWins: number;
  scrambleCorrect: number;
  imposterPoints: number;
  searchWins: number;
  rouletteWins: number;
  wordleWins: number;
  closerWins: number;
  chairsWins: number;
  hideseekWins: number;
  guessWins: number;
}

type GuildData = Record<string, UserRecord>;
type ScoresStore = Record<string, GuildData>;

let store: ScoresStore = {};
let dirty = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export async function loadScores(): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const raw = await readFile(SCORES_FILE, "utf-8");
    store = JSON.parse(raw) as ScoresStore;
  } catch {
    store = {};
  }
}

function scheduleSave(): void {
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (!dirty) return;
    dirty = false;
    try {
      await writeFile(SCORES_FILE, JSON.stringify(store, null, 2), "utf-8");
    } catch (err) {
      logger.error({ err }, "failed to save scores");
    }
  }, 2000);
}

function getOrCreate(guildId: string, userId: string, username: string): UserRecord {
  if (!store[guildId]) store[guildId] = {};
  if (!store[guildId][userId]) {
    store[guildId][userId] = {
      userId, username, points: 0,
      scrambleWins: 0, scrambleCorrect: 0, imposterPoints: 0,
      searchWins: 0, rouletteWins: 0,
      wordleWins: 0, closerWins: 0, chairsWins: 0, hideseekWins: 0, guessWins: 0,
    };
  } else {
    store[guildId][userId].username = username;
    // migrate old records
    const r = store[guildId][userId];
    if (r.wordleWins === undefined) r.wordleWins = 0;
    if (r.closerWins === undefined) r.closerWins = 0;
    if (r.chairsWins === undefined) r.chairsWins = 0;
    if (r.hideseekWins === undefined) r.hideseekWins = 0;
    if (r.guessWins === undefined) r.guessWins = 0;
  }
  return store[guildId][userId];
}

export function addScrambleCorrect(guildId: string, userId: string, username: string, pts: number): void {
  const r = getOrCreate(guildId, userId, username); r.points += pts; r.scrambleCorrect += 1; scheduleSave();
}
export function addScrambleWin(guildId: string, userId: string, username: string, pts: number): void {
  const r = getOrCreate(guildId, userId, username); r.points += pts; r.scrambleWins += 1; scheduleSave();
}
export function addImposterPoints(guildId: string, userId: string, username: string, pts: number): void {
  if (pts <= 0) return;
  const r = getOrCreate(guildId, userId, username); r.points += pts * 10; r.imposterPoints += pts * 10; scheduleSave();
}
export function addSearchWin(guildId: string, userId: string, username: string, pts: number): void {
  const r = getOrCreate(guildId, userId, username); r.points += pts; r.searchWins = (r.searchWins ?? 0) + 1; scheduleSave();
}
export function addRouletteWin(guildId: string, userId: string, username: string, pts: number): void {
  const r = getOrCreate(guildId, userId, username); r.points += pts; r.rouletteWins = (r.rouletteWins ?? 0) + 1; scheduleSave();
}
export function addWordleWin(guildId: string, userId: string, username: string): void {
  const r = getOrCreate(guildId, userId, username); r.points += 50; r.wordleWins += 1; scheduleSave();
}
export function addCloserWin(guildId: string, userId: string, username: string): void {
  const r = getOrCreate(guildId, userId, username); r.points += 30; r.closerWins += 1; scheduleSave();
}
export function addChairsWin(guildId: string, userId: string, username: string): void {
  const r = getOrCreate(guildId, userId, username); r.points += 60; r.chairsWins += 1; scheduleSave();
}
export function addHideseekWin(guildId: string, userId: string, username: string): void {
  const r = getOrCreate(guildId, userId, username); r.points += 40; r.hideseekWins += 1; scheduleSave();
}
export function addGuessWin(guildId: string, userId: string, username: string): void {
  const r = getOrCreate(guildId, userId, username); r.points += 40; r.guessWins += 1; scheduleSave();
}

export function getLeaderboard(guildId: string): UserRecord[] {
  const guild = store[guildId];
  if (!guild) return [];
  return Object.values(guild).filter((r) => r.points > 0).sort((a, b) => b.points - a.points).slice(0, 10);
}
export function getUserRecord(guildId: string, userId: string): UserRecord | null {
  return store[guildId]?.[userId] ?? null;
}
export function getUserRank(guildId: string, userId: string): number {
  const guild = store[guildId];
  if (!guild) return 0;
  const sorted = Object.values(guild).filter((r) => r.points > 0).sort((a, b) => b.points - a.points);
  const idx = sorted.findIndex((r) => r.userId === userId);
  return idx === -1 ? 0 : idx + 1;
}

export interface GuildStats {
  totalPlayers: number; totalPoints: number; topGame: string;
  topPlayer: UserRecord | null;
  gameCounts: { imposter: number; scramble: number; search: number; roulette: number; wordle: number; closer: number; chairs: number; hideseek: number; guess: number };
}

export function getGuildStats(guildId: string): GuildStats {
  const guild = store[guildId];
  if (!guild) return { totalPlayers: 0, totalPoints: 0, topGame: "—", topPlayer: null, gameCounts: { imposter:0,scramble:0,search:0,roulette:0,wordle:0,closer:0,chairs:0,hideseek:0,guess:0 } };
  const records = Object.values(guild).filter((r) => r.points > 0);
  const totalPoints = records.reduce((s, r) => s + r.points, 0);
  const gameCounts = {
    imposter: records.filter((r) => r.imposterPoints > 0).length,
    scramble: records.reduce((s, r) => s + r.scrambleWins, 0),
    search: records.reduce((s, r) => s + (r.searchWins ?? 0), 0),
    roulette: records.reduce((s, r) => s + (r.rouletteWins ?? 0), 0),
    wordle: records.reduce((s, r) => s + (r.wordleWins ?? 0), 0),
    closer: records.reduce((s, r) => s + (r.closerWins ?? 0), 0),
    chairs: records.reduce((s, r) => s + (r.chairsWins ?? 0), 0),
    hideseek: records.reduce((s, r) => s + (r.hideseekWins ?? 0), 0),
    guess: records.reduce((s, r) => s + (r.guessWins ?? 0), 0),
  };
  const gameNames: Record<string, string> = { imposter:"🕵️ الإمبوستر", scramble:"🔤 الحروف", search:"🔍 البحث", roulette:"🎡 الروليت", wordle:"📝 أوردو", closer:"🎯 أقرب", chairs:"🪑 كراسي", hideseek:"👀 غميضة", guess:"🧠 خمن" };
  const topGameEntry = (Object.entries(gameCounts) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  const topGame = topGameEntry && topGameEntry[1] > 0 ? (gameNames[topGameEntry[0]] ?? "—") : "—";
  const topPlayer = records.sort((a, b) => b.points - a.points)[0] ?? null;
  return { totalPlayers: records.length, totalPoints, topGame, topPlayer, gameCounts };
}
