import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Octokit } from "octokit";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '10mb' }));

  // API endpoint to push changes to GitHub
  app.post("/api/github/push", async (req, res) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "الرجاء إضافة GITHUB_TOKEN في إعدادات Secrets أولاً." });
    }

    const octokit = new Octokit({ auth: token });
    let { owner, repo, path: filePath, content, message } = req.body;

    // Default to pushing the dashboard itself if no content provided
    if (!content) {
      try {
        const absolutePath = path.join(process.cwd(), "src/App.tsx");
        const fs = await import("fs/promises");
        content = await fs.readFile(absolutePath, "utf-8");
        filePath = filePath || "src/Dashboard.tsx"; // Save as Dashboard.tsx in the target repo
      } catch (e) {
        return res.status(500).json({ error: "تعذر قراءة ملف الواجهة الراهن." });
      }
    }

    try {
      // Get current file SHA if exists
      let sha: string | undefined;
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: filePath,
        });
        if (!Array.isArray(data)) {
          sha = data.sha;
        }
      } catch (e) {
        // File doesn't exist yet, that's fine
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filePath,
        message: message || "Update from Nova Dashboard",
        content: Buffer.from(content).toString("base64"),
        sha,
      });

      res.json({ success: true, message: "تم الرفع بنجاح!" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "فشل الرفع إلى GitHub" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
