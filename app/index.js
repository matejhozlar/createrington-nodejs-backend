// Import core framework
import express from "express";

// Enable Cross-Origin Resource Sharing (CORS)
import cors from "cors";

// Import currency-related routes
import currencyRoutes from "./routes/currencyMod.js";

// Import PostgreSQL database instance (connection pool)
import { db } from "../db/index.js";

// Create an Express application instance
const app = express();

// -----------------------
// Middleware Registration
// -----------------------

// Parses incoming requests with JSON payloads
app.use(express.json());

// Enables CORS with default permissive settings
// `origin: true` — reflects the request origin in the CORS headers
// `credentials: true` — allows sending cookies and auth headers
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// -----------------------
// Route Registration
// -----------------------

// All currency-related endpoints are mounted under the /api path
// The currencyRoutes function receives the DB instance to inject as needed
app.use("/api", currencyRoutes(db));

// Export the configured Express app instance
export default app;
