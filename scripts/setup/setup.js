import fs from "fs";
import path from "path";
import glob from "fast-glob";
import inquirer from "inquirer";

const SOURCE_DIR = path.resolve(".");

/**
 * Prompts the user to select a database using arrow keys.
 *
 * @returns {Promise<"postgres"|"sqlite"|"mongo">} The selected database type
 */
async function promptDatabaseChoice() {
  const { db } = await inquirer.prompt([
    {
      type: "list",
      name: "db",
      message: "Select your database:",
      choices: [
        { name: "PostgreSQL", value: "postgres" },
        { name: "SQLite", value: "sqlite" },
        { name: "MongoDB", value: "mongo" },
      ],
    },
  ]);
  return db;
}

/**
 * Scans a JavaScript file and extracts environment variable names used as process.env.VAR_NAME.
 *
 * @param {string} filePath - Absolute path to the JS file
 * @returns {string[]} Array of detected env variable names
 */
function findEnvVarsInFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");
  content = content.replace(/\/\*[\s\S]*?\*\//g, "");
  content = content.replace(/\/\/.*/g, "");
  content = content.replace(/(['"`])(?:\\[\s\S]|(?!\1).)*\1/g, "");

  const matches = content.matchAll(/\bprocess\.env\.([A-Z0-9_]+)\b/g);
  return Array.from(matches, (m) => m[1]);
}

/**
 * Copies the correct database template file to `db/index.js` based on the user's choice.
 *
 * @param {"postgres"|"sqlite"|"mongo"} selectedDb - The selected database type
 */
function applyDatabaseTemplate(selectedDb) {
  const filesToReplace = [
    {
      src: `/scripts/setup/templates/db/${selectedDb}.js`,
      dest: `db/index.js`,
    },
    {
      src: `/scrits/setup/templates/routes/${selectedDb}.js`,
      dest: `app/routes/currencyMod.js`,
    },
    {
      src: `/scripts/setup/templates/utils/${selectedDb}.js`,
      dest: `app/utils/logTransactions.js`,
    },
  ];

  for (const { src, dest } of filesToReplace) {
    const sourcePath = path.resolve(src);
    const destPath = path.resolve(dest);

    if (!fs.existsSync(sourcePath)) {
      console.error(`❌ Template not found: ${sourcePath}`);
      process.exit(1);
    }

    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Copied: ${src} → ${dest}`);
  }
}

/**
 * Generates a .env.example file based on env variable usage and database-specific requirements.
 *
 * @param {"postgres"|"sqlite"|"mongo"} selectedDb - The selected database type
 */
function generateDotenvExample(selectedDb) {
  const dbPresets = {
    postgres: ["DATABASE_URL=postgresql://user:pass@localhost:5432/dbname"],
    sqlite: ["DATABASE_FILE=./db.sqlite"],
    mongo: ["MONGO_URI=mongodb://localhost:27017/dbname"],
  };

  const allFiles = glob.sync(["**/*.js"], {
    cwd: SOURCE_DIR,
    ignore: [
      "node_modules/**",
      "client/**",
      "build/**",
      "dist/**",
      "scripts/**",
    ],
    absolute: true,
  });

  const envVars = new Set();

  for (const file of allFiles) {
    try {
      const vars = findEnvVarsInFile(file);
      vars.forEach((v) => envVars.add(v));
    } catch (error) {
      console.warn(`⚠️ Skipping unreadable file ${file}: ${error}`);
    }
  }

  // Add DB-specific preset keys
  dbPresets[selectedDb].forEach((line) => {
    const [key] = line.split("=");
    envVars.add(key);
  });

  const sortedVars = Array.from(envVars).sort();
  const lines = sortedVars.map((v) => {
    const preset = dbPresets[selectedDb].find((line) => line.startsWith(v));
    return preset || `${v}=`;
  });

  fs.writeFileSync(".env.example", lines.join("\n") + "\n");
  console.log(`✅ Generated .env.example for ${selectedDb.toUpperCase()}`);
}

/**
 * Scans project files and writes an exportable JS array of required environment variables.
 * Output: config/env/vars/requiredVars.js
 */
function generateRequiredEnvVarsFile() {
  const allFiles = glob.sync(["**/*.js"], {
    cwd: SOURCE_DIR,
    ignore: [
      "node_modules/**",
      "client/**",
      "build/**",
      "dist/**",
      "scripts/**",
    ],
    absolute: true,
  });

  const envVars = new Set();

  for (const file of allFiles) {
    try {
      const vars = findEnvVarsInFile(file);
      vars.forEach((v) => envVars.add(v));
    } catch (error) {
      console.warn(`⚠️ Skipping unreadable file ${file}: ${error}`);
    }
  }

  const sortedVars = Array.from(envVars).sort();
  const jsContent = `const REQUIRED_VARS = [\n${sortedVars
    .map((v) => `  "${v}",`)
    .join("\n")}\n];\n\nexport default REQUIRED_VARS;\n`;

  const outputPath = path.resolve("config/env/vars/requiredVars.js");
  fs.writeFileSync(outputPath, jsContent);
  console.log(
    `✅ Wrote ${sortedVars.length} required env vars to ${outputPath}`
  );
}

/**
 * Main Setup Runner — orchestrates DB selection, file generation, and env validation
 */
async function runSetup() {
  console.log("🔧 Createrington Setup Wizard");
  const selectedDb = await promptDatabaseChoice();

  applyDatabaseTemplate(selectedDb);
  generateDotenvExample(selectedDb);
  generateRequiredEnvVarsFile();

  console.log(
    "\n🚀 Setup complete! You can now configure your .env file and start the server."
  );
}

runSetup();
