export interface ChairsPlayer {
  userId: string;
  username: string;
}

export type ChairsPhase = "lobby" | "countdown" | "grab" | "ended";

export interface ChairsGame {
  channelId: string;
  guildId: string;
  hostId: string;
  players: Map<string, ChairsPlayer>;
  eliminated: ChairsPlayer[];
  phase: ChairsPhase;
  roundNumber: number;
  chairsThisRound: number;
  grabbedChairs: Set<string>; // userIds who grabbed a chair this round
  timers: NodeJS.Timeout[];
  lobbyMessageId?: string;
  roundMessageId?: string;
}

const games = new Map<string, ChairsGame>();

export function getChairsGame(ch: string): ChairsGame | undefined { return games.get(ch); }
export function deleteChairsGame(ch: string): void { const g = games.get(ch); if (g) { for (const t of g.timers) clearTimeout(t); } games.delete(ch); }

export function createChairsGame(channelId: string, guildId: string, hostId: string, hostUsername: string): ChairsGame {
  const g: ChairsGame = {
    channelId, guildId, hostId,
    players: new Map([[hostId, { userId: hostId, username: hostUsername }]]),
    eliminated: [],
    phase: "lobby",
    roundNumber: 0,
    chairsThisRound: 0,
    grabbedChairs: new Set(),
    timers: [],
  };
  games.set(channelId, g);
  return g;
}

export function joinChairs(game: ChairsGame, userId: string, username: string): "joined" | "already" | "full" {
  if (game.phase !== "lobby") return "already";
  if (game.players.has(userId)) return "already";
  if (game.players.size >= 15) return "full";
  game.players.set(userId, { userId, username });
  return "joined";
}

export function startChairsRound(game: ChairsGame): void {
  game.roundNumber++;
  game.chairsThisRound = game.players.size - 1;
  game.grabbedChairs = new Set();
  game.phase = "grab";
}

export function grabChair(game: ChairsGame, userId: string): "grabbed" | "full" | "not_in" | "already" {
  if (game.phase !== "grab") return "not_in";
  if (!game.players.has(userId)) return "not_in";
  if (game.grabbedChairs.has(userId)) return "already";
  if (game.grabbedChairs.size >= game.chairsThisRound) return "full";
  game.grabbedChairs.add(userId);
  return "grabbed";
}

export function resolveRound(game: ChairsGame): ChairsPlayer | null {
  // Find the eliminated player (the one who didn't grab)
  let eliminated: ChairsPlayer | null = null;
  for (const [uid, p] of game.players) {
    if (!game.grabbedChairs.has(uid)) {
      eliminated = p;
      break;
    }
  }
  if (eliminated) {
    game.players.delete(eliminated.userId);
    game.eliminated.push(eliminated);
  }
  return eliminated;
}

export function getWinner(game: ChairsGame): ChairsPlayer | null {
  if (game.players.size === 1) return [...game.players.values()][0];
  return null;
}

export function clearChairsTimers(game: ChairsGame): void {
  for (const t of game.timers) clearTimeout(t);
  game.timers = [];
}
