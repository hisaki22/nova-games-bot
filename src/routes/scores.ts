import { Router, type IRouter } from "express";
import { getGuildStats, getLeaderboard } from "../bot/scores.js";
import { readFile } from "fs/promises";
import path from "path";

const router: IRouter = Router();

function getAllGuildIds(): string[] {
  try {
    const store = (globalThis as any).__scoresStore;
    if (store) return Object.keys(store);
  } catch {}
  return [];
}

router.get("/leaderboard", async (req, res) => {
  try {
    const dataPath = path.join(process.cwd(), "data", "scores.json");
    const raw = await readFile(dataPath, "utf-8");
    const store = JSON.parse(raw) as Record<string, Record<string, any>>;

    const merged: Record<string, any> = {};
    for (const guild of Object.values(store)) {
      for (const [userId, record] of Object.entries(guild)) {
        if (!merged[userId] || merged[userId].points < record.points) {
          merged[userId] = { ...record };
        } else {
          merged[userId].points += record.points;
          merged[userId].scrambleWins += record.scrambleWins ?? 0;
          merged[userId].scrambleCorrect += record.scrambleCorrect ?? 0;
          merged[userId].imposterPoints += record.imposterPoints ?? 0;
          merged[userId].searchWins += record.searchWins ?? 0;
          merged[userId].rouletteWins += record.rouletteWins ?? 0;
        }
      }
    }

    const leaderboard = Object.values(merged)
      .filter((r: any) => r.points > 0)
      .sort((a: any, b: any) => b.points - a.points)
      .slice(0, 20);

    res.json({ leaderboard });
  } catch {
    res.json({ leaderboard: [] });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const dataPath = path.join(process.cwd(), "data", "scores.json");
    const raw = await readFile(dataPath, "utf-8");
    const store = JSON.parse(raw) as Record<string, Record<string, any>>;

    let totalPlayers = 0;
    let totalPoints = 0;
    const gameCounts = { imposter: 0, scramble: 0, search: 0, roulette: 0 };
    const seen = new Set<string>();

    for (const guild of Object.values(store)) {
      for (const record of Object.values(guild) as any[]) {
        if (!seen.has(record.userId)) {
          seen.add(record.userId);
          totalPlayers++;
        }
        totalPoints += record.points ?? 0;
        gameCounts.imposter += record.imposterPoints > 0 ? 1 : 0;
        gameCounts.scramble += record.scrambleWins ?? 0;
        gameCounts.search += record.searchWins ?? 0;
        gameCounts.roulette += record.rouletteWins ?? 0;
      }
    }

    const topGameEntry = (Object.entries(gameCounts) as [string, number][])
      .sort((a, b) => b[1] - a[1])[0];
    const gameNames: Record<string, string> = {
      imposter: "الإمبوستر",
      scramble: "الحروف",
      search: "البحث",
      roulette: "الروليت",
    };
    const topGame =
      topGameEntry && topGameEntry[1] > 0
        ? (gameNames[topGameEntry[0]] ?? "—")
        : "—";

    res.json({ totalPlayers, totalPoints, topGame, gameCounts, totalGuilds: Object.keys(store).length });
  } catch {
    res.json({ totalPlayers: 0, totalPoints: 0, topGame: "—", gameCounts: { imposter: 0, scramble: 0, search: 0, roulette: 0 }, totalGuilds: 0 });
  }
});

export default router;
