import express from "express";
import cors from "cors";

// Routes
import currencyRoutes from "./routes/currencyMod.js";

// Database
import db from "../db/index.js";

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use("/api", currencyRoutes(db));

export default app;
