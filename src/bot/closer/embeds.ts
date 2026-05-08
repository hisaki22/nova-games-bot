import { EmbedBuilder, type APIEmbed } from "discord.js";
import type { CloserGame } from "./game.js";
import { getLeaderboard } from "./game.js";

function heat(diff: number): string {
  if (diff === 0) return "🎯";
  if (diff <= 5) return "🔥🔥🔥";
  if (diff <= 15) return "🔥🔥";
  if (diff <= 40) return "🔥";
  if (diff <= 100) return "🌡️";
  return "❄️";
}

export function closerEmbed(game: CloserGame): APIEmbed {
  const lb = getLeaderboard(game);
  const lbText = lb.length
    ? lb.map((e, i) => `\`${i + 1}.\` <@${e.userId}> — ${heat(e.diff)} (فرق ${e.diff})`).join("\n")
    : "لا أحد خمّن بعد";

  return new EmbedBuilder()
    .setColor(0xff7700)
    .setTitle("🎯 أقرب — خمّن الرقم!")
    .setDescription(`رقم سري بين **${game.min}** و **${game.max}**\nاكتب رقماً في المحادثة للتخمين!\n\n${heat(0)} = صح | 🔥 = قريب | ❄️ = بعيد`)
    .addFields({ name: "🏆 الأقرب حتى الآن", value: lbText })
    .setTimestamp()
    .toJSON();
}

export function closerWonEmbed(game: CloserGame, guessCount: number): APIEmbed {
  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle("🎯 فاز!")
    .setDescription(`**${game.winnerName}** خمّن الرقم الصحيح!\n\nالرقم كان: **${game.secret}**\nإجمالي التخمينات: **${guessCount}**`)
    .setTimestamp()
    .toJSON();
}

export function closerGuessEmbed(diff: number, value: number, tooBig: boolean, rank: number): APIEmbed {
  const color = diff <= 5 ? 0xee4444 : diff <= 40 ? 0xff9900 : 0x5588ff;
  const hint = tooBig ? "الرقم أصغر ⬇️" : "الرقم أكبر ⬆️";
  return new EmbedBuilder()
    .setColor(color)
    .setDescription(`${heat(diff)} تخمينك **${value}** — ${diff === 0 ? "🎯 صح!" : hint} (فرق ${diff}) | مرتبتك: #${rank}`)
    .toJSON();
}
