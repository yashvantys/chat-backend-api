import "dotenv/config";
import { app } from "./app.js";
import { connectDB, pool } from "./db.js";

const port = Number(process.env.PORT ?? 3000);

async function startServer(): Promise<void> {
  try {
    await connectDB();

    const server = app.listen(port, () => {
      console.log(`Chat API listening on :${port}`);
    });

    process.on("SIGTERM", () => {
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    await pool.end();
    process.exit(1);
  }
}

void startServer();