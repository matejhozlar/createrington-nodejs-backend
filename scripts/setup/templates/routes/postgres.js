import express from "express";
import logger from "../../logger.js";
import jwt from "jsonwebtoken";
import { DateTime } from "luxon";

// middleware
import verifyJWT from "../middleware/verifyJWT.js";
import verifyIP from "../middleware/verifyIP.js";

// utils
import { logTransactions } from "../utils/currency/logTransactions.js";

/**
 * Sets up currency-related API routes (authentication, balance, payments, etc.)
 *
 * @param {import('pg').Pool} db - PostgreSQL DB client or pool.
 * @returns {import('express').Router} Express router with currency routes.
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
  router.post("/currency/login", async (req, res) => {
    const { uuid, name } = req.body;

    if (!uuid || !name) {
      return res.status(400).json({ error: "Missing uuid or name" });
    }

    try {
      // Insert or update the user if already exists
      await db.query(
        `INSERT INTO user_funds (uuid, name, balance)
       VALUES ($1, $2, 0)
       ON CONFLICT (uuid) DO UPDATE SET name = EXCLUDED.name`,
        [uuid, name]
      );

      const token = jwt.sign({ uuid, name }, process.env.JWT_SECRET, {
        expiresIn: "10m",
      });

      res.json({ token });
    } catch (error) {
      logger.error(`/currency/login error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Protect all /currency/* routes with auth + IP check
  router.use("/currency", verifyJWT);
  router.use("/currency", verifyIP);

  /**
   * GET /currency/balance
   * Returns the player's current balance.
   */
  router.get("/currency/balance", async (req, res) => {
    const uuid = req.user.uuid;

    if (!uuid) {
      return res.status(400).json({ error: "Missing uuid" });
    }

    try {
      const result = await db.query(
        `SELECT balance FROM user_funds WHERE uuid = $1 LIMIT 1`,
        [uuid]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Player not found" });
      }

      const balance = result.rows[0].balance;
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
  router.post("/currency/pay", async (req, res) => {
    const { to_uuid, amount } = req.body;
    const from_uuid = req.user.uuid;

    if (!from_uuid || !to_uuid || typeof amount !== "number") {
      return res.status(400).json({ error: "Invalid input" });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Amount must be positive" });
    }

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const senderRes = await client.query(
        `SELECT balance FROM user_funds WHERE uuid = $1 FOR UPDATE`,
        [from_uuid]
      );

      if (senderRes.rows.length === 0) {
        throw new Error("Sender not found");
      }

      const senderBalance = senderRes.rows[0].balance;

      const newSenderBal = senderBalance - amount;

      if (senderBalance < amount) {
        throw new Error("Insufficient funds");
      }

      await client.query(
        `UPDATE user_funds SET balance = balance - $1 WHERE uuid = $2`,
        [amount, from_uuid]
      );

      const recipientRes = await client.query(
        `UPDATE user_funds SET balance = balance + $1 WHERE uuid = $2 RETURNING *`,
        [amount, to_uuid]
      );

      if (recipientRes.rowCount === 0) {
        throw new Error("Recipient not found");
      }

      await client.query("COMMIT");
      await logTransactions(db, {
        uuid: from_uuid,
        action: "pay",
        amount,
        from_uuid,
        to_uuid,
        balance_after: newSenderBal,
      });

      res.json({ success: true, new_sender_balance: newSenderBal });
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`/currency/send error: ${error}`);
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  /**
   * POST /currency/deposit
   * Converts physical in-game currency to digital balance.
   * @body {number} amount - Amount to deposit.
   */
  router.post("/currency/deposit", async (req, res) => {
    const { amount } = req.body;
    const uuid = req.user.uuid;

    if (!uuid || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE user_funds SET balance = balance + $1 WHERE uuid = $2 RETURNING balance`,
        [amount, uuid]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const newBalance = result.rows[0].balance;

      await client.query("COMMIT");
      await logTransactions(db, {
        uuid,
        action: "deposit",
        amount,
        balance_after: newBalance,
      });
      res.json({ success: true, new_balance: newBalance });
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`/currency/deposit error: ${error}`);
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  /**
   * POST /currency/withdraw
   * Withdraws virtual money into physical bills.
   * @body {number} count - Number of bills to withdraw.
   * @body {number} [denomination=1000] - Optional denomination per bill.
   */
  router.post("/currency/withdraw", async (req, res) => {
    const { count, denomination } = req.body;
    const uuid = req.user.uuid;

    if (!uuid || typeof count !== "number" || count <= 0) {
      return res.status(400).json({ error: "Invalid count or uuid" });
    }

    const denom = typeof denomination === "number" ? denomination : 1000;
    const amount = count * denom;

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT balance FROM user_funds WHERE uuid = $1 FOR UPDATE`,
        [uuid]
      );

      if (result.rows.length === 0) throw new Error("User not found");

      const currentBalance = result.rows[0].balance;
      if (currentBalance < amount) throw new Error("Insufficient funds");

      const updateRes = await client.query(
        `UPDATE user_funds SET balance = balance - $1 WHERE uuid = $2 RETURNING balance`,
        [amount, uuid]
      );

      await client.query("COMMIT");

      const newBalance = updateRes.rows[0].balance;

      await logTransactions(db, {
        uuid,
        action: "withdraw",
        amount,
        denomination: denom,
        count,
        balance_after: newBalance,
      });

      res.json({
        success: true,
        withdrawn: amount,
        new_balance: newBalance,
        denomination: denom,
        count,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`/currency/withdraw error: ${error}`);
      res.status(400).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  /**
   * GET /currency/top
   * Returns top 10 richest players by balance.
   */
  router.get("/currency/top", async (req, res) => {
    try {
      const result = await db.query(
        `SELECT name, balance FROM user_funds ORDER BY balance DESC LIMIT 10`
      );

      const top = result.rows.map((r) => ({
        name: r.name,
        balance: r.balance,
      }));

      res.json(top);
    } catch (error) {
      logger.error(`/currency/top error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /currency/mob-limit
   * Marks a user as having reached their mob drop limit for the day.
   */
  router.post("/currency/mob-limit", async (req, res) => {
    const uuid = req.user.uuid;

    if (!uuid) {
      return res.status(400).json({ error: "Missing uuid" });
    }

    try {
      await db.query(
        `INSERT INTO mob_limit_reached (uuid, date_reached) 
         VALUES ($1, CURRENT_DATE)
         ON CONFLICT (uuid) DO UPDATE SET date_reached = CURRENT_DATE`,
        [uuid]
      );

      res.json({ success: true, message: "Mob limit marked for user" });
    } catch (error) {
      logger.error(`/currency/mob-limit error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /currency/mob-limit
   * Checks if a user has reached their mob drop limit for the day.
   */
  router.get("/currency/mob-limit", async (req, res) => {
    const uuid = req.user.uuid;

    if (!uuid) {
      return res.status(400).json({ error: "Missing uuid" });
    }

    try {
      const result = await db.query(
        `SELECT 1 FROM mob_limit_reached WHERE uuid = $1 AND date_reached = CURRENT_DATE LIMIT 1`,
        [uuid]
      );

      logger.info("Checked limit reached");
      const limitReached = result.rowCount > 0;
      res.json({ limitReached });
    } catch (error) {
      logger.error(`/currency/mob-limit GET error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /currency/daily
   * Allows a user to claim a once-daily reward.
   */
  router.post("/currency/daily", async (req, res) => {
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
    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const userRes = await client.query(
        `SELECT balance FROM user_funds WHERE uuid = $1 FOR UPDATE`,
        [uuid]
      );
      if (userRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found." });
      }

      const currentBal = userRes.rows[0].balance;

      const rewardRes = await client.query(
        `SELECT last_claim_at FROM daily_rewards WHERE uuid = $1 FOR UPDATE`,
        [uuid]
      );

      const alreadyClaimed =
        rewardRes.rowCount > 0 &&
        DateTime.fromJSDate(rewardRes.rows[0].last_claim_at).setZone(
          TIMEZONE
        ) >= lastReset;

      if (alreadyClaimed) {
        await client.query("ROLLBACK");

        const nextReset = lastReset.plus({ days: 1 });
        const diff = nextReset.diff(now, ["hours", "minutes"]).toObject();
        const hours = Math.floor(diff.hours);
        const minutes = Math.floor(diff.minutes);

        return res.status(429).json({
          error: `You already claimed your daily reward. Next reset in ${hours}h ${minutes}m.`,
        });
      }

      await client.query(
        `UPDATE user_funds SET balance = balance + $1 WHERE uuid = $2`,
        [DAILY_REWARD_AMOUNT, uuid]
      );
      await client.query(
        `INSERT INTO daily_rewards (uuid, last_claim_at)
       VALUES ($1, $2)
       ON CONFLICT (uuid) DO UPDATE SET last_claim_at = EXCLUDED.last_claim_at`,
        [uuid, now.toJSDate()]
      );

      await client.query("COMMIT");

      const newBalance = currentBal + DAILY_REWARD_AMOUNT;
      const formatted = newBalance.toLocaleString("en-US");

      res.json({
        message: `You claimed your daily reward of $${DAILY_REWARD_AMOUNT}!\n💰 New Balance: $${formatted}`,
        new_balance: newBalance,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`/currency/daily error: ${error}`);
      res.status(500).json({
        error: "Something went wrong while claiming your daily reward.",
      });
    } finally {
      client.release();
    }
  });

  return router;
}
