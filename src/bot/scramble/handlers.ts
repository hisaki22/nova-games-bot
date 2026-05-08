import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type TextChannel,
  MessageFlags,
} from "discord.js";
import {
  beginRound,
  clearScrambleTimers,
  createScrambleGame,
  deleteScrambleGame,
  eliminatePlayer,
  getScrambleGame,
  getTurnSeconds,
  isRoundOver,
  joinScramble,
  leaveScramble,
  nextTurn,
  startScrambleGame,
} from "./game";
import {
  scrambleCancelledEmbed,
  scrambleDrawEmbed,
  scrambleLobbyEmbed,
  scrambleTurnEmbed,
  scrambleWinnerEmbed,
  scrambleWrongEmbed,
  roundSummaryEmbed,
} from "./embeds";
import { logger } from "../../lib/logger";
import { addScrambleWin } from "../scores";

const LOBBY_SECONDS = 60;
const LOBBY_TICK = 15;
const BETWEEN_TURNS_MS = 1500;
const BETWEEN_ROUNDS_MS = 4000;

function getScrambleWinPoints(roundNumber: number): number {
  if (roundNumber <= 1) return 10;
  if (roundNumber === 2) return 20;
  if (roundNumber === 3) return 25;
  return 30;
}

function lobbyButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("scr:join")
      .setLabel("انضم 🙋")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("scr:leave")
      .setLabel("خروج")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("scr:cancel")
      .setLabel("إلغاء ✖")
      .setStyle(ButtonStyle.Danger),
  );
}

export async function initScramble(
  channel: TextChannel,
  guildId: string,
  userId: string,
  username: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const channelId = channel.id;

  if (getScrambleGame(channelId)) {
    return { ok: false, reason: "في لعبة حروف شغّالة بالفعل في هذه القناة." };
  }

  const game = createScrambleGame(channelId, guildId, userId, username);
  const row = lobbyButtons();

  const msg = await channel.send({
    embeds: [scrambleLobbyEmbed(game, LOBBY_SECONDS)],
    components: [row],
  });
  game.lobbyMessage = msg;

  let secondsLeft = LOBBY_SECONDS;
  const tickInterval = setInterval(async () => {
    secondsLeft -= LOBBY_TICK;
    const g = getScrambleGame(channelId);
    if (!g || g.phase !== "lobby") { clearInterval(tickInterval); return; }
    if (secondsLeft <= 0) { clearInterval(tickInterval); await launchGame(channelId); return; }
    try {
      await msg.edit({ embeds: [scrambleLobbyEmbed(g, secondsLeft)], components: [row] });
    } catch { /* ignore */ }
  }, LOBBY_TICK * 1000);

  const timer = setTimeout(async () => {
    clearInterval(tickInterval);
    await launchGame(channelId);
  }, LOBBY_SECONDS * 1000);

  game.timers.push(timer);
  return { ok: true };
}

