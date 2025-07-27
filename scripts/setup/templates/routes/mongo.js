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
 * @param {import('pg').Pool} db - MongoDB instance.
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
      const userFunds = db.collection("user_funds");

      // Upsert user into the DB (create if missing, update name if changed)
      await userFunds.updateOne(
        { uuid },
        {
          $set: { name },
          $setOnInsert: { balance: 0 },
        },
        { upsert: true }
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
      const user = await db.collection("user_funds").findOne({ uuid });

      if (!user) {
        return res.status(404).json({ error: "Player not found" });
      }

      const balance = Math.floor(parseFloat(user.balance || 0));
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

    const session = db.client.startSession();

    try {
      await session.withTransaction(async () => {
        const userFunds = db.collection("user_funds");

        const sender = await userFunds.findOne(
          { uuid: from_uuid },
          { session }
        );
        if (!sender) throw new Error("Sender not found");

        const senderBalance = Math.floor(parseFloat(sender.balance || 0));
        const newSenderBal = senderBalance - amount;

        if (senderBalance < amount) throw new Error("Insufficient funds");

        const recipient = await userFunds.findOne(
          { uuid: to_uuid },
          { session }
        );
        if (!recipient) throw new Error("Recipient not found");

        // Update sender balance
        await userFunds.updateOne(
          { uuid: from_uuid },
          { $inc: { balance: -amount } },
          { session }
        );

        // Update recipient balance
        await userFunds.updateOne(
          { uuid: to_uuid },
          { $inc: { balance: amount } },
          { session }
        );

        await logTransactions(db, {
          uuid: from_uuid,
          action: "pay",
          amount,
          from_uuid,
          to_uuid,
          balance_after: newSenderBal,
        });

        res.json({ success: true, new_sender_balance: newSenderBal });
      });
    } catch (error) {
      logger.error(`/currency/pay error: ${error}`);
      res.status(400).json({ error: error.message });
    } finally {
      await session.endSession();
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

    try {
      const userFunds = db.collection("user_funds");

      // Update balance and get the updated document
      const result = await userFunds.findOneAndUpdate(
        { uuid },
        { $inc: { balance: amount } },
        { returnDocument: "after" }
      );

      if (!result.value) {
        return res.status(404).json({ error: "User not found" });
      }

      const newBalance = Math.floor(parseFloat(result.value.balance || 0));

      await logTransactions(db, {
        uuid,
        action: "deposit",
        amount,
        balance_after: newBalance,
      });

      res.json({ success: true, new_balance: newBalance });
    } catch (error) {
      logger.error(`/currency/deposit error: ${error}`);
      res.status(400).json({ error: error.message });
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

    try {
      const userFunds = db.collection("user_funds");

      const user = await userFunds.findOne({ uuid });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const currentBalance = Math.floor(parseFloat(user.balance || 0));

      if (currentBalance < amount) {
        return res.status(400).json({ error: "Insufficient funds" });
      }

      const updateResult = await userFunds.findOneAndUpdate(
        { uuid },
        { $inc: { balance: -amount } },
        { returnDocument: "after" }
      );

      const newBalance = Math.floor(
        parseFloat(updateResult.value.balance || 0)
      );

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
      logger.error(`/currency/withdraw error: ${error}`);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * GET /currency/top
   * Returns top 10 richest players by balance.
   */
  router.get("/currency/top", async (req, res) => {
    try {
      const userFunds = db.collection("user_funds");

      const topUsers = await userFunds
        .find({}, { projection: { name: 1, balance: 1 } })
        .sort({ balance: -1 })
        .limit(10)
        .toArray();

      const top = topUsers.map((r) => ({
        name: r.name,
        balance: Math.floor(parseFloat(r.balance || 0)),
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
      const mobLimit = db.collection("mob_limit_reached");

      await mobLimit.updateOne(
        { uuid },
        { $set: { date_reached: new Date() } },
        { upsert: true }
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
      const mobLimit = db.collection("mob_limit_reached");

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Midnight today

      const doc = await mobLimit.findOne({
        uuid,
        date_reached: { $gte: today },
      });

      logger.info("Checked limit reached");

      res.json({ limitReached: !!doc });
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

    try {
      const users = db.collection("users");
      const userFunds = db.collection("user_funds");
      const dailyRewards = db.collection("daily_rewards");

      const user = await users.findOne({ uuid });
      if (!user || !user.discord_id) {
        return res.status(404).json({
          error: "Your Minecraft account is not linked to Discord.",
        });
      }

      const discordId = user.discord_id;

      const fund = await userFunds.findOne({ uuid });
      if (!fund) {
        return res.status(404).json({ error: "User not found." });
      }

      const currentBal = Math.floor(fund.balance || 0);

      const reward = await dailyRewards.findOne({ discord_id: discordId });

      const alreadyClaimed =
        reward &&
        DateTime.fromJSDate(reward.last_claim_at).setZone(TIMEZONE) >=
          lastReset;

      if (alreadyClaimed) {
        const nextReset = lastReset.plus({ days: 1 });
        const diff = nextReset.diff(now, ["hours", "minutes"]).toObject();
        const hours = Math.floor(diff.hours);
        const minutes = Math.floor(diff.minutes);

        return res.status(429).json({
          error: `You already claimed your daily reward. Next reset in ${hours}h ${minutes}m.`,
        });
      }

      const session = db.client.startSession();
      await session.withTransaction(async () => {
        await userFunds.updateOne(
          { uuid },
          { $inc: { balance: DAILY_REWARD_AMOUNT } },
          { session }
        );

        await dailyRewards.updateOne(
          { discord_id: discordId },
          { $set: { last_claim_at: now.toJSDate() } },
          { upsert: true, session }
        );
      });
      await session.endSession();

      const newBalance = currentBal + DAILY_REWARD_AMOUNT;
      const formatted = newBalance.toLocaleString("en-US");

      res.json({
        message: `You claimed your daily reward of $${DAILY_REWARD_AMOUNT}!\n💰 New Balance: $${formatted}`,
        new_balance: newBalance,
      });
    } catch (error) {
      logger.error(`/currency/daily error: ${error}`);
      res.status(500).json({
        error: "Something went wrong while claiming your daily reward.",
      });
    }
  });

  return router;
}
