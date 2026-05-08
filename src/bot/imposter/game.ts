import { pickEightOptions, pickRound, type Category } from "../words";

export type Phase =
  | "lobby"
  | "reveal"
  | "suggestions"
  | "voting"
  | "guessing"
  | "ended";

export interface Player {
  id: string;
  username: string;
  isImposter: boolean;
  suggestion?: string;
  seenWord: boolean;
}

export interface Game {
  channelId: string;
  guildId: string;
  hostId: string;
  hostUsername: string;
  phase: Phase;
  players: Map<string, Player>;
  imposterIds: string[];
  category?: Category;
  secretWord?: string;
  eightOptions?: string[];
  votes: Map<string, string>;
  guess?: { word: string; correct: boolean; byUserId: string };
  votingDeadline?: number;
  guessDeadline?: number;
  lobbyMessageId?: string;
  timers: {
    suggestionsStart?: NodeJS.Timeout;
    votingStart?: NodeJS.Timeout;
    guessingStart?: NodeJS.Timeout;
    endRound?: NodeJS.Timeout;
    lobbyAutoStart?: NodeJS.Timeout;
  };
  scores: Map<string, number>;
  createdAt: number;
}

const games = new Map<string, Game>();

export function getGame(channelId: string): Game | undefined {
  return games.get(channelId);
}

export function createGame(
  channelId: string,
  guildId: string,
  hostId: string,
  hostUsername: string,
): Game {
  const game: Game = {
    channelId,
    guildId,
    hostId,
    hostUsername,
    phase: "lobby",
    players: new Map(),
    imposterIds: [],
    votes: new Map(),
    timers: {},
    scores: new Map(),
    createdAt: Date.now(),
  };
  game.players.set(hostId, {
    id: hostId,
    username: hostUsername,
    isImposter: false,
    seenWord: false,
  });
  games.set(channelId, game);
  return game;
}

export function clearTimers(game: Game): void {
  if (game.timers.suggestionsStart) clearTimeout(game.timers.suggestionsStart);
  if (game.timers.votingStart) clearTimeout(game.timers.votingStart);
  if (game.timers.guessingStart) clearTimeout(game.timers.guessingStart);
  if (game.timers.endRound) clearTimeout(game.timers.endRound);
  if (game.timers.lobbyAutoStart) clearTimeout(game.timers.lobbyAutoStart);
  game.timers = {};
}

export function deleteGame(channelId: string): void {
  const game = games.get(channelId);
  if (game) clearTimers(game);
  games.delete(channelId);
}

export function joinGame(
  channelId: string,
  userId: string,
  username: string,
): { ok: true; game: Game } | { ok: false; reason: string } {
  const game = games.get(channelId);
  if (!game) return { ok: false, reason: "ما في لعبة شغالة في هذي القناة." };
  if (game.phase !== "lobby")
    return { ok: false, reason: "اللعبة بدأت، ما تقدر تنضم الحين." };
  if (game.players.has(userId))
    return { ok: false, reason: "أنت أصلاً منضم." };
  if (game.players.size >= 15)
    return { ok: false, reason: "الحد الأقصى ١٥ لاعب." };
  game.players.set(userId, {
    id: userId,
    username,
    isImposter: false,
    seenWord: false,
  });
  return { ok: true, game };
}

export function leaveGame(
  channelId: string,
  userId: string,
): { ok: true; game: Game } | { ok: false; reason: string } {
  const game = games.get(channelId);
  if (!game) return { ok: false, reason: "ما في لعبة شغالة." };
  if (game.phase !== "lobby")
    return { ok: false, reason: "ما تقدر تطلع بعد بداية اللعبة." };
  if (!game.players.has(userId))
    return { ok: false, reason: "أنت أصلاً مو منضم." };
  if (userId === game.hostId)
    return { ok: false, reason: "أنت المضيف، استخدم زر إلغاء اللعبة." };
  game.players.delete(userId);
  return { ok: true, game };
}

