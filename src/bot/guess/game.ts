export interface GuessQuestion {
  text: string;
  answer: "yes" | "no" | "maybe";
  askedBy: string;
  askedByName: string;
}

export interface GuessGame {
  channelId: string;
  guildId: string;
  hostId: string;
  hostUsername: string;
  secret: string; // only host knows
  phase: "lobby" | "playing" | "ended";
  questions: GuessQuestion[];
  maxQuestions: number;
  guessers: Map<string, string>; // userId -> their guess
  winnerId?: string;
  winnerName?: string;
  timers: NodeJS.Timeout[];
}

const games = new Map<string, GuessGame>();

export function getGuessGame(ch: string): GuessGame | undefined { return games.get(ch); }
export function deleteGuessGame(ch: string): void { const g = games.get(ch); if (g) for (const t of g.timers) clearTimeout(t); games.delete(ch); }

export function createGuessGame(
  channelId: string, guildId: string,
  hostId: string, hostUsername: string, secret: string,
): GuessGame {
  const g: GuessGame = {
    channelId, guildId, hostId, hostUsername, secret,
    phase: "playing",
    questions: [],
    maxQuestions: 20,
    guessers: new Map(),
    timers: [],
  };
  games.set(channelId, g);
  return g;
}

export function addQuestion(game: GuessGame, text: string, userId: string, username: string): GuessQuestion | null {
  if (game.phase !== "playing") return null;
  if (game.questions.length >= game.maxQuestions) return null;
  const q: GuessQuestion = { text, answer: "yes", askedBy: userId, askedByName: username };
  game.questions.push(q);
  return q;
}

export function answerQuestion(game: GuessGame, index: number, answer: "yes" | "no" | "maybe"): boolean {
  if (!game.questions[index]) return false;
  game.questions[index].answer = answer;
  return true;
}

export function submitGuess(
  game: GuessGame, userId: string, username: string, guess: string,
): "won" | "wrong" | "already" {
  if (game.phase !== "playing") return "wrong";
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  if (norm(guess) === norm(game.secret)) {
    game.phase = "ended";
    game.winnerId = userId;
    game.winnerName = username;
    return "won";
  }
  game.guessers.set(userId, guess);
  return "wrong";
}

export function questionsLeft(game: GuessGame): number {
  return game.maxQuestions - game.questions.filter((q) => q.answer !== "yes" || game.questions.indexOf(q) < game.questions.length).length;
}
