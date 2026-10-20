
import type { Request, Response, NextFunction } from "express";
import { firebaseAuth } from "../config/firebase.js";

export async function authenticateFirebase(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
        res.status(401).json({
            error: "Unauthorized",
            message: "A Firebase ID token is required",
        });
        return;
    }

    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
        res.status(401).json({
            error: "Unauthorized",
            message: "Firebase ID token is missing",
        });
        return;
    }

    try {
        req.firebaseUser = await firebaseAuth.verifyIdToken(token);
        next();
    } catch {
        res.status(401).json({
            error: "Unauthorized",
            message: "Invalid or expired Firebase ID token",
        });
    }
}
