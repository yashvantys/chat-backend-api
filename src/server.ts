import app from "./app.js";
import { connectDatabase } from "./config/database.js";


connectDatabase().then(() => {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
});