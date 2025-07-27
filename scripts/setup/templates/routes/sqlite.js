// This is a rewritten version of the original PostgreSQL-based currency routes
// for use with SQLite. SQLite does not support client pooling or transactions the
// same way, so adjustments have been made accordingly.

import express from "express";
import logger from "../../logger.js";
import jwt from "jsonwebtoken";
import { DateTime } from "luxon";

import verifyJWT from "../middleware/verifyJWT.js";
import verifyIP from "../middleware/verifyIP.js";
import { logTransactions } from "../utils/currency/logTransactions.js";

/**
 * @param {import('sqlite').Database} db - SQLite database instance.
 */
export default function currencyRoutes(db) {
  const router = express.Router();

  /**
   * POST /currency/login
   * Authenticates a user and returns a short-lived JWT.
   * @body {string} uuid - Minecraft player's UUID.
   * @body {string} name - Minecraft username.
   * @returns {string} token
   */
  router.post("/currency/login", (req, res) => {
    const { uuid, name } = req.body;

    if (!uuid || !name) {
      return res.status(400).json({ error: "Missing uuid or name" });
    }

    const token = jwt.sign({ uuid, name }, process.env.JWT_SECRET, {
      expiresIn: "10m",
    });

    res.json({ token });
  });

  // Protect all /currency/* routes with auth + IP check
  router.use("/currency", verifyJWT);
  router.use("/currency", verifyIP);

  /**
   * GET /currency/balance
   * Returns the player's current balance.
   */
  router.get("/currency/balance", (req, res) => {
    const uuid = req.user.uuid;

    if (!uuid) {
      return res.status(400).json({ error: "Missing uuid" });
    }

    try {
      const stmt = db.prepare(
        "SELECT balance FROM user_funds WHERE uuid = ? LIMIT 1"
      );
      const row = stmt.get(uuid);

      if (!row) {
        return res.status(404).json({ error: "Player not found" });
      }

      const balance = row.balance;
      res.json({ balance });
    } catch (error) {
      logger.error(`/currency/balance error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /currency/pay
   * Sends money from one player to another.
   * @body {string} to_uuid - UUID of the recipient.
   * @body {number} amount - Amount to transfer.
   */
  router.post("/currency/pay", (req, res) => {
    const { to_uuid, amount } = req.body;
    const from_uuid = req.user.uuid;

    if (!from_uuid || !to_uuid || typeof amount !== "number") {
      return res.status(400).json({ error: "Invalid input" });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Amount must be positive" });
    }

    const transaction = db.transaction(() => {
      const getBalance = db.prepare(
        "SELECT balance FROM user_funds WHERE uuid = ?"
      );
      const updateBalance = db.prepare(
        "UPDATE user_funds SET balance = balance + ? WHERE uuid = ?"
      );

      const senderRow = getBalance.get(from_uuid);
      if (!senderRow) {
        throw new Error("Sender not found");
      }

      const senderBalance = senderRow.balance;
      if (senderBalance < amount) {
        throw new Error("Insufficient funds");
      }

      const recipientRow = getBalance.get(to_uuid);
      if (!recipientRow) {
        throw new Error("Recipient not found");
      }

      updateBalance.run(-amount, from_uuid);
      updateBalance.run(+amount, to_uuid);

      const newSenderBalance = senderBalance - amount;

      logTransactions(db, {
        uuid: from_uuid,
        action: "pay",
        amount,
        from_uuid,
        to_uuid,
        balance_after: newSenderBalance,
      });

      return newSenderBalance;
    });

    try {
      const newSenderBal = transaction();
      res.json({ success: true, new_sender_balance: newSenderBal });
    } catch (error) {
      logger.error(`/currency/pay error: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * POST /currency/deposit
   * Converts physical in-game currency to digital balance.
   * @body {number} amount - Amount to deposit.
   */
  router.post("/currency/deposit", (req, res) => {
    const { amount } = req.body;
    const uuid = req.user.uuid;

    if (!uuid || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid input" });
    }

    try {
      const transaction = db.transaction(() => {
        const updateBalance = db.prepare(
          "UPDATE user_funds SET balance = balance + ? WHERE uuid = ?"
        );
        const selectBalance = db.prepare(
          "SELECT balance FROM user_funds WHERE uuid = ?"
        );

        const updateResult = updateBalance.run(amount, uuid);
        if (updateResult.changes === 0) {
          throw new Error("User not found");
        }

        const userRow = selectBalance.get(uuid);
        const newBalance = userRow.balance;

        logTransactions(db, {
          uuid,
          action: "deposit",
          amount,
          balance_after: newBalance,
        });

        return newBalance;
      });

      const newBalance = transaction();
      res.json({ success: true, new_balance: newBalance });
    } catch (error) {
      logger.error(`/currency/deposit error: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * POST /currency/withdraw
   * Withdraws virtual money into physical bills.
   * @body {number} count - Number of bills to withdraw.
   * @body {number} [denomination=1000] - Optional denomination per bill.
   */
  router.post("/currency/withdraw", (req, res) => {
    const { count, denomination } = req.body;
    const uuid = req.user.uuid;

    if (!uuid || typeof count !== "number" || count <= 0) {
      return res.status(400).json({ error: "Invalid count or uuid" });
    }

    const denom = typeof denomination === "number" ? denomination : 1000;
    const amount = count * denom;

    try {
      const transaction = db.transaction(() => {
        const selectStmt = db.prepare(
          `SELECT balance FROM user_funds WHERE uuid = ?`
        );
        const userRow = selectStmt.get(uuid);
        if (!userRow) throw new Error("User not found");

        const currentBalance = userRow.balance;
        if (currentBalance < amount) throw new Error("Insufficient funds");

        const updateStmt = db.prepare(
          `UPDATE user_funds SET balance = balance - ? WHERE uuid = ?`
        );
        updateStmt.run(amount, uuid);

        const finalBalance = currentBalance - amount;

        logTransactions(db, {
          uuid,
          action: "withdraw",
          amount,
          denomination: denom,
          count,
          balance_after: finalBalance,
        });

        return finalBalance;
      });

      const newBalance = transaction();

      res.json({
        success: true,
        withdrawn: amount,
        new_balance: newBalance,
        denomination: denom,
        count,
      });
    } catch (error) {
      logger.error(`/currency/withdraw error: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * GET /currency/top
   * Returns top 10 richest players by balance.
   */
  router.get("/currency/top", (req, res) => {
    try {
      const stmt = db.prepare(
        `SELECT name, balance FROM user_funds ORDER BY balance DESC LIMIT 10`
      );
      const rows = stmt.all();

      const top = rows.map((r) => ({
        name: r.name,
        balance: r.balance,
      }));

      res.json(top);
    } catch (error) {
      logger.error(`/currency/top error: ${error.message}`);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /currency/mob-limit
   * Marks a user as having reached their mob drop limit for the day.
   */
  router.post("/currency/mob-limit", (req, res) => {
    const uuid = req.user.uuid;

    if (!uuid) {
      return res.status(400).json({ error: "Missing uuid" });
    }

    try {
      const stmt = db.prepare(`
      INSERT INTO mob_limit_reached (uuid, date_reached)
      VALUES (?, DATE('now'))
      ON CONFLICT(uuid) DO UPDATE SET date_reached = DATE('now')
    `);

      stmt.run(uuid);

      res.json({ success: true, message: "Mob limit marked for user" });
    } catch (error) {
      logger.error(`/currency/mob-limit error: ${error.message}`);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /currency/mob-limit
   * Checks if a user has reached their mob drop limit for the day.
   */
  router.get("/currency/mob-limit", (req, res) => {
    const uuid = req.user.uuid;

    if (!uuid) {
      return res.status(400).json({ error: "Missing uuid" });
    }

    try {
      const stmt = db.prepare(`
      SELECT 1 FROM mob_limit_reached 
      WHERE uuid = ? AND date_reached = DATE('now') 
      LIMIT 1
    `);
      const row = stmt.get(uuid);

      logger.info("Checked limit reached");
      const limitReached = !!row;
      res.json({ limitReached });
    } catch (error) {
      logger.error(`/currency/mob-limit GET error: ${error.message}`);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /currency/daily
   * Allows a user to claim a once-daily reward.
   */
  router.post("/currency/daily", (req, res) => {
    const uuid = req.user.uuid;

    if (!uuid) {
      return res.status(400).json({ error: "Missing uuid" });
    }

    const DAILY_REWARD_AMOUNT = 50;
    const TIMEZONE = "Europe/Berlin";
    const now = DateTime.now().setZone(TIMEZONE);

    const getLastReset = (now) => {
      let resetTime = now.set({
        hour: 6,
        minute: 30,
        second: 0,
        millisecond: 0,
      });
      if (now < resetTime) resetTime = resetTime.minus({ days: 1 });
      return resetTime;
    };

    const lastReset = getLastReset(now);

    try {
      const userBalStmt = db.prepare(
        `SELECT balance FROM user_funds WHERE uuid = ?`
      );
      const userRow = userBalStmt.get(uuid);
      if (!userRow) {
        return res.status(404).json({ error: "User not found." });
      }

      const currentBal = userRow.balance;

      const rewardStmt = db.prepare(
        `SELECT last_claim_at FROM daily_rewards WHERE uuid = ?`
      );
      const rewardRow = rewardStmt.get(uuid);

      const alreadyClaimed =
        rewardRow &&
        DateTime.fromSQL(rewardRow.last_claim_at, { zone: TIMEZONE }) >=
          lastReset;

      if (alreadyClaimed) {
        const nextReset = lastReset.plus({ days: 1 });
        const diff = nextReset.diff(now, ["hours", "minutes"]).toObject();
        const hours = Math.floor(diff.hours || 0);
        const minutes = Math.floor(diff.minutes || 0);

        return res.status(429).json({
          error: `You already claimed your daily reward. Next reset in ${hours}h ${minutes}m.`,
        });
      }

      const updateBalStmt = db.prepare(
        `UPDATE user_funds SET balance = balance + ? WHERE uuid = ?`
      );
      updateBalStmt.run(DAILY_REWARD_AMOUNT, uuid);

      const upsertRewardStmt = db.prepare(`
      INSERT INTO daily_rewards (uuid, last_claim_at)
      VALUES (?, ?)
      ON CONFLICT(uuid) DO UPDATE SET last_claim_at = excluded.last_claim_at
    `);
      upsertRewardStmt.run(uuid, now.toSQL());

      const newBalance = currentBal + DAILY_REWARD_AMOUNT;
      const formatted = newBalance.toLocaleString("en-US");

      res.json({
        message: `You claimed your daily reward of $${DAILY_REWARD_AMOUNT}!\n💰 New Balance: $${formatted}`,
        new_balance: newBalance,
      });
    } catch (error) {
      logger.error(`/currency/daily error: ${error.message}`);
      res.status(500).json({
        error: "Something went wrong while claiming your daily reward.",
      });
    }
  });

  return router;
}
