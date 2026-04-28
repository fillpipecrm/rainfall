import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://briandavidson@localhost:5432/rainfall_go",
  databaseSsl:
    process.env.DATABASE_SSL === "true" ||
    process.env.PGSSLMODE === "require" ||
    process.env.NETLIFY === "true",
};
