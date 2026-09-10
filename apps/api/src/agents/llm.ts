import "dotenv/config";
import OpenAI from "openai";
import { bookEvent, getEvents } from "../tools/calendar";

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey || apiKey.trim() === "") {
  throw new Error("OPENROUTER_API_KEY is not configured");
}

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "VoxAgent AI"
  }
});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `
You are VoxAgent, a professional AI voice call agent.

Your goals:
- Understand the caller's intent.
- Respond naturally and clearly.
- Keep spoken responses concise.
- Ask questions when important information is missing.
- Never invent facts.
- Use tools when they are appropriate.
- You are an AI assistant, not a human.

Available capabilities:
- Book calendar events.
- List calendar events.

CRITICAL TOOL RULES:
- Tool results are the source of truth.
- Never change, reinterpret, or invent dates, times, titles, or durations returned by a tool.
- When reporting a calendar event, preserve the exact date and time returned by the tool.
- If a tool provides a date such as 2026-09-11, report 2026-09-11, not another date.
- If information is missing, say that it is missing instead of guessing.
`;

const tools = [
  {
    type: "function" as const,
    function: {
      name: "book_event",
      description:
        "Book a calendar event for the user.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title of the event."
          },
          date: {
            type: "string",
            description:
              "Date of the event in YYYY-MM-DD format."
          },
          time: {
            type: "string",
            description:
              "Start time in HH:MM 24-hour format."
          },
          durationMinutes: {
            type: "number",
            description:
              "Duration of the event in minutes."
          }
        },
        required: [
          "title",
          "date",
          "time"
        ]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_events",
      description:
        "Get all currently booked calendar events.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  }
];

async function executeTool(
  toolName: string,
  args: Record<string, unknown>
) {
  switch (toolName) {
    case "book_event":
      return await bookEvent(
        String(args.title),
        String(args.date),
        String(args.time),
        Number(args.durationMinutes ?? 60)
      );

    case "get_events":
      return await getEvents();

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}


export async function generateAIResponse(
  history: ChatMessage[],
  message: string
): Promise<string> {
  const messages: any[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT
    },
    ...history.map((item) => ({
      role: item.role,
      content: item.content
    })),
    {
      role: "user",
      content: message
    }
  ];

  for (let iteration = 0; iteration < 5; iteration++) {
    const response =
      await client.chat.completions.create({
        model: "openrouter/free",
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.3,
        max_tokens: 400
      });

    const assistantMessage =
      response.choices[0]?.message;

    if (!assistantMessage) {
      throw new Error(
        "Model returned an empty response"
      );
    }

    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      return (
        assistantMessage.content?.trim() ||
        "I'm sorry, I couldn't generate a response."
      );
    }

    messages.push({
      role: "assistant",
      content: assistantMessage.content ?? null,
      tool_calls: assistantMessage.tool_calls
    });

    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.type !== "function") {
        continue;
      }

      const toolName = toolCall.function.name;

      let args: Record<string, unknown>;

      try {
        args = JSON.parse(
          toolCall.function.arguments || "{}"
        );
      } catch {
        throw new Error(
          `Invalid arguments for tool ${toolName}`
        );
      }

      console.log(
        `🔧 Tool call: ${toolName}`,
        args
      );

      const result = await executeTool(
        toolName,
        args
      );

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }
  }

  throw new Error(
    "Maximum tool-calling iterations reached"
  );
}
