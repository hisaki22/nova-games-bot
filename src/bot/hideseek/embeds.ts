import { EmbedBuilder, type APIEmbed } from "discord.js";
import type { HideseekGame, HideseekPlayer } from "./game.js";
import { ROOMS } from "./game.js";

export function hideseekLobbyEmbed(game: HideseekGame): APIEmbed {
  const hiders = [...game.players.values()].map((p, i) => `\`${i + 1}.\` <@${p.userId}>`).join("\n") || "لا أحد";
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("👀 غميضة — لوبي")
    .setDescription(`**الباحث:** <@${game.seekerId}> ${game.seekerUsername}\n\nالآخرون يختبئون منه في 6 غرف!\n\n> اضغط **أختبئ** للانضمام كـ مختبئ.`)
    .addFields({ name: `🙈 المختبئون (${game.players.size})`, value: hiders })
    .setFooter({ text: "الباحث يضغط ابدأ بعد الانضمام" })
    .setTimestamp()
    .toJSON();
}

export function hideseekHidingEmbed(game: HideseekGame): APIEmbed {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("🏃 اختبئ الآن!")
    .setDescription(`**${game.seekerUsername}** يعدّ... اختبئ في غرفة!\n\n${ROOMS.map((r, i) => `**${i + 1}.** ${r}`).join("\n")}\n\n> اضغط زر الغرفة في رسالتك الخاصة!`)
    .setTimestamp()
    .toJSON();
}

export function hideseekSeekEmbed(game: HideseekGame): APIEmbed {
  const searched = game.searchedRooms.map((i) => ROOMS[i]).join(", ") || "لا شيء";
  const rooms = ROOMS.map((r, i) => game.searchedRooms.includes(i) ? `~~${r}~~` : r).join("\n");
  const hidersLeft = [...game.players.values()].filter((p) => !p.found).length;
  return new EmbedBuilder()
    .setColor(0xff9900)
    .setTitle(`🔍 ${game.seekerUsername} يفتش!`)
    .setDescription(`**متبقي ${hidersLeft} مختبئ**\n\n${rooms}`)
    .addFields({ name: "فُتِّشت", value: searched })
    .setFooter({ text: "اضغط غرفة لتفتيشها" })
    .toJSON();
}

export function hideseekFoundEmbed(found: HideseekPlayer[], roomIndex: number, hidersLeft: number): APIEmbed {
  const names = found.map((p) => `**${p.username}**`).join(", ");
  return new EmbedBuilder()
    .setColor(found.length > 0 ? 0xed4245 : 0x57f287)
    .setTitle(`${ROOMS[roomIndex]} — ${found.length > 0 ? "وُجدوا! 🎉" : "فارغة 😅"}`)
    .setDescription(found.length > 0 ? `وُجد: ${names}\nمتبقي ${hidersLeft} مختبئ` : `لا أحد هنا. متبقي ${hidersLeft} مختبئ`)
    .toJSON();
}

export function hideseekEndEmbed(survivors: HideseekPlayer[], seekerName: string): APIEmbed {
  const won = survivors.length > 0;
  const names = survivors.map((p) => `<@${p.userId}>`).join(", ") || "—";
  return new EmbedBuilder()
    .setColor(won ? 0xfee75c : 0xed4245)
    .setTitle(won ? "🎉 نجا المختبئون!" : `🕵️ ${seekerName} وجد الجميع!`)
    .setDescription(won ? `نجا من الإمساك: ${names}` : `**${seekerName}** أمسك الجميع!`)
    .setTimestamp()
    .toJSON();
}
