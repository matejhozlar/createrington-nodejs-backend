export const DB_PRESETS = {
  postgres: ["DATABASE_URL=postgresql://user:pass@localhost:5432/dbname"],
  sqlite: ["DATABASE_FILE=./db.sqlite"],
  mongo: ["MONGO_URI=mongodb://localhost:27017/dbname"],
};
