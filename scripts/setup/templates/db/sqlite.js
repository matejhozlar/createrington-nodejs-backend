import sqlite3 from "better-sqlite3";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import logger from "../logger.js";

/**
 * SQLite database connection using the file path from environment variables.
 *
 * Environment Variables Used:
 * @env {string} DATABASE_FILE - Path to the SQLite file (e.g. ./db.sqlite)
 *
 * Notes:
 * - The file is created automatically if it does not exist
 * - SQLite does not support connection pooling
 */

dotenv.config();

const dbFilePath = process.env.DATABASE_FILE || "./db.sqlite";

// Ensure directory exists
const dbDir = path.dirname(dbFilePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

try {
  db = new sqlite3(dbFilePath);
  logger.info(`Connected to SQLite database at ${dbFilePath}`);
} catch (err) {
  logger.error(`Failed to connect to SQLite DB: ${err.message}`);
  process.exit(1);
}

export { db };
