import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type TextChannel,
  MessageFlags,
} from "discord.js";
import { generateWheelPng } from "./wheelImage";
import { logger } from "../../lib/logger";
import {
  createRouletteGame,
  getRouletteGame,
  deleteRouletteGame,
  clearRouletteTimers,
  getAlivePlayers,
  joinWithNumber,
  joinRandom,
  leaveGame,
  LOBBY_SECONDS,
  CHOOSE_SECONDS,
  MAX_LOBBY_NUMBERS,
  type RouletteGame,
  type RoulettePlayer,
} from "./game";
import {
  rouletteLobbyEmbed,
  rouletteChooserEmbed,
  rouletteReviveListEmbed,
  rouletteRevivedEmbed,
  rouletteNukeEmbed,
  rouletteWinnerEmbed,
  rouletteCancelledEmbed,
  rouletteChoiceExpiredEmbed,
  rouletteFinalRoundEmbed,
  rouletteDk1Embed,
  rouletteDk2Embed,
} from "./embeds";
import { addRouletteWin } from "../scores";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ─── Lobby Number Grid ────────────────────────────────────────────────────────

/**
 * Build 5 ActionRows:
 *   Rows 1-4 → numbered buttons 1-20 (taken = shows player name, disabled)
 *   Row 5    → دخول عشوائي | اخرج من اللعبة | متجر اللعبة (disabled)
 */
function lobbyNumberGrid(game: RouletteGame): ActionRowBuilder<ButtonBuilder>[] {
  // Build a reverse map: number → player
  const numToPlayer = new Map<number, RoulettePlayer>();
  for (const p of game.players.values()) {
    numToPlayer.set(p.number, p);
  }

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  // 4 rows × 5 buttons = 20 numbers
  for (let row = 0; row < 4; row++) {
    const btnRow = new ActionRowBuilder<ButtonBuilder>();
    for (let col = 0; col < 5; col++) {
      const num = row * 5 + col + 1;
      const owner = numToPlayer.get(num);
      const btn = new ButtonBuilder()
        .setCustomId(owner ? `rlt:taken:${num}` : `rlt:num:${num}`)
        .setStyle(owner ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(!!owner);

      if (owner) {
        // Show "9 Alucard" style label (truncate to fit)
        const label = `${num} ${owner.username}`.slice(0, 80);
        btn.setLabel(label);
      } else {
        btn.setLabel(String(num));
      }

      btnRow.addComponents(btn);
    }
    rows.push(btnRow);
  }

  // Action row
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("rlt:random")
      .setLabel("دخول عشوائي")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("rlt:leave")
      .setLabel("اخرج من اللعبة")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("rlt:store")
      .setLabel("⚡ متجر اللعبة")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );
  rows.push(actionRow);

  return rows;
}

// ─── Kick Buttons ─────────────────────────────────────────────────────────────

function kickButtons(
  game: RouletteGame,
  chooserId: string,
  hasNuke: boolean,
  hasDoubleKick: boolean,
): ActionRowBuilder<ButtonBuilder>[] {
  const others = getAlivePlayers(game).filter((p) => p.userId !== chooserId);
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  for (let i = 0; i < others.length; i += 5) {
    const slice = others.slice(i, i + 5);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...slice.map((p) =>
        new ButtonBuilder()
          .setCustomId(`rlt:kick:${p.userId}`)
          .setLabel(`${p.number} ${p.username}`.slice(0, 80))
          .setStyle(ButtonStyle.Danger),
      ),
    );
    rows.push(row);
    if (rows.length >= 4) break;
  }

  const actionRow = new ActionRowBuilder<ButtonBuilder>();

  // Self-withdraw button (chooser eliminates themselves)
  actionRow.addComponents(
    new ButtonBuilder()
      .setCustomId("rlt:self_kick")
      .setLabel("اتسحب")
      .setStyle(ButtonStyle.Danger),
  );

  if (hasDoubleKick) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId("rlt:double_kick")
        .setLabel("طرد مرتين 👥")
        .setStyle(ButtonStyle.Primary),
    );
  }

  if (game.eliminated.length > 0) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId("rlt:revive")
        .setLabel("إنعاش 🌱")
        .setStyle(ButtonStyle.Success),
    );
  }

  if (hasNuke) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId("rlt:nuke")
        .setLabel("💣 قنبلة نووية ☢️")
        .setStyle(ButtonStyle.Secondary),
    );
  }

  rows.push(actionRow);
  return rows;
}

