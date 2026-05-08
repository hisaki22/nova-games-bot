import { type Message, type TextChannel } from "discord.js";
import { logger } from "../lib/logger";
import { initImposterGame } from "./imposter/handlers";
import { initScramble } from "./scramble/handlers";
import { initSearchGame } from "./search/handlers";
import { initRouletteGame } from "./roulette/handlers";
import { getLeaderboard, getUserRank, getUserRecord, getGuildStats } from "./scores";
import { getGame, deleteGame } from "./imposter/game";
import { getScrambleGame, deleteScrambleGame, clearScrambleTimers } from "./scramble/game";
import { getSearchGame, deleteSearchGame, clearSearchTimers } from "./search/game";
import { getRouletteGame, deleteRouletteGame, clearRouletteTimers } from "./roulette/game";

export const PREFIX = "$";

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

async function replyTemp(msg: Message, content: string): Promise<void> {
  try {
    const sent = await msg.reply(content);
    setTimeout(() => sent.delete().catch(() => null), 5000);
  } catch { /* ignore */ }
}

export async function handlePrefixMessage(message: Message): Promise<void> {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;
  if (!message.guild || !message.channel.isTextBased()) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args[0];
  const guildId = message.guildId ?? "";
  const userId = message.author.id;
  const username = message.author.username;
  const channel = message.channel as TextChannel;

  try {
    switch (cmd) {
      case "امبوستر": {
        const result = await initImposterGame(channel, guildId, userId, username);
        if (!result.ok) await replyTemp(message, `❌ ${result.reason}`);
        break;
      }

      case "حروف": {
        const result = await initScramble(channel, guildId, userId, username);
        if (!result.ok) await replyTemp(message, `❌ ${result.reason}`);
        break;
      }

      case "الغاء": {
        const game = getGame(channel.id);
        if (!game) { await replyTemp(message, "❌ ما في لعبة إمبوستر نشطة."); break; }
        if (game.hostId !== userId) { await replyTemp(message, "❌ فقط المضيف يقدر يلغي."); break; }
        deleteGame(channel.id);
        await message.reply("✅ تم إلغاء لعبة الإمبوستر.");
        break;
      }

      case "الغاء_حروف": {
        const game = getScrambleGame(channel.id);
        if (!game) { await replyTemp(message, "❌ ما في لعبة حروف نشطة."); break; }
        if (game.hostId !== userId) { await replyTemp(message, "❌ فقط المضيف يقدر يلغي."); break; }
        clearScrambleTimers(game);
        deleteScrambleGame(channel.id);
        await message.reply("✅ تم إلغاء لعبة الحروف.");
        break;
      }

      case "بحث": {
        const result = await initSearchGame(channel, guildId, userId, username);
        if (!result.ok) await replyTemp(message, `❌ ${result.reason}`);
        break;
      }

      case "الغاء_بحث": {
        const game = getSearchGame(channel.id);
        if (!game) { await replyTemp(message, "❌ ما في لعبة بحث نشطة."); break; }
        if (game.hostId !== userId) { await replyTemp(message, "❌ فقط المضيف يقدر يلغي."); break; }
        clearSearchTimers(game);
        deleteSearchGame(channel.id);
        await message.reply("✅ تم إلغاء لعبة البحث.");
        break;
      }

      case "روليت": {
        const displayName = message.member?.displayName ?? message.author.username;
        const result = await initRouletteGame(channel, guildId, userId, displayName);
        if (!result.ok) await replyTemp(message, `❌ ${result.reason}`);
        break;
      }

      case "الغاء_روليت": {
        const game = getRouletteGame(channel.id);
        if (!game) { await replyTemp(message, "❌ ما في لعبة روليت نشطة."); break; }
        if (game.hostId !== userId) { await replyTemp(message, "❌ فقط المضيف يقدر يلغي."); break; }
        clearRouletteTimers(game);
        deleteRouletteGame(channel.id);
        await message.reply("✅ تم إلغاء لعبة الروليت.");
        break;
      }

      case "نقاط": {
        // If there's a mention, show that person's points
        const mention = args[1];
        const mentionMatch = mention?.match(/^<@!?(\d+)>$/);
        const targetId = mentionMatch ? mentionMatch[1]! : userId;
        const targetUsername = mentionMatch
          ? (await message.guild?.members.fetch(targetId).catch(() => null))?.user.username ?? targetId
          : username;

        const rec = getUserRecord(guildId, targetId);
        const rank = getUserRank(guildId, targetId);

        if (!rec || rec.points === 0) {
          const who = targetId === userId ? "ما لديك" : `ما لدى <@${targetId}>`;
          await message.reply(`${who} نقاط بعد. العب لتحصل على نقاط! 🎮`);
          break;
        }
        const rankText = rank > 0 ? ` • المرتبة: **#${rank}**` : "";
        await message.reply({
          embeds: [{
            color: 0xfaa61a,
            title: `🏅 نقاط ${targetId === userId ? username : targetUsername}`,
            description: [
              `**المجموع:** ${rec.points} نقطة${rankText}`,
              "",
              `🔤 الحروف: **${rec.scrambleCorrect}** إجابة • **${rec.scrambleWins}** فوز`,
              `🕵️ الإمبوستر: **${rec.imposterPoints}** نقطة`,
              `🔍 البحث: **${rec.searchWins ?? 0}** فوز`,
              `🎡 الروليت: **${rec.rouletteWins ?? 0}** فوز`,
            ].join("\n"),
          }],
        });
        break;
      }

      case "توب": {
        const top = getLeaderboard(guildId);
        if (top.length === 0) {
          await message.reply("ما في نقاط مسجّلة بعد. العب لتبدأ! 🎮");
          break;
        }
        const rows = top.map((r, i) => {
          const medal = RANK_MEDALS[i] ?? `\`${i + 1}.\``;
          return `${medal} <@${r.userId}> — **${r.points}** نقطة`;
        }).join("\n");
        await message.reply({
          embeds: [{
            color: 0xfaa61a,
            title: "🏆 المتصدرون",
            description: rows,
            footer: { text: "مجموع نقاط جميع الألعاب" },
          }],
        });
        break;
      }

      case "العاب": {
        await message.reply({
          embeds: [{
            color: 0x5865f2,
            title: "🎮 الألعاب المتاحة",
            description: [
              "**🕵️ الإمبوستر**",
              "`$امبوستر` — ابدأ لعبة إمبوستر",
              "`$الغاء` — ألغِ لعبة الإمبوستر (للمضيف)",
              "",
              "**🔤 الحروف المخربطة**",
              "`$حروف` — ابدأ لعبة الحروف",
              "`$الغاء_حروف` — ألغِ لعبة الحروف (للمضيف)",
              "",
              "**🔍 البحث**",
              "`$بحث` — ابدأ لعبة البحث على جوجل",
              "`$الغاء_بحث` — ألغِ لعبة البحث (للمضيف)",
              "",
              "**🎡 الروليت**",
              "`$روليت` — ابدأ لعبة الروليت الجماعية",
              "`$الغاء_روليت` — ألغِ لعبة الروليت (للمضيف)",
              "",
              "📌 جميع الألعاب تحتاج **٤ لاعبين** للبدء وتبدأ تلقائياً بعد دقيقة",
            ].join("\n"),
          }],
        });
        break;
      }

      case "احصاء": {
        const stats = getGuildStats(guildId);
        if (stats.totalPlayers === 0) {
          await message.reply("ما في إحصائيات بعد. العب لتبدأ! 🎮");
          break;
        }
        await message.reply({
          embeds: [{
            color: 0x2ecc71,
            title: "📊 إحصائيات السيرفر",
            fields: [
              { name: "👥 اللاعبين النشطين", value: `**${stats.totalPlayers}**`, inline: true },
              { name: "💰 مجموع النقاط", value: `**${stats.totalPoints}**`, inline: true },
              { name: "🏆 أكثر لعبة شعبية", value: stats.topGame, inline: true },
              {
                name: "🎮 إجمالي الفوز بكل لعبة",
                value: [
                  `🕵️ الإمبوستر: **${stats.gameCounts.imposter}** لاعب فاز`,
                  `🔤 الحروف: **${stats.gameCounts.scramble}** فوز`,
                  `🔍 البحث: **${stats.gameCounts.search}** فوز`,
                  `🎡 الروليت: **${stats.gameCounts.roulette}** فوز`,
                ].join("\n"),
                inline: false,
              },
              ...(stats.topPlayer ? [{
                name: "👑 أفضل لاعب",
                value: `<@${stats.topPlayer.userId}> — **${stats.topPlayer.points}** نقطة`,
                inline: false,
              }] : []),
            ],
          }],
        });
        break;
      }

      case "مساعدة": {
        await message.reply({
          embeds: [{
            color: 0x5865f2,
            title: "📋 أوامر البريفكس $",
            description: [
              "**🎮 الألعاب**",
              "`$العاب` — عرض جميع الألعاب",
              "",
              "**🏆 النقاط**",
              "`$نقاط` — اعرض نقاطك",
              "`$نقاط @شخص` — اعرض نقاط شخص آخر",
              "`$توب` — لوحة المتصدرين",
              "`$احصاء` — إحصائيات السيرفر",
              "`$مساعدة` — هذه القائمة",
            ].join("\n"),
          }],
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    logger.error({ err, cmd }, "prefix command failed");
  }
}
