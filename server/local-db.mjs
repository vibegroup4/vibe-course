import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

export function openDemoDatabase(filename = ":memory:") {
  const sqlite = new DatabaseSync(filename);
  const migration = readFileSync(new URL("../drizzle/0000_demo_sessions.sql", import.meta.url), "utf8");
  sqlite.exec(`BEGIN;
    CREATE TABLE IF NOT EXISTS local_migrations (version INTEGER PRIMARY KEY);
  `);
  try {
    if (!sqlite.prepare("SELECT version FROM local_migrations WHERE version = 1").get()) {
      sqlite.exec(migration);
      sqlite.exec("INSERT INTO local_migrations VALUES (1)");
    }
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    sqlite.close();
    throw error;
  }

  return {
    close: () => sqlite.close(),
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        bind(...args) {
          return {
            first: async () => statement.get(...args) ?? null,
            run: () => ({ meta: { changes: statement.run(...args).changes } }),
          };
        },
      };
    },
    batch(statements) {
      sqlite.exec("BEGIN");
      try {
        for (const statement of statements) statement.run();
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
