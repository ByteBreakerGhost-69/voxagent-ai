import { pool } from "./client";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function createConversation(): Promise<string> {
  const result = await pool.query(
    `INSERT INTO conversations DEFAULT VALUES RETURNING id`
  );

  return result.rows[0].id;
}

export async function saveMessage(
  conversationId: string,
  role: Message["role"],
  content: string
): Promise<void> {
  await pool.query(
    `
      INSERT INTO messages (conversation_id, role, content)
      VALUES ($1, $2, $3)
    `,
    [conversationId, role, content]
  );
}

export async function getMessages(
  conversationId: string
): Promise<Message[]> {
  const result = await pool.query(
    `
      SELECT role, content
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
    `,
    [conversationId]
  );

  return result.rows.map((row) => ({
    role: row.role as Message["role"],
    content: row.content,
  }));
}
