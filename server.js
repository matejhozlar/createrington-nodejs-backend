import logger from "./logger";

// App
import app from "./app/index.js";

// Packages
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, (req, res) => {
  logger.info(`Express App started on http://localhost:${PORT}`);
});
