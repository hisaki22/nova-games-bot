// src/bot/hotxo/handlers.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import {
  createHotXOGame,
  getHotXOGame,
  deleteHotXOGame,
  clearHotXOTimers,
  joinHotXO,
  placeHotXO,
} from "./game";
import type { HotXOGame } from "./game";
import {
  hotxoLobbyEmbed,
  hotxoBoardEmbed,
  hotxoWinEmbed,
  hotxoCancelledEmbed,
  hotxoTimeoutEmbed,
} from "./embeds";
// import { addHotXOWin } from "../../db/leaderboard";

const LOBBY_SECONDS = 60;
const TURN_SECONDS = 30;
const WIN_POINTS = 15;

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

      let label = "\u3000";
      let style = ButtonStyle.Secondary;

      if (cell === "X") {
        label = "\u2716";
        style = isNextToVanish ? ButtonStyle.Danger : ButtonStyle.Primary;
      } else if (cell === "O") {
        label = "\u2B55";
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
      .setCustomId("hotxo_join")
      .setLabel("\u0627\u0646\u0636\u0645")
      .setStyle(ButtonStyle.Success)
      .setEmoji("\u2B55"),
    new ButtonBuilder()
      .setCustomId("hotxo_start")
      .setLabel("\u0627\u0628\u062F\u0623")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("\u25B6\uFE0F")
      .setDisabled(game.players.length < 2),
    new ButtonBuilder()
      .setCustomId("hotxo_cancel")
      .setLabel("\u0625\u0644\u063A\u0627\u0621")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("\u274C")
  );
  return row;
}

