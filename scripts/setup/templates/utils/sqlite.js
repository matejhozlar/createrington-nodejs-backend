/**
 * Logs a currency transaction into the database using SQLite.
 *
 * @param {import('better-sqlite3').Database} db - The SQLite database instance.
 * @param {Object} data - The transaction data.
 * @param {string} data.uuid - The UUID of the user initiating the transaction.
 * @param {string} data.action - The type of transaction (e.g., "deposit", "withdraw").
 * @param {number} data.amount - The transaction amount.
 * @param {string|null} [data.from_uuid=null] - UUID of the sender, if applicable.
 * @param {string|null} [data.to_uuid=null] - UUID of the recipient, if applicable.
 * @param {string|null} [data.denomination=null] - Denomination used, if relevant.
 * @param {number|null} [data.count=null] - Item count involved in the transaction.
 * @param {number|null} [data.balance_after=null] - The balance after the transaction.
 */
export function logTransactions(db, data) {
  const {
    uuid,
    action,
    amount,
    from_uuid = null,
    to_uuid = null,
    denomination = null,
    count = null,
    balance_after = null,
  } = data;

  const stmt = db.prepare(`
    INSERT INTO currency_transactions (
      uuid, action, amount, from_uuid, to_uuid,
      denomination, count, balance_after
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    uuid,
    action,
    amount,
    from_uuid,
    to_uuid,
    denomination,
    count,
    balance_after
  );
}
