// src/bot/hotxo/game.ts

interface HotXOPlayer {
  id: string;
  username: string;
  symbol: "X" | "O";
  moves: number[];   // ordered list of cell indices (0-8)
}

interface HotXOGame {
  channelId: string;
  guildId: string;
  hostId: string;
  players: HotXOPlayer[];
  board: (string | null)[];    // 9 cells: null | "X" | "O"
  currentTurn: 0 | 1;         // index into players[]
  phase: "lobby" | "playing" | "ended";
  messageId: string | null;
  timers: NodeJS.Timeout[];
  createdAt: number;
}

const hotxoGames = new Map<string, HotXOGame>();

export function getHotXOGame(channelId: string): HotXOGame | undefined {
  return hotxoGames.get(channelId);
}

export function createHotXOGame(
  channelId: string,
  guildId: string,
  hostId: string,
  hostUsername: string
): HotXOGame {
  const game: HotXOGame = {
    channelId,
    guildId,
    hostId,
    players: [{ id: hostId, username: hostUsername, symbol: "X", moves: [] }],
    board: Array(9).fill(null),
    currentTurn: 0,
    phase: "lobby",
    messageId: null,
    timers: [],
    createdAt: Date.now(),
  };
  hotxoGames.set(channelId, game);
  return game;
}

export function deleteHotXOGame(channelId: string) {
  const g = hotxoGames.get(channelId);
  if (g) clearHotXOTimers(g);
  hotxoGames.delete(channelId);
}

export function clearHotXOTimers(game: HotXOGame) {
  for (const t of game.timers) clearTimeout(t);
  game.timers = [];
}

export function joinHotXO(
  game: HotXOGame,
  userId: string,
  username: string
): "ok" | "already" | "full" {
  if (game.players.some((p) => p.id === userId)) return "already";
  if (game.players.length >= 2) return "full";
  game.players.push({ id: userId, username: username, symbol: "O", moves: [] });
  return "ok";
}

export function placeHotXO(
  game: HotXOGame,
  playerIndex: number,
  cell: number
): { vanished: number | null; win: boolean } {
  const player = game.players[playerIndex];
  const symbol = player.symbol;

  game.board[cell] = symbol;
  player.moves.push(cell);

  let vanished: number | null = null;
  if (player.moves.length > 3) {
    const oldest = player.moves.shift()!;
    game.board[oldest] = null;
    vanished = oldest;
  }

  const win = checkWin(game.board, symbol);
  if (win) game.phase = "ended";
  else game.currentTurn = game.currentTurn === 0 ? 1 : 0;

  return { vanished, win };
}

function checkWin(board: (string | null)[], symbol: string): boolean {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  return lines.some((line) => line.every((i) => board[i] === symbol));
}

export type { HotXOGame, HotXOPlayer };
