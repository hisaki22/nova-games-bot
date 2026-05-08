import type { Message } from "discord.js";
import { pickWord, scrambleWord } from "./wordbank";

export interface ScramblePlayer {
  id: string;
  username: string;
}

export type ScramblePhase = "lobby" | "playing" | "ended";

export interface ScrambleGame {
  channelId: string;
  guildId: string;
  hostId: string;
  players: Map<string, ScramblePlayer>;
  phase: ScramblePhase;
  playerOrder: string[];
  currentPlayerIndex: number;
  currentWord: string;
  scrambledWord: string;
  usedWords: Set<string>;
  roundNumber: number;
  roundQueue: string[];
  eliminatedThisRound: string[];
  lobbyMessage?: Message;
  timers: ReturnType<typeof setTimeout>[];
}

const games = new Map<string, ScrambleGame>();

export function getScrambleGame(channelId: string): ScrambleGame | undefined {
  return games.get(channelId);
}

export function createScrambleGame(
  channelId: string,
  guildId: string,
  hostId: string,
  hostUsername: string,
): ScrambleGame {
  const game: ScrambleGame = {
    channelId,
    guildId,
    hostId,
    players: new Map([[hostId, { id: hostId, username: hostUsername }]]),
    phase: "lobby",
    playerOrder: [],
    currentPlayerIndex: 0,
    currentWord: "",
    scrambledWord: "",
    usedWords: new Set(),
    roundNumber: 0,
    roundQueue: [],
    eliminatedThisRound: [],
    timers: [],
  };
  games.set(channelId, game);
  return game;
}

export function deleteScrambleGame(channelId: string): void {
  const game = games.get(channelId);
  if (game) {
    for (const t of game.timers) clearTimeout(t);
    game.timers = [];
  }
  games.delete(channelId);
}

export function joinScramble(
  game: ScrambleGame,
  userId: string,
  username: string,
): "joined" | "already" | "full" {
  if (game.players.has(userId)) return "already";
  if (game.players.size >= 12) return "full";
  game.players.set(userId, { id: userId, username });
  return "joined";
}

export function leaveScramble(
  game: ScrambleGame,
  userId: string,
): "left" | "host" | "not_in" {
  if (!game.players.has(userId)) return "not_in";
  if (userId === game.hostId) return "host";
  game.players.delete(userId);
  return "left";
}

export function startScrambleGame(game: ScrambleGame): boolean {
  if (game.players.size < 4) return false;
  game.phase = "playing";
  game.playerOrder = [...game.players.keys()].sort(() => Math.random() - 0.5);
  beginRound(game);
  return true;
}

export function beginRound(game: ScrambleGame): void {
  game.roundNumber++;
  game.roundQueue = [...game.playerOrder];
  game.eliminatedThisRound = [];
}

export function nextTurn(
  game: ScrambleGame,
): { word: string; scrambled: string; playerId: string } | null {
  const playerId = game.roundQueue.shift();
  if (!playerId) return null;
  const word = pickWord(game.usedWords);
  if (!word) return null;
  game.usedWords.add(word);
  game.currentWord = word;
  game.scrambledWord = scrambleWord(word);
  return { word, scrambled: game.scrambledWord, playerId };
}

export function isRoundOver(game: ScrambleGame): boolean {
  return game.roundQueue.length === 0;
}

export function eliminatePlayer(game: ScrambleGame, playerId: string): void {
  game.eliminatedThisRound.push(playerId);
  game.playerOrder = game.playerOrder.filter((id) => id !== playerId);
}

export function getTurnSeconds(roundNumber: number): number {
  if (roundNumber <= 1) return 20;
  if (roundNumber === 2) return 16;
  if (roundNumber === 3) return 12;
  return 8;
}

export function clearScrambleTimers(game: ScrambleGame): void {
  for (const t of game.timers) clearTimeout(t);
  game.timers = [];
}
