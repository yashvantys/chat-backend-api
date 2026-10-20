
import express from "express";
import userRoutes from "./routes/user.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);

export default app;
