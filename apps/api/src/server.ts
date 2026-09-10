import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { VoxAgent } from "./agents/agent";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const agent = new VoxAgent();

app.use(cors());
app.use(express.json());

app.get("/api/agent/history", async (_req, res) => {
  try {
    const history = await agent.getHistory();

    return res.json({
      conversationId: agent.getConversationId(),
      history
    });
  } catch (error) {
    console.error("History error:", error);

    return res.status(500).json({
      error: "Failed to load conversation history"
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// AI Agent Chat
app.post("/api/agent/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "message is required"
      });
    }

    const response = await agent.chat(message);

    return res.json({
      response
    });
    } catch (error) {
      console.error("========== AGENT ERROR ==========");
      console.error(error);
      console.error("=================================");

      return res.status(500).json({
        error: "Agent failed to process the message",
        details:
          error instanceof Error
            ? error.message
            : String(error)
      });
    }
});

// Conversation history
app.get("/api/agent/history", (_req, res) => {
  res.json({
    history: agent.getHistory()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 VoxAgent API running on http://localhost:${PORT}`);
});
