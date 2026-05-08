import { EmbedBuilder } from "discord.js";
import type { RouletteGame, RoulettePlayer } from "./game";
import { getAlivePlayers, CHOOSE_SECONDS } from "./game";

const COLOR_GOLD = 0xf1c40f;
const COLOR_RED = 0xed4245;
const COLOR_GREEN = 0x57f287;
const COLOR_PURPLE = 0x9b59b6;
const COLOR_ORANGE = 0xe67e22;
const COLOR_BLUE = 0x3498db;
const COLOR_NUKE = 0xff4500;

// ─── Lobby ────────────────────────────────────────────────────────────────────

export function rouletteLobbyEmbed(game: RouletteGame, secondsLeft: number): EmbedBuilder {
  const alive = getAlivePlayers(game);

  const playerLines = alive.length > 0
    ? alive.map((p) => `**${p.number}** : <@${p.userId}>`).join("\n")
    : "*لا أحد بعد*";

  return new EmbedBuilder()
    .setColor(COLOR_GOLD)
    .setTitle("روليت")
    .setDescription(
      [
        "**طريقة اللعب:**",
        "١- اختر الرقم الذي سيمثّلك في اللعبة",
        "٢- ستبدأ الجولة الأولى وسيتم تدوير العجلة واختيار لاعب عشوائي",
        "٣- إذا كنت اللاعب المختار، فستختار لاعباً من اختيارك ليتم طرده من اللعبة",
        "٤- يُطرد اللاعب وتبدأ جولة جديدة، عندما يُطرد جميع اللاعبين ويبقى لاعبان فقط، ستدور العجلة ويكون اللاعب المختار هو الفائز باللعبة",
        "",
        `**أرقام اللاعبين:**`,
        playerLines,
      ].join("\n"),
    )
    .setFooter({ text: `سيبدأ اللعبة بعد ${secondsLeft} ثانية • الحد الأدنى ٤ لاعبين` });
}

// ─── Spinning Wheel ────────────────────────────────────────────────────────────

export function rouletteWheelSpinEmbed(game: RouletteGame): EmbedBuilder {
  const alive = getAlivePlayers(game);
  return new EmbedBuilder()
    .setColor(COLOR_PURPLE)
    .setTitle("🎡 الروليت تدور...")
    .setDescription(
      [
        "## 🌀🌀🌀 جارٍ اختيار اللاعب... 🌀🌀🌀",
        "",
        "**اللاعبون:**",
        alive.map((p) => `**${p.number}** ${p.username}`).join("  •  "),
      ].join("\n"),
    )
    .setFooter({ text: `جولة ${game.roundNumber + 1} • ${alive.length} لاعبين متبقّون` });
}

// ─── Chooser Selected ─────────────────────────────────────────────────────────

export function rouletteChooserEmbed(
  game: RouletteGame,
  chooser: RoulettePlayer,
  hasNuke: boolean,
  hasDoubleKick = false,
): EmbedBuilder {
  const extras: string[] = [];
  if (game.eliminated.length > 0) extras.push("🌱 تقدر تنعش مطرود بدل الطرد");
  if (hasDoubleKick) extras.push("👥 لديك خاصية الطرد المزدوج!");
  if (hasNuke) extras.push("☢️ لديك قنبلة نووية!");

  const lines = [
    `<@${chooser.userId}> لديك **${CHOOSE_SECONDS}** ثانية لاختيار لاعب لطرده`,
  ];
  if (extras.length > 0) lines.push("", extras.join("   •   "));

  return new EmbedBuilder()
    .setColor(COLOR_ORANGE)
    .setDescription(lines.join("\n"))
    .setImage("attachment://wheel.png")
    .setFooter({
      text: `جولة ${game.roundNumber} • إذا ما اخترت تنطرد أنت`,
    });
}

export function rouletteDk1Embed(chooser: RoulettePlayer): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_BLUE)
    .setTitle("👥 طرد مزدوج — الأول")
    .setDescription(`<@${chooser.userId}> اختر اللاعب **الأول** الذي تريد طرده:`);
}

export function rouletteDk2Embed(chooser: RoulettePlayer, victim1: RoulettePlayer): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_BLUE)
    .setTitle("👥 طرد مزدوج — الثاني")
    .setDescription(
      [
        `✅ تم اختيار **${victim1.number} ${victim1.username}** كأول طرد`,
        "",
        `<@${chooser.userId}> اختر اللاعب **الثاني** الذي تريد طرده:`,
      ].join("\n"),
    );
}

// ─── Revive List ──────────────────────────────────────────────────────────────

