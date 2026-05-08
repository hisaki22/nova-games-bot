import { type Message } from "discord.js";
import { type SearchPair } from "./wordbank";

export interface SearchPlayer {
  userId: string;
  username: string;
  alive: boolean;
}

export interface SearchGame {
  channelId: string;
  guildId: string;
  hostId: string;
  phase: "lobby" | "question" | "result" | "ended";
  players: Map<string, SearchPlayer>;
  currentPair: SearchPair | null;
  currentPairIndex: number;
  votes: Map<string, "a" | "b">;
  usedPairIndices: Set<number>;
  questionNumber: number;
  lobbyMessage: Message | null;
  questionMessage: Message | null;
  timers: NodeJS.Timeout[];
}

export const LOBBY_SECONDS = 60;
export const QUESTION_SECONDS = 10;

const games = new Map<string, SearchGame>();

export function createSearchGame(
  channelId: string,
  guildId: string,
  hostId: string,
  hostUsername: string,
): SearchGame {
  const game: SearchGame = {
    channelId,
    guildId,
    hostId,
    phase: "lobby",
    players: new Map([[
      hostId,
      { userId: hostId, username: hostUsername, alive: true },
    ]]),
    currentPair: null,
    currentPairIndex: -1,
    votes: new Map(),
    usedPairIndices: new Set(),
    questionNumber: 0,
    lobbyMessage: null,
    questionMessage: null,
    timers: [],
  };
  games.set(channelId, game);
  return game;
}

export function getSearchGame(channelId: string): SearchGame | undefined {
  return games.get(channelId);
}

export function deleteSearchGame(channelId: string): void {
  games.delete(channelId);
}

export function clearSearchTimers(game: SearchGame): void {
  for (const t of game.timers) {
    clearTimeout(t);
    clearInterval(t);
  }
  game.timers = [];
}

export function getAlivePlayers(game: SearchGame): SearchPlayer[] {
  return [...game.players.values()].filter((p) => p.alive);
}
