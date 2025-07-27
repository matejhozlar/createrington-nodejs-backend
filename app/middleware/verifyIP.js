import logger from "../../logger.js";

const allowedIp = process.env.ALLOWED_IP_ADDRESS;
const allowedIpLocal = process.env.ALLOWED_IP_ADDRESS_LOCAL;

/**
 * Express middleware to verify the IP address of incoming requests.
 *
 * Allows only IPs defined in ALLOWED_IP_ADDRESS and ALLOWED_IP_ADDRESS_LOCAL.
 *
 * @param {import('express').Request} req - The incoming HTTP request.
 * @param {import('express').Response} res - The HTTP response object.
 * @param {Function} next - Function to call the next middleware.
 */
export default function verifyIP(req, res, next) {
  const rawIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const normalizedIp = (rawIp || "")
    .replace("::ffff:", "")
    .split(",")[0]
    .trim();

  const allowed = [allowedIp, allowedIpLocal].filter(Boolean);

  if (allowed.includes(normalizedIp)) {
    return next();
  }

  logger.warn(`Blocked request from IP: ${normalizedIp}`);
  return res.status(403).json({ error: "Forbidden: Your IP is not allowed." });
}
