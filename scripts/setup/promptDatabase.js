import inquirer from "inquirer";

/**
 * Prompts the user to select a database from a list.
 *
 * @returns {Promise<"postgres"|"sqlite"|"mongo">} The selected database type
 */
export async function promptDatabaseChoice() {
  const { db } = await inquirer.prompt([
    {
      type: "list",
      name: "db",
      message: "Select your database:",
      choices: [
        { name: "PostgreSQL", value: "postgres" },
        { name: "SQLite", value: "sqlite" },
        { name: "MongoDB (beta – untested)", value: "mongo" },
      ],
    },
  ]);
  return db;
}
