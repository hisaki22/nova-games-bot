import {
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type TextChannel,
  MessageFlags,
} from "discord.js";
import { logger } from "../../lib/logger.js";
import {
  createWordleGame, getWordleGame, deleteWordleGame, submitWordleGuess,
} from "./game.js";
import { wordleEmbed, wordleWonEmbed, wordleLostEmbed } from "./embeds.js";
import { addWordleWin } from "../scores.js";

function guessButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("wrdl:guess").setLabel("✏️ خمّن كلمة").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("wrdl:cancel").setLabel("إلغاء").setStyle(ButtonStyle.Danger),
  ).toJSON();
}

export async function handleWordleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const ch = interaction.channelId;
  if (getWordleGame(ch)) {
    await interaction.reply({ content: "يوجد لعبة أوردو نشطة في هذه القناة!", flags: MessageFlags.Ephemeral });
    return;
  }
  const game = createWordleGame(ch, interaction.guildId!, interaction.user.id);
  logger.info({ channelId: ch }, "wordle game started");
  await interaction.reply({ embeds: [wordleEmbed(game)], components: [guessButton()] });
}

export async function handleWordleButton(interaction: ButtonInteraction): Promise<void> {
  const [, action] = interaction.customId.split(":");
  const game = getWordleGame(interaction.channelId);

  if (action === "cancel") {
    if (!game) { await interaction.reply({ content: "لا توجد لعبة.", flags: MessageFlags.Ephemeral }); return; }
    if (interaction.user.id !== game.hostId) { await interaction.reply({ content: "المضيف فقط يقدر يلغي.", flags: MessageFlags.Ephemeral }); return; }
    deleteWordleGame(interaction.channelId);
    await interaction.update({ content: "تم إلغاء لعبة الأوردو.", embeds: [], components: [] });
    return;
  }

  if (action === "guess") {
    if (!game || game.phase !== "playing") { await interaction.reply({ content: "لا توجد لعبة نشطة.", flags: MessageFlags.Ephemeral }); return; }
    const modal = new ModalBuilder()
      .setCustomId("wrdl:guess_modal")
      .setTitle("✏️ أدخل تخمينك")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("word")
            .setLabel("كلمة خماسية بالعربي")
            .setStyle(TextInputStyle.Short)
            .setMinLength(5)
            .setMaxLength(7)
            .setRequired(true)
            .setPlaceholder("مثال: سيارة"),
        ),
      );
    await interaction.showModal(modal);
  }
}

export async function handleWordleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const game = getWordleGame(interaction.channelId);
  if (!game || game.phase !== "playing") {
    await interaction.reply({ content: "لا توجد لعبة نشطة.", flags: MessageFlags.Ephemeral });
    return;
  }
  const word = interaction.fields.getTextInputValue("word");
  const result = submitWordleGuess(game, word, interaction.user.id, interaction.user.displayName);

  if ("error" in result) {
    await interaction.reply({ content: `❌ ${result.error}`, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferUpdate();
  const channel = interaction.channel as TextChannel;

  if (result.won) {
    addWordleWin(game.guildId, interaction.user.id, interaction.user.displayName);
    deleteWordleGame(interaction.channelId);
    await channel.send({ embeds: [wordleWonEmbed(game)] });
    await interaction.editReply({ embeds: [wordleWonEmbed(game)], components: [] });
  } else if (result.lost) {
    deleteWordleGame(interaction.channelId);
    await interaction.editReply({ embeds: [wordleLostEmbed(game)], components: [] });
  } else {
    await interaction.editReply({ embeds: [wordleEmbed(game)], components: [guessButton()] });
  }
}
