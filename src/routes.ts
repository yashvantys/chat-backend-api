import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import { createOrGetChat, listUserChats } from "./services/chatService.js";
import {
  deleteMessage,
  editMessage,
  getMessages,
  markRead,
  sendMessage,
  updateLastSeen,
} from "./services/messageService.js";

const id = z.string().uuid();
const messageIdSchema = z.string().min(1);
const messageText = z.string().trim().min(1).max(4000);
const chatParamsSchema = z.object({
  chatId: id,
});

const messageParamsSchema = z.object({
  chatId: id,
  messageId: messageIdSchema,
});

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export const router = Router();

router.post(
  "/chat/create",
  wrap(async (req, res) => {
    const { userAId, userBId } = z
      .object({
        userAId: id,
        userBId: id,
      })
      .parse(req.body);

    const result = await createOrGetChat(userAId, userBId);

    res.status(result.created ? 201 : 200).json({
      chatId: result.chatId,
      created: result.created,
    });
  }),
);

router.post(
  "/chat/:chatId/message/send",
  wrap(async (req, res) => {
    const { chatId } = chatParamsSchema.parse(req.params);

    const { senderId, text } = z
      .object({
        senderId: id,
        text: messageText,
      })
      .parse(req.body);

    const message = await sendMessage(chatId, senderId, text);

    res.status(201).json(message);
  }),
);

router.get(
  "/chat/:chatId/messages",
  wrap(async (req, res) => {
    const { chatId } = chatParamsSchema.parse(req.params);

    const { userId, limit, before } = z
      .object({
        userId: id,
        limit: z.coerce.number().int().min(1).max(100).default(50),
        before: z.string().datetime().optional(),
      })
      .parse(req.query);

    const messages = await getMessages(chatId, userId, limit, before);

    res.status(200).json({
      messages,
      count: messages.length,
    });
  }),
);

router.post(
  "/chat/:chatId/message/:messageId/read",
  wrap(async (req, res) => {
    const { chatId, messageId } = messageParamsSchema.parse(req.params);

    const { userId } = z
      .object({
        userId: id,
      })
      .parse(req.body);

    const message = await markRead(chatId, messageId, userId);

    res.status(200).json(message);
  }),
);

router.post(
  "/chat/:chatId/lastseen",
  wrap(async (req, res) => {
    const { chatId } = chatParamsSchema.parse(req.params);

    const { userId, messageId } = z
      .object({
        userId: id,
        messageId: messageIdSchema,
      })
      .parse(req.body);

    const result = await updateLastSeen(chatId, userId, messageId);

    res.status(200).json(result);
  }),
);

router.get(
  "/user/:userId/chats",
  wrap(async (req, res) => {
    const { userId } = z
      .object({
        userId: id,
      })
      .parse(req.params);

    const chats = await listUserChats(userId);

    res.status(200).json({
      chats,
      count: chats.length,
    });
  }),
);

router.patch(
  "/chat/:chatId/message/:messageId",
  wrap(async (req, res) => {
    const { chatId, messageId } = messageParamsSchema.parse(req.params);

    const { senderId, text } = z
      .object({
        senderId: id,
        text: messageText,
      })
      .parse(req.body);

    const message = await editMessage(chatId, messageId, senderId, text);

    res.status(200).json(message);
  }),
);

router.delete(
  "/chat/:chatId/message/:messageId",
  wrap(async (req, res) => {
    const { chatId, messageId } = messageParamsSchema.parse(req.params);

    const { senderId } = z
      .object({
        senderId: id,
      })
      .parse(req.query);

    await deleteMessage(chatId, messageId, senderId);

    res.status(204).end();
  }),
);
