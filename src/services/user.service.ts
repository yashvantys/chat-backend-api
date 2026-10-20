
import type { DecodedIdToken } from "firebase-admin/auth";
import { prisma } from "../config/database.js";

export async function syncUser(firebaseUser: DecodedIdToken) {
    const displayName =
        firebaseUser.name?.trim() ||
        firebaseUser.email ||
        "User";

    return prisma.user.upsert({
        where: {
            firebaseUid: firebaseUser.uid,
        },
        create: {
            firebaseUid: firebaseUser.uid,
            displayName,
            email: firebaseUser.email ?? null,
            photoUrl: firebaseUser.picture ?? null,
        },
        update: {
            displayName,
            email: firebaseUser.email ?? null,
            photoUrl: firebaseUser.picture ?? null,
        },
        select: {
            id: true,
            firebaseUid: true,
            displayName: true,
            email: true,
            photoUrl: true,
            createdAt: true,
            updatedAt: true,
        },
    });
}

export async function getUserByFirebaseUid(firebaseUid: string) {
    return prisma.user.findUnique({
        where: { firebaseUid },
        select: {
            id: true,
            firebaseUid: true,
            displayName: true,
            email: true,
            photoUrl: true,
            createdAt: true,
            updatedAt: true,
        },
    });
}
