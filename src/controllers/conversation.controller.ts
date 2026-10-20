
import type { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { createDirectConversation, getUserConversations } from "../services/conversation.service.js";
import { getConversationMessages } from "../services/message.service.js";
import { createGroupConversation } from "../services/conversation.service.js";

export async function createDirectConversationController(
    req: Request,
    res: Response,
): Promise<void> {
    try {
        const firebaseUser = req.firebaseUser;

        if (!firebaseUser) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { participantUserId } = req.body as {
            participantUserId?: string;
        };

        if (
            typeof participantUserId !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(participantUserId)
        ) {
            res.status(400).json({
                message: "A valid participantUserId UUID is required",
            });
            return;
        }

        const currentUser = await prisma.user.findUnique({
            where: { firebaseUid: firebaseUser.uid },
            select: { id: true },
        });

        if (!currentUser) {
            res.status(404).json({
                message: "User not found. Synchronize your profile first.",
            });
            return;
        }

        const conversation = await createDirectConversation(
            currentUser.id,
            participantUserId,
        );

        res.status(200).json({
            success: true,
            data: conversation,
        });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === "Cannot create a conversation with yourself") {
                res.status(400).json({ message: error.message });
                return;
            }

            if (error.message === "One or both users were not found") {
                res.status(404).json({ message: error.message });
                return;
            }
        }

        console.error("Create conversation failed:", error);
        res.status(500).json({
            message: "Unable to create conversation",
        });
    }
}


export async function listConversations(
    req: Request,
    res: Response,
): Promise<void> {
    try {
        const firebaseUser = req.firebaseUser;

        if (!firebaseUser) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const pageValue = req.query.page ?? "1";
        const limitValue = req.query.limit ?? "10";

        const page = Number(pageValue);
        const limit = Number(limitValue);

        if (
            typeof pageValue !== "string" ||
            typeof limitValue !== "string" ||
            !Number.isInteger(page) ||
            !Number.isInteger(limit) ||
            page < 1 ||
            limit < 1 ||
            limit > 100
        ) {
            res.status(400).json({
                message: "page must be positive and limit must be between 1 and 100",
            });
            return;
        }

        const currentUser = await prisma.user.findUnique({
            where: { firebaseUid: firebaseUser.uid },
            select: { id: true },
        });

        if (!currentUser) {
            res.status(404).json({
                message: "User not found. Synchronize your profile first.",
            });
            return;
        }

        const result = await getUserConversations(
            currentUser.id,
            page,
            limit,
        );

        res.status(200).json({
            success: true,
            data: result.conversations,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error("List conversations failed:", error);

        res.status(500).json({
            message: "Unable to fetch conversations",
        });
    }
}

export async function getConversationMessagesController(
    req: Request,
    res: Response,
): Promise<void> {
    try {
        const firebaseUser = req.firebaseUser;

        if (!firebaseUser) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const conversationId = req.params.conversationId;
        const pageValue = req.query.page ?? "1";
        const limitValue = req.query.limit ?? "20";

        if (
            typeof conversationId !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)
        ) {
            res.status(400).json({ message: "Invalid conversation ID" });
            return;
        }

        const page = Number(pageValue);
        const limit = Number(limitValue);

        if (
            typeof pageValue !== "string" ||
            typeof limitValue !== "string" ||
            !Number.isInteger(page) ||
            !Number.isInteger(limit) ||
            page < 1 ||
            limit < 1 ||
            limit > 100
        ) {
            res.status(400).json({
                message: "Invalid pagination parameters",
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

        const result = await getConversationMessages(
            conversationId,
            user.id,
            page,
            limit,
        );

        res.status(200).json({
            success: true,
            data: result.messages,
            pagination: result.pagination,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "You are not a participant in this conversation"
        ) {
            res.status(403).json({ message: error.message });
            return;
        }

        console.error("Get messages failed:", error);
        res.status(500).json({
            message: "Unable to fetch messages",
        });
    }
}

export async function createGroupConversationController(
    req: Request,
    res: Response,
): Promise<void> {
    try {
        const firebaseUser = req.firebaseUser;

        if (!firebaseUser) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { name, participantIds } = req.body as {
            name?: unknown;
            participantIds?: unknown;
        };

        if (
            typeof name !== "string" ||
            !name.trim() ||
            name.trim().length > 100
        ) {
            res.status(400).json({
                message: "Group name must be between 1 and 100 characters",
            });
            return;
        }


        if (
            !Array.isArray(participantIds) ||
            !participantIds.every(
                (id): id is string =>
                    typeof id === "string" &&
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
            ) ||
            participantIds.length < 1 ||
            participantIds.length > 99
        ) {
            res.status(400).json({
                message: "Provide between 1 and 99 valid participant UUIDs",
            });
            return;
        }

        const currentUser = await prisma.user.findUnique({
            where: { firebaseUid: firebaseUser.uid },
            select: { id: true },
        });

        if (!currentUser) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const conversation = await createGroupConversation(
            currentUser.id,
            name.trim(),
            participantIds,
        );

        res.status(201).json({
            success: true,
            data: conversation,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "One or more users were not found"
        ) {
            res.status(404).json({ message: error.message });
            return;
        }

        console.error("Create group failed:", error);
        res.status(500).json({
            message: "Unable to create group conversation",
        });
    }
}