import { EmbedBuilder, type APIEmbed } from "discord.js";
import type { HideseekGame, HideseekPlayer, RevealResult } from "./game.js";

export function hideseekLobbyEmbed(game: HideseekGame): APIEmbed {
  const list = [...game.players.values()]
    .map((p, i) => `\`${i + 1}.\` <@${p.userId}>`)
    .join("\n") || "لا أحد";
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("👀 غميضة — لوبي")
    .setDescription(
      "كل لاعب يختار **خانة سرية** (1-25).\n" +
      "بالتناوب، كل لاعب يكشف خانة — من اختبأ فيها يُطرد!\n" +
      "⚠️ إذا كشفت خانتك أنت، **تُطرد أيضاً!**\n\n" +
      "> اضغط **انضم** للدخول."
    )
    .addFields({ name: `👥 اللاعبون (${game.players.size})`, value: list })
    .setFooter({ text: "المضيف يضغط ابدأ — الحد الأدنى 3 لاعبين" })
    .setTimestamp()
    .toJSON();
}

export function hideseekHidingEmbed(game: HideseekGame): APIEmbed {
  const hid = [...game.players.values()].filter((p) => p.hiddenCell !== undefined).length;
  const total = game.players.size;
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("🙈 اختر خانتك السرية!")
    .setDescription(
      "اضغط **اختر خانتي** لتحديد رقمك السري (1-25).\n" +
      "لا أحد يعرف اختيارك!\n\n" +
      `✅ اختار: **${hid} / ${total}**`
    )
    .setFooter({ text: "اللعبة تبدأ تلقائياً بعد اختيار الجميع" })
    .setTimestamp()
    .toJSON();
}

export function hideseekGridEmbed(game: HideseekGame, revealer: HideseekPlayer): APIEmbed {
  const alive = [...game.players.values()].filter((p) => !p.eliminated);
  const aliveList = alive.map((p) => `<@${p.userId}>`).join(" | ") || "—";

  return new EmbedBuilder()
    .setColor(0xff9900)
    .setTitle(`🔍 الجولة ${game.roundNumber} — دور <@${revealer.userId}>`)
    .setDescription(
      `اختر خانة لتكشفها!\n` +
      `⚠️ إذا كشفت خانتك أنت → **تُطرد!**\n\n` +
      `الخانات المكشوفة: ${game.revealedCells.length > 0 ? game.revealedCells.sort((a, b) => a - b).join(", ") : "لا شيء"}`
    )
    .addFields({ name: `🎮 اللاعبون النشطون (${alive.length})`, value: aliveList })
    .setTimestamp()
    .toJSON();
}

export function hideseekRevealEmbed(result: RevealResult, revealerName: string): APIEmbed {
  const foundNames = result.foundPlayers.map((p) => `**${p.username}**`).join(", ") || "لا أحد";
  const survivorList = result.alivePlayers.map((p) => `<@${p.userId}>`).join(" ") || "—";
  const empty = result.foundPlayers.length === 0;

  let desc = `**${revealerName}** كشف الخانة **${result.cell}**\n\n`;

  if (empty) {
    desc += "😅 الخانة فارغة! لا أحد مختبئ هنا.";
  } else {
    desc += `💀 وُجد: ${foundNames}`;
    if (result.revealerCaught) {
      desc += `\n🤣 **${revealerName}** كشف خانته هو! طُرد أيضاً!`;
    }
  }

  desc += `\n\n✅ متبقي: **${result.alivePlayers.length}** لاعب`;

  return new EmbedBuilder()
    .setColor(empty ? 0x57f287 : 0xed4245)
    .setTitle(`💣 خانة ${result.cell} — ${empty ? "فارغة!" : "وُجدوا!"}`)
    .setDescription(desc)
    .addFields({ name: "الناجون", value: survivorList })
    .setTimestamp()
    .toJSON();
}

export function hideseekWinEmbed(winner: HideseekPlayer): APIEmbed {
  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle("🏆 الفائز!")
    .setDescription(`🎉 <@${winner.userId}> **${winner.username}** نجا وفاز في غميضة!`)
    .setTimestamp()
    .toJSON();
}

export function hideseekNoWinnerEmbed(): APIEmbed {
  return new EmbedBuilder()
    .setColor(0x99aab5)
    .setTitle("🏁 انتهت اللعبة!")
    .setDescription("لا أحد نجا! انتهت جميع الخانات.")
    .setTimestamp()
    .toJSON();
}
