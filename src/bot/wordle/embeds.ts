import { EmbedBuilder, type APIEmbed } from "discord.js";
import type { WordleGame, TileState } from "./game.js";

const TILE: Record<TileState, string> = {
  correct: "🟩",
  present: "🟨",
  absent: "⬛",
};

function renderGrid(game: WordleGame): string {
  const rows: string[] = [];
  for (const g of game.guesses) {
    const squares = g.tiles.map((t) => TILE[t]).join("");
    const word = g.word.split("").reverse().join(""); // RTL display
    rows.push(`${squares}  \`${word}\``);
  }
  for (let i = game.guesses.length; i < game.maxGuesses; i++) {
    rows.push("⬜⬜⬜⬜⬜");
  }
  return rows.join("\n");
}

export function wordleEmbed(game: WordleGame): APIEmbed {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("📝 أوردو — خمّن الكلمة الخماسية!")
    .setDescription(renderGrid(game))
    .addFields({ name: "المحاولات", value: `${game.guesses.length} / ${game.maxGuesses}`, inline: true })
    .setFooter({ text: 'استخدم /خمن_كلمة لإرسال تخمينك • 🟩 صح المكان • 🟨 موجود بس مكانها غلط • ⬛ مو موجودة' })
    .setTimestamp()
    .toJSON();
}

export function wordleWonEmbed(game: WordleGame): APIEmbed {
  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle("🎉 فزت!")
    .setDescription(`**${game.winnerName}** خمّن الكلمة في ${game.guesses.length} محاولة!\n\nالكلمة: **${game.secret}**\n\n${renderGrid(game)}`)
    .setTimestamp()
    .toJSON();
}

export function wordleLostEmbed(game: WordleGame): APIEmbed {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("💀 انتهت المحاولات!")
    .setDescription(`الكلمة الصحيحة كانت: **${game.secret}**\n\n${renderGrid(game)}`)
    .setTimestamp()
    .toJSON();
}
