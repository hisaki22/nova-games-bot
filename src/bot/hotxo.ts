// src/bot/hotxo.ts
// ============================================================
// HotXO Game — merged from game.ts + embeds.ts + handlers.ts
// ============================================================

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type TextChannel,
} from 'discord.js';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface HotXOPlayer {
  id: string;
  username: string;
  symbol: 'X' | 'O';
  moves: number[];
}

interface HotXOGame {
  channelId: string;
  guildId: string;
  hostId: string;
  players: HotXOPlayer[];
  board: (string | null)[];
  currentTurn: 0 | 1;
  phase: 'lobby' | 'playing' | 'ended';
  messageId: string | null;
  timers: NodeJS.Timeout[];
  createdAt: number;
}

// ─────────────────────────────────────────────
// Game State
// ─────────────────────────────────────────────

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
    players: [{ id: hostId, username: hostUsername, symbol: 'X', moves: [] }],
    board: Array(9).fill(null),
    currentTurn: 0,
    phase: 'lobby',
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
): 'ok' | 'already' | 'full' {
  if (game.players.some((p) => p.id === userId)) return 'already';
  if (game.players.length >= 2) return 'full';
  game.players.push({ id: userId, username, symbol: 'O', moves: [] });
  return 'ok';
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
  if (win) game.phase = 'ended';
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

// ─────────────────────────────────────────────
// Embeds
// ─────────────────────────────────────────────

function hotxoLobbyEmbed(game: HotXOGame): EmbedBuilder {
  const playerList = game.players
    .map((p, i) => `${i === 0 ? '❌' : '⭕'} <@${p.id}>`)
    .join('
');

  return new EmbedBuilder()
    .setTitle('🔥 XO الملتهبة')
    .setDescription(
      `**لعبة XO بنكهة جديدة!**
` +
      `كل لاعب يقدر يحط بس **3** علامات..
` +
      `لما تحط الرابعة، الأولى تختفي! 🔥

` +
      `**اللاعبين:**
${playerList}

` +
      `${game.players.length < 2 ? '⏳ ننتظر لاعب ثاني يدخل...' : '✅ جاهزين! اضغط **ابدأ**'}`
    )
    .setColor(0xFF4500)
    .setFooter({ text: 'Nova Games • XO الملتهبة' });
}

function hotxoBoardEmbed(game: HotXOGame, lastAction?: string): EmbedBuilder {
  const current = game.players[game.currentTurn];
  const symbol = current.symbol === 'X' ? '❌' : '⭕';

  let desc = lastAction ? `${lastAction}

` : '';
  desc += `${symbol} دور **${current.username}** (${current.symbol})`;

  const p1 = game.players[0];
  const p2 = game.players[1];
  desc += `

❌ ${p1.username}: **${p1.moves.length}/3** علامات`;
  desc += `
⭕ ${p2.username}: **${p2.moves.length}/3** علامات`;

  return new EmbedBuilder()
    .setTitle('🔥 XO الملتهبة')
    .setDescription(desc)
    .setColor(0xFF4500)
    .setFooter({ text: 'Nova Games • XO الملتهبة' });
}

function hotxoWinEmbed(game: HotXOGame, winnerId: string, pts: number): EmbedBuilder {
  const winner = game.players.find((p) => p.id === winnerId)!;
  const loser  = game.players.find((p) => p.id !== winnerId)!;
  const symbol = winner.symbol === 'X' ? '❌' : '⭕';

  return new EmbedBuilder()
    .setTitle(`🔥 فاز ${winner.username}! 🔥`)
    .setDescription(
      `${symbol} **${winner.username}** فاز على **${loser.username}**!

` +
      `🏆 +**${pts}** نقطة`
    )
    .setColor(0xFFD700)
    .setFooter({ text: 'Nova Games • XO الملتهبة' });
}

function hotxoCancelledEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🔥 XO الملتهبة')
    .setDescription('❌ تم إلغاء اللعبة.')
    .setColor(0x888888);
}

function hotxoTimeoutEmbed(game: HotXOGame): EmbedBuilder {
  const timedOut = game.players[game.currentTurn];
  const winner   = game.players[game.currentTurn === 0 ? 1 : 0];

  return new EmbedBuilder()
    .setTitle('🔥 انتهى الوقت!')
    .setDescription(
      `⏰ **${timedOut.username}** ما لعب بالوقت!
` +
      `🏆 **${winner.username}** فاز!`
    )
    .setColor(0xFF4500)
    .setFooter({ text: 'Nova Games • XO الملتهبة' });
}

// ─────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────

const LOBBY_SECONDS = 60;
const TURN_SECONDS  = 30;
const WIN_POINTS    = 15;

function boardRows(game: HotXOGame, disabled = false): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const cell = game.board[idx];

      const currentPlayer = game.players[game.currentTurn];
      const isNextToVanish =
        currentPlayer.moves.length >= 3 && currentPlayer.moves[0] === idx;

      let label = '　';
      let style = ButtonStyle.Secondary;

      if (cell === 'X') {
        label = '✖';
        style = isNextToVanish ? ButtonStyle.Danger : ButtonStyle.Primary;
      } else if (cell === 'O') {
        label = '⭕';
        style = isNextToVanish ? ButtonStyle.Danger : ButtonStyle.Success;
      }

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`hotxo_cell_${idx}`)
          .setLabel(label)
          .setStyle(style)
          .setDisabled(disabled || cell !== null)
      );
    }
    rows.push(row);
  }
  return rows;
}

