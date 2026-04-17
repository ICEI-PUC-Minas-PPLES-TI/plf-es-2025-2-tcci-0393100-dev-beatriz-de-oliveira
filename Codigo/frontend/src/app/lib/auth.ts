export type UserRole = "PROPRIETARIO" | "VENDEDOR";

export interface AuthenticatedUser {
  id: number;
  nome: string;
  login: string;
  role: UserRole;
}

export const AUTH_TOKEN_KEY = "token";
export const AUTH_USER_KEY = "auth_user";

export const authStorage = {
  getToken: () => localStorage.getItem(AUTH_TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(AUTH_TOKEN_KEY, token),
  getUser: (): AuthenticatedUser | null => {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AuthenticatedUser;
    } catch {
      localStorage.removeItem(AUTH_USER_KEY);
      return null;
    }
  },
  setUser: (user: AuthenticatedUser) => localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user)),
  clearToken: () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  },
  isAuthenticated: () => Boolean(localStorage.getItem(AUTH_TOKEN_KEY)),
};
