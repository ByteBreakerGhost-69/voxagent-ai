import { generateAIResponse } from "./llm";
import {
  createConversation,
  getMessages,
  saveMessage,
} from "../db/memory";

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export class VoxAgent {
  async startConversation(): Promise<string> {
    return createConversation();
  }

  async chat(
    conversationId: string,
    message: string
  ): Promise<string> {
    if (!conversationId) {
      throw new Error("conversationId is required");
    }

    const history = await getMessages(conversationId);

    const response = await generateAIResponse(
      history,
      message
    );

    await saveMessage(
      conversationId,
      "user",
      message
    );

    await saveMessage(
      conversationId,
      "assistant",
      response
    );

    return response;
  }

  async getHistory(
    conversationId: string
  ): Promise<AgentMessage[]> {
    if (!conversationId) {
      return [];
    }

    return getMessages(conversationId);
  }
}
