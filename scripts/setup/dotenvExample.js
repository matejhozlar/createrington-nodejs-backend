import fs from "fs";
import path from "path";
import glob from "fast-glob";
import { findEnvVarsInFile } from "./envScanner.js";
import { DB_PRESETS } from "./dbPresets.js";

const SOURCE_DIR = path.resolve(".");

/**
 * Generates a `.env.example` file based on all `process.env.*` usages in the project,
 * and includes DB-specific preset values.
 *
 * @param {"postgres"|"sqlite"|"mongo"} selectedDb - The selected database type to include relevant env presets for.
 */
export function generateDotenvExample(selectedDb) {
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

  const envVars = new Map(); // key -> line or default value

  for (const file of allFiles) {
    try {
      const vars = findEnvVarsInFile(file);
      vars.forEach((v) => {
        if (!envVars.has(v)) envVars.set(v, `${v}=`);
      });
    } catch (error) {
      console.warn(`⚠️ Skipping unreadable file ${file}: ${error}`);
    }
  }

  // Apply DB presets (overwrite or insert)
  for (const line of DB_PRESETS[selectedDb]) {
    const [key] = line.split("=");
    envVars.set(key, line);
  }

  const sortedVars = Array.from(envVars.keys()).sort();
  const lines = sortedVars.map((key) => envVars.get(key));

  fs.writeFileSync(".env.example", lines.join("\n") + "\n");
  console.log(`✅ Generated .env.example for ${selectedDb.toUpperCase()}`);
}

/**
 * Scans project files for all used `process.env.*` variables and
 * generates a JavaScript file exporting them as an array.
 *
 * Output file: `config/env/vars/requiredVars.js`
 */
export function generateRequiredEnvVarsFile() {
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