function lobbyRow(game: HotXOGame): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('hotxo_join')
      .setLabel('انضم')
      .setStyle(ButtonStyle.Success)
      .setEmoji('⭕'),
    new ButtonBuilder()
      .setCustomId('hotxo_start')
      .setLabel('ابدأ')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('▶️')
      .setDisabled(game.players.length < 2),
    new ButtonBuilder()
      .setCustomId('hotxo_cancel')
      .setLabel('إلغاء')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')
  );
  return row;
}

function startTurnTimer(channel: TextChannel, game: HotXOGame) {
  clearHotXOTimers(game);
  const timer = setTimeout(async () => {
    const g = getHotXOGame(channel.id);
    if (!g || g.phase !== 'playing') return;
    g.phase = 'ended';
    await channel.send({ embeds: [hotxoTimeoutEmbed(g)] });
    deleteHotXOGame(channel.id);
  }, TURN_SECONDS * 1000);
  game.timers.push(timer);
}

export async function initHotXOGame(
  channel: TextChannel,
  guildId: string,
  userId: string,
  username: string
): Promise<{ ok: boolean; error?: string }> {
  if (getHotXOGame(channel.id)) {
    return { ok: false, error: '⚠️ في لعبة XO ملتهبة شغالة بالفعل هنا!' };
  }

  const game = createHotXOGame(channel.id, guildId, userId, username);
  const msg  = await channel.send({
    embeds:     [hotxoLobbyEmbed(game)],
    components: [lobbyRow(game)],
  });
  game.messageId = msg.id;

  // بعد 0.1 ثانية نعدّل الرسالة ونضيف @here فوق الإمبد للإشعار
  setTimeout(() => {
    msg.edit({
      content:    '@here',
      embeds:     [hotxoLobbyEmbed(game)],
      components: [lobbyRow(game)],
    }).catch(() => {});
  }, 100);

  const timer = setTimeout(async () => {
    const g = getHotXOGame(channel.id);
    if (g && g.phase === 'lobby') {
      await msg.edit({ embeds: [hotxoCancelledEmbed()], components: [] });
      deleteHotXOGame(channel.id);
    }
  }, LOBBY_SECONDS * 1000);
  game.timers.push(timer);

  return { ok: true };
}