function startTurnTimer(channel: TextChannel, game: HotXOGame) {
  clearHotXOTimers(game);
  const timer = setTimeout(async () => {
    const g = getHotXOGame(channel.id);
    if (!g || g.phase !== "playing") return;
    g.phase = "ended";
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
    return { ok: false, error: "\u26A0\uFE0F \u0641\u064A \u0644\u0639\u0628\u0629 XO \u0645\u0644\u062A\u0647\u0628\u0629 \u0634\u063A\u0627\u0644\u0629 \u0628\u0627\u0644\u0641\u0639\u0644 \u0647\u0646\u0627!" };
  }

  const game = createHotXOGame(channel.id, guildId, userId, username);
  const msg = await channel.send({
    embeds: [hotxoLobbyEmbed(game)],
    components: [lobbyRow(game)],
  });
  game.messageId = msg.id;

  const timer = setTimeout(async () => {
    const g = getHotXOGame(channel.id);
    if (g && g.phase === "lobby") {
      await msg.edit({ embeds: [hotxoCancelledEmbed()], components: [] });
      deleteHotXOGame(channel.id);
    }
  }, LOBBY_SECONDS * 1000);
  game.timers.push(timer);

  return { ok: true };
}

export async function handleHotXOCommand(interaction: ChatInputCommandInteraction) {
  const channel = interaction.channel as TextChannel;
  const guildId = interaction.guildId ?? "";
  const userId = interaction.user.id;
  const username = interaction.user.displayName ?? interaction.user.username;

  const result = await initHotXOGame(channel, guildId, userId, username);
  if (!result.ok) {
    await interaction.reply({ content: result.error!, ephemeral: true });
  } else {
    await interaction.reply({ content: "\uD83D\uDD25 \u062A\u0645 \u0641\u062A\u062D \u0644\u0639\u0628\u0629 XO \u0627\u0644\u0645\u0644\u062A\u0647\u0628\u0629!", ephemeral: true });
  }
}

export async function handleHotXOButton(interaction: ButtonInteraction) {
  const channelId = interaction.channelId;
  const game = getHotXOGame(channelId);
  if (!game) return;

  const userId = interaction.user.id;
  const customId = interaction.customId;

  if (customId === "hotxo_join") {
    const result = joinHotXO(game, userId, interaction.user.displayName ?? interaction.user.username);
    if (result === "already") {
      await interaction.reply({ content: "\u0623\u0646\u062A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644!", ephemeral: true });
      return;
    }
    if (result === "full") {
      await interaction.reply({ content: "\u0627\u0644\u0644\u0639\u0628\u0629 \u0645\u0645\u062A\u0644\u0626\u0629 (2 \u0644\u0627\u0639\u0628\u064A\u0646)", ephemeral: true });
      return;
    }
    await interaction.update({
      embeds: [hotxoLobbyEmbed(game)],
      components: [lobbyRow(game)],
    });
    return;
  }

  if (customId === "hotxo_cancel") {
    if (userId !== game.hostId) {
      await interaction.reply({ content: "\u0628\u0633 \u0635\u0627\u062D\u0628 \u0627\u0644\u0644\u0639\u0628\u0629 \u064A\u0642\u062F\u0631 \u064A\u0644\u063A\u064A\u0647\u0627!", ephemeral: true });
      return;
    }
    await interaction.update({ embeds: [hotxoCancelledEmbed()], components: [] });
    deleteHotXOGame(channelId);
    return;
  }

  if (customId === "hotxo_start") {
    if (userId !== game.hostId) {
      await interaction.reply({ content: "\u0628\u0633 \u0635\u0627\u062D\u0628 \u0627\u0644\u0644\u0639\u0628\u0629 \u064A\u0642\u062F\u0631 \u064A\u0628\u062F\u0623\u0647\u0627!", ephemeral: true });
      return;
    }
    if (game.players.length < 2) {
      await interaction.reply({ content: "\u062A\u062D\u062A\u0627\u062C \u0644\u0627\u0639\u0628\u064A\u0646 2!", ephemeral: true });
      return;
    }

    game.currentTurn = Math.random() < 0.5 ? 0 : 1;
    game.phase = "playing";
    clearHotXOTimers(game);

    await interaction.update({
      embeds: [hotxoBoardEmbed(game, "\uD83C\uDFAE \u0628\u062F\u0623\u062A \u0627\u0644\u0644\u0639\u0628\u0629!")],
      components: boardRows(game),
    });
    startTurnTimer(interaction.channel as TextChannel, game);
    return;
  }

  if (customId.startsWith("hotxo_cell_")) {
    if (game.phase !== "playing") return;

    const playerIndex = game.players.findIndex((p) => p.id === userId);
    if (playerIndex === -1) {
      await interaction.reply({ content: "\u0623\u0646\u062A \u0645\u0648 \u0628\u0647\u0627\u0644\u0644\u0639\u0628\u0629!", ephemeral: true });
      return;
    }
    if (playerIndex !== game.currentTurn) {
      await interaction.reply({ content: "\u0645\u0648 \u062F\u0648\u0631\u0643! \u23F3", ephemeral: true });
      return;
    }

    const cell = parseInt(customId.replace("hotxo_cell_", ""), 10);
    if (game.board[cell] !== null) {
      await interaction.reply({ content: "\u0647\u0627\u0644\u0645\u0643\u0627\u0646 \u0645\u0634\u063A\u0648\u0644!", ephemeral: true });
      return;
    }

    const { vanished, win } = placeHotXO(game, playerIndex, cell);

    let actionMsg = "";
    if (vanished !== null) {
      actionMsg = `\uD83D\uDCA8 \u0627\u062E\u062A\u0641\u062A \u0639\u0644\u0627\u0645\u0629 \u0645\u0646 \u0627\u0644\u0645\u0631\u0628\u0639 ${vanished + 1}!`;
    }

    if (win) {
      const winnerId = game.players[playerIndex].id;
      await interaction.update({
        embeds: [hotxoWinEmbed(game, winnerId, WIN_POINTS)],
        components: boardRows(game, true),
      });
      deleteHotXOGame(channelId);
      return;
    }

    await interaction.update({
      embeds: [hotxoBoardEmbed(game, actionMsg)],
      components: boardRows(game),
    });
    startTurnTimer(interaction.channel as TextChannel, game);
  }
}
