import { EmbedBuilder, type APIEmbed } from "discord.js";
import type { Game, RoundResult } from "./game";

const COLOR_PRIMARY = 0x5865f2;
const COLOR_SUCCESS = 0x57f287;
const COLOR_DANGER = 0xed4245;
const COLOR_GOLD = 0xfee75c;
const COLOR_DARK = 0x2b2d31;
const COLOR_INFO = 0x00b8d4;

export function lobbyEmbed(game: Game, secondsLeft?: number): APIEmbed {
  const playerList = Array.from(game.players.values())
    .map((p, i) => `\`${i + 1}.\` <@${p.id}>`)
    .join("\n");

  const timerLine = secondsLeft !== undefined
    ? `⏱️ تبدأ تلقائياً بعد **${secondsLeft} ثانية**`
    : "";

  return new EmbedBuilder()
    .setColor(COLOR_PRIMARY)
    .setTitle("🕵️ لعبة الإمبوستر — لوبي الانضمام")
    .setDescription(
      [
        "> اضغط **انضم** للدخول. تبدأ اللعبة تلقائياً بعد دقيقة.",
        "",
        `**المضيف:** <@${game.hostId}>`,
        `**اللاعبون:** ${game.players.size} / 15  (الحد الأدنى ٤)`,
        `**عدد الإمبوسترين:** 1`,
        timerLine,
      ].filter(Boolean).join("\n"),
    )
    .addFields({
      name: "👥 المنضمّون",
      value: playerList || "لا أحد بعد.",
    })
    .setFooter({ text: "اضغط الأزرار في الأسفل." })
    .setTimestamp(new Date())
    .toJSON();
}

export function revealPhaseEmbed(game: Game, secondsLeft: number): APIEmbed {
  const seenList = Array.from(game.players.values())
    .map((p) => `${p.seenWord ? "✅" : "⬜"} <@${p.id}>`)
    .join("\n");

  return new EmbedBuilder()
    .setColor(COLOR_INFO)
    .setTitle("🎴 مرحلة كشف الكلمة")
    .setDescription(
      [
        "> اضغط الزر تحت **سرّاً** لتعرف كلمتك أو دورك.",
        "",
        `**الفئة:** \`${game.category?.name ?? "؟"}\``,
        `**عدد اللاعبين:** ${game.players.size}`,
        `**فيهم إمبوستر واحد** 🔪`,
        "",
        `⏱️ ينتقل إلى مرحلة الاقتراحات بعد **${secondsLeft} ثانية**`,
      ].join("\n"),
    )
    .addFields({ name: "الذين رأوا كلمتهم", value: seenList })
    .setFooter({ text: "كل لاعب لازم يضغط الزر ويشوف كلمته." })
    .setTimestamp(new Date())
    .toJSON();
}

export function revealEphemeralPlayer(
  word: string,
  category: string,
): APIEmbed {
  return new EmbedBuilder()
    .setColor(COLOR_SUCCESS)
    .setTitle("🎴 كلمتك السرية")
    .setDescription(
      [
        `**الفئة:** \`${category}\``,
        `**الكلمة السرية:**`,
        `# ${word}`,
        "",
        "> فكّر في اقتراح ذكي لما يجيك الزر — لا واضح زيادة ولا غامض زيادة.",
      ].join("\n"),
    )
    .setFooter({ text: "هذي الرسالة سرّية، ما يشوفها غيرك." })
    .toJSON();
}

export function revealEphemeralImposter(category: string): APIEmbed {
  return new EmbedBuilder()
    .setColor(COLOR_DANGER)
    .setTitle("🔪 أنت الإمبوستر!")
    .setDescription(
      [
        `**الفئة:** \`${category}\``,
        "",
        "> ما عندك الكلمة السرية. مهمتك تتظاهر إنك تعرفها.",
        "> اسمع اقتراحات الباقين عشان تحاول تخمّن الكلمة في النهاية.",
        "",
        "**🎯 هدفك:**",
        "• اكتب اقتراح يبيّن إنك فاهم الموضوع، بدون ما تكشف نفسك",
        "• حاول تتجنّب التصويت ضدك",
        "• في النهاية بتختار الكلمة الصحيحة من ٨ خيارات",
      ].join("\n"),
    )
    .setFooter({ text: "هذي الرسالة سرّية، ما يشوفها غيرك." })
    .toJSON();
}

