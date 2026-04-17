export interface AuthAdministrator {
  id: number;
  nome: string;
  login: string;
  senha: string;
  permissao: string;
}

export interface BootstrapAdministratorInput {
  nome: string;
  login: string;
  senhaHash: string;
  permissao: string;
}

export interface AuthRepository {
  ensureBootstrapAdministrator(input: BootstrapAdministratorInput): Promise<void>;
  findByLogin(login: string): Promise<AuthAdministrator | null>;
}
