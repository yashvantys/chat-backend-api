
import { Router } from "express";
import { authenticateFirebase } from "../middleware/auth.middleware.js";
import {
    createDirectConversationController,
    createGroupConversationController,
    listConversations,
} from "../controllers/conversation.controller.js";
import messageRoutes from "./message.routes.js";
const router = Router();



router.use("/:conversationId/messages", messageRoutes);

router.use(authenticateFirebase);
// Keep your existing middleware and route.
router.get("/", listConversations);
router.post("/direct", createDirectConversationController);
router.post("/group", createGroupConversationController);

export default router;
