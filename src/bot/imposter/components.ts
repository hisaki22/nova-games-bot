import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { Game } from "./game";

type RowJSON = ReturnType<ActionRowBuilder<ButtonBuilder>["toJSON"]>;

export function lobbyButtons(): RowJSON {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("imp:join")
      .setLabel("انضم")
      .setEmoji("✋")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("imp:leave")
      .setLabel("خروج")
      .setEmoji("🚪")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("imp:cancel")
      .setLabel("إلغاء")
      .setEmoji("🛑")
      .setStyle(ButtonStyle.Danger),
  );
  return row.toJSON();
}

export function revealButton(): RowJSON {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("imp:reveal")
      .setLabel("اعرف كلمتك السرية")
      .setEmoji("🎴")
      .setStyle(ButtonStyle.Primary),
  );
  return row.toJSON();
}

export function suggestButton(): RowJSON {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("imp:suggest")
      .setLabel("اكتب اقتراحك")
      .setEmoji("✍️")
      .setStyle(ButtonStyle.Primary),
  );
  return row.toJSON();
}

export function suggestionModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId("imp:suggest_modal")
    .setTitle("اكتب اقتراحك")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("suggestion")
          .setLabel("اقتراحك / تلميحك عن الكلمة")
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(80)
          .setRequired(true)
          .setPlaceholder("مثال: حلو الطعم"),
      ),
    );
}

export function votingButtons(game: Game): RowJSON[] {
  const players = Array.from(game.players.values());
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < players.length; i += 5) {
    const slice = players.slice(i, i + 5);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...slice.map((p) =>
        new ButtonBuilder()
          .setCustomId(`imp:vote:${p.id}`)
          .setLabel(p.username.slice(0, 70))
          .setStyle(ButtonStyle.Secondary),
      ),
    );
    rows.push(row);
  }
  return rows.map((r) => r.toJSON());
}

export function guessButtons(options: string[]): RowJSON[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < options.length; i += 4) {
    const slice = options.slice(i, i + 4);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...slice.map((word, idx) =>
        new ButtonBuilder()
          .setCustomId(`imp:guess:${i + idx}`)
          .setLabel(word.slice(0, 70))
          .setStyle(ButtonStyle.Danger),
      ),
    );
    rows.push(row);
  }
  return rows.map((r) => r.toJSON());
}
