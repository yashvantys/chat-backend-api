import {
  FieldPath,
  FieldValue,
  Timestamp,
  type DocumentData,
  type DocumentSnapshot,
} from "firebase-admin/firestore";

import { firestore } from "../firebase";
import { HttpError } from "../errors";
import { assertMember } from "./chatService";

const messagesCol = (chatId: string) =>
  firestore.collection("chats").doc(chatId).collection("messages");

const memberDoc = (chatId: string, userId: string) =>
  firestore.collection("chats").doc(chatId).collection("members").doc(userId);

const MAX_MESSAGE_LENGTH = 5000;
const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 100;

export interface MessageDto {
  id: string;
  chatId: string;
  senderId: string;
  text: string | null;
  createdAt: string | null;
  editedAt: string | null;
  deleted: boolean;
  readBy: Record<string, string>;
}

const iso = (value: unknown): string | null => {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
};

function validateMessageText(text: string): string {
  const normalized = text.trim();

  if (!normalized) {
    throw new HttpError(400, "Message text cannot be empty");
  }

  if (normalized.length > MAX_MESSAGE_LENGTH) {
    throw new HttpError(
      400,
      `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
    );
  }

  return normalized;
}

function toDto(chatId: string, snap: DocumentSnapshot): MessageDto {
  const data = snap.data() ?? {};

  const readByRaw = (data.readBy ?? {}) as Record<string, unknown>;
  const readBy: Record<string, string> = {};

  for (const [userId, timestamp] of Object.entries(readByRaw)) {
    const value = iso(timestamp);

    if (value) {
      readBy[userId] = value;
    }
  }

  const deleted = data.deleted === true;

  return {
    id: snap.id,
    chatId,
    senderId: String(data.senderId ?? ""),
    text: deleted ? null : String(data.text ?? ""),
    createdAt: iso(data.createdAt),
    editedAt: iso(data.editedAt),
    deleted,
    readBy,
  };
}

async function getMessageOr404(
  chatId: string,
  messageId: string,
): Promise<DocumentSnapshot> {
  const snap = await messagesCol(chatId).doc(messageId).get();

  if (!snap.exists) {
    throw new HttpError(404, "Message not found");
  }

  return snap;
}

export async function sendMessage(
  chatId: string,
  senderId: string,
  text: string,
): Promise<MessageDto> {
  await assertMember(chatId, senderId);

  const normalizedText = validateMessageText(text);
  const ref = messagesCol(chatId).doc();

  await ref.set({
    senderId,
    text: normalizedText,
    createdAt: FieldValue.serverTimestamp(),
    editedAt: null,
    deleted: false,
    readBy: {},
  });

  const savedMessage = await ref.get();

  return toDto(chatId, savedMessage);
}

export async function getMessages(
  chatId: string,
  userId: string,
  limit = DEFAULT_MESSAGE_LIMIT,
  before?: string,
): Promise<MessageDto[]> {
  await assertMember(chatId, userId);

  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.floor(limit), 1), MAX_MESSAGE_LIMIT)
    : DEFAULT_MESSAGE_LIMIT;

  let query = messagesCol(chatId)
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");

  if (before) {
    const beforeDate = new Date(before);

    if (Number.isNaN(beforeDate.getTime())) {
      throw new HttpError(400, "Invalid before timestamp");
    }

    query = query.where("createdAt", "<", Timestamp.fromDate(beforeDate));
  }

  const snapshot = await query.limit(safeLimit).get();

  return snapshot.docs.map((doc) => toDto(chatId, doc)).reverse();
}

export async function markRead(
  chatId: string,
  messageId: string,
  userId: string,
): Promise<MessageDto> {
  await assertMember(chatId, userId);

  const ref = messagesCol(chatId).doc(messageId);

  await firestore.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);

    if (!snap.exists) {
      throw new HttpError(404, "Message not found");
    }

    const data = snap.data() as DocumentData;

    if (data.senderId === userId) {
      throw new HttpError(400, "Cannot mark your own message as read");
    }

    if (data.deleted === true) {
      throw new HttpError(409, "Cannot mark a deleted message as read");
    }

    const readBy = (data.readBy ?? {}) as Record<string, unknown>;

    if (readBy[userId] === undefined) {
      transaction.update(ref, {
        [`readBy.${userId}`]: FieldValue.serverTimestamp(),
      });
    }
  });

  const updated = await ref.get();

  return toDto(chatId, updated);
}

export async function updateLastSeen(
  chatId: string,
  userId: string,
  messageId: string,
): Promise<{ userId: string; lastSeenMessageId: string }> {
  await assertMember(chatId, userId);

  const msgRef = messagesCol(chatId).doc(messageId);
  const memRef = memberDoc(chatId, userId);

  return firestore.runTransaction(async (transaction) => {
    const [messageSnap, memberSnap] = await Promise.all([
      transaction.get(msgRef),
      transaction.get(memRef),
    ]);

    if (!messageSnap.exists) {
      throw new HttpError(404, "Message not found");
    }

    const messageData = messageSnap.data() as DocumentData;
    const messageAt = messageData.createdAt;

    if (!(messageAt instanceof Timestamp)) {
      throw new HttpError(500, "Message timestamp is invalid");
    }

    const memberData = memberSnap.data() as DocumentData | undefined;
    const currentAt = memberData?.lastSeenMessageAt;

    if (
      currentAt instanceof Timestamp &&
      currentAt.toMillis() >= messageAt.toMillis()
    ) {
      return {
        userId,
        lastSeenMessageId: String(memberData?.lastSeenMessageId ?? ""),
      };
    }

    transaction.set(
      memRef,
      {
        lastSeenMessageId: messageId,
        lastSeenMessageAt: messageAt,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return {
      userId,
      lastSeenMessageId: messageId,
    };
  });
}

export async function editMessage(
  chatId: string,
  messageId: string,
  senderId: string,
  text: string,
): Promise<MessageDto> {
  await assertMember(chatId, senderId);

  const normalizedText = validateMessageText(text);
  const ref = messagesCol(chatId).doc(messageId);

  await firestore.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);

    if (!snap.exists) {
      throw new HttpError(404, "Message not found");
    }

    const data = snap.data() as DocumentData;

    if (data.senderId !== senderId) {
      throw new HttpError(403, "Only the sender can edit a message");
    }

    if (data.deleted === true) {
      throw new HttpError(409, "Message was deleted");
    }

    transaction.update(ref, {
      text: normalizedText,
      editedAt: FieldValue.serverTimestamp(),
    });
  });

  return toDto(chatId, await ref.get());
}

export async function deleteMessage(
  chatId: string,
  messageId: string,
  senderId: string,
): Promise<void> {
  await assertMember(chatId, senderId);

  const ref = messagesCol(chatId).doc(messageId);

  await firestore.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);

    if (!snap.exists) {
      throw new HttpError(404, "Message not found");
    }

    const data = snap.data() as DocumentData;

    if (data.senderId !== senderId) {
      throw new HttpError(403, "Only the sender can delete a message");
    }

    if (data.deleted === true) {
      return;
    }

    transaction.update(ref, {
      deleted: true,
      text: FieldValue.delete(),
      deletedAt: FieldValue.serverTimestamp(),
    });
  });
}
