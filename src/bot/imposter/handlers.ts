import {
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type TextChannel,
  type Client,
  type Message,
  MessageFlags,
} from "discord.js";
import {
  castVote,
  clearTimers,
  createGame,
  deleteGame,
  finalizeScores,
  getGame,
  joinGame,
  leaveGame,
  markSeen,
  startGame,
  submitGuess,
  submitSuggestion,
  type Game,
} from "./game";
import {
  endRoundEmbed,
  errorEmbed,
  guessingPhaseEmbed,
  helpEmbed,
  infoEmbed,
  lobbyEmbed,
  revealEphemeralImposter,
  revealEphemeralPlayer,
  revealPhaseEmbed,
  successEmbed,
  suggestionsPhaseEmbed,
  votingPhaseEmbed,
} from "./embeds";
import {
  guessButtons,
  lobbyButtons,
  revealButton,
  suggestButton,
  suggestionModal,
  votingButtons,
} from "./components";
import { logger } from "../../lib/logger";
import {
  addImposterPoints,
  getLeaderboard,
  getUserRank,
  getUserRecord,
} from "./scores";

const REVEAL_SECONDS = 20;
const SUGGESTION_SECONDS = 40;
const VOTING_BASE_SECONDS = 30;
const VOTING_PER_PLAYER_SECONDS = 2;
const GUESSING_SECONDS = 30;
const LOBBY_SECONDS = 60;

interface PhaseMessage {
  reveal?: Message;
  suggestions?: Message;
  voting?: Message;
  guessing?: Message;
}
const phaseMessages = new Map<string, PhaseMessage>();

function getPhaseMessages(channelId: string): PhaseMessage {
  let pm = phaseMessages.get(channelId);
  if (!pm) {
    pm = {};
    phaseMessages.set(channelId, pm);
  }
  return pm;
}

function clearPhaseMessages(channelId: string): void {
  phaseMessages.delete(channelId);
}

// ────────────────────────────────────────────────────────────────────
// Slash commands
// ────────────────────────────────────────────────────────────────────

export async function initImposterGame(
  channel: TextChannel,
  guildId: string,
  userId: string,
  username: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const existing = getGame(channel.id);
  if (existing) {
    return { ok: false, reason: "في لعبة شغالة في هذي القناة. الغها أولاً أو خلصوها." };
  }

  const game = createGame(channel.id, guildId, userId, username);
  clearPhaseMessages(channel.id);

  let secondsLeft = LOBBY_SECONDS;

  const msg = await channel.send({
    embeds: [lobbyEmbed(game, secondsLeft)],
    components: [lobbyButtons()],
  });
  game.lobbyMessageId = msg.id;

  const tick = setInterval(async () => {
    secondsLeft -= 15;
    const g = getGame(channel.id);
    if (!g || g.phase !== "lobby") { clearInterval(tick); return; }
    if (secondsLeft <= 0) { clearInterval(tick); return; }
    try {
      await msg.edit({ embeds: [lobbyEmbed(g, secondsLeft)], components: [lobbyButtons()] });
    } catch { /* ignore */ }
  }, 15_000);

  const autoStart = setTimeout(async () => {
    clearInterval(tick);
    const g = getGame(channel.id);
    if (!g || g.phase !== "lobby") return;

    const startResult = startGame(channel.id, g.hostId);
    if (!startResult.ok) {
      try {
        await msg.edit({
          embeds: [infoEmbed("❌ انتهى وقت الانتظار", startResult.reason)],
          components: [],
        });
      } catch { /* ignore */ }
      deleteGame(channel.id);
      clearPhaseMessages(channel.id);
      return;
    }

    try {
      await msg.edit({
        embeds: [infoEmbed("🎬 بدأت اللعبة", `بدأت تلقائياً — تابعوا الرسائل تحت ⬇️`)],
        components: [],
      });
    } catch { /* ignore */ }

    await transitionToReveal(channel.client, channel, startResult.game);
  }, LOBBY_SECONDS * 1000);

  game.timers.lobbyAutoStart = autoStart;

  return { ok: true };
}

