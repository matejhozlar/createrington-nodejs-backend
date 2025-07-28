import fs from "fs"; // File system module for reading/writing files
import path from "path"; // Utility for resolving filesystem paths
import { fileURLToPath } from "url"; // Converts file URL to file path
import inquirer from "inquirer"; // Library for interactive CLI prompts

// Convert current module URL to file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute paths to .env files (2 directories up)
const EXAMPLE_PATH = path.resolve(__dirname, "../../.env.example");
const ENV_PATH = path.resolve(__dirname, "../../.env");

// Optional: Descriptive tooltips for each environment variable
const ENV_DESCRIPTIONS = {
  DATABASE_URL: "Only use this if youre using an external DB",
  DB_DATABASE: "Name of your database (eg. currency)",
  DB_HOST: "Database host (e.g. localhost or db.internal)",
  DB_USER: "Database user (usually postgres)",
  DB_PASSWORD: "Password for the DB user",
  DB_NAME: "Name of the database to connect to",
  DB_PORT: "Port the database is listening on (default: 5432)",
  JWT_SECRET: "Secret key used to sign JWT tokens",
  NODE_ENV: "Application environment (development, production, etc.)",
  PORT: "(Recommended 5000) Port for your backend server to listen on",
  ALLOWED_IP_ADDRESS: "IP Address of your Minecraft Server",
  ALLOWED_IP_ADDRESS_LOCAL: "IP Address of your Local Machine (127.0.0.1)",
};

// Exit early if .env already exists
if (fs.existsSync(ENV_PATH)) {
  console.log(".env already exists. Skipping prompt.");
  process.exit(0);
}

// Exit if .env.example is missing
if (!fs.existsSync(EXAMPLE_PATH)) {
  console.error("❌ No .env.example found.");
  process.exit(1);
}

// Read and process .env.example lines
const lines = fs.readFileSync(EXAMPLE_PATH, "utf-8").split("\n");
const keys = lines
  .filter((line) => line.trim() && !line.trim().startsWith("#"))
  .map((line) => {
    const [rawKey, defaultVal] = line.split("=");
    return {
      key: rawKey.trim(),
      default: defaultVal?.trim() || "",
    };
  });

const answers = {};

for (const { key, default: def } of keys) {
  const tooltip = ENV_DESCRIPTIONS[key];
  if (tooltip) {
    console.log(`\n💡 ${tooltip}`);
  }

  const { value } = await inquirer.prompt([
    {
      type: "input",
      name: "value",
      message: `${key}:`,
      default: def,
    },
  ]);

  answers[key] = value;
}

// Write answers to .env file
const envContent = Object.entries(answers)
  .map(([k, v]) => `${k}=${v}`)
  .join("\n");

fs.writeFileSync(ENV_PATH, envContent);
console.log("✅ .env file created.");
