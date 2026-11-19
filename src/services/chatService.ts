import { pool } from "../db";
import { HttpError } from "../errors";

export interface ChatSummary {
  chatId: string;
  type: "direct" | "group";
  memberIds: string[];
  createdAt: string;
}

interface ChatRow {
  id: string;
  type: "direct" | "group";
  created_at: Date;
  member_ids: string[];
}

export async function createOrGetChat(
  userAId: string,
  userBId: string,
): Promise<{ chatId: string; created: boolean }> {
  if (userAId === userBId) {
    throw new HttpError(400, "Cannot create a chat with yourself");
  }

  const directKey = [userAId, userBId].sort().join(":");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const users = await client.query<{ id: string }>(
      `SELECT id
         FROM users
        WHERE id = ANY($1::uuid[])`,
      [[userAId, userBId]],
    );

    if (users.rowCount !== 2) {
      throw new HttpError(404, "One or both users not found");
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO chats (type, direct_key)
       VALUES ('direct', $1)
       ON CONFLICT (direct_key) DO NOTHING
       RETURNING id`,
      [directKey],
    );

    const newChat = inserted.rows[0];

    if (newChat) {
      await client.query(
        `INSERT INTO chat_members (chat_id, user_id)
         VALUES ($1, $2), ($1, $3)`,
        [newChat.id, userAId, userBId],
      );

      await client.query("COMMIT");

      return {
        chatId: newChat.id,
        created: true,
      };
    }

    const existing = await client.query<{ id: string }>(
      `SELECT id
         FROM chats
        WHERE direct_key = $1`,
      [directKey],
    );

    const existingChat = existing.rows[0];

    if (!existingChat) {
      throw new HttpError(500, "Chat lookup failed");
    }

    await client.query("COMMIT");

    return {
      chatId: existingChat.id,
      created: false,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function assertMember(
  chatId: string,
  userId: string,
): Promise<void> {
  const result = await pool.query<{ is_member: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM chat_members
        WHERE chat_id = $1
          AND user_id = $2
     ) AS is_member
       FROM chats
      WHERE id = $1`,
    [chatId, userId],
  );

  const row = result.rows[0];

  if (!row) {
    throw new HttpError(404, "Chat not found");
  }

  if (!row.is_member) {
    throw new HttpError(403, "User is not a member of this chat");
  }
}

export async function assertChatExists(chatId: string): Promise<void> {
  const result = await pool.query(
    `SELECT 1
       FROM chats
      WHERE id = $1`,
    [chatId],
  );

  if (result.rowCount === 0) {
    throw new HttpError(404, "Chat not found");
  }
}

export async function listUserChats(userId: string): Promise<ChatSummary[]> {
  const user = await pool.query(
    `SELECT 1
       FROM users
      WHERE id = $1`,
    [userId],
  );

  if (user.rowCount === 0) {
    throw new HttpError(404, "User not found");
  }

  const result = await pool.query<ChatRow>(
    `SELECT
        c.id,
        c.type,
        c.created_at,
        array_agg(m2.user_id ORDER BY m2.user_id) AS member_ids
       FROM chat_members m
       JOIN chats c
         ON c.id = m.chat_id
       JOIN chat_members m2
         ON m2.chat_id = c.id
      WHERE m.user_id = $1
      GROUP BY c.id, c.type, c.created_at
      ORDER BY c.created_at DESC, c.id DESC`,
    [userId],
  );

  return result.rows.map((chat) => ({
    chatId: chat.id,
    type: chat.type,
    memberIds: chat.member_ids,
    createdAt: chat.created_at.toISOString(),
  }));
}
