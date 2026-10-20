
import { ConversationType } from "../generated/prisma/client.js";
import { prisma } from "../config/database.js";

export async function createDirectConversation(
    currentUserId: string,
    participantUserId: string,
) {
    if (currentUserId === participantUserId) {
        throw new Error("Cannot create a conversation with yourself");
    }

    return prisma.$transaction(async (tx) => {
        const users = await tx.user.findMany({
            where: {
                id: { in: [currentUserId, participantUserId] },
            },
            select: { id: true },
        });

        if (users.length !== 2) {
            throw new Error("One or both users were not found");
        }

        const existing = await tx.conversation.findFirst({
            where: {
                type: ConversationType.DIRECT,
                AND: [
                    {
                        participants: {
                            some: { userId: currentUserId },
                        },
                    },
                    {
                        participants: {
                            some: { userId: participantUserId },
                        },
                    },
                    {
                        participants: {
                            every: {
                                userId: {
                                    in: [currentUserId, participantUserId],
                                },
                            },
                        },
                    },
                ],
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                displayName: true,
                                photoUrl: true,
                            },
                        },
                    },
                },
            },
        });

        if (existing) {
            return existing;
        }

        return tx.conversation.create({
            data: {
                type: ConversationType.DIRECT,
                participants: {
                    create: [
                        { userId: currentUserId },
                        { userId: participantUserId },
                    ],
                },
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                displayName: true,
                                photoUrl: true,
                            },
                        },
                    },
                },
            },
        });
    });
}


export async function getUserConversations(
    userId: string,
    page: number,
    limit: number,
) {
    const [conversations, total] = await prisma.$transaction([
        prisma.conversation.findMany({
            where: {
                participants: {
                    some: { userId },
                },
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                displayName: true,
                                photoUrl: true,
                            },
                        },
                    },
                },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                        id: true,
                        content: true,
                        type: true,
                        senderId: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.conversation.count({
            where: {
                participants: {
                    some: { userId },
                },
            },
        }),
    ]);

    return {
        conversations,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function createGroupConversation(
    creatorId: string,
    name: string,
    participantIds: string[],
) {
    const allParticipantIds = [
        ...new Set([creatorId, ...participantIds]),
    ];

    return prisma.$transaction(async (tx) => {
        const users = await tx.user.findMany({
            where: {
                id: { in: allParticipantIds },
            },
            select: { id: true },
        });

        if (users.length !== allParticipantIds.length) {
            throw new Error("One or more users were not found");
        }

        return tx.conversation.create({
            data: {
                type: ConversationType.GROUP,
                name,
                participants: {
                    create: allParticipantIds.map((userId) => ({
                        userId,
                    })),
                },
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                displayName: true,
                                photoUrl: true,
                            },
                        },
                    },
                },
            },
        });
    });
}