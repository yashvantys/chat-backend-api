
import { Router } from "express";
import { authenticateFirebase } from "../middleware/auth.middleware.js";
import { deleteMessageController, editMessageController, sendMessageController } from "../controllers/message.controller.js";
import { getConversationMessagesController } from "../controllers/conversation.controller.js";

const router = Router({ mergeParams: true });

router.use(authenticateFirebase);
router.post("/", sendMessageController);
router.get("/", getConversationMessagesController);
router.patch("/:messageId", editMessageController);
router.delete("/:messageId", deleteMessageController);
export default router;
