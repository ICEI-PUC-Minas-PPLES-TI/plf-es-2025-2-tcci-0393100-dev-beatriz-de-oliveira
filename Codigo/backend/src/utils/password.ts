import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_PREFIX = "scrypt";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${SCRYPT_PREFIX}$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedValue: string): boolean {
  if (!storedValue) {
    return false;
  }

  if (!storedValue.startsWith(`${SCRYPT_PREFIX}$`)) {
    return storedValue === password;
  }

  const [, salt, derivedHash] = storedValue.split("$");
  if (!salt || !derivedHash) {
    return false;
  }

  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(derivedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
