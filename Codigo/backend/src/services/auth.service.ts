import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import type { AuthLoginResult, AuthenticatedUser, UserRole } from "../types/auth.js";
import type { AuthRepository } from "../repositories/auth.repository.js";
import { AppError } from "../utils/app-error.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

function normalizeRole(value: string): UserRole {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  if (normalized === "VENDEDOR") {
    return "VENDEDOR";
  }

  return "PROPRIETARIO";
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async login(email: string, senha: string): Promise<AuthLoginResult> {
    await this.ensureBootstrapUsers();

    const administrator = await this.repository.findByLogin(email);

    if (!administrator || !verifyPassword(senha, administrator.senha)) {
      throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    const user: AuthenticatedUser = {
      id: administrator.id,
      nome: administrator.nome,
      login: administrator.login,
      role: normalizeRole(administrator.permissao),
    };

    return {
      token: this.createToken(user),
      user,
    };
  }

  verifyToken(token?: string): boolean {
    return this.getUserFromToken(token) !== null;
  }

  getUserFromToken(token?: string): AuthenticatedUser | null {
    if (!token) {
      return null;
    }

    const [payloadPart, signaturePart] = token.split(".");
    if (!payloadPart || !signaturePart) {
      return null;
    }

    const expectedSignature = this.sign(payloadPart);
    const actualBuffer = Buffer.from(signaturePart, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
      return null;
    }

    try {
      const payload = JSON.parse(fromBase64Url(payloadPart)) as AuthenticatedUser;
      if (!payload || typeof payload.id !== "number" || typeof payload.login !== "string" || typeof payload.nome !== "string") {
        return null;
      }
      return {
        id: payload.id,
        nome: payload.nome,
        login: payload.login,
        role: payload.role === "VENDEDOR" ? "VENDEDOR" : "PROPRIETARIO",
      };
    } catch {
      return null;
    }
  }

  private async ensureBootstrapUsers(): Promise<void> {
    await this.repository.ensureBootstrapAdministrator({
      nome: "Proprietario",
      login: env.AUTH_ADMIN_EMAIL,
      senhaHash: hashPassword(env.AUTH_ADMIN_PASSWORD),
      permissao: "PROPRIETARIO",
    });

    await this.repository.ensureBootstrapAdministrator({
      nome: env.AUTH_SELLER_NAME,
      login: env.AUTH_SELLER_EMAIL,
      senhaHash: hashPassword(env.AUTH_SELLER_PASSWORD),
      permissao: "VENDEDOR",
    });
  }

  private createToken(user: AuthenticatedUser): string {
    const payload = toBase64Url(JSON.stringify(user));
    return `${payload}.${this.sign(payload)}`;
  }

  private sign(payload: string): string {
    return createHmac("sha256", env.AUTH_TOKEN_SECRET).update(payload).digest("hex");
  }
}
