
import { Router } from "express";
import { authenticateFirebase } from "../middleware/auth.middleware.js";
import {
    getCurrentUser,
    syncCurrentUser,
} from "../controllers/user.controller.js";

const router = Router();
router.use(authenticateFirebase);
router.post("/sync", syncCurrentUser);
router.get("/me", getCurrentUser);

export default router;
