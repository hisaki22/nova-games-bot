import app from "./app.js";
import { logger } from "./lib/logger.js";
import { startBot } from "./bot/client.js";
import { loadScores } from "./bot/scores.js";

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

loadScores().catch((err) => logger.error({ err }, "failed to load scores"));

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  logger.warn("DISCORD_BOT_TOKEN missing — bot will not start.");
} else {
  startBot(token).catch((err) => {
    logger.error({ err }, "failed to start discord bot");
  });
}