function dkPickButtons(
  game: RouletteGame,
  chooserId: string,
  excludeIds: string[],
  phase: 1 | 2,
): ActionRowBuilder<ButtonBuilder>[] {
  const targets = getAlivePlayers(game).filter(
    (p) => p.userId !== chooserId && !excludeIds.includes(p.userId),
  );
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const customIdPrefix = phase === 1 ? "rlt:dk1:" : "rlt:dk2:";

  for (let i = 0; i < targets.length; i += 5) {
    const slice = targets.slice(i, i + 5);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...slice.map((p) =>
        new ButtonBuilder()
          .setCustomId(`${customIdPrefix}${p.userId}`)
          .setLabel(`${p.number} ${p.username}`.slice(0, 80))
          .setStyle(ButtonStyle.Primary),
      ),
    );
    rows.push(row);
    if (rows.length >= 5) break;
  }
  return rows;
}

function reviveButtons(
  game: RouletteGame,
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < game.eliminated.length; i += 5) {
    const slice = game.eliminated.slice(i, i + 5);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...slice.map((p) =>
        new ButtonBuilder()
          .setCustomId(`rlt:revive_pick:${p.userId}`)
          .setLabel(`${p.number} ${p.username}`.slice(0, 80))
          .setStyle(ButtonStyle.Success),
      ),
    );
    rows.push(row);
    if (rows.length >= 5) break;
  }
  return rows;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initRouletteGame(
  channel: TextChannel,
  guildId: string,
  userId: string,
  username: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (getRouletteGame(channel.id)) {
    return { ok: false, reason: "في لعبة روليت شغّالة بالفعل في هذه القناة." };
  }

  const game = createRouletteGame(channel.id, guildId, userId, username);
  const rows = lobbyNumberGrid(game);
  const msg = await channel.send({
    embeds: [rouletteLobbyEmbed(game, LOBBY_SECONDS)],
    components: rows.map((r) => r.toJSON()),
  });
  game.lobbyMessage = msg;

  let secondsLeft = LOBBY_SECONDS;
  const tick = setInterval(async () => {
    secondsLeft -= 15;
    const g = getRouletteGame(channel.id);
    if (!g || g.phase !== "lobby") { clearInterval(tick); return; }
    if (secondsLeft <= 0) { clearInterval(tick); await launchRouletteGame(channel); return; }
    try {
      const updatedRows = lobbyNumberGrid(g);
      await msg.edit({
        embeds: [rouletteLobbyEmbed(g, secondsLeft)],
        components: updatedRows.map((r) => r.toJSON()),
      });
    } catch { /* ignore */ }
  }, 15_000);
  game.timers.push(tick as unknown as NodeJS.Timeout);

  const autoStart = setTimeout(async () => {
    clearInterval(tick);
    await launchRouletteGame(channel);
  }, LOBBY_SECONDS * 1_000);
  game.timers.push(autoStart);

  return { ok: true };
}

