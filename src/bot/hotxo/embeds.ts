// src/bot/hotxo/embeds.ts
import { EmbedBuilder } from "discord.js";
import type { HotXOGame } from "./game";

export function hotxoLobbyEmbed(game: HotXOGame): EmbedBuilder {
  const playerList = game.players
    .map((p, i) => `${i === 0 ? "\u2716\uFE0F" : "\u2B55"} <@${p.id}>`)
    .join("\n");

  return new EmbedBuilder()
    .setTitle("\uD83D\uDD25 XO \u0627\u0644\u0645\u0644\u062A\u0647\u0628\u0629")
    .setDescription(
      `**\u0644\u0639\u0628\u0629 XO \u0628\u0646\u0643\u0647\u0629 \u062C\u062F\u064A\u062F\u0629!**\n` +
      `\u0643\u0644 \u0644\u0627\u0639\u0628 \u064A\u0642\u062F\u0631 \u064A\u062D\u0637 \u0628\u0633 **3** \u0639\u0644\u0627\u0645\u0627\u062A..\n` +
      `\u0644\u0645\u0627 \u062A\u062D\u0637 \u0627\u0644\u0631\u0627\u0628\u0639\u0629\u060C \u0627\u0644\u0623\u0648\u0644\u0649 \u062A\u062E\u062A\u0641\u064A! \uD83D\uDD25\n\n` +
      `**\u0627\u0644\u0644\u0627\u0639\u0628\u064A\u0646:**\n${playerList}\n\n` +
      `${game.players.length < 2 ? "\u23F3 \u0646\u0646\u062A\u0638\u0631 \u0644\u0627\u0639\u0628 \u062B\u0627\u0646\u064A \u064A\u062F\u062E\u0644..." : "\u2705 \u062C\u0627\u0647\u0632\u064A\u0646! \u0627\u0636\u063A\u0637 **\u0627\u0628\u062F\u0623**"}`
    )
    .setColor(0xFF4500)
    .setFooter({ text: "Nova Games \u2022 XO \u0627\u0644\u0645\u0644\u062A\u0647\u0628\u0629" });
}

export function hotxoBoardEmbed(game: HotXOGame, lastAction?: string): EmbedBuilder {
  const current = game.players[game.currentTurn];
  const symbol = current.symbol === "X" ? "\u2716\uFE0F" : "\u2B55";

  let desc = lastAction ? `${lastAction}\n\n` : "";
  desc += `${symbol} \u062F\u0648\u0631 **${current.username}** (${current.symbol})`;

  const p1 = game.players[0];
  const p2 = game.players[1];
  desc += `\n\n\u2716\uFE0F ${p1.username}: **${p1.moves.length}/3** \u0639\u0644\u0627\u0645\u0627\u062A`;
  desc += `\n\u2B55 ${p2.username}: **${p2.moves.length}/3** \u0639\u0644\u0627\u0645\u0627\u062A`;

  return new EmbedBuilder()
    .setTitle("\uD83D\uDD25 XO \u0627\u0644\u0645\u0644\u062A\u0647\u0628\u0629")
    .setDescription(desc)
    .setColor(0xFF4500)
    .setFooter({ text: "Nova Games \u2022 XO \u0627\u0644\u0645\u0644\u062A\u0647\u0628\u0629" });
}

export function hotxoWinEmbed(game: HotXOGame, winnerId: string, pts: number): EmbedBuilder {
  const winner = game.players.find((p) => p.id === winnerId)!;
  const loser = game.players.find((p) => p.id !== winnerId)!;
  const symbol = winner.symbol === "X" ? "\u2716\uFE0F" : "\u2B55";

  return new EmbedBuilder()
    .setTitle(`\uD83D\uDD25 \u0641\u0627\u0632 ${winner.username}! \uD83D\uDD25`)
    .setDescription(
      `${symbol} **${winner.username}** \u0641\u0627\u0632 \u0639\u0644\u0649 **${loser.username}**!\n\n` +
      `\uD83C\uDFC6 +**${pts}** \u0646\u0642\u0637\u0629`
    )
    .setColor(0xFFD700)
    .setFooter({ text: "Nova Games \u2022 XO \u0627\u0644\u0645\u0644\u062A\u0647\u0628\u0629" });
}

export function hotxoCancelledEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("\uD83D\uDD25 XO \u0627\u0644\u0645\u0644\u062A\u0647\u0628\u0629")
    .setDescription("\u274C \u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0644\u0639\u0628\u0629.")
    .setColor(0x888888);
}

export function hotxoTimeoutEmbed(game: HotXOGame): EmbedBuilder {
  const timedOut = game.players[game.currentTurn];
  const winner = game.players[game.currentTurn === 0 ? 1 : 0];

  return new EmbedBuilder()
    .setTitle("\uD83D\uDD25 \u0627\u0646\u062A\u0647\u0649 \u0627\u0644\u0648\u0642\u062A!")
    .setDescription(
      `\u23F0 **${timedOut.username}** \u0645\u0627 \u0644\u0639\u0628 \u0628\u0627\u0644\u0648\u0642\u062A!\n` +
      `\uD83C\uDFC6 **${winner.username}** \u0641\u0627\u0632!`
    )
    .setColor(0xFF4500)
    .setFooter({ text: "Nova Games \u2022 XO \u0627\u0644\u0645\u0644\u062A\u0647\u0628\u0629" });
}
