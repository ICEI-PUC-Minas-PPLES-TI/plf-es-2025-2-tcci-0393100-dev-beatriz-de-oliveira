import { Pool, type PoolConfig } from "pg";
import { env } from "./env.js";

function maskConnectionString(connectionString: string): string {
  return connectionString.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
}

function normalizeDatabaseUrl(rawUrl: string): string {
  if (!rawUrl.includes("://")) {
    return rawUrl;
  }

  const schemeSeparatorIndex = rawUrl.indexOf("://");
  const scheme = rawUrl.slice(0, schemeSeparatorIndex + 3);
  const remainder = rawUrl.slice(schemeSeparatorIndex + 3);
  const atIndex = remainder.lastIndexOf("@");

  if (atIndex === -1) {
    return rawUrl;
  }

  const authPart = remainder.slice(0, atIndex);
  const hostPart = remainder.slice(atIndex + 1);
  const colonIndex = authPart.indexOf(":");

  if (colonIndex === -1) {
    return rawUrl;
  }

  const username = authPart.slice(0, colonIndex);
  const password = authPart.slice(colonIndex + 1);
  const decodedPassword = decodeURIComponent(password);
  const encodedPassword = encodeURIComponent(decodedPassword);

  return `${scheme}${username}:${encodedPassword}@${hostPart}`;
}

function sanitizeConnectionString(connectionString: string): string {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("ssl");
  url.searchParams.delete("sslcert");
  url.searchParams.delete("sslkey");
  url.searchParams.delete("sslrootcert");
  return url.toString();
}

function createPoolConfig(connectionString: string): PoolConfig {
  const url = new URL(connectionString);
  const isSupabase = url.hostname.includes("supabase.co");
  const isPooler = url.hostname.includes("pooler.supabase.com");

  return {
    connectionString: sanitizeConnectionString(connectionString),
    ssl: isSupabase
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
    max: isPooler ? 5 : 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true,
    keepAlive: true,
  };
}

const normalizedDatabaseUrl = normalizeDatabaseUrl(env.DATABASE_URL);
const normalizedDatabaseUrlMasked = maskConnectionString(normalizedDatabaseUrl);
const parsedDatabaseUrl = new URL(normalizedDatabaseUrl);

export const pool = new Pool(createPoolConfig(normalizedDatabaseUrl));

export async function testDatabaseConnection() {
  const result = await pool.query("SELECT NOW() AS now");
  return {
    now: result.rows[0]?.now as Date | string | undefined,
    host: parsedDatabaseUrl.hostname,
    port: parsedDatabaseUrl.port,
    database: parsedDatabaseUrl.pathname.replace(/^\//, ""),
    user: decodeURIComponent(parsedDatabaseUrl.username),
    usingPooler: parsedDatabaseUrl.hostname.includes("pooler.supabase.com"),
    ssl: parsedDatabaseUrl.hostname.includes("supabase.co"),
    normalizedConnectionString: normalizedDatabaseUrlMasked,
  };
}


