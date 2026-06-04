import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";

const databasePath = join(process.cwd(), "prisma", "dev.db");
const migrationPath = join(process.cwd(), "prisma", "migrations", "20260604130000_init", "migration.sql");

mkdirSync(dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
const sql = readFileSync(migrationPath, "utf8");

db.exec(sql);
db.close();

console.log(`Initialized SQLite database at ${databasePath}`);
