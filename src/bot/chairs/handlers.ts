import {
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type TextChannel,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  MessageFlags,
} from "discord.js";
import { logger } from "../../lib/logger.js";
import {
  createChairsGame, getChairsGame, deleteChairsGame,
  joinChairs, startChairsRound, grabChair, resolveRound, getWinner, clearChairsTimers,
} from "./game.js";
import {
  chairsLobbyEmbed, chairsRoundEmbed, chairsEliminatedEmbed, chairsWinEmbed,
} from "./embeds.js";
import { addChairsWin } from "../scores.js";

function lobbyButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("chr:join").setLabel("✋ انضم").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("chr:start").setLabel("🎵 ابدأ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("chr:cancel").setLabel("إلغاء").setStyle(ButtonStyle.Danger),
  ).toJSON();
}

function chairButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("chr:grab").setLabel("🪑 خذ كرسي!").setStyle(ButtonStyle.Success),
  ).toJSON();
}

export async function handleChairsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const ch = interaction.channelId;
  if (getChairsGame(ch)) {
    await interaction.reply({ content: "يوجد لعبة كراسي نشطة!", flags: MessageFlags.Ephemeral });
    return;
  }
  const game = createChairsGame(ch, interaction.guildId!, interaction.user.id, interaction.user.displayName);
  logger.info({ channelId: ch }, "chairs game started");
  const msg = await interaction.reply({ embeds: [chairsLobbyEmbed(game)], components: [lobbyButtons()], fetchReply: true });
  game.lobbyMessageId = msg.id;
}

export async function handleChairsButton(interaction: ButtonInteraction): Promise<void> {
  const [, action] = interaction.customId.split(":");
  const game = getChairsGame(interaction.channelId);
  if (!game) { await interaction.reply({ content: "لا توجد لعبة.", flags: MessageFlags.Ephemeral }); return; }

  if (action === "cancel") {
    if (interaction.user.id !== game.hostId) { await interaction.reply({ content: "المضيف فقط.", flags: MessageFlags.Ephemeral }); return; }
    deleteChairsGame(interaction.channelId);
    await interaction.update({ content: "تم إلغاء اللعبة.", embeds: [], components: [] });
    return;
  }

  if (action === "join") {
    const result = joinChairs(game, interaction.user.id, interaction.user.displayName);
    if (result === "already") { await interaction.reply({ content: "أنت منضم!", flags: MessageFlags.Ephemeral }); return; }
    if (result === "full") { await interaction.reply({ content: "اللعبة ممتلئة (15 لاعب).", flags: MessageFlags.Ephemeral }); return; }
    await interaction.update({ embeds: [chairsLobbyEmbed(game)], components: [lobbyButtons()] });
    return;
  }

  if (action === "start") {
    if (interaction.user.id !== game.hostId) { await interaction.reply({ content: "المضيف فقط.", flags: MessageFlags.Ephemeral }); return; }
    if (game.players.size < 3) { await interaction.reply({ content: "يلزم 3 لاعبين على الأقل.", flags: MessageFlags.Ephemeral }); return; }
    await interaction.deferUpdate();
    await runChairsRound(interaction.channel as TextChannel, game);
    return;
  }

  if (action === "grab") {
    if (game.phase !== "grab") { await interaction.reply({ content: "مو وقت الأخذ!", flags: MessageFlags.Ephemeral }); return; }
    const result = grabChair(game, interaction.user.id);
    if (result === "not_in") { await interaction.reply({ content: "أنت لست في اللعبة.", flags: MessageFlags.Ephemeral }); return; }
    if (result === "already") { await interaction.reply({ content: "أخذت كرسي!", flags: MessageFlags.Ephemeral }); return; }
    if (result === "full") { await interaction.reply({ content: "💀 الكراسي امتلأت! ما لحقت.", flags: MessageFlags.Ephemeral }); return; }
    await interaction.reply({ content: "🪑 أخذت كرسي!", flags: MessageFlags.Ephemeral });
    // Update display
    const ch = interaction.channel as TextChannel;
    const msgs = await ch.messages.fetch({ limit: 5 });
    const roundMsg = msgs.find((m) => m.embeds[0]?.title?.includes("الجولة"));
    if (roundMsg) await roundMsg.edit({ embeds: [chairsRoundEmbed(game, 0)], components: [chairButton()] }).catch(() => null);
    return;
  }
}

async function runChairsRound(channel: TextChannel, game: ReturnType<typeof getChairsGame> & {}): Promise<void> {
  startChairsRound(game);
  let secs = 10;
  const msg = await channel.send({ embeds: [chairsRoundEmbed(game, secs)], components: [chairButton()] });

  await new Promise<void>((resolve) => {
    const tick = setInterval(async () => {
      secs--;
      if (secs <= 0) {
        clearInterval(tick);
        resolve();
        return;
      }
      await msg.edit({ embeds: [chairsRoundEmbed(game, secs)], components: [chairButton()] }).catch(() => null);
    }, 1000);
    game.timers.push(tick as unknown as NodeJS.Timeout);
  });

  game.phase = "countdown";
  await msg.edit({ embeds: [chairsRoundEmbed(game, 0)], components: [] }).catch(() => null);

  const eliminated = resolveRound(game);
  if (eliminated) {
    await channel.send({ embeds: [chairsEliminatedEmbed(eliminated, game)] });
  }

  const winner = getWinner(game);
  if (winner) {
    game.phase = "ended";
    clearChairsTimers(game);
    addChairsWin(game.guildId, winner.userId, winner.username);
    deleteChairsGame(game.channelId);
    await channel.send({ embeds: [chairsWinEmbed(winner)] });
    return;
  }

  // Next round after 3s
  await new Promise((r) => setTimeout(r, 3000));
  if (getChairsGame(game.channelId)) {
    await runChairsRound(channel, game);
  }
}
