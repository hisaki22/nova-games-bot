import {
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  type TextChannel,
  MessageFlags,
} from "discord.js";
import { logger } from "../../lib/logger.js";
import {
  createHideseekGame, getHideseekGame, deleteHideseekGame,
  joinHideseek, setHiddenCell, allPlayersHid, startGame,
  getCurrentRevealer, revealCell, getAlivePlayers, GRID_SIZE,
} from "./game.js";
import {
  hideseekLobbyEmbed, hideseekHidingEmbed, hideseekGridEmbed,
  hideseekRevealEmbed, hideseekWinEmbed, hideseekNoWinnerEmbed,
} from "./embeds.js";
import { addHideseekWin } from "../scores.js";

function lobbyButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("hsk:join").setLabel("✋ انضم").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("hsk:start").setLabel("▶️ ابدأ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("hsk:cancel").setLabel("إلغاء").setStyle(ButtonStyle.Danger),
  ).toJSON();
}

function hidingButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("hsk:pickCell").setLabel("🙈 اختر خانتي").setStyle(ButtonStyle.Primary),
  ).toJSON();
}

/** Build 5×5 grid (5 rows × 5 buttons = 25 cells) */
function gridButtons(revealedCells: number[]) {
  const rows: ReturnType<ActionRowBuilder<ButtonBuilder>["toJSON"]>[] = [];
  for (let row = 0; row < 5; row++) {
    const actionRow = new ActionRowBuilder<ButtonBuilder>();
    for (let col = 0; col < 5; col++) {
      const cell = row * 5 + col + 1; // 1-25
      const revealed = revealedCells.includes(cell);
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`hsk:reveal:${cell}`)
          .setLabel(revealed ? "💣" : String(cell))
          .setStyle(revealed ? ButtonStyle.Danger : ButtonStyle.Secondary)
          .setDisabled(revealed),
      );
    }
    rows.push(actionRow.toJSON());
  }
  return rows;
}

export async function handleHideseekCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const ch = interaction.channelId;
  if (getHideseekGame(ch)) {
    await interaction.reply({ content: "يوجد لعبة غميضة نشطة في هذه القناة!", flags: MessageFlags.Ephemeral });
    return;
  }
  const game = createHideseekGame(ch, interaction.guildId!, interaction.user.id, interaction.user.displayName);
  logger.info({ channelId: ch }, "hideseek game created");
  await interaction.reply({ embeds: [hideseekLobbyEmbed(game)], components: [lobbyButtons()] });
}

