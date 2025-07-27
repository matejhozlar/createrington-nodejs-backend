# Createrington Node.js Backend Template

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-DB-336791?logo=postgresql)
![Node.js](https://img.shields.io/badge/Node.js-22-green?logo=node.js&logoColor=white)

This repository provides a **Node.js backend template** for the **Createrington Currency** Minecraft mod.
The backend exposes a simple HTTP API that the mod can call for authentication and currency‑related actions.
It is designed to be easy to deploy and integrate: clone the repository, configure the environment variables, run the server and the mod will be able to communicate with it immediately.

This project serves as a backend template for [Createrington Currency Mod](https://github.com/matejhozlar/createrington-currency)

---

## Table of contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation & Setup](#installation--setup)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [API Guide](#api-guide)
- [Database](#database)
- [Logging](#logging)
- [Security](#security)
- [Scripts](#scripts)
- [Recommended](#recommended)
- [Example Usage](#example-usage)
- [License](#license)
- [Support](#support)

---

## Features

- JWT-based authentication
- PostgreSQL database integration
- IP allowlisting middleware
- Comprehensive logging via `winston`
- Environment variable validation
- Includes API for user login, balance checks, payments, and more
- Modular project structure ready for production

---

## Tech Stack

| Technology | Description                          |
| ---------- | ------------------------------------ |
| Node.js    | Backend runtime environment          |
| Express.js | Web framework for routing and logic  |
| PostgreSQL | Relational database for data storage |
| JavaScript | Language used for application logic  |

<p align="center">
  <img src="https://skillicons.dev/icons?i=nodejs,postgres,express,js" />
</p>

---

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/matejhozlar/createrington-nodejs-backend.git
cd createrington-nodejs-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Setup Wizard

Start the interactive setup to configure your database, generate a `.env.example` file, and prepare necessary environment variable files:

```bash
npm run setup
```

The wizard will:

- Let you choose a database (PostgreSQL, SQLite, MongoDB)
- Replace backend files according to your DB choice
- Generate `.env.example`
- Create `config/env/vars/requiredVars.js` for validation

### 4. Configure Your Environment

Copy the example file and adjust values as needed:

```bash
cp .env.example .env
```

Edit `.env` with your actual credentials and secrets.

Example:

```ini
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/createrington
JWT_SECRET=your_jwt_secret
ALLOWED_IPS=127.0.0.1,192.168.1.10
```

### 5. Start the Server

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

## API Endpoints

All endpoints are prefixed under `/currency`

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

## API Guide

All routes are prefixed with `/currency`. Except for `POST /currency/login`, all endpoints require:

- A valid JWT token passed via the `Authorization` header (`Bearer <token>`)
- The request must originate from an allowed IP (based on your `.env` configuration)

---

### Authentication and Session

#### `POST /currency/login`

**Body:**

| Field | Description                        |
| ----- | ---------------------------------- |
| uuid  | Player’s Minecraft UUID (string)   |
| name  | Player’s in-game username (string) |

**Returns:**

```json
{
  "token": "<JWT_TOKEN>"
}
```

The token expires after 10 minutes. Use this token in all subsequent requests.

---

### Account Actions

#### `GET /currency/balance`

Returns the authenticated player’s current balance.

**Response:**

```json
{
  "balance": "<number>"
}
```

Returns `404` if the player is not found.

#### `POST /currency/pay`

Transfers money from the authenticated user to another user.

**Body:**

```json
{
  "to_uuid": "<recipient UUID>",
  "amount": "<positive number>"
}
```

Returns `400` if amount is not positive or if sender has insufficient balance. Updates both balances atomically.

#### `POST /currency/deposit`

Adds virtual currency to the user’s balance.

**Body:**

```json
{
  "amount": "<positive number>"
}
```

Returns updated balance or `400` if invalid.

#### `POST /currency/withdraw`

Withdraws money from the user’s balance as in-game bills.

**Body:**

```json
{
  "count": "<number of bills>",
  "denomination": "<value per bill>" // optional
}
```

Returns updated balance and bill details.

---

### Game Mechanics

#### `GET /currency/top`

Returns the top 10 richest players, ordered by balance descending.

**Response:**

```json
[
  { "name": "Player1", "balance": 12345 },
  { "name": "Player2", "balance": 10000 }
  // more players
]
```

---

### Mob Drop Limit

| Endpoint                   | Description                                                   |
| -------------------------- | ------------------------------------------------------------- |
| `POST /currency/mob-limit` | Marks the user as having reached the mob drop limit for today |
| `GET /currency/mob-limit`  | Returns `{ "limitReached": true/false }`                      |

---

### Daily Reward

#### `POST /currency/daily`

Allows the user to claim a once-daily reward.

- Checks whether the user already claimed it after the last reset time (default 06:30 CET)
- Either credits the reward or tells the user how long to wait until the next reset
- Updates user balance and daily rewards tracking on success

---

## Database

You need a PostgreSQL database with tables like `users`, `transactions`, `items`, `daily_rewards`, etc.
Connection is handled via the `DATABASE_URL` in your `.env` file.

See `db/index.js` for the pool setup.

---

## Logging

The backend uses a custom Winston logger. Logs are saved in a `logs` directory inside a folder named after the current date. Each day at midnight the logger rotates to a new folder and cleans up old folders after a retention period. The logger writes separate files for server logs, error logs and exception logs and also outputs to the console. See `logger.js` for implementation details.

---

## Security

- JWT authentication with expiration
- IP allowlist via middleware (`ALLOWED_IPS`)
- Required environment variables are validated on startup

---

## Scripts

| Script                        | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `npm start`                   | Start the production server                   |
| `npm run dev`                 | Start dev server with nodemon                 |
| `npm run Setup`               | Setup Wizard                                  |
| `npm run env-gen`             | Generate required .env vars                   |
| `npm run env-find <variable>` | Locates env variable in a file based on input |

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

## Support

For integration help, please open an issue or contact via GitHub.
