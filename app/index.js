import express from "express";

// Routes
import currencyRoutes from "./routes/currencyMod.js";

// Database
import db from "../db/index.js";

const app = express();

app.use(express.json());

app.use("/api", currencyRoutes(db));

export default app;
