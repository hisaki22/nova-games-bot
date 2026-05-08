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
  createGuessGame, getGuessGame, deleteGuessGame,
  addQuestion, answerQuestion, submitGuess,
} from "./game.js";
import { guessEmbed, guessWonEmbed, guessEndedNoWinnerEmbed, guessHostPromptEmbed } from "./embeds.js";
import { addGuessWin } from "../scores.js";

function gameButtons(isHost: boolean, questionsLeft: number) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("gss:ask").setLabel("❓ اسأل سؤالاً").setStyle(ButtonStyle.Primary).setDisabled(questionsLeft <= 0),
    new ButtonBuilder().setCustomId("gss:guess").setLabel("💡 خمّن الإجابة").setStyle(ButtonStyle.Success),
  );
  if (isHost) row.addComponents(
    new ButtonBuilder().setCustomId("gss:cancel").setLabel("إلغاء").setStyle(ButtonStyle.Danger),
  );
  return row.toJSON();
}

function answerButtons(qIndex: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`gss:ans:${qIndex}:yes`).setLabel("✅ نعم").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`gss:ans:${qIndex}:no`).setLabel("❌ لا").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`gss:ans:${qIndex}:maybe`).setLabel("🤷 ربما").setStyle(ButtonStyle.Secondary),
  ).toJSON();
}

export async function handleGuessCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const ch = interaction.channelId;
  if (getGuessGame(ch)) {
    await interaction.reply({ content: "يوجد لعبة خمن نشطة!", flags: MessageFlags.Ephemeral });
    return;
  }
  // Ask host for the secret via modal
  const modal = new ModalBuilder()
    .setCustomId("gss:setup_modal")
    .setTitle("🧠 ما الذي تفكر فيه؟")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("secret")
          .setLabel("الشيء الذي يجب أن يخمنوه (سري!)")
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(100)
          .setRequired(true)
          .setPlaceholder("مثال: برج إيفل"),
      ),
    );
  await interaction.showModal(modal);
}

export async function handleGuessModal(interaction: ModalSubmitInteraction): Promise<void> {
  const [, action] = interaction.customId.split(":");

  if (action === "setup_modal") {
    const secret = interaction.fields.getTextInputValue("secret");
    const game = createGuessGame(interaction.channelId, interaction.guildId!, interaction.user.id, interaction.user.displayName, secret);
    logger.info({ channelId: interaction.channelId }, "guess game started");
    await interaction.reply({ embeds: [guessEmbed(game)], components: [gameButtons(true, game.maxQuestions - game.questions.length)] });
    return;
  }

  if (action === "ask_modal") {
    const game = getGuessGame(interaction.channelId);
    if (!game) { await interaction.reply({ content: "لا توجد لعبة.", flags: MessageFlags.Ephemeral }); return; }
    const text = interaction.fields.getTextInputValue("question");
    const q = addQuestion(game, text, interaction.user.id, interaction.user.displayName);
    if (!q) { await interaction.reply({ content: "انتهت الأسئلة المتاحة.", flags: MessageFlags.Ephemeral }); return; }
    const qIdx = game.questions.length - 1;
    // Notify host
    const ch = interaction.channel as TextChannel;
    await ch.send({
      content: `<@${game.hostId}> سؤال جديد من **${interaction.user.displayName}**: "${text}"`,
      components: [answerButtons(qIdx)],
    });
    await interaction.reply({ content: `✅ سؤالك أُرسل للمضيف!`, flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === "guess_modal") {
    const game = getGuessGame(interaction.channelId);
    if (!game) { await interaction.reply({ content: "لا توجد لعبة.", flags: MessageFlags.Ephemeral }); return; }
    const g = interaction.fields.getTextInputValue("answer");
    const result = submitGuess(game, interaction.user.id, interaction.user.displayName, g);
    if (result === "won") {
      addGuessWin(game.guildId, interaction.user.id, interaction.user.displayName);
      deleteGuessGame(interaction.channelId);
      await interaction.reply({ embeds: [guessWonEmbed(game)] });
    } else {
      await interaction.reply({ content: `❌ تخمينك **"${g}"** غلط! حاول مرة ثانية.`, flags: MessageFlags.Ephemeral });
    }
    return;
  }
}

export async function handleGuessButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(":");
  const action = parts[1];
  const game = getGuessGame(interaction.channelId);

  if (action === "cancel") {
    if (!game || interaction.user.id !== game.hostId) { await interaction.reply({ content: "المضيف فقط.", flags: MessageFlags.Ephemeral }); return; }
    deleteGuessGame(interaction.channelId);
    await interaction.update({ content: "تم إلغاء اللعبة.", embeds: [], components: [] });
    return;
  }

  if (action === "ask") {
    if (!game || game.phase !== "playing") { await interaction.reply({ content: "لا توجد لعبة.", flags: MessageFlags.Ephemeral }); return; }
    if (interaction.user.id === game.hostId) { await interaction.reply({ content: "أنت المضيف، لا تسأل!", flags: MessageFlags.Ephemeral }); return; }
    const modal = new ModalBuilder()
      .setCustomId("gss:ask_modal")
      .setTitle("❓ اكتب سؤالاً بنعم/لا")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("question")
            .setLabel("سؤالك (يجاوب عنه بنعم أو لا)")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(150)
            .setRequired(true)
            .setPlaceholder("مثال: هل هو حي؟"),
        ),
      );
    await interaction.showModal(modal);
    return;
  }

  if (action === "guess") {
    if (!game || game.phase !== "playing") { await interaction.reply({ content: "لا توجد لعبة.", flags: MessageFlags.Ephemeral }); return; }
    const modal = new ModalBuilder()
      .setCustomId("gss:guess_modal")
      .setTitle("💡 ما إجابتك؟")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("answer")
            .setLabel("اكتب تخمينك")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
    return;
  }

  if (action === "ans") {
    const qIdx = parseInt(parts[2], 10);
    const answer = parts[3] as "yes" | "no" | "maybe";
    if (!game || interaction.user.id !== game.hostId) { await interaction.reply({ content: "المضيف فقط.", flags: MessageFlags.Ephemeral }); return; }
    answerQuestion(game, qIdx, answer);
    await interaction.update({ components: [] });
    // Update game embed
    const ch = interaction.channel as TextChannel;
    const msgs = await ch.messages.fetch({ limit: 20 });
    const gameMsg = msgs.find((m) => m.author.id === interaction.client.user?.id && m.embeds[0]?.title?.includes("خمن"));
    const ql = game.maxQuestions - game.questions.length;
    if (gameMsg) await gameMsg.edit({ embeds: [guessEmbed(game)], components: [gameButtons(false, ql)] }).catch(() => null);

    if (ql <= 0 && game.phase === "playing") {
      game.phase = "ended";
      deleteGuessGame(interaction.channelId);
      await ch.send({ embeds: [guessEndedNoWinnerEmbed(game)] });
    }
    return;
  }
}
