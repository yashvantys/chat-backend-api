
import { prisma } from "../config/database.js";
import { MessageType } from "../generated/prisma/client.js";

interface SendMessageInput {
    conversationId: string;
    senderId: string;
    content: string;
}

export async function sendMessage(input: SendMessageInput) {
    const content = input.content.trim();

    if (!content) {
        throw new Error("Message content cannot be empty");
    }

    return prisma.$transaction(async (tx) => {
        const participant = await tx.conversationParticipant.findUnique({
            where: {
                userId_conversationId: {
                    userId: input.senderId,
                    conversationId: input.conversationId,
                },
            },
            select: { id: true },
        });

        if (!participant) {
            throw new Error("You are not a participant in this conversation");
        }

        const message = await tx.message.create({
            data: {
                conversationId: input.conversationId,
                senderId: input.senderId,
                content,
                type: MessageType.TEXT,
            },
            select: {
                id: true,
                conversationId: true,
                senderId: true,
                content: true,
                type: true,
                createdAt: true,
            },
        });

        await tx.conversation.update({
            where: { id: input.conversationId },
            data: { updatedAt: new Date() },
        });

        return message;
    });
}

export async function getConversationMessages(
    conversationId: string,
    userId: string,
    page: number,
    limit: number,
) {
    return prisma.$transaction(async (tx) => {
        const participant = await tx.conversationParticipant.findUnique({
            where: {
                userId_conversationId: {
                    userId,
                    conversationId,
                },
            },
            select: { id: true },
        });

        if (!participant) {
            throw new Error("You are not a participant in this conversation");
        }

        const [messages, total] = await Promise.all([
            tx.message.findMany({
                where: { conversationId },
                orderBy: [
                    { createdAt: "desc" },
                    { id: "desc" },
                ],
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true,
                    conversationId: true,
                    senderId: true,
                    content: true,
                    type: true,
                    createdAt: true,
                    sender: {
                        select: {
                            id: true,
                            displayName: true,
                            photoUrl: true,
                        },
                    },
                },
            }),
            tx.message.count({
                where: { conversationId },
            }),
        ]);

        return {
            messages,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    });
}

interface EditMessageInput {
    conversationId: string;
    messageId: string;
    userId: string;
    content: string;
}

export async function editMessage(input: EditMessageInput) {
    const content = input.content.trim();

    if (!content || content.length > 5000) {
        throw new Error("Message content must be between 1 and 5000 characters");
    }

    return prisma.$transaction(async (tx) => {
        const participant = await tx.conversationParticipant.findUnique({
            where: {
                userId_conversationId: {
                    userId: input.userId,
                    conversationId: input.conversationId,
                },
            },
            select: { id: true },
        });

        if (!participant) {
            throw new Error("Conversation access denied");
        }

        const message = await tx.message.findFirst({
            where: {
                id: input.messageId,
                conversationId: input.conversationId,
                senderId: input.userId,
                deletedAt: null,
            },
            select: { id: true, type: true },
        });

        if (!message) {
            throw new Error("Message not found or cannot be edited");
        }

        if (message.type !== "TEXT") {
            throw new Error("Only text messages can be edited");
        }

        return tx.message.update({
            where: { id: message.id },
            data: {
                content,
                editedAt: new Date(),
            },
            select: {
                id: true,
                conversationId: true,
                senderId: true,
                content: true,
                type: true,
                createdAt: true,
                updatedAt: true,
                editedAt: true,
            },
        });
    });
}

export async function deleteMessage(
    conversationId: string,
    messageId: string,
    userId: string,
) {
    return prisma.$transaction(async (tx) => {
        const participant = await tx.conversationParticipant.findUnique({
            where: {
                userId_conversationId: {
                    userId,
                    conversationId,
                },
            },
            select: { id: true },
        });

        if (!participant) {
            throw new Error("Conversation access denied");
        }

        const message = await tx.message.findFirst({
            where: {
                id: messageId,
                conversationId,
                senderId: userId,
                deletedAt: null,
            },
            select: { id: true },
        });

        if (!message) {
            throw new Error("Message not found or cannot be deleted");
        }

        return tx.message.update({
            where: { id: message.id },
            data: {
                content: "This message was deleted",
                deletedAt: new Date(),
            },
            select: {
                id: true,
                conversationId: true,
                senderId: true,
                content: true,
                deletedAt: true,
            },
        });
    });
}