export async function handleRouletteCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId || !interaction.channel?.isTextBased()) {
    await interaction.reply({ content: "هذا الأمر يشتغل فقط في قنوات السيرفر.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const displayName = (interaction.member as { displayName?: string } | null)?.displayName ?? interaction.user.username;
  const result = await initRouletteGame(
    interaction.channel as TextChannel,
    interaction.guildId,
    interaction.user.id,
    displayName,
  );
  if (!result.ok) {
    await interaction.editReply({ content: `❌ ${result.reason}` });
  } else {
    await interaction.deleteReply().catch(() => null);
  }
}

// ─── Launch ───────────────────────────────────────────────────────────────────

async function launchRouletteGame(channel: TextChannel): Promise<void> {
  const game = getRouletteGame(channel.id);
  if (!game || game.phase !== "lobby") return;

  if (game.players.size < 4) {
    try {
      await game.lobbyMessage?.edit({
        embeds: [{ color: 0xed4245, description: "❌ يلزم ٤ لاعبين على الأقل لبدء الروليت." }],
        components: [],
      });
    } catch { /* ignore */ }
    deleteRouletteGame(channel.id);
    return;
  }

  clearRouletteTimers(game);
  game.phase = "spinning";

  try {
    await game.lobbyMessage?.edit({
      embeds: [{ color: 0xf1c40f, description: "🎡 انطلقت الروليت! استعدوا..." }],
      components: [],
    });
  } catch { /* ignore */ }

  await sleep(2_000);
  await runRound(channel, game);
}

// ─── Round Logic ──────────────────────────────────────────────────────────────

async function runRound(channel: TextChannel, game: RouletteGame): Promise<void> {
  const g = getRouletteGame(channel.id);
  if (!g || (g.phase !== "spinning" && g.phase !== "choosing")) return;

  const alive = getAlivePlayers(g);

  if (alive.length <= 1) {
    await endGame(channel, alive[0] ?? null);
    return;
  }

  if (alive.length === 2) {
    await channel.send({ embeds: [rouletteFinalRoundEmbed(alive[0]!, alive[1]!)] });
    await sleep(3_000);
  }

  g.phase = "spinning";
  g.roundNumber++;
  g.hasNuke = Math.random() < 0.01;
  g.hasDoubleKick = Math.random() < 0.20;
  g.doubleKickVictim1 = undefined;

  const currentAlive = getAlivePlayers(g);
  if (currentAlive.length <= 1) {
    await endGame(channel, currentAlive[0] ?? null);
    return;
  }

  const chooser = pickRandom(currentAlive);
  g.currentChooser = chooser.userId;
  g.phase = "choosing";

  const others = currentAlive.filter((p) => p.userId !== chooser.userId);
  if (others.length === 0) {
    await endGame(channel, chooser);
    return;
  }

  const rows = kickButtons(g, chooser.userId, g.hasNuke, g.hasDoubleKick);

  const chooserIdxInAlive = currentAlive.findIndex((p) => p.userId === chooser.userId);
  const wheelPng = await generateWheelPng(
    currentAlive.map((p) => ({ name: p.username, number: p.number })),
    chooserIdxInAlive >= 0 ? chooserIdxInAlive : 0,
  ).catch(() => null);

  const wheelFile = wheelPng ? new AttachmentBuilder(wheelPng, { name: "wheel.png" }) : null;

  const choosingMsg = await channel.send({
    content: `<@${chooser.userId}>`,
    embeds: [rouletteChooserEmbed(g, chooser, g.hasNuke, g.hasDoubleKick)],
    components: rows.map((r) => r.toJSON()),
    ...(wheelFile ? { files: [wheelFile] } : {}),
  });
  g.choosingMessage = choosingMsg;

  const autoKick = setTimeout(async () => {
    const current = getRouletteGame(channel.id);
    if (!current || current.phase !== "choosing" || current.currentChooser !== chooser.userId) return;
    if (!current.choosingMessage) return;

    try {
      await current.choosingMessage.edit({ embeds: [rouletteChoiceExpiredEmbed()], components: [] });
    } catch { /* ignore */ }

    await performKick(channel, current, chooser, chooser, true);
  }, CHOOSE_SECONDS * 1_000);

  game.timers.push(autoKick);
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function performKick(
  channel: TextChannel,
  game: RouletteGame,
  chooser: RoulettePlayer,
  victim: RoulettePlayer,
  isAuto: boolean,
): Promise<void> {
  clearRouletteTimers(game);
  game.phase = "spinning";
  game.currentChooser = undefined;

  victim.alive = false;
  game.eliminated.push(victim);

  if (isAuto) {
    await channel.send(`تم طرد <@${victim.userId}> من اللعبة، سيتم بدء الجولة القادمة في بضع ثواني |`);
  } else {
    await channel.send(`تم طرد <@${victim.userId}> من اللعبة، سيتم بدء الجولة القادمة في بضع ثواني |`);
  }

  const remaining = getAlivePlayers(game);
  if (remaining.length <= 1) {
    await sleep(2_000);
    await endGame(channel, remaining[0] ?? null);
    return;
  }

  await sleep(3_000);
  await runRound(channel, game);
}

async function performDoubleKick(
  channel: TextChannel,
  game: RouletteGame,
  chooser: RoulettePlayer,
  victim1: RoulettePlayer,
  victim2: RoulettePlayer,
): Promise<void> {
  clearRouletteTimers(game);
  game.phase = "spinning";
  game.currentChooser = undefined;
  game.doubleKickVictim1 = undefined;
  game.hasDoubleKick = false;

  victim1.alive = false;
  game.eliminated.push(victim1);
  victim2.alive = false;
  game.eliminated.push(victim2);

  await channel.send(
    `💥 طرد مزدوج! تم طرد <@${victim1.userId}> و <@${victim2.userId}> دفعة واحدة 👥`,
  );

  const remaining = getAlivePlayers(game);
  if (remaining.length <= 1) {
    await sleep(2_000);
    await endGame(channel, remaining[0] ?? null);
    return;
  }

  await sleep(3_000);
  await runRound(channel, game);
}

async function performRevive(
  channel: TextChannel,
  game: RouletteGame,
  chooser: RoulettePlayer,
  revived: RoulettePlayer,
): Promise<void> {
  clearRouletteTimers(game);
  game.phase = "spinning";
  game.currentChooser = undefined;

  game.eliminated = game.eliminated.filter((p) => p.userId !== revived.userId);
  revived.alive = true;

  await channel.send({ embeds: [rouletteRevivedEmbed(revived, chooser)] });

  await sleep(3_000);
  await runRound(channel, game);
}

async function performNuke(
  channel: TextChannel,
  game: RouletteGame,
  chooser: RoulettePlayer,
): Promise<void> {
  clearRouletteTimers(game);
  game.phase = "spinning";
  game.currentChooser = undefined;

  const others = getAlivePlayers(game).filter((p) => p.userId !== chooser.userId);
  const shuffled = shuffleArray(others);
  const killCount = Math.ceil(shuffled.length * 0.6);
  const killed = shuffled.slice(0, killCount);

  for (const p of killed) {
    p.alive = false;
    game.eliminated.push(p);
  }

  const surviving = getAlivePlayers(game);
  await channel.send({ embeds: [rouletteNukeEmbed(chooser, killed, surviving)] });

  if (surviving.length <= 1) {
    await sleep(2_000);
    await endGame(channel, surviving[0] ?? null);
    return;
  }

  await sleep(4_000);
  await runRound(channel, game);
}

// ─── End Game ─────────────────────────────────────────────────────────────────

async function endGame(channel: TextChannel, winner: RoulettePlayer | null): Promise<void> {
  const game = getRouletteGame(channel.id);
  if (!game) return;

  game.phase = "ended";
  clearRouletteTimers(game);

  if (game.choosingMessage) {
    try {
      await game.choosingMessage.edit({ components: [] });
    } catch { /* ignore */ }
  }

  const totalPlayers = game.players.size;
  deleteRouletteGame(channel.id);

  if (!winner) {
    await channel.send({ embeds: [{ color: 0xed4245, description: "🤝 انتهت اللعبة بدون فائز." }] });
    return;
  }

  const pts = 10 + totalPlayers * 2;
  await channel.send({ embeds: [rouletteWinnerEmbed(winner, game.roundNumber, pts)] });
  addRouletteWin(game.guildId, winner.userId, winner.username, pts);

  logger.info(
    { channelId: channel.id, winner: winner.username, rounds: game.roundNumber, pts },
    "roulette game ended",
  );
}

// ─── Cancel Command ───────────────────────────────────────────────────────────

export async function handleRouletteCancelCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId || !interaction.channel?.isTextBased()) {
    await interaction.reply({ content: "هذا الأمر يشتغل فقط في قنوات السيرفر.", flags: MessageFlags.Ephemeral });
    return;
  }
  const game = getRouletteGame(interaction.channelId);
  if (!game) {
    await interaction.reply({ content: "❌ ما في لعبة روليت في هذه القناة.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (game.hostId !== interaction.user.id) {
    await interaction.reply({ content: "❌ فقط المضيف يقدر يلغي اللعبة.", flags: MessageFlags.Ephemeral });
    return;
  }
  clearRouletteTimers(game);
  deleteRouletteGame(interaction.channelId);
  await interaction.reply({ embeds: [rouletteCancelledEmbed()] });
}

// ─── Button Handler ───────────────────────────────────────────────────────────

export async function handleRouletteButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  const game = getRouletteGame(interaction.channelId);

  // ── Pick a specific number ──────────────────────────────────────────────────
  if (customId.startsWith("rlt:num:")) {
    if (!game || game.phase !== "lobby") {
      await interaction.reply({ content: "❌ ما في لعبة روليت في طور الانتظار.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.players.has(interaction.user.id)) {
      await interaction.reply({ content: "✅ أنت مسجّل بالفعل! اضغط «اخرج من اللعبة» إذا أردت تغيير رقمك.", flags: MessageFlags.Ephemeral });
      return;
    }
    const num = parseInt(customId.replace("rlt:num:", ""), 10);
    const displayName = (interaction.member as { displayName?: string } | null)?.displayName ?? interaction.user.username;
    const ok = joinWithNumber(game, interaction.user.id, displayName, num);
    if (!ok) {
      await interaction.reply({ content: "❌ هذا الرقم محجوز، اختر رقماً آخر.", flags: MessageFlags.Ephemeral });
      return;
    }
    const secLeft = Math.max(0, LOBBY_SECONDS - Math.floor(
      (Date.now() - (game.lobbyMessage?.createdTimestamp ?? Date.now())) / 1000,
    ));
    const updatedRows = lobbyNumberGrid(game);
    try {
      await game.lobbyMessage?.edit({
        embeds: [rouletteLobbyEmbed(game, secLeft)],
        components: updatedRows.map((r) => r.toJSON()),
      });
    } catch { /* ignore */ }
    await interaction.reply({ content: `✅ انضممت بالرقم **${num}**! 🎡`, flags: MessageFlags.Ephemeral });
    return;
  }

  // ── Random join ─────────────────────────────────────────────────────────────
  if (customId === "rlt:random") {
    if (!game || game.phase !== "lobby") {
      await interaction.reply({ content: "❌ ما في لعبة روليت في طور الانتظار.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.players.has(interaction.user.id)) {
      await interaction.reply({ content: "✅ أنت مسجّل بالفعل!", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.numberPool.size === 0) {
      await interaction.reply({ content: "❌ جميع الأرقام محجوزة.", flags: MessageFlags.Ephemeral });
      return;
    }
    const displayName = (interaction.member as { displayName?: string } | null)?.displayName ?? interaction.user.username;
    const num = joinRandom(game, interaction.user.id, displayName);
    if (!num) {
      await interaction.reply({ content: "❌ ما في أرقام متاحة.", flags: MessageFlags.Ephemeral });
      return;
    }
    const secLeft = Math.max(0, LOBBY_SECONDS - Math.floor(
      (Date.now() - (game.lobbyMessage?.createdTimestamp ?? Date.now())) / 1000,
    ));
    const updatedRows = lobbyNumberGrid(game);
    try {
      await game.lobbyMessage?.edit({
        embeds: [rouletteLobbyEmbed(game, secLeft)],
        components: updatedRows.map((r) => r.toJSON()),
      });
    } catch { /* ignore */ }
    await interaction.reply({ content: `✅ انضممت بالرقم **${num}** عشوائياً! 🎡`, flags: MessageFlags.Ephemeral });
    return;
  }

  // ── Leave lobby ─────────────────────────────────────────────────────────────
  if (customId === "rlt:leave") {
    if (!game || game.phase !== "lobby") {
      await interaction.reply({ content: "❌ ما في لعبة في طور الانتظار.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.hostId === interaction.user.id) {
      await interaction.reply({ content: "❌ المضيف لا يستطيع الخروج. استخدم `$الغاء_روليت` لإلغاء اللعبة.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!game.players.has(interaction.user.id)) {
      await interaction.reply({ content: "❌ أنت لست في اللعبة.", flags: MessageFlags.Ephemeral });
      return;
    }
    leaveGame(game, interaction.user.id);
    const secLeft = Math.max(0, LOBBY_SECONDS - Math.floor(
      (Date.now() - (game.lobbyMessage?.createdTimestamp ?? Date.now())) / 1000,
    ));
    const updatedRows = lobbyNumberGrid(game);
    try {
      await game.lobbyMessage?.edit({
        embeds: [rouletteLobbyEmbed(game, secLeft)],
        components: updatedRows.map((r) => r.toJSON()),
      });
    } catch { /* ignore */ }
    await interaction.reply({ content: "✅ خرجت من اللعبة.", flags: MessageFlags.Ephemeral });
    return;
  }

  // ── Cancel (host) ─────────────────────────────────────────────────────────
  if (customId === "rlt:cancel") {
    if (!game || game.phase !== "lobby") {
      await interaction.reply({ content: "❌ ما في لعبة للإلغاء.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.hostId !== interaction.user.id) {
      await interaction.reply({ content: "❌ فقط المضيف يقدر يلغي.", flags: MessageFlags.Ephemeral });
      return;
    }
    clearRouletteTimers(game);
    deleteRouletteGame(interaction.channelId);
    await interaction.update({ embeds: [rouletteCancelledEmbed()], components: [] });
    return;
  }

  // ── Self-kick (withdraw) ──────────────────────────────────────────────────
  if (customId === "rlt:self_kick") {
    if (!game || game.phase !== "choosing") {
      await interaction.reply({ content: "❌ لم يحن وقت الاختيار.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.currentChooser !== interaction.user.id) {
      await interaction.reply({ content: "❌ هذا ليس دورك!", flags: MessageFlags.Ephemeral });
      return;
    }
    const chooser = game.players.get(interaction.user.id)!;
    await interaction.deferUpdate();
    try {
      await game.choosingMessage?.edit({ components: [] });
    } catch { /* ignore */ }
    await performKick(interaction.channel as TextChannel, game, chooser, chooser, false);
    return;
  }

  // ── Activate double kick (phase 1) ───────────────────────────────────────
  if (customId === "rlt:double_kick") {
    if (!game || game.phase !== "choosing") {
      await interaction.reply({ content: "❌ لم يحن وقت الاختيار.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.currentChooser !== interaction.user.id) {
      await interaction.reply({ content: "❌ هذا ليس دورك!", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!game.hasDoubleKick) {
      await interaction.reply({ content: "❌ لا تملك خاصية الطرد المزدوج.", flags: MessageFlags.Ephemeral });
      return;
    }
    const chooser = game.players.get(interaction.user.id)!;
    const rows = dkPickButtons(game, chooser.userId, [], 1);
    if (rows.length === 0) {
      await interaction.reply({ content: "❌ لا يوجد لاعبون كافون للطرد المزدوج.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.update({
      embeds: [rouletteDk1Embed(chooser)],
      components: rows.map((r) => r.toJSON()),
    });
    return;
  }

  // ── Double kick phase 1: pick first victim ────────────────────────────────
  if (customId.startsWith("rlt:dk1:")) {
    if (!game || game.phase !== "choosing") {
      await interaction.reply({ content: "❌ لم يحن وقت الاختيار.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.currentChooser !== interaction.user.id) {
      await interaction.reply({ content: "❌ هذا ليس دورك!", flags: MessageFlags.Ephemeral });
      return;
    }
    const victim1Id = customId.replace("rlt:dk1:", "");
    const victim1 = game.players.get(victim1Id);
    if (!victim1 || !victim1.alive) {
      await interaction.reply({ content: "❌ هذا اللاعب غير متاح.", flags: MessageFlags.Ephemeral });
      return;
    }
    game.doubleKickVictim1 = victim1Id;
    const chooser = game.players.get(interaction.user.id)!;
    const rows = dkPickButtons(game, chooser.userId, [victim1Id], 2);
    if (rows.length === 0) {
      // Only one other player — just do single kick
      await interaction.deferUpdate();
      try { await game.choosingMessage?.edit({ components: [] }); } catch { /* ignore */ }
      await performKick(interaction.channel as TextChannel, game, chooser, victim1, false);
      return;
    }
    await interaction.update({
      embeds: [rouletteDk2Embed(chooser, victim1)],
      components: rows.map((r) => r.toJSON()),
    });
    return;
  }

  // ── Double kick phase 2: pick second victim ───────────────────────────────
  if (customId.startsWith("rlt:dk2:")) {
    if (!game || game.phase !== "choosing") {
      await interaction.reply({ content: "❌ لم يحن وقت الاختيار.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.currentChooser !== interaction.user.id) {
      await interaction.reply({ content: "❌ هذا ليس دورك!", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!game.doubleKickVictim1) {
      await interaction.reply({ content: "❌ خطأ في الطرد المزدوج، حاول مرة أخرى.", flags: MessageFlags.Ephemeral });
      return;
    }
    const victim1 = game.players.get(game.doubleKickVictim1);
    const victim2Id = customId.replace("rlt:dk2:", "");
    const victim2 = game.players.get(victim2Id);
    const chooser = game.players.get(interaction.user.id)!;
    if (!victim1 || !victim1.alive || !victim2 || !victim2.alive) {
      await interaction.reply({ content: "❌ أحد اللاعبين غير متاح.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferUpdate();
    try { await game.choosingMessage?.edit({ components: [] }); } catch { /* ignore */ }
    await performDoubleKick(interaction.channel as TextChannel, game, chooser, victim1, victim2);
    return;
  }

  // ── Kick a player ─────────────────────────────────────────────────────────
  if (customId.startsWith("rlt:kick:")) {
    if (!game || game.phase !== "choosing") {
      await interaction.reply({ content: "❌ لم يحن وقت الاختيار.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.currentChooser !== interaction.user.id) {
      await interaction.reply({ content: "❌ هذا ليس دورك!", flags: MessageFlags.Ephemeral });
      return;
    }
    const targetId = customId.replace("rlt:kick:", "");
    const target = game.players.get(targetId);
    if (!target || !target.alive) {
      await interaction.reply({ content: "❌ هذا اللاعب غير موجود أو مطرود بالفعل.", flags: MessageFlags.Ephemeral });
      return;
    }
    const chooser = game.players.get(interaction.user.id)!;
    await interaction.deferUpdate();
    try {
      await game.choosingMessage?.edit({ components: [] });
    } catch { /* ignore */ }
    await performKick(interaction.channel as TextChannel, game, chooser, target, false);
    return;
  }

  // ── Revive list ───────────────────────────────────────────────────────────
  if (customId === "rlt:revive") {
    if (!game || game.phase !== "choosing") {
      await interaction.reply({ content: "❌ لم يحن وقت الاختيار.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.currentChooser !== interaction.user.id) {
      await interaction.reply({ content: "❌ هذا ليس دورك!", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.eliminated.length === 0) {
      await interaction.reply({ content: "❌ لا يوجد مطرودون للإنعاش.", flags: MessageFlags.Ephemeral });
      return;
    }
    const chooser = game.players.get(interaction.user.id)!;
    const rows = reviveButtons(game);
    await interaction.update({
      embeds: [rouletteReviveListEmbed(game, chooser)],
      components: rows.map((r) => r.toJSON()),
    });
    return;
  }

  // ── Pick revive target ────────────────────────────────────────────────────
  if (customId.startsWith("rlt:revive_pick:")) {
    if (!game || game.phase !== "choosing") {
      await interaction.reply({ content: "❌ لم يحن وقت الاختيار.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.currentChooser !== interaction.user.id) {
      await interaction.reply({ content: "❌ هذا ليس دورك!", flags: MessageFlags.Ephemeral });
      return;
    }
    const targetId = customId.replace("rlt:revive_pick:", "");
    const target = game.eliminated.find((p) => p.userId === targetId);
    if (!target) {
      await interaction.reply({ content: "❌ هذا اللاعب ليس في قائمة المطرودين.", flags: MessageFlags.Ephemeral });
      return;
    }
    const chooser = game.players.get(interaction.user.id)!;
    await interaction.deferUpdate();
    try {
      await game.choosingMessage?.edit({ components: [] });
    } catch { /* ignore */ }
    await performRevive(interaction.channel as TextChannel, game, chooser, target);
    return;
  }

  // ── Nuke ─────────────────────────────────────────────────────────────────
  if (customId === "rlt:nuke") {
    if (!game || game.phase !== "choosing") {
      await interaction.reply({ content: "❌ لم يحن وقت الاختيار.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.currentChooser !== interaction.user.id) {
      await interaction.reply({ content: "❌ هذا ليس دورك!", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!game.hasNuke) {
      await interaction.reply({ content: "❌ لا تملك قنبلة نووية.", flags: MessageFlags.Ephemeral });
      return;
    }
    const chooser = game.players.get(interaction.user.id)!;
    await interaction.deferUpdate();
    try {
      await game.choosingMessage?.edit({ components: [] });
    } catch { /* ignore */ }
    await performNuke(interaction.channel as TextChannel, game, chooser);
    return;
  }

  // ── Store (disabled placeholder) ──────────────────────────────────────────
  if (customId === "rlt:store") {
    await interaction.reply({ content: "🏪 متجر اللعبة قادم قريباً!", flags: MessageFlags.Ephemeral });
    return;
  }

  // ── Taken number (disabled but might slip through) ────────────────────────
  if (customId.startsWith("rlt:taken:")) {
    await interaction.reply({ content: "❌ هذا الرقم محجوز.", flags: MessageFlags.Ephemeral });
    return;
  }

  // ── Max lobby numbers constant used to avoid lint warning ─────────────────
  void MAX_LOBBY_NUMBERS;
}
