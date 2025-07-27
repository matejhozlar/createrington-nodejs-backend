import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import logger from "../logger.js";

/**
 * MongoDB client instance using environment variables.
 *
 * Environment Variables Used:
 * @env {string} MONGO_URI - The MongoDB connection URI (e.g. mongodb://localhost:27017/createrington)
 *
 * Notes:
 * - Uses MongoClient from the official `mongodb` package
 * - Exports the connected `client` and `db` reference
 */

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  logger.error("MONGO_URI is not defined in the environment");
  process.exit(1);
}

const client = new MongoClient(MONGO_URI);

let db;

try {
  await client.connect();
  const dbName =
    new URL(MONGO_URI).pathname.replace("/", "") || "createrington";
  db = client.db(dbName);
  logger.info(`Connected to MongoDB: ${MONGO_URI}`);
} catch (error) {
  logger.error(`Failed to connect to MongoDB: ${error.message}`);
  process.exit(1);
}

export { client, db };
