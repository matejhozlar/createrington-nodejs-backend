// Load custom Winston-based logger
import logger from "./logger.js";

// Import function that validates required environment variables at startup
import { validateEnv } from "./config/env/validateEnv.js";

// Import the Express application instance configured with routes and middleware
import app from "./app/index.js";

// Load environment variables from .env file into process.env
import dotenv from "dotenv";

// --------------------------------------------------
// Step 1: Validate Environment
// This ensures all required env variables are defined before anything runs.
// If a required variable is missing, the process will exit immediately.
validateEnv();

// Step 2: Load environment variables
// Reads values from .env and populates process.env
dotenv.config();

// Step 3: Define Port
// Defaults to 5000 if PORT is not set in environment
const PORT = process.env.PORT || 5000;

// Step 4: Start Express Server
// Binds the Express app to the specified port
app.listen(PORT, () => {
  logger.info(`Express App started on http://localhost:${PORT}`);
});
