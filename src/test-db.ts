import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "./config/database.js";

async function testDatabase(): Promise<void> {
    try {
        await connectDatabase();
        console.log("Database connection test passed");
    } catch (error) {
        console.error("Database connection test failed:", error);
        process.exitCode = 1;
    } finally {
        await disconnectDatabase();
    }
}

void testDatabase();