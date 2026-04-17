export type UserRole = "PROPRIETARIO" | "VENDEDOR";

export interface AuthenticatedUser {
  id: number;
  nome: string;
  login: string;
  role: UserRole;
}

export interface AuthLoginResult {
  token: string;
  user: AuthenticatedUser;
}
