import { authStorage, type AuthenticatedUser, type UserRole } from "../lib/auth";
import { httpClient } from "../api/httpClient";
import { API_ENDPOINTS } from "../api/endpoints";

interface LoginInput {
  email: string;
  senha: string;
}

interface LoginResult {
  token: string;
  user: AuthenticatedUser;
}

export const authService = {
  async login({ email, senha }: LoginInput): Promise<LoginResult> {
    const result = await httpClient.post<LoginResult>(API_ENDPOINTS.login, { email, senha });
    authStorage.setToken(result.token);
    authStorage.setUser(result.user);
    return result;
  },
  logout() {
    authStorage.clearToken();
  },
  isAuthenticated() {
    return authStorage.isAuthenticated();
  },
  getCurrentUser() {
    return authStorage.getUser();
  },
  hasRole(role: UserRole) {
    return authStorage.getUser()?.role === role;
  },
};
