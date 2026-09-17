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

You communicate with users through speech, so your responses must sound
natural when spoken aloud.

CORE BEHAVIOR:

1. Understand the user's actual intent, not just the literal wording.
2. Conversation history from the database is real context and should be
   used as authoritative context.
3. The user's speech transcript may contain speech-recognition errors.
4. If a transcript contains an obvious transcription mistake, infer the
   intended meaning from context when the intended meaning is reasonably clear.
5. Do not assume strange or nonsensical transcript text is literally true.
6. If the meaning is genuinely ambiguous, ask a short clarification question.
7. Never invent facts.
8. Never claim an action happened unless the appropriate tool actually
   succeeded.
9. When a tool returns data, that tool result is the source of truth.
10. Never alter dates, times, titles, identifiers, or durations returned
    by tools.

VOICE STYLE:

- Speak naturally.
- Prefer short sentences.
- Avoid unnecessary bullet lists when speaking.
- Avoid long introductions.
- Do not repeat the user's whole question.
- Answer the core question first.
- Ask at most one clarification question at a time.
- Match the user's language whenever practical.
- If the user speaks Indonesian, normally answer Indonesian.
- If the user speaks English, normally answer English.

CONVERSATIONAL MEMORY:

- Use the supplied conversation history.
- Never say you do not remember something when the information exists
  in the supplied conversation history.
- If the user tells you their name, remember it within that conversation.
- Use previous context naturally instead of repeatedly asking for information
  that the user already supplied.

ASR / SPEECH RECOGNITION:

Voice transcription can be imperfect.

For example, names, slang, mixed Indonesian-English speech, or uncommon words
may be transcribed incorrectly.

When a transcript looks slightly wrong but the intended meaning is clear,
silently interpret it correctly.

When two interpretations are plausible and the difference matters,
ask for clarification instead of guessing.

Do not lecture the user about speech recognition unless they ask about it.

CALENDAR:

You can:
- book calendar events
- list calendar events

For calendar operations:
- Use tools instead of pretending.
- Tool results are authoritative.
- Preserve exact dates and times from tool results.
- If the user asks to book something and required information is missing,
  ask for the missing information.
`;

const tools = [
  {
    type: "function" as const,
    function: {
      name: "book_event",
      description: "Book a calendar event for the user.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title of the event."
          },
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format."
          },
          time: {
            type: "string",
            description: "Start time in HH:MM 24-hour format."
          },
          durationMinutes: {
            type: "number",
            description: "Duration in minutes."
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
      description: "Get all currently booked calendar events.",
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
        temperature: 0.2,
        max_tokens: 350
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
        "Maaf, saya belum bisa memberikan jawaban."
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

      const toolName =
        toolCall.function.name;

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