export function suggestionsPhaseEmbed(
  game: Game,
  secondsLeft: number,
): APIEmbed {
  const submitted = Array.from(game.players.values())
    .map((p) => `${p.suggestion ? "✅" : "⬜"} <@${p.id}>`)
    .join("\n");

  return new EmbedBuilder()
    .setColor(COLOR_GOLD)
    .setTitle("✍️ مرحلة الاقتراحات")
    .setDescription(
      [
        "> اضغط الزر تحت واكتب **اقتراح / تلميح** عن الكلمة السرية.",
        "> الإمبوستر يكتب اقتراح يحاول يندمج فيه مع الباقي.",
        "",
        `**الفئة:** \`${game.category?.name ?? "؟"}\``,
        "",
        `⏱️ مرحلة التصويت تبدأ بعد **${secondsLeft} ثانية**`,
      ].join("\n"),
    )
    .addFields({ name: "📝 من أرسل اقتراحه", value: submitted })
    .setFooter({ text: "كل لاعب يضغط الزر ويكتب اقتراحه. يقدر يعدّل بإعادة الإرسال." })
    .setTimestamp(new Date())
    .toJSON();
}

export function votingPhaseEmbed(game: Game, secondsLeft: number): APIEmbed {
  const items = Array.from(game.players.values())
    .map(
      (p) =>
        `**<@${p.id}>**\n> ${
          p.suggestion ? `*${p.suggestion}*` : "*(لم يكتب اقتراحه)*"
        }`,
    )
    .join("\n\n");

  return new EmbedBuilder()
    .setColor(COLOR_PRIMARY)
    .setTitle("🗳️ مرحلة التصويت")
    .setDescription(
      [
        "> اقرأ الاقتراحات وصوّت على من تشك إنه الإمبوستر.",
        "> ما تقدر تصوّت على نفسك، وما تقدر تغيّر صوتك.",
        "",
        `**الفئة:** \`${game.category?.name ?? "؟"}\``,
        `**صوّتوا حتى الآن:** ${game.votes.size} / ${game.players.size}`,
        "",
        `⏱️ ينتهي التصويت بعد **${secondsLeft} ثانية**`,
      ].join("\n"),
    )
    .addFields({ name: "📜 الاقتراحات", value: items.slice(0, 4000) })
    .setFooter({ text: "ينتهي التصويت تلقائياً عند انتهاء الوقت أو تصويت الجميع." })
    .setTimestamp(new Date())
    .toJSON();
}

export function guessingPhaseEmbed(
  game: Game,
  voteSummary: string,
  secondsLeft: number,
): APIEmbed {
  const imposter = game.imposterIds[0]
    ? `<@${game.imposterIds[0]}>`
    : "غير معروف";

  return new EmbedBuilder()
    .setColor(COLOR_DANGER)
    .setTitle("🔪 كشف الإمبوستر — مرحلة التخمين")
    .setDescription(
      [
        `**الإمبوستر:** ${imposter}`,
        "",
        "> الحين دور الإمبوستر يخمّن الكلمة السرية من ٨ خيارات من نفس الفئة.",
        "",
        `**الفئة:** \`${game.category?.name ?? "؟"}\``,
        "",
        `⏱️ التخمين خلال **${secondsLeft} ثانية**`,
      ].join("\n"),
    )
    .addFields({
      name: "📊 نتائج التصويت",
      value: voteSummary || "لا أصوات",
    })
    .setFooter({ text: "إذا لم يخمّن أحد، تنتهي اللعبة بدون نقطة تخمين." })
    .setTimestamp(new Date())
    .toJSON();
}