export async function handleScrambleCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId || !interaction.channel?.isTextBased()) {
    await interaction.reply({ content: "هذا الأمر يشتغل فقط في قنوات السيرفر.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await initScramble(
    interaction.channel as TextChannel,
    interaction.guildId,
    interaction.user.id,
    interaction.user.username,
  );
  if (!result.ok) {
    await interaction.editReply({ content: result.reason });
  } else {
    await interaction.deleteReply().catch(() => null);
  }
}

async function launchGame(channelId: string): Promise<void> {
  const game = getScrambleGame(channelId);
  if (!game || game.phase !== "lobby") return;

  if (game.players.size < 4) {
    try {
      await game.lobbyMessage?.edit({
        embeds: [{ color: 0xed4245, description: "❌ يلزم ٤ لاعبين على الأقل. انتهت اللعبة." }],
        components: [],
      });
    } catch { /* ignore */ }
    deleteScrambleGame(channelId);
    return;
  }

  startScrambleGame(game);

  try {
    await game.lobbyMessage?.edit({
      embeds: [{ color: 0x57f287, description: `✅ انطلقت اللعبة! ${game.players.size} لاعبين — جولة 1 (${getTurnSeconds(1)} ثانية لكل سؤال)` }],
      components: [],
    });
  } catch { /* ignore */ }

  await runTurn(channelId);
}

async function runTurn(channelId: string): Promise<void> {
  const game = getScrambleGame(channelId);
  if (!game || game.phase !== "playing") return;

  if (game.playerOrder.length === 1) {
    const channel = game.lobbyMessage?.channel as TextChannel | undefined;
    const winnerId = game.playerOrder[0];
    const winner = game.players.get(winnerId!);
    const pts = getScrambleWinPoints(game.roundNumber);
    if (winner && game.guildId) addScrambleWin(game.guildId, winnerId!, winner.username, pts);
    if (channel) await channel.send({ embeds: [scrambleWinnerEmbed(game, winnerId!, pts)] });
    deleteScrambleGame(channelId);
    return;
  }

  if (game.playerOrder.length === 0) {
    deleteScrambleGame(channelId);
    return;
  }

  const turn = nextTurn(game);
  if (!turn) {
    const channel = game.lobbyMessage?.channel as TextChannel | undefined;
    if (channel) await channel.send({ embeds: [scrambleDrawEmbed(game)] });
    deleteScrambleGame(channelId);
    return;
  }

  const { playerId, scrambled, word } = turn;
  const channel = game.lobbyMessage?.channel as TextChannel | undefined;
  if (!channel) { deleteScrambleGame(channelId); return; }

  const turnSeconds = getTurnSeconds(game.roundNumber);

  await channel.send({
    content: `<@${playerId}>`,
    embeds: [scrambleTurnEmbed(scrambled, turnSeconds, game.roundNumber)],
  });

  let answered = false;

  const collector = channel.createMessageCollector({
    filter: (m) => m.author.id === playerId && !m.author.bot,
    time: turnSeconds * 1000,
  });

  collector.on("collect", async (m) => {
    if (answered) return;
    const answer = m.content.trim();
    if (answer === word) {
      answered = true;
      collector.stop("correct");

      try { await m.react("✅"); } catch { /* ignore */ }
      await channel.send(`✅ <@${playerId}> صح! الكلمة: **${word}**`);
      await advanceAfterTurn(channelId, null);
    } else {
      try { await m.react("❌"); } catch { /* ignore */ }
    }
  });

  collector.on("end", async (_collected, reason) => {
    if (answered) return;
    answered = true;

    const g = getScrambleGame(channelId);
    if (!g || g.phase !== "playing") return;

    const isTimeout = reason === "time";
    await channel.send({ embeds: [scrambleWrongEmbed(playerId, word, isTimeout ? "timeout" : "wrong")] });
    eliminatePlayer(g, playerId);

    await advanceAfterTurn(channelId, channel);
  });
}

async function advanceAfterTurn(
  channelId: string,
  channel: TextChannel | null,
): Promise<void> {
  const game = getScrambleGame(channelId);
  if (!game || game.phase !== "playing") return;

  if (game.playerOrder.length <= 1) {
    const ch = channel ?? (game.lobbyMessage?.channel as TextChannel | undefined);
    if (ch) {
      if (game.playerOrder.length === 1) {
        const winnerId = game.playerOrder[0];
        const winner = game.players.get(winnerId!);
        const pts = getScrambleWinPoints(game.roundNumber);
        if (winner && game.guildId) addScrambleWin(game.guildId, winnerId!, winner.username, pts);
        await ch.send({ embeds: [scrambleWinnerEmbed(game, winnerId!, pts)] });
      }
    }
    deleteScrambleGame(channelId);
    return;
  }

  if (isRoundOver(game)) {
    const ch = channel ?? (game.lobbyMessage?.channel as TextChannel | undefined);
    if (!ch) { deleteScrambleGame(channelId); return; }

    const eliminated = [...game.eliminatedThisRound];
    beginRound(game);

    setTimeout(async () => {
      const g = getScrambleGame(channelId);
      if (!g || g.phase !== "playing") return;
      await ch.send({ embeds: [roundSummaryEmbed(g, eliminated)] });

      if (g.playerOrder.length <= 1) {
        if (g.playerOrder.length === 1) {
          const winnerId = g.playerOrder[0];
          const winner = g.players.get(winnerId!);
          const pts = getScrambleWinPoints(g.roundNumber);
          if (winner && g.guildId) addScrambleWin(g.guildId, winnerId!, winner.username, pts);
          await ch.send({ embeds: [scrambleWinnerEmbed(g, winnerId!, pts)] });
        }
        deleteScrambleGame(channelId);
        return;
      }

      setTimeout(() => runTurn(channelId), BETWEEN_ROUNDS_MS);
    }, BETWEEN_TURNS_MS);
  } else {
    setTimeout(() => runTurn(channelId), BETWEEN_TURNS_MS);
  }
}

export async function handleScrambleButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const [, action] = interaction.customId.split(":");
  const channelId = interaction.channelId;
  const game = getScrambleGame(channelId);

  if (!game || game.phase !== "lobby") {
    await interaction.reply({ content: "اللوبي انتهى أو ما في لعبة نشطة.", flags: MessageFlags.Ephemeral });
    return;
  }

  const userId = interaction.user.id;

  if (action === "join") {
    const result = joinScramble(game, userId, interaction.user.username);
    if (result === "already") {
      await interaction.reply({ content: "أنت بالفعل في اللعبة.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (result === "full") {
      await interaction.reply({ content: "اللعبة ممتلئة.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.update({ embeds: [scrambleLobbyEmbed(game, LOBBY_SECONDS)] });
    return;
  }

  if (action === "leave") {
    const result = leaveScramble(game, userId);
    if (result === "host") {
      await interaction.reply({ content: "المضيف ما يقدر يطلع. استخدم إلغاء.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (result === "not_in") {
      await interaction.reply({ content: "ما أنت في اللعبة.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.update({ embeds: [scrambleLobbyEmbed(game, LOBBY_SECONDS)] });
    return;
  }

  if (action === "cancel") {
    if (userId !== game.hostId) {
      await interaction.reply({ content: "فقط المضيف يقدر يلغي.", flags: MessageFlags.Ephemeral });
      return;
    }
    clearScrambleTimers(game);
    deleteScrambleGame(channelId);
    await interaction.update({ embeds: [scrambleCancelledEmbed()], components: [] });
    return;
  }
}

export async function handleScrambleCancel(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const channelId = interaction.channelId;
  const game = getScrambleGame(channelId);
  if (!game) {
    await interaction.reply({ content: "ما في لعبة حروف نشطة في هذه القناة.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.user.id !== game.hostId) {
    await interaction.reply({ content: "فقط المضيف يقدر يلغي.", flags: MessageFlags.Ephemeral });
    return;
  }
  clearScrambleTimers(game);
  deleteScrambleGame(channelId);
  await interaction.reply({ embeds: [scrambleCancelledEmbed()] });
}
