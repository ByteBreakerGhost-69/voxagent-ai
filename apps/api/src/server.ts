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
app.use(express.static("apps/api/public"));

app.get("/", (_req, res) => {
  res.json({
    name: "VoxAgent AI",
    version: "0.1.0",
    status: "online",
    message: "AI Voice Agent backend is running."
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// Create a new conversation session
app.post("/api/agent/session", async (_req, res) => {
  try {
    const conversationId =
      await agent.startConversation();

    return res.json({
      conversationId
    });
  } catch (error) {
    console.error(
      "Session error:",
      error
    );

    return res.status(500).json({
      error: "Failed to create agent session"
    });
  }
});

// Send a message to a specific conversation
app.post("/api/agent/chat", async (req, res) => {
  try {
    const {
      message,
      conversationId
    } = req.body;

    if (
      !message ||
      typeof message !== "string"
    ) {
      return res.status(400).json({
        error: "message is required"
      });
    }

    if (
      !conversationId ||
      typeof conversationId !== "string"
    ) {
      return res.status(400).json({
        error: "conversationId is required"
      });
    }

    const response =
      await agent.chat(
        conversationId,
        message
      );

    return res.json({
      conversationId,
      response
    });

  } catch (error) {
    console.error(
      "Agent error:",
      error
    );

    return res.status(500).json({
      error: "Agent failed to process the message",
      details:
        error instanceof Error
          ? error.message
          : String(error)
    });
  }
});

// Get history for a specific conversation
app.get(
  "/api/agent/history/:conversationId",
  async (req, res) => {
    try {
      const {
        conversationId
      } = req.params;

      const history =
        await agent.getHistory(
          conversationId
        );

      return res.json({
        conversationId,
        history
      });

    } catch (error) {
      console.error(
        "History error:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to load conversation history"
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(
    `🚀 VoxAgent API running on http://localhost:${PORT}`
  );
});
