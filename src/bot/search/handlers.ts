import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type TextChannel,
  MessageFlags,
} from "discord.js";
import { logger } from "../../lib/logger";
import {
  createSearchGame,
  getSearchGame,
  deleteSearchGame,
  clearSearchTimers,
  getAlivePlayers,
  LOBBY_SECONDS,
  QUESTION_SECONDS,
  type SearchGame,
  type SearchPlayer,
} from "./game";
import {
  searchLobbyEmbed,
  searchQuestionEmbed,
  searchResultEmbed,
  searchWinnerEmbed,
  searchCancelledEmbed,
} from "./embeds";
import { getRandomPairs } from "./wordbank";
import { addSearchWin } from "../scores";

// ─── Buttons ──────────────────────────────────────────────────────────────────

function lobbyButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("search:join")
      .setLabel("انضم ✋")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("search:cancel")
      .setLabel("إلغاء ✖")
      .setStyle(ButtonStyle.Danger),
  );
}

function voteButtons(labelA: string, labelB: string): ActionRowBuilder<ButtonBuilder> {
  const truncate = (s: string) => s.length > 75 ? s.slice(0, 72) + "..." : s;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("search:vote_a")
      .setLabel(truncate(labelA))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("search:vote_b")
      .setLabel(truncate(labelB))
      .setStyle(ButtonStyle.Danger),
  );
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initSearchGame(
  channel: TextChannel,
  guildId: string,
  userId: string,
  username: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (getSearchGame(channel.id)) {
    return { ok: false, reason: "في لعبة بحث شغّالة بالفعل في هذه القناة." };
  }

  const game = createSearchGame(channel.id, guildId, userId, username);
  const msg = await channel.send({
    embeds: [searchLobbyEmbed(game, LOBBY_SECONDS)],
    components: [lobbyButtons()],
  });
  game.lobbyMessage = msg;

  let secondsLeft = LOBBY_SECONDS;
  const tick = setInterval(async () => {
    secondsLeft -= 15;
    const g = getSearchGame(channel.id);
    if (!g || g.phase !== "lobby") { clearInterval(tick); return; }
    if (secondsLeft <= 0) { clearInterval(tick); await launchSearchGame(channel); return; }
    try {
      await msg.edit({ embeds: [searchLobbyEmbed(g, secondsLeft)], components: [lobbyButtons()] });
    } catch { /* ignore */ }
  }, 15_000);
  game.timers.push(tick as unknown as NodeJS.Timeout);

  const autoStart = setTimeout(async () => {
    clearInterval(tick);
    await launchSearchGame(channel);
  }, LOBBY_SECONDS * 1_000);
  game.timers.push(autoStart);

  return { ok: true };
}

