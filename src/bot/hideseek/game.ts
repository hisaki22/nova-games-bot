export const ROOMS = ["🌲 الغابة", "🏚️ المخزن", "⛵ المركب", "🏔️ الكهف", "🌾 الحقل", "🏰 القلعة"];
export const ROOM_IDS = ["r0","r1","r2","r3","r4","r5"];

export interface HideseekPlayer {
  userId: string;
  username: string;
  roomIndex?: number; // where they hid
  found: boolean;
}

export type HideseekPhase = "lobby" | "hiding" | "seeking" | "ended";

export interface HideseekGame {
  channelId: string;
  guildId: string;
  seekerId: string;
  seekerUsername: string;
  players: Map<string, HideseekPlayer>; // hiders only (not seeker)
  phase: HideseekPhase;
  searchedRooms: number[];
  roundsLeft: number;
  timers: NodeJS.Timeout[];
  lobbyMessageId?: string;
}

const games = new Map<string, HideseekGame>();

export function getHideseekGame(ch: string): HideseekGame | undefined { return games.get(ch); }
export function deleteHideseekGame(ch: string): void { const g = games.get(ch); if (g) for (const t of g.timers) clearTimeout(t); games.delete(ch); }

export function createHideseekGame(
  channelId: string, guildId: string,
  seekerId: string, seekerUsername: string,
): HideseekGame {
  const g: HideseekGame = {
    channelId, guildId, seekerId, seekerUsername,
    players: new Map(),
    phase: "lobby",
    searchedRooms: [],
    roundsLeft: ROOMS.length,
    timers: [],
  };
  games.set(channelId, g);
  return g;
}

export function joinHideseek(game: HideseekGame, userId: string, username: string): "joined" | "already" | "seeker" | "full" {
  if (userId === game.seekerId) return "seeker";
  if (game.players.has(userId)) return "already";
  if (game.players.size >= 10) return "full";
  game.players.set(userId, { userId, username, found: false });
  return "joined";
}

export function hidePlayer(game: HideseekGame, userId: string, roomIndex: number): boolean {
  const p = game.players.get(userId);
  if (!p || game.phase !== "hiding") return false;
  p.roomIndex = roomIndex;
  return true;
}

export function searchRoom(game: HideseekGame, roomIndex: number): HideseekPlayer[] {
  if (game.searchedRooms.includes(roomIndex)) return [];
  game.searchedRooms.push(roomIndex);
  const found: HideseekPlayer[] = [];
  for (const p of game.players.values()) {
    if (p.roomIndex === roomIndex && !p.found) {
      p.found = true;
      found.push(p);
    }
  }
  return found;
}

export function getHidersLeft(game: HideseekGame): HideseekPlayer[] {
  return [...game.players.values()].filter((p) => !p.found);
}

export function allHid(game: HideseekGame): boolean {
  return [...game.players.values()].every((p) => p.roomIndex !== undefined);
}
