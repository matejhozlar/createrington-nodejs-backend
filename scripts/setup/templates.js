import fs from "fs";
import path from "path";

/**
 * Replaces project files with database-specific template versions.
 *
 * This function copies template files for the selected database into
 * the appropriate locations in the project, such as `db/index.js`,
 * `app/routes/currencyMod.js`, and `app/utils/logTransactions.js`.
 *
 * @param {"postgres"|"sqlite"|"mongo"} selectedDb - The chosen database type.
 */
export function applyDatabaseTemplate(selectedDb) {
  const filesToReplace = [
    { src: `scripts/setup/templates/db/${selectedDb}.js`, dest: `db/index.js` },
    {
      src: `scripts/setup/templates/routes/${selectedDb}.js`,
      dest: `app/routes/currencyMod.js`,
    },
    {
      src: `scripts/setup/templates/utils/${selectedDb}.js`,
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
  }
}
