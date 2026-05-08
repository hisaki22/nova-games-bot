import { EmbedBuilder, type APIEmbed } from "discord.js";
import type { ChairsGame } from "./game.js";

export function chairsLobbyEmbed(game: ChairsGame): APIEmbed {
  const list = [...game.players.values()].map((p, i) => `\`${i + 1}.\` <@${p.userId}>`).join("\n") || "لا أحد";
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🪑 كراسي موسيقية — لوبي")
    .setDescription("> اضغط **انضم** للدخول في اللعبة!\n> الحد الأدنى 3 لاعبين للبداية.")
    .addFields(
      { name: `👥 اللاعبون (${game.players.size})`, value: list },
    )
    .setFooter({ text: "المضيف يضغط ابدأ عندما يكتمل العدد" })
    .setTimestamp()
    .toJSON();
}

export function chairsRoundEmbed(game: ChairsGame, secondsLeft: number): APIEmbed {
  const list = [...game.players.values()].map((p) =>
    `${game.grabbedChairs.has(p.userId) ? "✅" : "⏳"} <@${p.userId}>`
  ).join("\n");
  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle(`🪑 الجولة ${game.roundNumber} — ${game.chairsThisRound} كرسي!`)
    .setDescription(`⏱️ **${secondsLeft}** ثانية لتأخذ كرسي!\nعدد الكراسي: **${game.chairsThisRound}** لـ **${game.players.size}** لاعب\n\n> اضغط 🪑 **خذ كرسي** قبل ما تنتهي الوقت!`)
    .addFields({ name: "الحالة", value: list })
    .toJSON();
}

export function chairsEliminatedEmbed(eliminated: { username: string }, game: ChairsGame): APIEmbed {
  const remaining = [...game.players.values()].map((p) => `<@${p.userId}>`).join(" | ") || "—";
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("💀 خرج من اللعبة!")
    .setDescription(`**${eliminated.username}** ما أخذ كرسي! 😂\n\nالمتبقون: ${remaining}`)
    .setTimestamp()
    .toJSON();
}

export function chairsWinEmbed(winner: { username: string; userId: string }): APIEmbed {
  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle("🏆 الفائز!")
    .setDescription(`🎉 <@${winner.userId}> **${winner.username}** فاز بلعبة الكراسي الموسيقية!`)
    .setTimestamp()
    .toJSON();
}