export function endRoundEmbed(game: Game, result: RoundResult): APIEmbed {
  const imposter = game.imposterIds[0]
    ? `<@${game.imposterIds[0]}>`
    : "غير معروف";

  let outcomeText: string;
  let color: number;
  if (result.guessOutcome === "correct") {
    outcomeText = "🎯 الإمبوستر خمّن الكلمة الصحيحة!";
    color = COLOR_DANGER;
  } else if (result.guessOutcome === "wrong") {
    outcomeText = "❌ الإمبوستر خمّن غلط.";
    color = COLOR_SUCCESS;
  } else {
    outcomeText = "⏰ ما خمّن الإمبوستر في الوقت.";
    color = COLOR_DARK;
  }

  const sortedScores = Array.from(result.scoreTotals.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  const board = sortedScores
    .map(([id, total], i) => {
      const delta = result.scoreDelta.get(id) ?? 0;
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "▫️";
      const botPts = delta > 0 ? delta * 10 : 0;
      return `${medal} <@${id}> — **${total}** نقطة ${
        botPts > 0 ? `\`(+${botPts} نقطة)\`` : ""
      }`;
    })
    .join("\n");

  const guessText = game.guess
    ? `**الإمبوستر <@${game.guess.byUserId}> اختار:** \`${game.guess.word}\``
    : "*لم يتم التخمين*";

  return new EmbedBuilder()
    .setColor(color)
    .setTitle("🏁 نهاية الجولة")
    .setDescription(
      [
        outcomeText,
        "",
        `**الكلمة السرية:** \`${game.secretWord ?? "؟"}\``,
        `**الفئة:** \`${game.category?.name ?? "؟"}\``,
        `**الإمبوستر:** ${imposter}`,
        guessText,
      ].join("\n"),
    )
    .addFields(
      {
        name: "📊 النقاط",
        value: [
          "• كل من صوّت على الإمبوستر = +10 نقطة",
          "• الإمبوستر إذا ما اتطرد بالأغلبية = +10 نقطة",
          "• تخمين الإمبوستر للكلمة الصحيحة = +10 نقطة",
        ].join("\n"),
      },
      { name: "🏆 لوحة النقاط", value: board || "—" },
    )
    .setFooter({ text: "اكتب $امبوستر لجولة جديدة." })
    .setTimestamp(new Date())
    .toJSON();
}

export function infoEmbed(title: string, description: string): APIEmbed {
  return new EmbedBuilder()
    .setColor(COLOR_PRIMARY)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp(new Date())
    .toJSON();
}

export function errorEmbed(message: string): APIEmbed {
  return new EmbedBuilder()
    .setColor(COLOR_DANGER)
    .setTitle("⚠️ خطأ")
    .setDescription(message)
    .toJSON();
}

export function successEmbed(message: string): APIEmbed {
  return new EmbedBuilder()
    .setColor(COLOR_SUCCESS)
    .setTitle("✅ تم")
    .setDescription(message)
    .toJSON();
}

export function helpEmbed(): APIEmbed {
  return new EmbedBuilder()
    .setColor(COLOR_PRIMARY)
    .setTitle("📖 طريقة لعب الإمبوستر")
    .setDescription(
      "> لعبة استنتاج اجتماعية بالعربي 🕵️\n> اكتشف الإمبوستر قبل ما يخدعكم!",
    )
    .addFields(
      {
        name: "🎮 الأوامر",
        value: [
          "`$امبوستر` — ابدأ لعبة جديدة",
          "`$مساعدة` — اعرض هذي الرسالة",
          "`$الغاء` — ألغِ اللعبة الحالية (للمضيف)",
          "`$العاب` — عرض جميع الألعاب",
          "`$نقاط` — نقاطك الحالية",
          "`$توب` — لوحة المتصدرين",
        ].join("\n"),
      },
      {
        name: "🔄 مراحل اللعبة",
        value: [
          "**1.** المضيف يبدأ، الكل يضغطون **انضم**",
          "**2.** اللعبة تبدأ تلقائياً بعد دقيقة (٤ لاعبين كحد أدنى)",
          "**3.** **مرحلة الكشف** (20 ثانية): كل لاعب يضغط زر سرّي ليعرف كلمته",
          "**4.** **مرحلة الاقتراحات** (40 ثانية): كل لاعب يكتب تلميح",
          "**5.** **مرحلة التصويت** (30 ثانية + 2 لكل لاعب): صوّت على المشتبه به",
          "**6.** **مرحلة التخمين** (30 ثانية): الإمبوستر يخمّن من ٨ خيارات",
        ].join("\n"),
      },
      {
        name: "🏆 النقاط",
        value: [
          "• كل من **صوّت على الإمبوستر** = +10 نقطة",
          "• الإمبوستر إذا **ما اتطرد بالأغلبية** = +10 نقطة",
          "• إذا **خمّن الكلمة الصحيحة** = +10 نقطة",
        ].join("\n"),
      },
    )
    .setFooter({ text: "حظ موفق! 🎲" })
    .toJSON();
}
