[![Open in Codespaces](https://classroom.github.com/assets/launch-codespace-2972f46106e565e64193e422d61a12cf1da4916b45550586e14ef0a7c637dd04.svg)](https://classroom.github.com/open-in-codespaces?assignment_repo_id=20563286)

# TCC — Chatbot de Atendimento ao Cliente Integrado a um Painel de Gestão

Este projeto tem como objetivo desenvolver um **chatbot de atendimento via Telegram**, integrado a um **Painel de Gestão web**.

A solução automatiza parte do atendimento digital da loja **Eletro Rádio Esperança**, fornecendo respostas sobre produtos e promoções, reduzindo a sobrecarga da equipe de vendas e permitindo a geração de leads, o acompanhamento de conversas, o gerenciamento de produtos, promoções e pedidos, o controle de cobranças e a visualização de informações gerenciais.

---

## 👤 Integrante da Equipe

- **Beatriz de Oliveira Silveira**

---

## 👨‍🏫 Professores Responsáveis

- **Cleiton Silva Tavares** (TCC 1)
- **Danilo de Quadros Maia Filho** (TCC 1)
- **Leonardo Vilela Cardoso** (TCC 1)
- **Raphael Ramos Dias Costa** (TCC 1)
- **Marco Rodrigo Costa** (TCC 2)

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React, Vite e TypeScript
- **Backend:** Node.js, Fastify e TypeScript
- **Banco de Dados:** Supabase/PostgreSQL
- **Integração Externa:** Telegram Bot API
- **Hospedagem:** Vercel e Render 

---

## 🌐 Acesso ao Sistema

O sistema encontra-se hospedado e pode ser acessado pelos seguintes endereços:

- **Painel de Gestão:** `https://eletro-radio-esperanca.vercel.app/`
- **Chatbot no Telegram:** `@EletroRadio_bot`

---

## ▶️ Instruções de Utilização

O sistema pode ser utilizado por meio da versão hospedada ou pela execução local do projeto.

Para acessar a versão hospedada, utilize os links informados na seção **Acesso ao Sistema**.

Para executar o projeto localmente, é necessário ter instalado:

- Node.js 20 ou superior
- npm
- Conta e projeto configurados no Supabase
- Bot criado no Telegram por meio do BotFather

---

### 1. Clonar este repositório

```bash
git clone <url-do-repositorio>
```

Depois, acesse a pasta do projeto:

```bash
cd <nome-da-pasta-do-projeto>
```

---

### 2. Instalar as dependências

Como o frontend e o backend estão em pastas separadas, é necessário instalar as dependências em cada uma delas.

No backend:

```bash
cd Codigo/backend
npm install
```

No frontend:

```bash
cd Codigo/frontend
npm install
```

---

### 3. Configurar o banco de dados

O sistema utiliza **Supabase/PostgreSQL** como banco de dados.

As migrations SQL estão disponíveis na pasta:

```text
Codigo/database
```

Execute os scripts SQL no Supabase, respeitando a ordem dos arquivos, para criar as tabelas, relacionamentos, índices e dados iniciais necessários para o funcionamento do sistema.

---

### 4. Configurar as variáveis de ambiente

O repositório possui arquivos `.env.example` com as variáveis necessárias para execução do sistema.

#### Backend

Crie um arquivo `.env` dentro da pasta:

```text
Codigo/backend
```

Exemplo de configuração:

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3333

FRONTEND_URL=http://localhost:5173,http://localhost:5174

AUTH_TOKEN_SECRET=change_me_auth_secret

AUTH_ADMIN_EMAIL=admin@eletroradio.com
AUTH_ADMIN_PASSWORD=senha123

AUTH_SELLER_NAME=Vendedor
AUTH_SELLER_EMAIL=vendedor@eletroradio.com
AUTH_SELLER_PASSWORD=senha123

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

BILLING_JOB_ENABLED=true
BILLING_JOB_INTERVAL_MS=60000
BILLING_JOB_TIMEZONE=America/Sao_Paulo

DATABASE_URL=postgresql://postgres:your_password%40here@db.your-project-ref.supabase.co:5432/postgres?sslmode=require
```

As variáveis devem ser preenchidas conforme as credenciais do Supabase, do bot criado no Telegram e das configurações de autenticação do sistema.

#### Frontend

Crie um arquivo `.env` dentro da pasta:

```text
Codigo/frontend
```

Exemplo de configuração:

```env
VITE_API_BASE_URL=http://localhost:3333
VITE_DATA_SOURCE=api
```

---

### 5. Configurar o webhook do Telegram

A integração com o Telegram ocorre por meio de webhook. No backend, o endpoint de entrada utilizado é:

```text
/webhooks/telegram
```

O bot criado no Telegram deve ser configurado para enviar as mensagens recebidas para a URL pública do backend hospedado, utilizando esse caminho de webhook.

Exemplo de URL final:

```text
https://sua-url-do-backend.com/webhooks/telegram
```

Para testes locais com webhook, é necessário expor o backend por uma URL pública, usando uma ferramenta como ngrok ou serviço equivalente.

---

### 6. Executar a aplicação

Em um terminal, execute o backend:

```bash
cd Codigo/backend
npm run dev
```

Em outro terminal, execute o frontend:

```bash
cd Codigo/frontend
npm run dev
```

Após a execução, o **Painel de Gestão** poderá ser acessado pelo navegador no endereço local informado pelo terminal, geralmente:

```text
http://localhost:5173
```

O chatbot poderá ser utilizado diretamente pelo Telegram, por meio do bot configurado para o projeto.

---

## 📄 Observação

Este projeto foi desenvolvido como parte do Trabalho de Conclusão de Curso em Engenharia de Software, tendo como cliente real a loja **Eletro Rádio Esperança**.
