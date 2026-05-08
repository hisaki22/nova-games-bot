import { EmbedBuilder, type APIEmbed } from "discord.js";
import type { ScrambleGame } from "./game";

const COLOR_BLUE = 0x5865f2;
const COLOR_RED = 0xed4245;
const COLOR_YELLOW = 0xfee75c;
const COLOR_GOLD = 0xfaa61a;
const COLOR_GREY = 0x36393f;

export function scrambleLobbyEmbed(
  game: ScrambleGame,
  secondsLeft: number,
): APIEmbed {
  const playerList = [...game.players.values()]
    .map((p, i) => `\`${i + 1}.\` <@${p.id}>`)
    .join("\n");

  return new EmbedBuilder()
    .setColor(COLOR_BLUE)
    .setTitle("🔤 لعبة الحروف — لوبي الانضمام")
    .setDescription(
      [
        "> كل لاعب بدوره يستلم **٥ حروف عربية مخربطة** ويكتب الكلمة الصحيحة في الشات.",
        "> الغلط أو المتأخر = **ينطرد** ❌ — في كل جولة الوقت يقل!",
        "",
        `**المضيف:** <@${game.hostId}>  •  **اللاعبون:** ${game.players.size} / 12`,
        `⏱️ تبدأ تلقائياً بعد **${secondsLeft} ثانية** (الحد الأدنى ٤ لاعبين)`,
      ].join("\n"),
    )
    .addFields({ name: "👥 المنضمّون", value: playerList || "لا أحد بعد." })
    .setFooter({ text: "اضغط انضم للمشاركة" })
    .toJSON();
}

export function scrambleTurnEmbed(
  scrambled: string,
  secondsLeft: number,
  roundNumber: number,
): APIEmbed {
  return new EmbedBuilder()
    .setColor(COLOR_YELLOW)
    .setDescription(
      [
        `**${[...scrambled].join(" ・ ")}**`,
        `رتّب هذه الحروف لتكوّن كلمة صحيحة — ⏱️ **${secondsLeft}ث** • جولة ${roundNumber}`,
      ].join("\n"),
    )
    .toJSON();
}

export function scrambleWrongEmbed(
  playerId: string,
  correctWord: string,
  reason: "wrong" | "timeout",
): APIEmbed {
  const reasonText =
    reason === "timeout" ? "انتهى الوقت!" : "إجابة خاطئة!";

  return new EmbedBuilder()
    .setColor(COLOR_RED)
    .setDescription(
      `❌ <@${playerId}> ${reasonText}  الكلمة الصحيحة: **${correctWord}**`,
    )
    .toJSON();
}

export function roundSummaryEmbed(
  game: ScrambleGame,
  eliminated: string[],
): APIEmbed {
  const survivors = game.playerOrder.map((id) => `<@${id}>`).join("  ");
  const eliminatedText =
    eliminated.length > 0
      ? eliminated.map((id) => `<@${id}>`).join("  ")
      : "لا أحد 🎉";

  return new EmbedBuilder()
    .setColor(COLOR_GREY)
    .setTitle(`📊 نهاية الجولة ${game.roundNumber - 1}`)
    .addFields(
      { name: "❌ المنطردون", value: eliminatedText, inline: true },
      { name: "✅ المتبقون", value: survivors || "—", inline: true },
    )
    .setFooter({
      text:
        game.roundNumber <= 1
          ? `الجولة ${game.roundNumber} • ${game.playerOrder.length > 0 ? "الوقت يقل!" : ""}`
          : `الجولة ${game.roundNumber} قادمة — الوقت أقل!`,
    })
    .toJSON();
}

export function scrambleWinnerEmbed(
  game: ScrambleGame,
  winnerId: string,
  pts: number,
): APIEmbed {
  return new EmbedBuilder()
    .setColor(COLOR_GOLD)
    .setTitle("🏆 انتهت اللعبة!")
    .setDescription(
      [
        `## 🥇 الفائز: <@${winnerId}>`,
        `عدد الجولات: **${game.roundNumber}**`,
        "",
        `🎉 حصل الفائز على **${pts} نقطة**!`,
      ].join("\n"),
    )
    .setFooter({ text: "اكتب $حروف لجولة جديدة!" })
    .toJSON();
}

export function scrambleDrawEmbed(game: ScrambleGame): APIEmbed {
  return new EmbedBuilder()
    .setColor(COLOR_GOLD)
    .setTitle("🏆 نفذت الكلمات!")
    .setDescription(
      [
        "نفذت كلمات اللعبة! 🤝",
        `الناجون: ${game.playerOrder.map((id) => `<@${id}>`).join(", ")}`,
        `جولات: **${game.roundNumber}**`,
      ].join("\n"),
    )
    .setFooter({ text: "اكتب $حروف لجولة جديدة!" })
    .toJSON();
}

export function scrambleCancelledEmbed(): APIEmbed {
  return new EmbedBuilder()
    .setColor(COLOR_RED)
    .setDescription("🚫 تم إلغاء لعبة الحروف.")
    .toJSON();
}
