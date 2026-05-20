# Eletro Radio Esperanca - Sistema Telegram-only

Painel administrativo e chatbot Telegram para loja de moveis, eletrodomesticos e eletronicos.

## Estrutura
- `backend/`: API Fastify, chatbot Telegram, produtos, promocoes, leads, cobrancas, pedidos, metricas e suporte.
- `frontend/`: painel administrativo React.
- `database/`: schema, indices, seeds e migrations SQL.

## Como rodar

### Backend
```bash
cd Codigo/backend
npm install
npm run dev
```

API local: `http://localhost:3333`

### Frontend
```bash
cd Codigo/frontend
npm install
npm run dev
```

Painel local: `http://localhost:5173`

## Funcionalidades
- Login administrativo.
- Dashboard e metricas.
- Produtos com multiplas imagens.
- Promocoes.
- Leads Telegram.
- Cobrancas via Telegram.
- Conversas e handoff humano via Telegram.
- Chatbot com catalogo, promocoes, suporte e pos-venda.

## Testes

### Backend
```bash
cd Codigo/backend
npm run test
npm run type-check
npm run build
```

### Frontend
```bash
cd Codigo/frontend
npm run test
npm run type-check
npm run build
npm run test:e2e
```

O E2E espera o frontend disponivel em `http://127.0.0.1:5173`.

## Env
Veja `Codigo/backend/.env.example` e `Codigo/frontend/.env.example`.

A versao final ativa apenas Telegram. Arquivos e variaveis de WhatsApp, Evolution API e Meta Cloud API nao fazem parte do runtime.

## Database
Mantenha as migrations em `Codigo/database` versionadas. Colunas historicas de canal podem permanecer no banco para compatibilidade, mas o codigo ativo usa Telegram.