export async function handleHotXOCommand(interaction: ChatInputCommandInteraction) {
  const channel  = interaction.channel as TextChannel;
  const guildId  = interaction.guildId ?? '';
  const userId   = interaction.user.id;
  const username = interaction.user.displayName ?? interaction.user.username;

  const result = await initHotXOGame(channel, guildId, userId, username);
  if (!result.ok) {
    await interaction.reply({ content: result.error!, ephemeral: true });
  } else {
    await interaction.reply({ content: '🔥 تم فتح لعبة XO الملتهبة!', ephemeral: true });
  }
}

export async function handleHotXOButton(interaction: ButtonInteraction) {
  const channelId = interaction.channelId;
  const game      = getHotXOGame(channelId);
  if (!game) return;

  const userId   = interaction.user.id;
  const customId = interaction.customId;

  if (customId === 'hotxo_join') {
    const result = joinHotXO(game, userId, interaction.user.displayName ?? interaction.user.username);
    if (result === 'already') {
      await interaction.reply({ content: 'أنت مسجل بالفعل!', ephemeral: true });
      return;
    }
    if (result === 'full') {
      await interaction.reply({ content: 'اللعبة ممتلئة (2 لاعبين)', ephemeral: true });
      return;
    }
    await interaction.update({
      embeds:     [hotxoLobbyEmbed(game)],
      components: [lobbyRow(game)],
    });
    return;
  }

  if (customId === 'hotxo_cancel') {
    if (userId !== game.hostId) {
      await interaction.reply({ content: 'بس صاحب اللعبة يقدر يلغيها!', ephemeral: true });
      return;
    }
    await interaction.update({ embeds: [hotxoCancelledEmbed()], components: [] });
    deleteHotXOGame(channelId);
    return;
  }

  if (customId === 'hotxo_start') {
    if (userId !== game.hostId) {
      await interaction.reply({ content: 'بس صاحب اللعبة يقدر يبدأها!', ephemeral: true });
      return;
    }
    if (game.players.length < 2) {
      await interaction.reply({ content: 'تحتاج لاعبين 2!', ephemeral: true });
      return;
    }

    game.currentTurn = Math.random() < 0.5 ? 0 : 1;
    game.phase       = 'playing';
    clearHotXOTimers(game);

    await interaction.update({
      embeds:     [hotxoBoardEmbed(game, '🎮 بدأت اللعبة!')],
      components: boardRows(game),
    });
    startTurnTimer(interaction.channel as TextChannel, game);
    return;
  }

  if (customId.startsWith('hotxo_cell_')) {
    if (game.phase !== 'playing') return;

    const playerIndex = game.players.findIndex((p) => p.id === userId);
    if (playerIndex === -1) {
      await interaction.reply({ content: 'أنت مو بهاللعبة!', ephemeral: true });
      return;
    }
    if (playerIndex !== game.currentTurn) {
      await interaction.reply({ content: 'مو دورك! ⏳', ephemeral: true });
      return;
    }

    const cell = parseInt(customId.replace('hotxo_cell_', ''), 10);
    if (game.board[cell] !== null) {
      await interaction.reply({ content: 'هالمكان مشغول!', ephemeral: true });
      return;
    }

    const { vanished, win } = placeHotXO(game, playerIndex, cell);

    let actionMsg = '';
    if (vanished !== null) {
      actionMsg = `💨 اختفت علامة من المربع ${vanished + 1}!`;
    }

    if (win) {
      const winnerId = game.players[playerIndex].id;
      await interaction.update({
        embeds:     [hotxoWinEmbed(game, winnerId, WIN_POINTS)],
        components: boardRows(game, true),
      });
      deleteHotXOGame(channelId);
      return;
    }

    await interaction.update({
      embeds:     [hotxoBoardEmbed(game, actionMsg)],
      components: boardRows(game),
    });
    startTurnTimer(interaction.channel as TextChannel, game);
  }
}

export type { HotXOGame, HotXOPlayer };
