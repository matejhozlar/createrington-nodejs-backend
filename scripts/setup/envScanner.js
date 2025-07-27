import fs from "fs";

/**
 * Extracts all environment variable keys accessed via `process.env.*`
 * in a JavaScript file, ignoring comments and string literals.
 *
 * @param {string} filePath - Absolute path to the JavaScript file to scan.
 * @returns {string[]} An array of environment variable names found in the file.
 */
export function findEnvVarsInFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");

  // Remove block comments (/* ... */)
  content = content.replace(/\/\*[\s\S]*?\*\//g, "");

  // Remove single-line comments (// ...)
  content = content.replace(/\/\/.*/g, "");

  // Remove string literals ('...', "...", `...`)
  content = content.replace(/(['"`])(?:\\[\s\S]|(?!\1).)*\1/g, "");

  // Match process.env.VAR_NAME
  const matches = content.matchAll(/\bprocess\.env\.([A-Z0-9_]+)\b/g);

  return Array.from(matches, (m) => m[1]);
}