export async function handleStartCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (
    !interaction.guildId ||
    !interaction.channel ||
    !interaction.channel.isTextBased()
  ) {
    await interaction.reply({
      embeds: [errorEmbed("هذا الأمر يشتغل فقط داخل قنوات السيرفر.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await initImposterGame(
    interaction.channel as TextChannel,
    interaction.guildId,
    interaction.user.id,
    interaction.user.username,
  );
  if (!result.ok) {
    await interaction.editReply({ embeds: [errorEmbed(result.reason)] });
  } else {
    await interaction.deleteReply().catch(() => null);
  }
}

export async function handleHelpCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.reply({
    embeds: [helpEmbed()],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleCancelCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const game = getGame(interaction.channelId);
  if (!game) {
    await interaction.reply({
      embeds: [errorEmbed("ما في لعبة شغالة.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (game.hostId !== interaction.user.id) {
    await interaction.reply({
      embeds: [errorEmbed("بس المضيف يقدر يلغي اللعبة.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  deleteGame(interaction.channelId);
  clearPhaseMessages(interaction.channelId);
  await interaction.reply({
    embeds: [successEmbed("تم إلغاء اللعبة.")],
  });
}

// ────────────────────────────────────────────────────────────────────
// Buttons
// ────────────────────────────────────────────────────────────────────

export async function handleButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const id = interaction.customId;
  if (id === "imp:join") return handleJoin(interaction);
  if (id === "imp:leave") return handleLeave(interaction);
  if (id === "imp:cancel") return handleCancel(interaction);
  if (id === "imp:reveal") return handleReveal(interaction);
  if (id === "imp:suggest") return handleSuggestOpen(interaction);
  if (id.startsWith("imp:vote:")) {
    return handleVote(interaction, id.slice("imp:vote:".length));
  }
  if (id.startsWith("imp:guess:")) {
    return handleGuess(interaction, Number(id.slice("imp:guess:".length)));
  }
}

async function refreshLobby(interaction: ButtonInteraction): Promise<void> {
  const game = getGame(interaction.channelId);
  if (!game) return;
  const secLeft = Math.max(0, LOBBY_SECONDS - Math.floor(
    (Date.now() - game.createdAt) / 1000,
  ));
  await interaction.message.edit({
    embeds: [lobbyEmbed(game, secLeft)],
    components: [lobbyButtons()],
  });
}

async function handleJoin(interaction: ButtonInteraction): Promise<void> {
  const result = joinGame(
    interaction.channelId,
    interaction.user.id,
    interaction.user.username,
  );
  if (!result.ok) {
    await interaction.reply({
      embeds: [errorEmbed(result.reason)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.deferUpdate();
  await refreshLobby(interaction);
}

async function handleLeave(interaction: ButtonInteraction): Promise<void> {
  const result = leaveGame(interaction.channelId, interaction.user.id);
  if (!result.ok) {
    await interaction.reply({
      embeds: [errorEmbed(result.reason)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.deferUpdate();
  await refreshLobby(interaction);
}

async function handleCancel(interaction: ButtonInteraction): Promise<void> {
  const game = getGame(interaction.channelId);
  if (!game) {
    await interaction.reply({
      embeds: [errorEmbed("ما في لعبة شغالة.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (game.hostId !== interaction.user.id) {
    await interaction.reply({
      embeds: [errorEmbed("بس المضيف يقدر يلغي اللعبة.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  deleteGame(interaction.channelId);
  clearPhaseMessages(interaction.channelId);
  await interaction.update({
    embeds: [
      infoEmbed(
        "🛑 تم إلغاء اللعبة",
        "المضيف ألغى اللعبة. اكتب `$امبوستر` لجولة جديدة.",
      ),
    ],
    components: [],
  });
}

async function handleReveal(interaction: ButtonInteraction): Promise<void> {
  const game = getGame(interaction.channelId);
  if (!game) {
    await interaction.reply({
      embeds: [errorEmbed("ما في لعبة شغالة.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (game.phase !== "reveal") {
    await interaction.reply({
      embeds: [errorEmbed("مرحلة الكشف انتهت.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const player = game.players.get(interaction.user.id);
  if (!player) {
    await interaction.reply({
      embeds: [errorEmbed("أنت مو في اللعبة.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  markSeen(game, interaction.user.id);

  const embed = player.isImposter
    ? revealEphemeralImposter(game.category!.name)
    : revealEphemeralPlayer(game.secretWord!, game.category!.name);

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });

  // Update reveal embed checklist
  try {
    const pm = getPhaseMessages(interaction.channelId);
    if (pm.reveal) {
      const secondsLeft = Math.max(
        0,
        Math.round(((game.timers as unknown as { revealEnd?: number }).revealEnd ?? 0) - Date.now()) / 1000,
      );
      await pm.reveal.edit({
        embeds: [revealPhaseEmbed(game, Math.max(0, Math.ceil(secondsLeft)))],
        components: [revealButton()],
      });
    }
  } catch (err) {
    logger.warn({ err }, "failed to refresh reveal embed");
  }
}

async function handleSuggestOpen(interaction: ButtonInteraction): Promise<void> {
  const game = getGame(interaction.channelId);
  if (!game) {
    await interaction.reply({
      embeds: [errorEmbed("ما في لعبة شغالة.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (game.phase !== "suggestions") {
    await interaction.reply({
      embeds: [errorEmbed("مرحلة الاقتراحات مو شغالة الحين.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!game.players.has(interaction.user.id)) {
    await interaction.reply({
      embeds: [errorEmbed("أنت مو في اللعبة.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.showModal(suggestionModal());
}

export async function handleModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  if (interaction.customId !== "imp:suggest_modal") return;
  const game = getGame(interaction.channelId ?? "");
  if (!game) {
    await interaction.reply({
      embeds: [errorEmbed("ما في لعبة شغالة.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const text = interaction.fields.getTextInputValue("suggestion").trim();
  const result = submitSuggestion(game, interaction.user.id, text);
  if (!result.ok) {
    await interaction.reply({
      embeds: [errorEmbed(result.reason)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.reply({
    embeds: [successEmbed(`تم تسجيل اقتراحك: \`${text}\``)],
    flags: MessageFlags.Ephemeral,
  });
  // Refresh suggestions checklist
  try {
    const pm = getPhaseMessages(interaction.channelId ?? "");
    if (pm.suggestions) {
      const secondsLeft = Math.max(
        0,
        Math.ceil(
          (((game.timers as unknown as { suggestEnd?: number }).suggestEnd ?? 0) -
            Date.now()) /
            1000,
        ),
      );
      await pm.suggestions.edit({
        embeds: [suggestionsPhaseEmbed(game, secondsLeft)],
        components: [suggestButton()],
      });
    }
  } catch (err) {
    logger.warn({ err }, "failed to refresh suggestions embed");
  }
}

async function handleVote(
  interaction: ButtonInteraction,
  targetId: string,
): Promise<void> {
  const game = getGame(interaction.channelId);
  if (!game) {
    await interaction.reply({
      embeds: [errorEmbed("ما في لعبة شغالة.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const result = castVote(game, interaction.user.id, targetId);
  if (!result.ok) {
    await interaction.reply({
      embeds: [errorEmbed(result.reason)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.reply({
    embeds: [successEmbed(`صوّتك سُجّل على <@${targetId}>`)],
    flags: MessageFlags.Ephemeral,
  });
  // Refresh voting embed
  try {
    const pm = getPhaseMessages(interaction.channelId);
    if (pm.voting) {
      const secondsLeft = Math.max(
        0,
        Math.ceil(((game.votingDeadline ?? 0) - Date.now()) / 1000),
      );
      await pm.voting.edit({
        embeds: [votingPhaseEmbed(game, secondsLeft)],
        components: votingButtons(game),
      });
    }
  } catch (err) {
    logger.warn({ err }, "failed to refresh voting embed");
  }

  if (result.allVoted) {
    clearTimers(game);
    await transitionToGuessing(
      interaction.client,
      interaction.channel as TextChannel,
      game,
    );
  }
}

async function handleGuess(
  interaction: ButtonInteraction,
  index: number,
): Promise<void> {
  const game = getGame(interaction.channelId);
  if (!game) {
    await interaction.reply({
      embeds: [errorEmbed("ما في لعبة شغالة.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const word = game.eightOptions?.[index];
  if (!word) {
    await interaction.reply({
      embeds: [errorEmbed("خيار غير صحيح.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const result = submitGuess(game, interaction.user.id, word);
  if (!result.ok) {
    await interaction.reply({
      embeds: [errorEmbed(result.reason)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.reply({
    embeds: [
      successEmbed(
        result.correct
          ? `🎯 اخترت \`${word}\` — صحيح!`
          : `❌ اخترت \`${word}\` — غلط.`,
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
  clearTimers(game);
  await endRound(interaction.channel as TextChannel, game);
}

// ────────────────────────────────────────────────────────────────────
// Phase transitions (with timers)
// ────────────────────────────────────────────────────────────────────

async function transitionToReveal(
  _client: Client,
  channel: TextChannel,
  game: Game,
): Promise<void> {
  game.phase = "reveal";
  const revealEnd = Date.now() + REVEAL_SECONDS * 1000;
  (game.timers as unknown as { revealEnd: number }).revealEnd = revealEnd;
  const msg = await channel.send({
    embeds: [revealPhaseEmbed(game, REVEAL_SECONDS)],
    components: [revealButton()],
  });
  getPhaseMessages(channel.id).reveal = msg;
  game.timers.suggestionsStart = setTimeout(() => {
    transitionToSuggestions(channel, game).catch((err) =>
      logger.error({ err }, "transitionToSuggestions failed"),
    );
  }, REVEAL_SECONDS * 1000);
}

async function transitionToSuggestions(
  channel: TextChannel,
  game: Game,
): Promise<void> {
  if (game.phase !== "reveal") return;
  game.phase = "suggestions";
  const suggestEnd = Date.now() + SUGGESTION_SECONDS * 1000;
  (game.timers as unknown as { suggestEnd: number }).suggestEnd = suggestEnd;

  // Lock reveal message
  const pm = getPhaseMessages(channel.id);
  if (pm.reveal) {
    try {
      await pm.reveal.edit({
        embeds: [
          infoEmbed(
            "🎴 انتهت مرحلة الكشف",
            "ننتقل لمرحلة الاقتراحات ⬇️",
          ),
        ],
        components: [],
      });
    } catch {
      // ignore
    }
  }

  const msg = await channel.send({
    embeds: [suggestionsPhaseEmbed(game, SUGGESTION_SECONDS)],
    components: [suggestButton()],
  });
  pm.suggestions = msg;

  game.timers.votingStart = setTimeout(() => {
    transitionToVoting(channel, game).catch((err) =>
      logger.error({ err }, "transitionToVoting failed"),
    );
  }, SUGGESTION_SECONDS * 1000);
}

async function transitionToVoting(
  channel: TextChannel,
  game: Game,
): Promise<void> {
  if (game.phase !== "suggestions") return;
  game.phase = "voting";
  const seconds =
    VOTING_BASE_SECONDS + game.players.size * VOTING_PER_PLAYER_SECONDS;
  game.votingDeadline = Date.now() + seconds * 1000;

  // Lock suggestion message
  const pm = getPhaseMessages(channel.id);
  if (pm.suggestions) {
    try {
      await pm.suggestions.edit({
        embeds: [
          infoEmbed(
            "✍️ انتهت مرحلة الاقتراحات",
            "ننتقل لمرحلة التصويت ⬇️",
          ),
        ],
        components: [],
      });
    } catch {
      // ignore
    }
  }

  const msg = await channel.send({
    embeds: [votingPhaseEmbed(game, seconds)],
    components: votingButtons(game),
  });
  pm.voting = msg;

  game.timers.guessingStart = setTimeout(() => {
    transitionToGuessing(channel.client, channel, game).catch((err) =>
      logger.error({ err }, "transitionToGuessing failed"),
    );
  }, seconds * 1000);
}

async function transitionToGuessing(
  _client: Client,
  channel: TextChannel,
  game: Game,
): Promise<void> {
  if (game.phase !== "voting") return;
  game.phase = "guessing";
  game.guessDeadline = Date.now() + GUESSING_SECONDS * 1000;

  // Lock voting message
  const pm = getPhaseMessages(channel.id);
  if (pm.voting) {
    try {
      await pm.voting.edit({
        embeds: [
          infoEmbed("🗳️ انتهت مرحلة التصويت", "ننتقل لمرحلة التخمين ⬇️"),
        ],
        components: [],
      });
    } catch {
      // ignore
    }
  }

  const voteCounts = new Map<string, number>();
  for (const target of game.votes.values()) {
    voteCounts.set(target, (voteCounts.get(target) ?? 0) + 1);
  }
  const voteSummary = Array.from(game.players.values())
    .map((p) => `<@${p.id}> — **${voteCounts.get(p.id) ?? 0}** صوت`)
    .join("\n");

  const msg = await channel.send({
    embeds: [guessingPhaseEmbed(game, voteSummary, GUESSING_SECONDS)],
    components: guessButtons(game.eightOptions ?? []),
  });
  pm.guessing = msg;

  game.timers.endRound = setTimeout(() => {
    endRound(channel, game).catch((err) =>
      logger.error({ err }, "endRound failed"),
    );
  }, GUESSING_SECONDS * 1000);
}

async function endRound(channel: TextChannel, game: Game): Promise<void> {
  if (game.phase !== "guessing") return;
  game.phase = "ended";
  clearTimers(game);

  // Lock guessing message
  const pm = getPhaseMessages(channel.id);
  if (pm.guessing) {
    try {
      await pm.guessing.edit({
        embeds: [
          infoEmbed("🔪 انتهت مرحلة التخمين", "النتائج النهائية ⬇️"),
        ],
        components: [],
      });
    } catch {
      // ignore
    }
  }

  const result = finalizeScores(game);
  await channel.send({ embeds: [endRoundEmbed(game, result)] });

  // Find top scorer to announce points
  let topPts = 0;
  let topId = "";
  for (const [id, delta] of result.scoreDelta) {
    if (delta > topPts) { topPts = delta; topId = id; }
  }
  if (topId && topPts > 0) {
    const botPts = topPts * 10;
    await channel.send(`🎉 <@${topId}> حصل على أعلى نقاط في هذه الجولة: **${botPts} نقطة**!`);
  }

  // Award persistent points (1 game-point = 10 bot-points)
  for (const [userId, delta] of result.scoreDelta) {
    const player = game.players.get(userId);
    if (player && game.guildId) {
      addImposterPoints(game.guildId, userId, player.username, delta);
    }
  }

  deleteGame(channel.id);
  clearPhaseMessages(channel.id);
}

// ────────────────────────────────────────────────────────────────────
// Score commands
// ────────────────────────────────────────────────────────────────────

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

export async function handleMyScoreCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: "هذا الأمر يشتغل بالسيرفرات فقط.", flags: MessageFlags.Ephemeral });
    return;
  }
  const rec = getUserRecord(guildId, interaction.user.id);
  const rank = getUserRank(guildId, interaction.user.id);

  if (!rec || rec.points === 0) {
    await interaction.reply({
      embeds: [{
        color: 0x5865f2,
        description: `<@${interaction.user.id}> ما لديك نقاط بعد. العب لتحصل على نقاط! 🎮`,
      }],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const rankText = rank > 0 ? `المرتبة: **#${rank}**` : "";
  await interaction.reply({
    embeds: [{
      color: 0xfaa61a,
      title: `🏅 نقاط ${interaction.user.username}`,
      description: [
        `**المجموع:** ${rec.points} نقطة  ${rankText}`,
        "",
        `🔤 لعبة الحروف: **${rec.scrambleCorrect}** إجابة صحيحة  •  **${rec.scrambleWins}** فوز`,
        `🕵️ لعبة الإمبوستر: **${rec.imposterPoints}** نقطة`,
        `🔍 لعبة البحث: **${rec.searchWins ?? 0}** فوز`,
        `🎡 لعبة الروليت: **${rec.rouletteWins ?? 0}** فوز`,
      ].join("\n"),
    }],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleLeaderboardCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: "هذا الأمر يشتغل بالسيرفرات فقط.", flags: MessageFlags.Ephemeral });
    return;
  }

  const top = getLeaderboard(guildId);
  if (top.length === 0) {
    await interaction.reply({
      embeds: [{
        color: 0x5865f2,
        description: "ما في نقاط مسجّلة في هذا السيرفر بعد. العب لتبدأ! 🎮",
      }],
    });
    return;
  }

  const rows = top.map((r, i) => {
    const medal = RANK_MEDALS[i] ?? `\`${i + 1}.\``;
    return `${medal} <@${r.userId}> — **${r.points}** نقطة`;
  }).join("\n");

  await interaction.reply({
    embeds: [{
      color: 0xfaa61a,
      title: "🏆 المتصدرون",
      description: rows,
      footer: { text: "مجموع نقاط جميع الألعاب" },
    }],
  });
}
