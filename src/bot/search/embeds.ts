import { type APIEmbed } from "discord.js";
import { type SearchGame, getAlivePlayers, LOBBY_SECONDS, QUESTION_SECONDS } from "./game";
import { type SearchPair } from "./wordbank";

export function searchLobbyEmbed(game: SearchGame, secondsLeft: number): APIEmbed {
  const players = [...game.players.values()];
  const playerList = players.map((p) => `• <@${p.userId}>`).join("\n") || "لا يوجد لاعبون بعد";
  return {
    color: 0x4285f4,
    title: "🔍 لعبة البحث",
    description: [
      "**كيف تلعب؟**",
      "يظهر البوت موضوعين — اختر أيهما يُبحث عنه **أكثر على جوجل**!",
      "من يختار الجواب الغلط = **يُطرد** ❌",
      "آخر لاعب يبقى يفوز 🏆",
      "",
      `**اللاعبون (${players.length}):**`,
      playerList,
    ].join("\n"),
    fields: [
      { name: "⏱️ وقت الانضمام", value: `${secondsLeft}s`, inline: true },
      { name: "⚡ وقت الإجابة", value: `${QUESTION_SECONDS}s`, inline: true },
      { name: "👥 الحد الأدنى", value: "٤ لاعبين", inline: true },
    ],
    footer: { text: "اضغط انضم ✋ للمشاركة — تبدأ تلقائياً بعد دقيقة" },
  };
}

export function searchQuestionEmbed(
  game: SearchGame,
  pair: SearchPair,
  secondsLeft: number,
): APIEmbed {
  const alive = getAlivePlayers(game);
  const voted = game.votes.size;
  const bar = buildBar(secondsLeft, QUESTION_SECONDS);

  return {
    color: secondsLeft <= 3 ? 0xed4245 : 0x4285f4,
    title: `🔍 سؤال #${game.questionNumber}`,
    description: [
      "**أيهما يُبحث عنه أكثر على جوجل؟**",
      "",
      `🅰️  **${pair.a}**`,
      `🅱️  **${pair.b}**`,
      "",
      `${bar} **${secondsLeft}s**`,
    ].join("\n"),
    fields: [
      {
        name: `👥 اللاعبون الباقون (${alive.length})`,
        value: alive.map((p) => `• <@${p.userId}>`).join("\n") || "—",
        inline: true,
      },
      {
        name: "📊 صوّتوا",
        value: `${voted} / ${alive.length}`,
        inline: true,
      },
    ],
    footer: { text: "اضغط 🅰️ أو 🅱️ للاختيار" },
  };
}

export function searchResultEmbed(
  game: SearchGame,
  pair: SearchPair,
  eliminated: { userId: string; username: string }[],
): APIEmbed {
  const alive = getAlivePlayers(game);
  const correctLabel = pair.answer === "a" ? pair.a : pair.b;
  const wrongLabel = pair.answer === "a" ? pair.b : pair.a;

  const aVotes = [...game.votes.values()].filter((v) => v === "a").length;
  const bVotes = [...game.votes.values()].filter((v) => v === "b").length;
  const noVote = alive.length + eliminated.length - game.votes.size;

  const elimList = eliminated.length > 0
    ? eliminated.map((p) => `❌ <@${p.userId}>`).join("\n")
    : "لا أحد ✅";

  return {
    color: 0xfaa61a,
    title: `📊 نتيجة السؤال #${game.questionNumber}`,
    description: [
      `✅ **الجواب الصحيح:** \`${correctLabel}\``,
      `❌ **الخيار الخاطئ:** \`${wrongLabel}\``,
      "",
      `🅰️ ${pair.a}: **${aVotes}** صوت`,
      `🅱️ ${pair.b}: **${bVotes}** صوت`,
      noVote > 0 ? `⏰ لم يصوّتوا: **${noVote}**` : "",
    ].filter(Boolean).join("\n"),
    fields: [
      {
        name: "🚫 المطرودون",
        value: elimList,
        inline: true,
      },
      {
        name: `👥 الباقون (${alive.length})`,
        value: alive.length > 0 ? alive.map((p) => `✅ <@${p.userId}>`).join("\n") : "—",
        inline: true,
      },
    ],
  };
}

export function searchWinnerEmbed(winner: { userId: string; username: string }, rounds: number, pts: number): APIEmbed {
  return {
    color: 0x57f287,
    title: "🏆 انتهت اللعبة!",
    description: [
      `🥇 الفائز: <@${winner.userId}>`,
      "",
      `صمد خلال **${rounds}** جولة وكان الأذكى! 🧠`,
      `🎉 حصل الفائز على **${pts} نقطة**!`,
    ].join("\n"),
  };
}

export function searchCancelledEmbed(): APIEmbed {
  return {
    color: 0xed4245,
    description: "❌ تم إلغاء لعبة البحث.",
  };
}

function buildBar(current: number, total: number): string {
  const filled = Math.max(0, Math.round((current / total) * 10));
  return "█".repeat(filled) + "░".repeat(10 - filled);
}
