import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch"; // Only needed if Node < 18

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 8787;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error("ERROR: GITHUB_TOKEN missing in .env!");
  process.exit(1);
}

const ENDPOINT = "https://models.github.ai/inference";
const MODEL_NAME = "openai/gpt-4.1-mini";

// ✅ Store history per player (instead of one global array)
let chatHistories = {};

/**
 * Chat endpoint — Convai External API will call this
 */
app.post("/chat", async (req, res) => {
  try {
    const {
      playerId = "default",
      message,
      emotionType = "general",
      intensity = 5
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Initialize history if missing
    if (!chatHistories[playerId]) {
      chatHistories[playerId] = [];
    }

    // Add user message
    chatHistories[playerId].push({ role: "user", content: message });

    // Call GitHub Models API
    const response = await fetch(`${ENDPOINT}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: `The user feels ${emotionType} with intensity ${intensity}.` },
          ...chatHistories[playerId]
        ],
        temperature: 1.0,
        top_p: 1.0
      })
    });

    const data = await response.json();

    const aiText =
      data.choices?.[0]?.message?.content || "I couldn't generate a reply.";

    // Save AI reply to history
    chatHistories[playerId].push({ role: "assistant", content: aiText });

    res.json({ reply: aiText });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "AI Error", details: err.toString() });
  }
});

/**
 * Optional: clear chat history for a player
 */
app.post("/clear", (req, res) => {
  const { playerId = "default" } = req.body;
  chatHistories[playerId] = [];
  res.json({ status: `Chat history cleared for ${playerId}.` });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
