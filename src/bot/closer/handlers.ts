import {
  type ChatInputCommandInteraction,
  type Message,
  type TextChannel,
  MessageFlags,
} from "discord.js";
import { logger } from "../../lib/logger.js";
import {
  createCloserGame, getCloserGame, deleteCloserGame, submitCloserGuess,
} from "./game.js";
import { closerEmbed, closerWonEmbed, closerGuessEmbed } from "./embeds.js";
import { addCloserWin } from "../scores.js";

export async function handleCloserCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const ch = interaction.channelId;
  if (getCloserGame(ch)) {
    await interaction.reply({ content: "يوجد لعبة أقرب نشطة في هذه القناة!", flags: MessageFlags.Ephemeral });
    return;
  }
  const game = createCloserGame(ch, interaction.guildId!, interaction.user.id);
  logger.info({ channelId: ch, secret: game.secret }, "closer game started");
  await interaction.reply({ embeds: [closerEmbed(game)] });
}

export async function handleCloserMessage(message: Message): Promise<void> {
  if (message.author.bot) return;
  if (!message.guild) return;
  const game = getCloserGame(message.channelId);
  if (!game || game.phase !== "playing") return;

  const num = parseInt(message.content.trim(), 10);
  if (isNaN(num)) return;

  const result = submitCloserGuess(game, message.author.id, message.author.displayName, num);
  if ("error" in result) {
    await message.reply(result.error).then((m) => setTimeout(() => m.delete().catch(() => null), 4000));
    return;
  }

  if (result.won) {
    addCloserWin(game.guildId, message.author.id, message.author.displayName);
    const total = game.guesses.length;
    deleteCloserGame(message.channelId);
    await message.reply({ embeds: [closerWonEmbed(game, total)] });
  } else {
    const reply = await message.reply({ embeds: [closerGuessEmbed(result.diff, num, result.tooBig, result.rank)] });
    setTimeout(() => reply.delete().catch(() => null), 8000);
    // Update the main game message if possible
    try {
      const ch = message.channel as TextChannel;
      const msgs = await ch.messages.fetch({ limit: 20 });
      const gameMsg = msgs.find((m) => m.author.id === message.client.user?.id && m.embeds[0]?.title?.includes("أقرب"));
      if (gameMsg) await gameMsg.edit({ embeds: [closerEmbed(game)] });
    } catch { /* ignore */ }
  }
}
