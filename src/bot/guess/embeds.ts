import { EmbedBuilder, type APIEmbed } from "discord.js";
import type { GuessGame } from "./game.js";

const ANSWER_EMOJI: Record<string, string> = { yes: "✅", no: "❌", maybe: "🤷" };

export function guessEmbed(game: GuessGame): APIEmbed {
  const qList = game.questions
    .map((q, i) => `\`${i + 1}.\` **${q.text}** — ${ANSWER_EMOJI[q.answer]} (سأل: ${q.askedByName})`)
    .join("\n") || "لا أسئلة بعد";

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("🧠 خمن — لعبة الـ 20 سؤال")
    .setDescription(
      `**${game.hostUsername}** يفكر في شيء ما...\n> اسأل سؤالاً بـ **نعم أو لا** وحاول تخمينه!\n\n` +
      `**الأسئلة المتبقية:** ${game.maxQuestions - game.questions.length} / ${game.maxQuestions}`
    )
    .addFields({ name: "📋 الأسئلة والأجوبة", value: qList.slice(0, 1000) })
    .setFooter({ text: "استخدم /سؤال لطرح سؤال • /تخمين_شيء للتخمين" })
    .setTimestamp()
    .toJSON();
}

export function guessWonEmbed(game: GuessGame): APIEmbed {
  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle("🎉 تم التخمين!")
    .setDescription(`**${game.winnerName}** خمّن الإجابة الصحيحة!\n\nالإجابة كانت: **${game.secret}**`)
    .setTimestamp()
    .toJSON();
}

export function guessEndedNoWinnerEmbed(game: GuessGame): APIEmbed {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("😈 لم يخمن أحد!")
    .setDescription(`انتهت الـ 20 سؤال ولم يخمن أحد!\n\nالإجابة كانت: **${game.secret}**`)
    .setTimestamp()
    .toJSON();
}

export function guessHostPromptEmbed(): APIEmbed {
  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("🧠 اكتب ما تفكر فيه")
    .setDescription("أدخل الشيء الذي تريد الآخرين أن يخمنوه. لن يراه أحد غيرك!")
    .toJSON();
}