export async function handleHideseekButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(":");
  const action = parts[1];
  const game = getHideseekGame(interaction.channelId);
  if (!game) { await interaction.reply({ content: "لا توجد لعبة.", flags: MessageFlags.Ephemeral }); return; }

  // ── LOBBY ──────────────────────────────────────────
  if (action === "cancel") {
    if (interaction.user.id !== game.hostId) {
      await interaction.reply({ content: "المضيف فقط يقدر يلغي.", flags: MessageFlags.Ephemeral }); return;
    }
    deleteHideseekGame(interaction.channelId);
    await interaction.update({ content: "تم إلغاء لعبة الغميضة.", embeds: [], components: [] });
    return;
  }

  if (action === "join") {
    const res = joinHideseek(game, interaction.user.id, interaction.user.displayName);
    if (res === "already") { await interaction.reply({ content: "أنت منضم.", flags: MessageFlags.Ephemeral }); return; }
    if (res === "full") { await interaction.reply({ content: "اللعبة ممتلئة (15 لاعب).", flags: MessageFlags.Ephemeral }); return; }
    await interaction.update({ embeds: [hideseekLobbyEmbed(game)], components: [lobbyButtons()] });
    return;
  }

  if (action === "start") {
    if (interaction.user.id !== game.hostId) {
      await interaction.reply({ content: "المضيف فقط يقدر يبدأ.", flags: MessageFlags.Ephemeral }); return;
    }
    if (game.players.size < 3) {
      await interaction.reply({ content: "يلزم 3 لاعبين على الأقل.", flags: MessageFlags.Ephemeral }); return;
    }
    game.phase = "hiding";
    await interaction.update({ embeds: [hideseekHidingEmbed(game)], components: [hidingButton()] });
    return;
  }

  // ── HIDING PHASE ───────────────────────────────────
  if (action === "pickCell") {
    if (game.phase !== "hiding") {
      await interaction.reply({ content: "مو وقت الاختيار.", flags: MessageFlags.Ephemeral }); return;
    }
    if (!game.players.has(interaction.user.id)) {
      await interaction.reply({ content: "أنت لست في اللعبة.", flags: MessageFlags.Ephemeral }); return;
    }
    const modal = new ModalBuilder()
      .setCustomId("hsk:cellModal")
      .setTitle("🙈 اختر خانتك السرية")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("cell")
            .setLabel(`رقم من 1 إلى ${GRID_SIZE}`)
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(2)
            .setRequired(true)
            .setPlaceholder("مثال: 13"),
        ),
      );
    await interaction.showModal(modal);
    return;
  }

  // ── PLAYING PHASE — reveal a cell ──────────────────
  if (action === "reveal") {
    if (game.phase !== "playing") {
      await interaction.reply({ content: "اللعبة مو في مرحلة الكشف.", flags: MessageFlags.Ephemeral }); return;
    }

    const revealer = getCurrentRevealer(game);
    if (!revealer || revealer.userId !== interaction.user.id) {
      await interaction.reply({ content: "مو دورك الآن!", flags: MessageFlags.Ephemeral }); return;
    }

    const cell = parseInt(parts[2], 10);
    const result = revealCell(game, interaction.user.id, cell);
    if ("error" in result) {
      await interaction.reply({ content: `❌ ${result.error}`, flags: MessageFlags.Ephemeral }); return;
    }

    const ch = interaction.channel as TextChannel;

    // Update the grid message
    if (game.phase === "ended") {
      await interaction.update({ components: [] });
    } else {
      const nextRevealer = getCurrentRevealer(game);
      if (nextRevealer) {
        await interaction.update({
          embeds: [hideseekGridEmbed(game, nextRevealer)],
          components: gridButtons(game.revealedCells),
        });
      }
    }

    // Send reveal result
    await ch.send({ embeds: [hideseekRevealEmbed(result, revealer.username)] });

    // Check end conditions
    if (game.phase === "ended") {
      if (result.winner) {
        addHideseekWin(game.guildId, result.winner.userId, result.winner.username);
        await ch.send({ embeds: [hideseekWinEmbed(result.winner)] });
      } else {
        await ch.send({ embeds: [hideseekNoWinnerEmbed()] });
      }
      deleteHideseekGame(interaction.channelId);
    } else {
      // Ping next revealer
      const nextRevealer = getCurrentRevealer(game);
      if (nextRevealer) {
        await ch.send({ content: `🔍 دور <@${nextRevealer.userId}> — اختر خانة لتكشفها!` });
      }
    }
    return;
  }
}

export async function handleHideseekModal(interaction: ModalSubmitInteraction): Promise<void> {
  const game = getHideseekGame(interaction.channelId);
  if (!game || game.phase !== "hiding") {
    await interaction.reply({ content: "لا توجد لعبة في مرحلة الاختيار.", flags: MessageFlags.Ephemeral }); return;
  }

  const raw = interaction.fields.getTextInputValue("cell").trim();
  const cell = parseInt(raw, 10);
  const result = setHiddenCell(game, interaction.user.id, cell);

  if (result === "invalid") {
    await interaction.reply({ content: `❌ أدخل رقماً بين 1 و ${GRID_SIZE}.`, flags: MessageFlags.Ephemeral }); return;
  }
  if (result === "not_in") {
    await interaction.reply({ content: "أنت لست في اللعبة.", flags: MessageFlags.Ephemeral }); return;
  }

  await interaction.reply({ content: `✅ اختبأت في الخانة **${cell}**! لا تخبر أحد 🤫`, flags: MessageFlags.Ephemeral });

  // Update hiding embed to show progress
  const ch = interaction.channel as TextChannel;
  const msgs = await ch.messages.fetch({ limit: 10 });
  const hidingMsg = msgs.find((m) => m.embeds[0]?.title?.includes("اختر خانتك"));
  if (hidingMsg) {
    await hidingMsg.edit({ embeds: [hideseekHidingEmbed(game)], components: [hidingButton()] }).catch(() => null);
  }

  // Start game if all players have hidden
  if (allPlayersHid(game)) {
    startGame(game);
    const revealer = getCurrentRevealer(game);
    if (!revealer) return;

    await ch.send({
      content: `👀 الجميع اختبأ! **الجولة 1** — دور <@${revealer.userId}> لكشف أول خانة!`,
      embeds: [hideseekGridEmbed(game, revealer)],
      components: gridButtons(game.revealedCells),
    });
  }
}
