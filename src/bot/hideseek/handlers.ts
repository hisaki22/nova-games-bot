import {
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type TextChannel,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  MessageFlags,
} from "discord.js";
import { logger } from "../../lib/logger.js";
import {
  createHideseekGame, getHideseekGame, deleteHideseekGame,
  joinHideseek, hidePlayer, searchRoom, getHidersLeft, allHid, ROOMS, ROOM_IDS,
} from "./game.js";
import {
  hideseekLobbyEmbed, hideseekHidingEmbed, hideseekSeekEmbed,
  hideseekFoundEmbed, hideseekEndEmbed,
} from "./embeds.js";
import { addHideseekWin } from "../scores.js";

function lobbyButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("hsk:join").setLabel("🙈 أختبئ").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("hsk:start").setLabel("👀 ابدأ").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("hsk:cancel").setLabel("إلغاء").setStyle(ButtonStyle.Danger),
  ).toJSON();
}

function seekButtons(game: ReturnType<typeof getHideseekGame> & {}) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...ROOMS.slice(0, 5).map((r, i) =>
      new ButtonBuilder()
        .setCustomId(`hsk:search:${i}`)
        .setLabel(r)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(game.searchedRooms.includes(i)),
    ),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`hsk:search:5`)
      .setLabel(ROOMS[5])
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(game.searchedRooms.includes(5)),
  );
  return [row.toJSON(), row2.toJSON()];
}

function hideButtons() {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...ROOMS.slice(0, 3).map((r, i) =>
      new ButtonBuilder().setCustomId(`hsk:hide:${i}`).setLabel(r).setStyle(ButtonStyle.Primary),
    ),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...ROOMS.slice(3).map((r, i) =>
      new ButtonBuilder().setCustomId(`hsk:hide:${i + 3}`).setLabel(r).setStyle(ButtonStyle.Primary),
    ),
  );
  return [row1.toJSON(), row2.toJSON()];
}

export async function handleHideseekCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const ch = interaction.channelId;
  if (getHideseekGame(ch)) {
    await interaction.reply({ content: "يوجد لعبة غميضة نشطة!", flags: MessageFlags.Ephemeral });
    return;
  }
  const game = createHideseekGame(ch, interaction.guildId!, interaction.user.id, interaction.user.displayName);
  logger.info({ channelId: ch }, "hideseek game started");
  const msg = await interaction.reply({ embeds: [hideseekLobbyEmbed(game)], components: [lobbyButtons()], fetchReply: true });
  game.lobbyMessageId = msg.id;
}

export async function handleHideseekButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(":");
  const action = parts[1];
  const game = getHideseekGame(interaction.channelId);
  if (!game) { await interaction.reply({ content: "لا توجد لعبة.", flags: MessageFlags.Ephemeral }); return; }

  if (action === "cancel") {
    if (interaction.user.id !== game.seekerId) { await interaction.reply({ content: "الباحث فقط.", flags: MessageFlags.Ephemeral }); return; }
    deleteHideseekGame(interaction.channelId);
    await interaction.update({ content: "تم إلغاء اللعبة.", embeds: [], components: [] });
    return;
  }

  if (action === "join") {
    const res = joinHideseek(game, interaction.user.id, interaction.user.displayName);
    if (res === "seeker") { await interaction.reply({ content: "أنت الباحث! لا تقدر تختبئ.", flags: MessageFlags.Ephemeral }); return; }
    if (res === "already") { await interaction.reply({ content: "أنت منضم.", flags: MessageFlags.Ephemeral }); return; }
    if (res === "full") { await interaction.reply({ content: "اللعبة ممتلئة.", flags: MessageFlags.Ephemeral }); return; }
    await interaction.update({ embeds: [hideseekLobbyEmbed(game)], components: [lobbyButtons()] });
    return;
  }

  if (action === "start") {
    if (interaction.user.id !== game.seekerId) { await interaction.reply({ content: "الباحث فقط.", flags: MessageFlags.Ephemeral }); return; }
    if (game.players.size < 2) { await interaction.reply({ content: "يلزم شخصين مختبئين على الأقل.", flags: MessageFlags.Ephemeral }); return; }
    game.phase = "hiding";
    await interaction.update({ embeds: [hideseekHidingEmbed(game)], components: [] });
    // Send ephemeral hide buttons to each player
    const ch = interaction.channel as TextChannel;
    await ch.send({
      content: `🙈 **المختبئون:** اختاروا غرفتكم قبل 30 ثانية!\n${[...game.players.values()].map((p) => `<@${p.userId}>`).join(" ")}`,
      components: hideButtons(),
    });
    // After 30s, start seeking phase
    const t = setTimeout(async () => {
      if (!getHideseekGame(interaction.channelId)) return;
      game.phase = "seeking";
      const seekMsg = await ch.send({ embeds: [hideseekSeekEmbed(game)], components: seekButtons(game) });
      await ch.send({ content: `🔍 <@${game.seekerId}> دورك تفتش الغرف!` });
    }, 30000);
    game.timers.push(t);
    return;
  }

  if (action === "hide") {
    const roomIdx = parseInt(parts[2], 10);
    if (game.phase !== "hiding") { await interaction.reply({ content: "وقت الاختباء انتهى!", flags: MessageFlags.Ephemeral }); return; }
    if (!game.players.has(interaction.user.id)) { await interaction.reply({ content: "أنت لست من المختبئين.", flags: MessageFlags.Ephemeral }); return; }
    hidePlayer(game, interaction.user.id, roomIdx);
    await interaction.reply({ content: `🙈 اختبأت في **${ROOMS[roomIdx]}**! لا تتحرك!`, flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === "search") {
    const roomIdx = parseInt(parts[2], 10);
    if (game.phase !== "seeking") { await interaction.reply({ content: "مو وقت البحث!", flags: MessageFlags.Ephemeral }); return; }
    if (interaction.user.id !== game.seekerId) { await interaction.reply({ content: "الباحث فقط يقدر يفتش.", flags: MessageFlags.Ephemeral }); return; }
    const found = searchRoom(game, roomIdx);
    const hidersLeft = getHidersLeft(game);
    await interaction.update({ embeds: [hideseekSeekEmbed(game)], components: seekButtons(game) });
    await (interaction.channel as TextChannel).send({ embeds: [hideseekFoundEmbed(found, roomIdx, hidersLeft.length)] });

    if (hidersLeft.length === 0 || game.searchedRooms.length >= ROOMS.length) {
      const survivors = getHidersLeft(game);
      if (survivors.length > 0) {
        for (const s of survivors) addHideseekWin(game.guildId, s.userId, s.username);
      }
      deleteHideseekGame(interaction.channelId);
      await (interaction.channel as TextChannel).send({ embeds: [hideseekEndEmbed(survivors, game.seekerUsername)] });
    }
    return;
  }
}
