import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

export class AuthService {
  async login(email: string, senha: string): Promise<{ token: string }> {
    if (email !== env.AUTH_ADMIN_EMAIL || senha !== env.AUTH_ADMIN_PASSWORD) {
      throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    return { token: env.AUTH_MOCK_TOKEN };
  }

  verifyToken(token?: string): boolean {
    return token === env.AUTH_MOCK_TOKEN;
  }
}
