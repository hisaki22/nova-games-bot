import type { Message } from "discord.js";

export const LOBBY_SECONDS = 60;
export const CHOOSE_SECONDS = 30;
export const MAX_LOBBY_NUMBERS = 20;

export interface RoulettePlayer {
  userId: string;
  username: string;
  alive: boolean;
  number: number;
}

export interface RouletteGame {
  channelId: string;
  guildId: string;
  hostId: string;
  hostUsername: string;
  players: Map<string, RoulettePlayer>;
  eliminated: RoulettePlayer[];
  phase: "lobby" | "spinning" | "choosing" | "ended";
  roundNumber: number;
  currentChooser?: string;
  hasNuke: boolean;
  hasDoubleKick: boolean;
  doubleKickVictim1?: string;
  timers: NodeJS.Timeout[];
  numberPool: Set<number>;
  lobbyMessage?: Message;
  choosingMessage?: Message;
}

const games = new Map<string, RouletteGame>();

export function createRouletteGame(
  channelId: string,
  guildId: string,
  userId: string,
  username: string,
): RouletteGame {
  const pool = new Set<number>(Array.from({ length: MAX_LOBBY_NUMBERS }, (_, i) => i + 1));
  const hostNum = pickFromPool(pool)!;
  pool.delete(hostNum);

  const game: RouletteGame = {
    channelId,
    guildId,
    hostId: userId,
    hostUsername: username,
    players: new Map(),
    eliminated: [],
    phase: "lobby",
    roundNumber: 0,
    hasNuke: false,
    hasDoubleKick: false,
    timers: [],
    numberPool: pool,
  };
  game.players.set(userId, { userId, username, alive: true, number: hostNum });
  games.set(channelId, game);
  return game;
}

function pickFromPool(pool: Set<number>): number | undefined {
  const arr = Array.from(pool);
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function joinWithNumber(
  game: RouletteGame,
  userId: string,
  username: string,
  num: number,
): boolean {
  if (!game.numberPool.has(num)) return false;
  game.numberPool.delete(num);
  game.players.set(userId, { userId, username, alive: true, number: num });
  return true;
}

export function joinRandom(
  game: RouletteGame,
  userId: string,
  username: string,
): number | undefined {
  const num = pickFromPool(game.numberPool);
  if (num === undefined) return undefined;
  game.numberPool.delete(num);
  game.players.set(userId, { userId, username, alive: true, number: num });
  return num;
}

export function leaveGame(game: RouletteGame, userId: string): boolean {
  const p = game.players.get(userId);
  if (!p) return false;
  game.numberPool.add(p.number);
  game.players.delete(userId);
  return true;
}

export function getRouletteGame(channelId: string): RouletteGame | undefined {
  return games.get(channelId);
}

export function deleteRouletteGame(channelId: string): void {
  games.delete(channelId);
}

export function clearRouletteTimers(game: RouletteGame): void {
  for (const t of game.timers) clearTimeout(t);
  game.timers = [];
}

export function getAlivePlayers(game: RouletteGame): RoulettePlayer[] {
  return Array.from(game.players.values())
    .filter((p) => p.alive)
    .sort((a, b) => a.number - b.number);
}
