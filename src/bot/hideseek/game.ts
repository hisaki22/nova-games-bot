export const GRID_SIZE = 25;

export interface HideseekPlayer {
  userId: string;
  username: string;
  hiddenCell?: number;   // 1-25, chosen secretly
  eliminated: boolean;
  joinOrder: number;
}

export type HideseekPhase = "lobby" | "hiding" | "playing" | "ended";

export interface HideseekGame {
  channelId: string;
  guildId: string;
  hostId: string;
  players: Map<string, HideseekPlayer>;
  phase: HideseekPhase;
  revealedCells: number[];      // cells already revealed
  currentRevealerIndex: number; // index into turn order
  turnOrder: string[];          // userIds in rotation
  roundNumber: number;
  timers: NodeJS.Timeout[];
}

const games = new Map<string, HideseekGame>();

export function getHideseekGame(ch: string): HideseekGame | undefined {
  return games.get(ch);
}

export function deleteHideseekGame(ch: string): void {
  const g = games.get(ch);
  if (g) for (const t of g.timers) clearTimeout(t);
  games.delete(ch);
}

export function createHideseekGame(
  channelId: string, guildId: string, hostId: string, hostUsername: string,
): HideseekGame {
  const g: HideseekGame = {
    channelId, guildId, hostId,
    players: new Map([[hostId, { userId: hostId, username: hostUsername, eliminated: false, joinOrder: 0 }]]),
    phase: "lobby",
    revealedCells: [],
    currentRevealerIndex: 0,
    turnOrder: [],
    roundNumber: 0,
    timers: [],
  };
  games.set(channelId, g);
  return g;
}

export function joinHideseek(game: HideseekGame, userId: string, username: string): "joined" | "already" | "full" {
  if (game.players.has(userId)) return "already";
  if (game.players.size >= 15) return "full";
  game.players.set(userId, { userId, username, eliminated: false, joinOrder: game.players.size });
  return "joined";
}

export function setHiddenCell(game: HideseekGame, userId: string, cell: number): "ok" | "invalid" | "not_in" {
  const p = game.players.get(userId);
  if (!p) return "not_in";
  if (cell < 1 || cell > GRID_SIZE) return "invalid";
  p.hiddenCell = cell;
  return "ok";
}

export function allPlayersHid(game: HideseekGame): boolean {
  return [...game.players.values()].every((p) => p.hiddenCell !== undefined);
}

export function startGame(game: HideseekGame): void {
  game.phase = "playing";
  game.turnOrder = [...game.players.keys()];
  game.currentRevealerIndex = 0;
  game.roundNumber = 1;
}

export function getCurrentRevealer(game: HideseekGame): HideseekPlayer | null {
  // Advance to next non-eliminated player
  const alive = game.turnOrder.filter((id) => {
    const p = game.players.get(id);
    return p && !p.eliminated;
  });
  if (alive.length === 0) return null;
  const idx = game.currentRevealerIndex % alive.length;
  const uid = alive[idx];
  return game.players.get(uid) ?? null;
}

export interface RevealResult {
  cell: number;
  foundPlayers: HideseekPlayer[];    // hiding in that cell
  revealerCaught: boolean;           // revealer was in their own cell
  alivePlayers: HideseekPlayer[];
  winner: HideseekPlayer | null;
}

export function revealCell(
  game: HideseekGame,
  revealerId: string,
  cell: number,
): RevealResult | { error: string } {
  if (game.phase !== "playing") return { error: "اللعبة مو نشطة." };
  if (game.revealedCells.includes(cell)) return { error: "هذه الخانة مكشوفة بالفعل!" };

  const revealer = game.players.get(revealerId);
  if (!revealer || revealer.eliminated) return { error: "أنت مو من اللاعبين النشطين." };

  game.revealedCells.push(cell);
  game.roundNumber++;

  // Find all players hiding in this cell (including possibly the revealer)
  const foundPlayers: HideseekPlayer[] = [];
  for (const p of game.players.values()) {
    if (!p.eliminated && p.hiddenCell === cell) {
      p.eliminated = true;
      foundPlayers.push(p);
    }
  }

  // Check if revealer was caught in their own cell
  const revealerCaught = foundPlayers.some((p) => p.userId === revealerId);

  // Advance turn (skip to next alive player)
  const aliveAfter = [...game.players.values()].filter((p) => !p.eliminated);

  // Next revealer: move index forward
  game.currentRevealerIndex++;

  const winner = aliveAfter.length === 1 ? aliveAfter[0] : null;
  if (aliveAfter.length <= 1) game.phase = "ended";

  return { cell, foundPlayers, revealerCaught, alivePlayers: aliveAfter, winner: winner ?? null };
}

export function getAlivePlayers(game: HideseekGame): HideseekPlayer[] {
  return [...game.players.values()].filter((p) => !p.eliminated);
}
