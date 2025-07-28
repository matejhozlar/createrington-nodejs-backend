export const DB_PRESETS = {
  postgres: [
    "DATABASE_URL=postgresql://user:pass@localhost:5432/dbname",
    "DB_DATABASE=currency",
    "DB_HOST=host.docker.internal",
    "DB_PORT=5432",
    "DB_USER=postgres",
    "DOTENV_CONFIG_QUIET=true",
    "ALLOWED_IP_ADDRESS_LOCAL=127.0.0.1",
    "PORT=5000",
  ],
  sqlite: [
    "DATABASE_FILE=./db.sqlite",
    "DOTENV_CONFIG_QUIET=true",
    "ALLOWED_IP_ADDRESS_LOCAL=127.0.0.1",
    "PORT=5000",
  ],
  mongo: [
    "MONGO_URI=mongodb://localhost:27017/dbname",
    "DOTENV_CONFIG_QUIET=true",
    "ALLOWED_IP_ADDRESS_LOCAL=127.0.0.1",
    "PORT=5000",
  ],
};