export function rouletteReviveListEmbed(
  game: RouletteGame,
  chooser: RoulettePlayer,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_GREEN)
    .setTitle("🌱 قائمة الإنعاش")
    .setDescription(
      [
        `<@${chooser.userId}> اختر من تريد إنعاشه:`,
        "",
        "**المطرودون:**",
        game.eliminated.map((p) => `💀 **${p.number}** ${p.username}`).join("\n"),
      ].join("\n"),
    )
    .setFooter({ text: "اختر لاعباً لإعادته للعبة" });
}

// ─── Kicked ───────────────────────────────────────────────────────────────────

export function rouletteKickedEmbed(
  game: RouletteGame,
  kicked: RoulettePlayer,
  byPlayer: RoulettePlayer,
): EmbedBuilder {
  const remaining = getAlivePlayers(game);
  return new EmbedBuilder()
    .setColor(COLOR_RED)
    .setTitle("💥 تم الطرد!")
    .setDescription(
      [
        `> ☠️ **${kicked.username}** تم طرده بواسطة **${byPlayer.username}**!`,
        "",
        `👥 تبقّى **${remaining.length}** لاعب${remaining.length === 1 ? "" : "ين"}`,
        "",
        remaining.length > 0
          ? "**المتبقّون:**\n" + remaining.map((p) => `🟢 **${p.number}** ${p.username}`).join("\n")
          : "",
      ].join("\n"),
    )
    .setFooter({ text: `جولة ${game.roundNumber}` });
}

// ─── Revived ──────────────────────────────────────────────────────────────────

export function rouletteRevivedEmbed(
  revived: RoulettePlayer,
  byPlayer: RoulettePlayer,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_GREEN)
    .setTitle("🌱 تم الإنعاش!")
    .setDescription(
      [
        `> ✨ **${revived.username}** تم إنعاشه بواسطة **${byPlayer.username}**!`,
        "",
        "🎉 عاد للعبة مرة أخرى!",
      ].join("\n"),
    );
}

// ─── Nuclear Bomb ─────────────────────────────────────────────────────────────

export function rouletteNukeEmbed(
  byPlayer: RoulettePlayer,
  killed: RoulettePlayer[],
  surviving: RoulettePlayer[],
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_NUKE)
    .setTitle("☢️ انفجرت القنبلة النووية!")
    .setDescription(
      [
        `# 💣 ${byPlayer.username} فجّر القنبلة النووية!`,
        "",
        "**الضحايا (60%):**",
        killed.map((p) => `☠️ **${p.number}** ${p.username}`).join("\n") || "—",
        "",
        "**الناجون:**",
        surviving.map((p) => `🟢 **${p.number}** ${p.username}`).join("\n") || "—",
      ].join("\n"),
    )
    .setFooter({ text: "دمار شامل! 🔥" });
}

// ─── Auto Kick ────────────────────────────────────────────────────────────────

export function rouletteAutoKickEmbed(
  kicked: RoulettePlayer,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_RED)
    .setDescription(
      `⏰ انتهى الوقت! تم طرد **${kicked.username}** تلقائياً.`,
    );
}

// ─── Winner ───────────────────────────────────────────────────────────────────

export function rouletteWinnerEmbed(winner: RoulettePlayer, rounds: number, pts: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_GREEN)
    .setTitle("🎉 فاز في الروليت!")
    .setDescription(
      [
        `# 🏆 ${winner.username}`,
        "",
        "**مبروك! نجح في الصمود وطرد الجميع!**",
        "",
        `📊 عدد الجولات: **${rounds}**`,
        "",
        `🎊 الفائز حصل على **${pts} نقطة**!`,
      ].join("\n"),
    );
}

// ─── Cancelled ────────────────────────────────────────────────────────────────

export function rouletteCancelledEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_RED)
    .setDescription("❌ **ألغيت لعبة الروليت.**");
}

// ─── Timeout Expired ─────────────────────────────────────────────────────────

export function rouletteChoiceExpiredEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_RED)
    .setDescription("⏰ انتهى وقت الاختيار.")
    .setTitle("⏰ انتهى الوقت");
}

// ─── Final Round ─────────────────────────────────────────────────────────────

export function rouletteFinalRoundEmbed(playerA: RoulettePlayer, playerB: RoulettePlayer): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR_GOLD)
    .setTitle("🏆 الجولة النهائية!")
    .setDescription(
      [
        "وصلنا للنهاية! شخصان تبقّيا...",
        "",
        `⚔️  **${playerA.number}** ${playerA.username}  vs  **${playerB.number}** ${playerB.username}`,
        "",
        "🎡 الروليت ستختار أحدهم ليطرد الآخر ويفوز!",
      ].join("\n"),
    );
}

// ─── Unused colours kept for potential future use ──────────────────────────────
void COLOR_BLUE;
void COLOR_PURPLE;