export async function handleSearchCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId || !interaction.channel?.isTextBased()) {
    await interaction.reply({ content: "هذا الأمر يشتغل فقط في قنوات السيرفر.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await initSearchGame(
    interaction.channel as TextChannel,
    interaction.guildId,
    interaction.user.id,
    interaction.user.username,
  );
  if (!result.ok) {
    await interaction.editReply({ content: `❌ ${result.reason}` });
  } else {
    await interaction.deleteReply().catch(() => null);
  }
}

// ─── Launch ───────────────────────────────────────────────────────────────────

async function launchSearchGame(channel: TextChannel): Promise<void> {
  const game = getSearchGame(channel.id);
  if (!game || game.phase !== "lobby") return;

  if (game.players.size < 4) {
    try {
      await game.lobbyMessage?.edit({
        embeds: [{ color: 0xed4245, description: "❌ يلزم ٤ لاعبين على الأقل. انتهت اللعبة." }],
        components: [],
      });
    } catch { /* ignore */ }
    deleteSearchGame(channel.id);
    return;
  }

  clearSearchTimers(game);
  game.phase = "question";

  try {
    await game.lobbyMessage?.edit({
      embeds: [{ color: 0x57f287, description: "🚀 انطلقت اللعبة! استعدوا..." }],
      components: [],
    });
  } catch { /* ignore */ }

  setTimeout(() => askQuestion(channel), 2_000);
}

// ─── Question round ───────────────────────────────────────────────────────────

async function askQuestion(channel: TextChannel): Promise<void> {
  const game = getSearchGame(channel.id);
  if (!game || game.phase !== "question") return;

  const alive = getAlivePlayers(game);
  if (alive.length <= 1) {
    await endGame(channel, alive[0] ?? null);
    return;
  }

  const pairs = getRandomPairs(1, game.usedPairIndices);
  if (pairs.length === 0) {
    await channel.send({ embeds: [{ color: 0xfaa61a, description: "🏁 نفدت الأسئلة! انتهت اللعبة." }] });
    const topAlive = getAlivePlayers(game);
    await endGame(channel, topAlive[0] ?? null);
    return;
  }

  const { pair, index } = pairs[0]!;
  game.usedPairIndices.add(index);
  game.currentPair = pair;
  game.currentPairIndex = index;
  game.votes = new Map();
  game.questionNumber++;

  let secondsLeft = QUESTION_SECONDS;

  const msg = await channel.send({
    embeds: [searchQuestionEmbed(game, pair, secondsLeft)],
    components: [voteButtons(pair.a, pair.b)],
  });
  game.questionMessage = msg;

  const tick = setInterval(async () => {
    secondsLeft--;
    const g = getSearchGame(channel.id);
    if (!g || g.phase !== "question") { clearInterval(tick); return; }
    if (secondsLeft <= 0) { clearInterval(tick); return; }
    try {
      await msg.edit({ embeds: [searchQuestionEmbed(g, pair, secondsLeft)] });
    } catch { /* ignore */ }
  }, 1_000);
  game.timers.push(tick as unknown as NodeJS.Timeout);

  const endTimer = setTimeout(async () => {
    clearInterval(tick);
    await revealResult(channel, game);
  }, QUESTION_SECONDS * 1_000);
  game.timers.push(endTimer);
}

// ─── Reveal result ────────────────────────────────────────────────────────────

async function revealResult(channel: TextChannel, game: SearchGame): Promise<void> {
  if (game.phase !== "question") return;
  game.phase = "result";
  clearSearchTimers(game);

  const pair = game.currentPair!;
  const alive = getAlivePlayers(game);

  const eliminated: SearchPlayer[] = [];

  for (const player of alive) {
    const vote = game.votes.get(player.userId);
    if (vote !== pair.answer) {
      player.alive = false;
      eliminated.push(player);
    }
  }

  try {
    await game.questionMessage?.edit({ components: [] });
  } catch { /* ignore */ }

  await channel.send({
    embeds: [searchResultEmbed(game, pair, eliminated)],
  });

  const remaining = getAlivePlayers(game);

  if (remaining.length <= 1) {
    setTimeout(() => endGame(channel, remaining[0] ?? null), 2_000);
    return;
  }

  game.phase = "question";
  setTimeout(() => askQuestion(channel), 3_000);
}

// ─── End game ─────────────────────────────────────────────────────────────────

async function endGame(channel: TextChannel, winner: SearchPlayer | null): Promise<void> {
  const game = getSearchGame(channel.id);
  if (!game) return;

  game.phase = "ended";
  clearSearchTimers(game);
  deleteSearchGame(channel.id);

  if (!winner) {
    await channel.send({ embeds: [{ color: 0xed4245, description: "🤝 تعادل! انتهت اللعبة بدون فائز." }] });
    return;
  }

  const pts = 10 + game.questionNumber;
  await channel.send({ embeds: [searchWinnerEmbed(winner, game.questionNumber, pts)] });
  addSearchWin(game.guildId, winner.userId, winner.username, pts);
}

// ─── Button handler ───────────────────────────────────────────────────────────

export async function handleSearchButton(interaction: ButtonInteraction): Promise<void> {
  const action = interaction.customId.replace("search:", "");
  const game = getSearchGame(interaction.channelId);

  if (action === "join") {
    if (!game || game.phase !== "lobby") {
      await interaction.reply({ content: "❌ ما في لعبة للانضمام إليها.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.players.has(interaction.user.id)) {
      await interaction.reply({ content: "✅ أنت مسجّل بالفعل!", flags: MessageFlags.Ephemeral });
      return;
    }
    game.players.set(interaction.user.id, {
      userId: interaction.user.id,
      username: interaction.user.username,
      alive: true,
    });
    const secLeft = Math.max(0, LOBBY_SECONDS - Math.floor(
      (Date.now() - (game.lobbyMessage?.createdTimestamp ?? Date.now())) / 1000,
    ));
    try {
      await game.lobbyMessage?.edit({ embeds: [searchLobbyEmbed(game, secLeft)], components: [lobbyButtons()] });
    } catch { /* ignore */ }
    await interaction.reply({ content: `✅ انضممت! ${game.players.size} لاعبين حتى الآن.`, flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === "cancel") {
    if (!game || game.phase !== "lobby") {
      await interaction.reply({ content: "❌ ما في لعبة للإلغاء.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.hostId !== interaction.user.id) {
      await interaction.reply({ content: "❌ فقط المضيف يقدر يلغي.", flags: MessageFlags.Ephemeral });
      return;
    }
    clearSearchTimers(game);
    deleteSearchGame(interaction.channelId);
    await interaction.update({ embeds: [searchCancelledEmbed()], components: [] });
    return;
  }

  if (action === "vote_a" || action === "vote_b") {
    if (!game || game.phase !== "question") {
      await interaction.reply({ content: "❌ ما في سؤال نشط الحين.", flags: MessageFlags.Ephemeral });
      return;
    }
    const player = game.players.get(interaction.user.id);
    if (!player || !player.alive) {
      await interaction.reply({ content: "❌ أنت خارج اللعبة أو لست مسجلاً.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.votes.has(interaction.user.id)) {
      await interaction.reply({ content: "✅ سبق وصوّتَ في هذا السؤال.", flags: MessageFlags.Ephemeral });
      return;
    }

    const choice = action === "vote_a" ? "a" : "b";
    game.votes.set(interaction.user.id, choice);

    const pair = game.currentPair!;
    const chosen = choice === "a" ? pair.a : pair.b;
    await interaction.reply({ content: `✅ اخترت: **${chosen}**`, flags: MessageFlags.Ephemeral });

    const alive = getAlivePlayers(game);
    if (game.votes.size >= alive.length) {
      clearSearchTimers(game);
      await revealResult(interaction.channel as TextChannel, game);
    }
    return;
  }

  await interaction.reply({ content: "❌ أمر غير معروف.", flags: MessageFlags.Ephemeral });
}
