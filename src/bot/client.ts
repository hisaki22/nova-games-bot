import {
  Client, Events, GatewayIntentBits, Partials, REST, Routes,
  SlashCommandBuilder, type Interaction,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { handlePrefixMessage } from "./prefix.js";
import { handleButton, handleCancelCommand, handleHelpCommand, handleLeaderboardCommand, handleModal, handleMyScoreCommand, handleStartCommand } from "./imposter/handlers.js";
import { handleScrambleButton, handleScrambleCommand, handleScrambleCancel } from "./scramble/handlers.js";
import { handleSearchCommand, handleSearchButton } from "./search/handlers.js";
import { handleRouletteCommand, handleRouletteButton, handleRouletteCancelCommand } from "./roulette/handlers.js";
import { handleHotXOCommand, handleHotXOButton } from "./hotxo.js";
import { handleWordleCommand, handleWordleButton, handleWordleModal } from "./wordle/handlers.js";
import { handleCloserCommand, handleCloserMessage } from "./closer/handlers.js";
import { handleChairsCommand, handleChairsButton } from "./chairs/handlers.js";
import { handleHideseekCommand, handleHideseekButton, handleHideseekModal } from "./hideseek/handlers.js";
import { handleGuessCommand, handleGuessButton, handleGuessModal } from "./guess/handlers.js";

const commands = [
  new SlashCommandBuilder().setName("امبوستر").setDescription("ابدأ لعبة إمبوستر جديدة في هذه القناة").toJSON(),
  new SlashCommandBuilder().setName("مساعدة").setDescription("اعرض شرح لعبة الإمبوستر والأوامر").toJSON(),
  new SlashCommandBuilder().setName("الغاء").setDescription("ألغِ لعبة الإمبوستر الحالية (للمضيف)").toJSON(),
  new SlashCommandBuilder().setName("حروف").setDescription("ابدأ لعبة الحروف المخربطة").toJSON(),
  new SlashCommandBuilder().setName("الغاء_حروف").setDescription("ألغِ لعبة الحروف الحالية (للمضيف)").toJSON(),
  new SlashCommandBuilder().setName("نقاط").setDescription("اعرض نقاطك ومرتبتك في هذا السيرفر").toJSON(),
  new SlashCommandBuilder().setName("توب").setDescription("اعرض أفضل ١٠ لاعبين في السيرفر").toJSON(),
  new SlashCommandBuilder().setName("بحث").setDescription("ابدأ لعبة البحث — أيهما يُبحث عنه أكثر؟").toJSON(),
  new SlashCommandBuilder().setName("روليت").setDescription("ابدأ لعبة الروليت").toJSON(),
  new SlashCommandBuilder().setName("الغاء_روليت").setDescription("ألغِ لعبة الروليت الحالية (للمضيف)").toJSON(),
  new SlashCommandBuilder().setName("xo").setDescription("ابدأ لعبة XO الملتهبة 🔥").toJSON(),
  new SlashCommandBuilder().setName("اوردو").setDescription("ابدأ لعبة أوردو — خمّن الكلمة الخماسية!").toJSON(),
  new SlashCommandBuilder().setName("اقرب").setDescription("ابدأ لعبة أقرب — خمّن الرقم السري!").toJSON(),
  new SlashCommandBuilder().setName("كراسي").setDescription("ابدأ الكراسي الموسيقية!").toJSON(),
  new SlashCommandBuilder().setName("غميضة").setDescription("ابدأ لعبة غميضة — اختبئ في خانة سرية!").toJSON(),
  new SlashCommandBuilder().setName("خمن").setDescription("ابدأ لعبة خمن — 20 سؤال بنعم أو لا!").toJSON(),
];

export async function startBot(token: string): Promise<Client> {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel],
  });

  client.once(Events.ClientReady, async (c) => {
    logger.info({ tag: c.user.tag, id: c.user.id }, "discord bot ready");
    try {
      const rest = new REST({ version: "10" }).setToken(token);
      await rest.put(Routes.applicationCommands(c.user.id), { body: commands });
      logger.info({ count: commands.length }, "registered global slash commands");
    } catch (err) {
      logger.error({ err }, "failed to register slash commands");
    }
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const name = interaction.commandName;
        if (name === "امبوستر") await handleStartCommand(interaction);
        else if (name === "مساعدة") await handleHelpCommand(interaction);
        else if (name === "الغاء") await handleCancelCommand(interaction);
        else if (name === "حروف") await handleScrambleCommand(interaction);
        else if (name === "الغاء_حروف") await handleScrambleCancel(interaction);
        else if (name === "نقاط") await handleMyScoreCommand(interaction);
        else if (name === "توب") await handleLeaderboardCommand(interaction);
        else if (name === "بحث") await handleSearchCommand(interaction);
        else if (name === "روليت") await handleRouletteCommand(interaction);
        else if (name === "الغاء_روليت") await handleRouletteCancelCommand(interaction);
        else if (name === "xo") await handleHotXOCommand(interaction);
        else if (name === "اوردو") await handleWordleCommand(interaction);
        else if (name === "اقرب") await handleCloserCommand(interaction);
        else if (name === "كراسي") await handleChairsCommand(interaction);
        else if (name === "غميضة") await handleHideseekCommand(interaction);
        else if (name === "خمن") await handleGuessCommand(interaction);

      } else if (interaction.isButton()) {
        const id = interaction.customId;
        if (id.startsWith("scr:")) await handleScrambleButton(interaction);
        else if (id.startsWith("search:")) await handleSearchButton(interaction);
        else if (id.startsWith("rlt:")) await handleRouletteButton(interaction);
        else if (id.startsWith("hotxo_")) await handleHotXOButton(interaction);
        else if (id.startsWith("wrdl:")) await handleWordleButton(interaction);
        else if (id.startsWith("chr:")) await handleChairsButton(interaction);
        else if (id.startsWith("hsk:")) await handleHideseekButton(interaction);
        else if (id.startsWith("gss:")) await handleGuessButton(interaction);
        else await handleButton(interaction);

      } else if (interaction.isModalSubmit()) {
        const id = interaction.customId;
        if (id.startsWith("wrdl:")) await handleWordleModal(interaction);
        else if (id.startsWith("hsk:")) await handleHideseekModal(interaction);
        else if (id.startsWith("gss:")) await handleGuessModal(interaction);
        else await handleModal(interaction);
      }
    } catch (err) {
      logger.error({ err }, "interaction handler failed");
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "صار خطأ غير متوقع. حاول مرة ثانية.", ephemeral: true });
        }
      } catch { /* ignore */ }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    try {
      await handlePrefixMessage(message);
      await handleCloserMessage(message);
    } catch (err) {
      logger.error({ err }, "message handler failed");
    }
  });

  client.on(Events.Error, (err) => { logger.error({ err }, "discord client error"); });
  await client.login(token);
  return client;
}
