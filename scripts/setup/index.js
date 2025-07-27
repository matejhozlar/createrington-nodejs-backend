import { promptDatabaseChoice } from "./promptDatabase.js";
import { applyDatabaseTemplate } from "./templates.js";
import {
  generateDotenvExample,
  generateRequiredEnvVarsFile,
} from "./dotenvExample.js";

/**
 * Main setup script for Createrington.
 *
 * Prompts the user to choose a database, applies appropriate template files,
 * generates an `.env.example` file, and writes a list of required environment variables.
 *
 * Warns if MongoDB is selected, since it's currently in beta.
 */
async function runSetup() {
  console.log("🔧 Createrington Setup Wizard");

  const selectedDb = await promptDatabaseChoice();

  if (selectedDb === "mongo") {
    console.warn(
      "⚠️ MongoDB support is currently in beta and not fully tested."
    );
  }

  applyDatabaseTemplate(selectedDb);
  generateDotenvExample(selectedDb);
  generateRequiredEnvVarsFile();

  console.log("\n🚀 Setup complete! Configure your .env and start the server.");
}

runSetup();
