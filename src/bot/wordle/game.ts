import { pickWord, getLetters, normalize } from "./wordbank.js";

export type TileState = "correct" | "present" | "absent";

export interface GuessResult {
  word: string;
  tiles: TileState[];
}

export interface WordleGame {
  channelId: string;
  guildId: string;
  hostId: string;
  secret: string;
  guesses: GuessResult[];
  maxGuesses: number;
  phase: "playing" | "won" | "lost";
  winnerId?: string;
  winnerName?: string;
  startedAt: number;
}

const games = new Map<string, WordleGame>();

export function getWordleGame(channelId: string): WordleGame | undefined {
  return games.get(channelId);
}

export function createWordleGame(channelId: string, guildId: string, hostId: string): WordleGame {
  const game: WordleGame = {
    channelId, guildId, hostId,
    secret: pickWord(),
    guesses: [],
    maxGuesses: 6,
    phase: "playing",
    startedAt: Date.now(),
  };
  games.set(channelId, game);
  return game;
}

export function deleteWordleGame(channelId: string): void {
  games.delete(channelId);
}

export function submitWordleGuess(
  game: WordleGame,
  word: string,
  userId: string,
  username: string,
): { result: GuessResult; won: boolean; lost: boolean } | { error: string } {
  if (game.phase !== "playing") return { error: "اللعبة انتهت." };
  const norm = normalize(word);
  const secretNorm = normalize(game.secret);
  if (norm.length !== 5) return { error: "الكلمة يجب أن تكون 5 أحرف." };

  const secretLetters = secretNorm.split("");
  const guessLetters = norm.split("");
  const tiles: TileState[] = Array(5).fill("absent");

  // First pass: exact matches
  const remaining: (string | null)[] = [...secretLetters];
  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] === secretLetters[i]) {
      tiles[i] = "correct";
      remaining[i] = null;
    }
  }
  // Second pass: present but wrong position
  for (let i = 0; i < 5; i++) {
    if (tiles[i] === "correct") continue;
    const idx = remaining.indexOf(guessLetters[i]);
    if (idx !== -1) {
      tiles[i] = "present";
      remaining[idx] = null;
    }
  }

  const result: GuessResult = { word: norm, tiles };
  game.guesses.push(result);

  const won = tiles.every((t) => t === "correct");
  const lost = !won && game.guesses.length >= game.maxGuesses;

  if (won) {
    game.phase = "won";
    game.winnerId = userId;
    game.winnerName = username;
  } else if (lost) {
    game.phase = "lost";
  }

  return { result, won, lost };
}
