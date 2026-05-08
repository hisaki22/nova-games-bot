import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  type Interaction,
} from "discord.js";
import { logger } from "../lib/logger";
import { handlePrefixMessage } from "./prefix";
import {
  handleButton,
  handleCancelCommand,
  handleHelpCommand,
  handleLeaderboardCommand,
  handleModal,
  handleMyScoreCommand,
  handleStartCommand,
} from "./imposter/handlers";
import {
  handleScrambleButton,
  handleScrambleCommand,
  handleScrambleCancel,
} from "./scramble/handlers";
import {
  handleSearchCommand,
  handleSearchButton,
} from "./search/handlers";
import {
  handleRouletteCommand,
  handleRouletteButton,
  handleRouletteCancelCommand,
} from "./roulette/handlers";
import {
  handleHotXOCommand,
  handleHotXOButton,
} from "./hotxo";

const commands = [
  new SlashCommandBuilder()
    .setName("امبوستر")
    .setDescription("ابدأ لعبة إمبوستر جديدة في هذه القناة")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("مساعدة")
    .setDescription("اعرض شرح لعبة الإمبوستر والأوامر")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("الغاء")
    .setDescription("ألغِ لعبة الإمبوستر الحالية في هذه القناة (للمضيف فقط)")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("حروف")
    .setDescription("ابدأ لعبة الحروف المخربطة في هذه القناة")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("الغاء_حروف")
    .setDescription("ألغِ لعبة الحروف الحالية في هذه القناة (للمضيف فقط)")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("نقاط")
    .setDescription("اعرض نقاطك ومرتبتك في هذا السيرفر")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("توب")
    .setDescription("اعرض أفضل ١٠ لاعبين في السيرفر")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("بحث")
    .setDescription("ابدأ لعبة البحث — أيهما يُبحث عنه أكثر على جوجل؟")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("روليت")
    .setDescription("ابدأ لعبة الروليت — تدور وتطرد لاعباً كل جولة حتى يبقى الفائز!")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("الغاء_روليت")
    .setDescription("ألغِ لعبة الروليت الحالية في هذه القناة (للمضيف فقط)")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("xo")
    .setDescription("ابدأ لعبة XO الملتهبة 🔥")
    .toJSON(),
];

export async function startBot(token: string): Promise<Client> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  client.once(Events.ClientReady, async (c) => {
    logger.info({ tag: c.user.tag, id: c.user.id }, "discord bot ready");
    try {
      const rest = new REST({ version: "10" }).setToken(token);
      await rest.put(Routes.applicationCommands(c.user.id), {
        body: commands,
      });
      logger.info(
        { count: commands.length },
        "registered global slash commands",
      );
    } catch (err) {
      logger.error({ err }, "failed to register slash commands");
    }
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const name = interaction.commandName;
        if (name === "امبوستر") {
          await handleStartCommand(interaction);
        } else if (name === "مساعدة") {
          await handleHelpCommand(interaction);
        } else if (name === "الغاء") {
          await handleCancelCommand(interaction);
        } else if (name === "حروف") {
          await handleScrambleCommand(interaction);
        } else if (name === "الغاء_حروف") {
          await handleScrambleCancel(interaction);
        } else if (name === "نقاط") {
          await handleMyScoreCommand(interaction);
        } else if (name === "توب") {
          await handleLeaderboardCommand(interaction);
        } else if (name === "بحث") {
          await handleSearchCommand(interaction);
        } else if (name === "روليت") {
          await handleRouletteCommand(interaction);
        } else if (name === "الغاء_روليت") {
          await handleRouletteCancelCommand(interaction);
        } else if (name === "xo") {
          await handleHotXOCommand(interaction);
        }
      } else if (interaction.isButton()) {
        if (interaction.customId.startsWith("scr:")) {
          await handleScrambleButton(interaction);
        } else if (interaction.customId.startsWith("search:")) {
          await handleSearchButton(interaction);
        } else if (interaction.customId.startsWith("rlt:")) {
          await handleRouletteButton(interaction);
        } else if (interaction.customId.startsWith("hotxo_")) {
          await handleHotXOButton(interaction);
        } else {
          await handleButton(interaction);
        }
      } else if (interaction.isModalSubmit()) {
        await handleModal(interaction);
      }
    } catch (err) {
      logger.error({ err }, "interaction handler failed");
      try {
        if (
          interaction.isRepliable() &&
          !interaction.replied &&
          !interaction.deferred
        ) {
          await interaction.reply({
            content: "صار خطأ غير متوقع. حاول مرة ثانية.",
            ephemeral: true,
          });
        }
      } catch {
        // ignore
      }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    try {
      await handlePrefixMessage(message);
    } catch (err) {
      logger.error({ err }, "prefix handler failed");
    }
  });

  client.on(Events.Error, (err) => {
    logger.error({ err }, "discord client error");
  });

  await client.login(token);
  return client;
}