export function startGame(
  channelId: string,
  userId: string,
): { ok: true; game: Game } | { ok: false; reason: string } {
  const game = games.get(channelId);
  if (!game) return { ok: false, reason: "ما في لعبة شغالة." };
  if (game.hostId !== userId)
    return { ok: false, reason: "بس المضيف يقدر يبدأ اللعبة." };
  if (game.phase !== "lobby")
    return { ok: false, reason: "اللعبة بدأت من قبل." };
  if (game.players.size < 4)
    return { ok: false, reason: "تحتاج على الأقل ٤ لاعبين." };

  const { category, word } = pickRound();
  game.category = category;
  game.secretWord = word;
  game.eightOptions = pickEightOptions(category, word);

  const ids = Array.from(game.players.keys());
  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  game.imposterIds = shuffled.slice(0, 1);
  for (const p of game.players.values()) {
    p.isImposter = game.imposterIds.includes(p.id);
  }
  game.phase = "reveal";
  return { ok: true, game };
}

export function markSeen(game: Game, userId: string): boolean {
  const p = game.players.get(userId);
  if (!p) return false;
  p.seenWord = true;
  return true;
}

export function submitSuggestion(
  game: Game,
  userId: string,
  text: string,
): { ok: true } | { ok: false; reason: string } {
  if (game.phase !== "suggestions")
    return { ok: false, reason: "مرحلة الاقتراح ما هي شغالة الحين." };
  const p = game.players.get(userId);
  if (!p) return { ok: false, reason: "أنت مو في اللعبة." };
  p.suggestion = text.slice(0, 80);
  return { ok: true };
}

export function castVote(
  game: Game,
  voterId: string,
  targetId: string,
): { ok: true; allVoted: boolean } | { ok: false; reason: string } {
  if (game.phase !== "voting")
    return { ok: false, reason: "مرحلة التصويت ما بدأت." };
  if (!game.players.has(voterId))
    return { ok: false, reason: "أنت مو في اللعبة." };
  if (!game.players.has(targetId))
    return { ok: false, reason: "هذا اللاعب مو موجود." };
  if (voterId === targetId)
    return { ok: false, reason: "ما تقدر تصوّت على نفسك." };
  if (game.votes.has(voterId))
    return { ok: false, reason: "صوّتت من قبل، ما تقدر تغيّر." };
  game.votes.set(voterId, targetId);
  return { ok: true, allVoted: game.votes.size >= game.players.size };
}

export function submitGuess(
  game: Game,
  userId: string,
  word: string,
): { ok: true; correct: boolean } | { ok: false; reason: string } {
  if (game.phase !== "guessing")
    return { ok: false, reason: "مرحلة التخمين ما بدأت." };
  if (!game.imposterIds.includes(userId))
    return { ok: false, reason: "بس الإمبوستر يقدر يخمّن." };
  if (game.guess)
    return { ok: false, reason: "تم التخمين بالفعل." };
  const correct = word === game.secretWord;
  game.guess = { word, correct, byUserId: userId };
  return { ok: true, correct };
}

export interface RoundResult {
  voteCounts: Map<string, number>;
  topVoted: string[];
  guessOutcome: "correct" | "wrong" | "skipped";
  scoreDelta: Map<string, number>;
  scoreTotals: Map<string, number>;
}

export function finalizeScores(game: Game): RoundResult {
  const voteCounts = new Map<string, number>();
  for (const target of game.votes.values()) {
    voteCounts.set(target, (voteCounts.get(target) ?? 0) + 1);
  }
  let max = 0;
  let topVoted: string[] = [];
  for (const [id, c] of voteCounts) {
    if (c > max) {
      max = c;
      topVoted = [id];
    } else if (c === max) {
      topVoted.push(id);
    }
  }

  const delta = new Map<string, number>();
  const add = (id: string, n: number) => {
    delta.set(id, (delta.get(id) ?? 0) + n);
  };

  for (const [voterId, targetId] of game.votes) {
    if (game.imposterIds.includes(targetId)) {
      add(voterId, 1);
    }
  }

  for (const impId of game.imposterIds) {
    if (!topVoted.includes(impId)) {
      add(impId, 1);
    }
  }

  let guessOutcome: "correct" | "wrong" | "skipped" = "skipped";
  if (game.guess) {
    if (game.guess.correct) {
      guessOutcome = "correct";
      for (const impId of game.imposterIds) add(impId, 1);
    } else {
      guessOutcome = "wrong";
    }
  }

  for (const [id, n] of delta) {
    game.scores.set(id, (game.scores.get(id) ?? 0) + n);
  }
  for (const id of game.players.keys()) {
    if (!game.scores.has(id)) game.scores.set(id, 0);
  }

  return {
    voteCounts,
    topVoted,
    guessOutcome,
    scoreDelta: delta,
    scoreTotals: new Map(game.scores),
  };
}
