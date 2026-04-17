# Eletro Rádio Esperança - Painel Administrativo

Painel administrativo moderno e comercial para loja de móveis e eletrodomésticos.

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- Node.js 18+ instalado
- npm ou pnpm

### Instalação e Execução

1. **Clone o repositório** (se ainda não clonou)

2. **Instale as dependências:**
   ```bash
   npm install
   # ou
   pnpm install
   ```

3. **Rode o servidor de desenvolvimento:**
   ```bash
   npm run dev
   # ou
   pnpm dev
   ```

4. **Acesse no navegador:**
   ```
   http://localhost:5173
   ```

### Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Gera build de produção
- `npm run preview` - Preview do build de produção

## 🎨 Características

- **Design Comercial Vibrante**: Interface verde (#10B981) com visual de loja viva
- **Totalmente Responsivo**: Desktop e mobile
- **Navegação Intuitiva**: Sidebar com ícones ilustrativos
- **Componentes Visuais**: Cards grandes, badges coloridos, status visuais
- **Tipografia Moderna**: Fonte Inter

## 🚀 Funcionalidades

### Páginas Implementadas

1. **Login** (`/login`)
   - Autenticação simulada
   - Credenciais: `admin@eletroradio.com` / `senha123`

2. **Dashboard** (`/`)
   - KPIs de leads, vendas e atendimentos
   - Top produtos mais vendidos
   - Atendimentos WhatsApp recentes
   - Filtro por período

3. **Produtos** (`/produtos`)
   - Listagem com imagens
   - Filtros (categoria, preço, disponibilidade)
   - CRUD completo (criar, editar, excluir)
   - Toggle de disponibilidade

4. **Promoções** (`/promocoes`)
   - Grid visual estilo etiquetas
   - Tipos: PROMOCAO e DESTAQUE
   - Filtros por tipo e status
   - Modal para criar/editar

5. **Leads** (`/leads`)
   - Gestão de CRM
   - Status: NOVO, ENCAMINHADO_HUMANO, EM_CONTATO, CONVERTIDO, PERDIDO
   - Filtros e busca
   - Exportação CSV

6. **Métricas** (`/metricas`)
   - Gráficos de vendas e receita (Recharts)
   - Top 5 produtos mais vendidos
   - KPIs de desempenho
   - Filtro por período

7. **Cobranças** (`/cobrancas`)
   - Aba 1: Configuração de regras de cobrança
   - Aba 2: Gestão de pedidos
   - Criação de pedidos com modal
   - Alteração de status

8. **WhatsApp** (`/whatsapp`)
   - Interface de chat em tempo real
   - Lista de atendimentos com filtros
   - Envio de mensagens
   - Encerramento de atendimentos
   - Status: ATIVO, PENDENTE, ENCERRADO

## 🛠️ Tecnologias

- **React 18.3** com TypeScript
- **React Router 7** (Data mode)
- **Tailwind CSS 4**
- **Recharts** (gráficos)
- **Radix UI** (componentes acessíveis)
- **Lucide React** (ícones)
- **Sonner** (notificações toast)
- **date-fns** (manipulação de datas)

## 📦 Componentes Customizados

- **StatusBadge**: Badges coloridos de status
- **KPICard**: Cards de indicadores
- **EmptyState**: Estados vazios amigáveis
- **DateRangePicker**: Seletor de período
- **LoadingSpinner**: Indicador de carregamento

## 🎯 Estrutura de Dados

### Produto
```typescript
{
  id: number;
  nome: string;
  categoria: string;
  descricao: string;
  preco: string;
  imagens: string[];
  disponibilidade: boolean;
}
```

### Promoção
```typescript
{
  id: number;
  produto_id: number;
  tipo: "PROMOCAO" | "DESTAQUE";
  ativa: boolean;
  inicio_em: string;
  fim_em: string;
}
```

### Lead
```typescript
{
  id: number;
  nome: string;
  telefone: string;
  email: string;
  interesse: string;
  status: "NOVO" | "ENCAMINHADO_HUMANO" | "EM_CONTATO" | "CONVERTIDO" | "PERDIDO";
  data_criacao: string;
}
```

### Regra de Cobrança
```typescript
{
  ativa: boolean;
  mensagem_template: string;
  limite_envio_por_dia: string;
  hora_envio: string;
  dias_atraso_min: string;
  dias_atraso_max: string;
}
```

### Pedido
```typescript
{
  id: number;
  telefone_cliente: string;
  valor_total: string;
  forma_pagamento: string;
  status: "PAGO" | "PENDENTE" | "ATRASADO" | "CANCELADO";
  data_vencimento: string;
}
```

### Atendimento
```typescript
{
  id: number;
  cliente: string;
  telefone: string;
  status: "ATIVO" | "PENDENTE" | "ENCERRADO";
  ultima_mensagem: string;
  horario: string;
}
```

### Mensagem
```typescript
{
  id: number;
  tipo: "enviada" | "recebida";
  conteudo: string;
  horario: string;
}
```

## 🔌 Integrações de API (Simuladas)

As seguintes rotas de API estão prontas para integração:

- `POST /auth/login` → Autenticação
- `GET /admin/produtos` → Listar produtos
- `POST /admin/produtos` → Criar produto
- `PUT /admin/produtos/:id` → Atualizar produto
- `DELETE /admin/produtos/:id` → Excluir produto
- `PATCH /admin/produtos/:id/disponibilidade` → Toggle disponibilidade
- `GET /admin/metricas/resumo` → Métricas gerais
- `GET /admin/metricas/top-produtos` → Top produtos
- `GET /admin/atendimentos` → Listar atendimentos
- `POST /admin/atendimentos/:id/mensagens` → Enviar mensagem
- `PATCH /admin/atendimentos/:id/status` → Atualizar status

## 🎨 Paleta de Cores

- **Verde Principal**: #10B981
- **Verde Claro**: #F0FDF4
- **Azul**: #3B82F6
- **Amarelo**: #F59E0B
- **Vermelho**: #EF4444
- **Roxo**: #8B5CF6

## 📱 Responsividade

- **Desktop**: Sidebar fixa + conteúdo principal
- **Mobile**: Menu drawer + layout adaptado
- **Breakpoints**: md (768px) e lg (1024px)

## 🚪 Acesso

**URL**: Acesse `/login` para começar

**Credenciais de teste**:
- Email: `admin@eletroradio.com`
- Senha: `senha123`
