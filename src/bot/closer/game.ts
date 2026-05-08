export interface GuessEntry {
  userId: string;
  username: string;
  value: number;
  diff: number;
  timestamp: number;
}

export interface CloserGame {
  channelId: string;
  guildId: string;
  hostId: string;
  secret: number;
  min: number;
  max: number;
  guesses: GuessEntry[];
  phase: "playing" | "ended";
  winnerId?: string;
  winnerName?: string;
}

const games = new Map<string, CloserGame>();

export function getCloserGame(ch: string): CloserGame | undefined { return games.get(ch); }

export function createCloserGame(channelId: string, guildId: string, hostId: string, min = 1, max = 500): CloserGame {
  const game: CloserGame = {
    channelId, guildId, hostId,
    secret: Math.floor(Math.random() * (max - min + 1)) + min,
    min, max,
    guesses: [],
    phase: "playing",
  };
  games.set(channelId, game);
  return game;
}

export function deleteCloserGame(ch: string): void { games.delete(ch); }

export function submitCloserGuess(
  game: CloserGame,
  userId: string,
  username: string,
  value: number,
): { diff: number; won: boolean; tooBig: boolean; rank: number } | { error: string } {
  if (game.phase !== "playing") return { error: "اللعبة انتهت." };
  if (isNaN(value) || value < game.min || value > game.max)
    return { error: `رقم بين ${game.min} و ${game.max} فقط.` };

  const diff = Math.abs(game.secret - value);
  const entry: GuessEntry = { userId, username, value, diff, timestamp: Date.now() };
  game.guesses.push(entry);

  if (diff === 0) {
    game.phase = "ended";
    game.winnerId = userId;
    game.winnerName = username;
  }

  // rank = how many unique users have guessed closer
  const bestPerUser = new Map<string, number>();
  for (const g of game.guesses) {
    const prev = bestPerUser.get(g.userId) ?? Infinity;
    if (g.diff < prev) bestPerUser.set(g.userId, g.diff);
  }
  const sorted = [...bestPerUser.values()].sort((a, b) => a - b);
  const myBest = bestPerUser.get(userId) ?? diff;
  const rank = sorted.indexOf(myBest) + 1;

  return { diff, won: diff === 0, tooBig: value > game.secret, rank };
}

export function getLeaderboard(game: CloserGame): { userId: string; username: string; diff: number }[] {
  const best = new Map<string, { userId: string; username: string; diff: number }>();
  for (const g of game.guesses) {
    const prev = best.get(g.userId);
    if (!prev || g.diff < prev.diff) best.set(g.userId, { userId: g.userId, username: g.username, diff: g.diff });
  }
  return [...best.values()].sort((a, b) => a.diff - b.diff).slice(0, 10);
}
