
import type { Request, Response } from "express";
import {
    getUserByFirebaseUid,
    syncUser,
} from "../services/user.service.js";

export async function syncCurrentUser(
    req: Request,
    res: Response,
): Promise<void> {
    try {
        const firebaseUser = req.firebaseUser!;
        const user = await syncUser(firebaseUser);
        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        console.error("User synchronization failed:", error);
        res.status(500).json({
            error: "Internal Server Error",
            message: "Unable to synchronize user",
        });
    }
}

export async function getCurrentUser(
    req: Request,
    res: Response,
): Promise<void> {
    try {
        const firebaseUser = req.firebaseUser!;
        const user = await getUserByFirebaseUid(firebaseUser.uid);
        if (!user) {
            res.status(404).json({
                error: "Not Found",
                message: "User not found. Synchronize your account first.",
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        console.error("Fetching current user failed:", error);
        res.status(500).json({
            error: "Internal Server Error",
            message: "Unable to fetch user",
        });
    }
}
