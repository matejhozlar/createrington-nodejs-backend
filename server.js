import logger from "./logger.js";
import { validateEnv } from "./config/env/validateEnv.js";

// App
import app from "./app/index.js";

// Packages
import dotenv from "dotenv";

validateEnv();

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, (req, res) => {
  logger.info(`Express App started on http://localhost:${PORT}`);
});
