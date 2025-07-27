# Createrington Node.js Backend Template

This repository provides a **Node.js backend template** for the **Createrington Currency** Minecraft mod.
The backend exposes a simple HTTP API that the mod can call for authentication and currency‑related actions.
It is designed to be easy to deploy and integrate: clone the repository, configure the environment variables, run the server and the mod will be able to communicate with it immediately.

---

## Features

- JWT-based authentication
- PostgreSQL database integration
- IP allowlisting middleware
- Comprehensive logging via `pino`
- Environment variable validation
- Includes API for user login, balance checks, payments, and more
- Modular project structure ready for production

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/matejhozlar/createrington-nodejs-backend.git
cd createrington-nodejs-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Use the provided generator script:

```bash
npm run gen:env-vars
```

Or manually create a `.env` file:

```ini
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/createrington
JWT_SECRET=your_jwt_secret
ALLOWED_IPS=127.0.0.1,192.168.1.10
```

### 4. Run the Server

```bash
npm start
```

---

## Project Structure

| Folder/File                 | Purpose                                |
| --------------------------- | -------------------------------------- |
| `server.js`                 | App bootstrap and express setup        |
| `app/index.js`              | Express app with routes and middleware |
| `app/routes/currencyMod.js` | Mod-related HTTP routes                |
| `db/index.js`               | PostgreSQL connection pool             |
| `logger.js`                 | Pino-based logger setup                |
| `config/env/`               | Environment variable validation        |
| `scripts/env/`              | Tools for managing environment vars    |
| `app/middleware/`           | JWT and IP validation middlewares      |

---

## Authentication

Users authenticate with their username and UUID to obtain a JWT:

```http
POST /currency-mod/login
Content-Type: application/json

{
  "username": "Player1",
  "uuid": "player-uuid"
}
```

On success, you'll receive:

```json
{
  "token": "<JWT_TOKEN>"
}
```

This token must be included in all further requests via the `Authorization` header:

```
Authorization: Bearer <JWT_TOKEN>
```

---

## API Endpoints

All endpoints are prefixed under `/currency-mod`

| Method | Endpoint   | Description                         | Auth? | IP Check? |
| ------ | ---------- | ----------------------------------- | ----- | --------- |
| POST   | /login     | Log in player and issue token       | No    | No        |
| GET    | /balance   | Get player currency balance         | Yes   | Yes       |
| POST   | /pay       | Transfer currency to another player | Yes   | Yes       |
| POST   | /deposit   | Deposit in-game items for currency  | Yes   | Yes       |
| POST   | /withdraw  | Withdraw items using currency       | Yes   | Yes       |
| GET    | /top       | Leaderboard of richest players      | Yes   | Yes       |
| GET    | /mob-limit | Get per-mob currency drop limit     | Yes   | Yes       |
| POST   | /daily     | Claim daily currency bonus          | Yes   | Yes       |

---

## Database

You need a PostgreSQL database with tables like `users`, `transactions`, `items`, `daily_rewards`, etc.
Connection is handled via the `DATABASE_URL` in your `.env` file.

See `db/index.js` for the pool setup.

---

## Logging

The backend uses `pino` for structured JSON logging. Logs include request details, IPs, status codes, etc.
See `logger.js` for customization.

---

## Security

- JWT authentication with expiration
- IP allowlist via middleware (`ALLOWED_IPS`)
- Required environment variables are validated on startup

---

## Scripts

| Script                 | Description                   |
| ---------------------- | ----------------------------- |
| `npm start`            | Start the production server   |
| `npm run dev`          | Start dev server with nodemon |
| `npm run gen:env-vars` | Generate required .env vars   |

---

## Recommended

- Use reverse proxy (e.g. nginx) for SSL termination and rate-limiting
- Use PostgreSQL 13+
- Log files to disk or external log aggregator

---

## Example Usage

The following demonstrates how a client (e.g. the mod) might interact with the API using curl:

```bash
# Login and store the token
token=$(curl -s -X POST http://localhost:5000/api/currency/login \
  -H "Content-Type: application/json" \
  -d '{"uuid": "<player-uuid>", "name": "PlayerName"}' | jq -r '.token')

# Get balance
curl http://localhost:5000/api/currency/balance -H "Authorization: Bearer $token"

# Pay 100 to another player
curl -X POST http://localhost:5000/api/currency/pay \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{"to_uuid": "<recipient-uuid>", "amount": 100}'
```

---

## License

MIT

---

## Maintainer

Developed by [matejhozlar](https://github.com/matejhozlar)

---

## Contributions

Feel free to fork, PR, or suggest improvements!

---

## Support

For integration help, please open an issue or contact via GitHub.
