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
  private name: string;
  private conversationId: string | null = null;

  constructor(name = "VoxAgent") {
    this.name = name;
  }

  async startConversation(): Promise<string> {
    this.conversationId = await createConversation();
    return this.conversationId;
  }

  async chat(message: string): Promise<string> {
    if (!this.conversationId) {
      await this.startConversation();
    }

    const history = await getMessages(this.conversationId!);

    const response = await generateAIResponse(
      history,
      message
    );

    await saveMessage(
      this.conversationId!,
      "user",
      message
    );

    await saveMessage(
      this.conversationId!,
      "assistant",
      response
    );

    return response;
  }

  getConversationId(): string | null {
    return this.conversationId;
  }

  async getHistory(): Promise<AgentMessage[]> {
    if (!this.conversationId) {
      return [];
    }

    return getMessages(this.conversationId);
  }
}
