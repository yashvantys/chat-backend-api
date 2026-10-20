
import type { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { sendMessage } from "../services/message.service.js";
import {
    editMessage,
    deleteMessage,
} from "../services/message.service.js";

export async function sendMessageController(
    req: Request,
    res: Response,
): Promise<void> {
    try {
        const firebaseUser = req.firebaseUser;

        if (!firebaseUser) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { conversationId } = req.params;
        const { content } = req.body as { content?: unknown };

        if (
            typeof conversationId !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)
        ) {
            res.status(400).json({ message: "Invalid conversation ID" });
            return;
        }

        if (
            typeof content !== "string" ||
            !content.trim() ||
            content.trim().length > 5000
        ) {
            res.status(400).json({
                message: "Message content must be between 1 and 5000 characters",
            });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { firebaseUid: firebaseUser.uid },
            select: { id: true },
        });

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const message = await sendMessage({
            conversationId,
            senderId: user.id,
            content,
        });

        res.status(201).json({
            success: true,
            data: message,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "You are not a participant in this conversation"
        ) {
            res.status(403).json({ message: error.message });
            return;
        }

        if (
            error instanceof Error &&
            error.message === "Message content cannot be empty"
        ) {
            res.status(400).json({ message: error.message });
            return;
        }

        console.error("Send message failed:", error);
        res.status(500).json({ message: "Unable to send message" });
    }
}


export async function editMessageController(
    req: Request,
    res: Response,
): Promise<void> {
    try {
        const firebaseUser = req.firebaseUser;

        if (!firebaseUser) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { conversationId, messageId } = req.params;
        const { content } = req.body as { content?: unknown };

        const uuidPattern =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (
            typeof conversationId !== "string" ||
            !uuidPattern.test(conversationId) ||
            typeof messageId !== "string" ||
            !uuidPattern.test(messageId)
        ) {
            res.status(400).json({ message: "Invalid conversation or message ID" });
            return;
        }

        if (
            typeof content !== "string" ||
            !content.trim() ||
            content.trim().length > 5000
        ) {
            res.status(400).json({
                message: "Message content must be between 1 and 5000 characters",
            });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { firebaseUid: firebaseUser.uid },
            select: { id: true },
        });

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const message = await editMessage({
            conversationId,
            messageId,
            userId: user.id,
            content,
        });

        res.status(200).json({ success: true, data: message });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === "Conversation access denied") {
                res.status(403).json({ message: error.message });
                return;
            }

            if (
                error.message === "Message not found or cannot be edited" ||
                error.message === "Only text messages can be edited"
            ) {
                res.status(404).json({ message: error.message });
                return;
            }
        }

        console.error("Edit message failed:", error);
        res.status(500).json({ message: "Unable to edit message" });
    }
}

export async function deleteMessageController(
    req: Request,
    res: Response,
): Promise<void> {
    try {
        const firebaseUser = req.firebaseUser;

        if (!firebaseUser) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { conversationId, messageId } = req.params;

        const uuidPattern =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (
            typeof conversationId !== "string" ||
            !uuidPattern.test(conversationId) ||
            typeof messageId !== "string" ||
            !uuidPattern.test(messageId)
        ) {
            res.status(400).json({ message: "Invalid conversation or message ID" });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { firebaseUid: firebaseUser.uid },
            select: { id: true },
        });

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const message = await deleteMessage(
            conversationId,
            messageId,
            user.id,
        );

        res.status(200).json({ success: true, data: message });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === "Conversation access denied") {
                res.status(403).json({ message: error.message });
                return;
            }

            if (error.message === "Message not found or cannot be deleted") {
                res.status(404).json({ message: error.message });
                return;
            }
        }

        console.error("Delete message failed:", error);
        res.status(500).json({ message: "Unable to delete message" });
    }
}