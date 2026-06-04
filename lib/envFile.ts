import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const keys = ["FRED_API_KEY", "FMP_API_KEY", "NASDAQ_DATA_LINK_API_KEY", "TRADING_ECONOMICS_API_KEY"] as const;

export type ApiKeyName = (typeof keys)[number];

export function getApiKeyNames(): ApiKeyName[] {
  return [...keys];
}

function envPath(): string {
  return join(process.cwd(), ".env.local");
}

function parseEnv(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const raw = match[2].trim();
    map.set(match[1], raw.replace(/^"|"$/g, ""));
  }
  return map;
}

export function readLocalApiKeys(): Record<ApiKeyName, string> {
  const path = envPath();
  const content = existsSync(path) ? readFileSync(path, "utf8") : "";
  const parsed = parseEnv(content);
  return Object.fromEntries(keys.map((key) => [key, parsed.get(key) ?? process.env[key] ?? ""])) as Record<ApiKeyName, string>;
}

export function writeLocalApiKeys(values: Record<ApiKeyName, string>): void {
  const path = envPath();
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = existing.split(/\r?\n/).filter((line) => {
    const key = line.split("=")[0];
    return line.trim() && !keys.includes(key as ApiKeyName);
  });

  for (const key of keys) {
    const escaped = values[key].replaceAll("\\", "\\\\").replaceAll('"', '\\"');
    lines.push(`${key}="${escaped}"`);
  }

  if (!lines.some((line) => line.startsWith("DATABASE_URL="))) {
    lines.unshift('DATABASE_URL="file:./prisma/dev.db"');
  }

  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}
