# Backend API - Telegram-only

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run type-check`
- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`
- `npm run smoke:billing`
- `npm run test:db`

## Env
Use `.env` baseado em `.env.example`.

Variaveis principais:
- `NODE_ENV`
- `HOST`
- `PORT`
- `FRONTEND_URL`
- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `AUTH_TOKEN_SECRET`
- `AUTH_ADMIN_EMAIL` / `AUTH_ADMIN_PASSWORD`
- `AUTH_SELLER_NAME`
- `AUTH_SELLER_EMAIL` / `AUTH_SELLER_PASSWORD`
- `BILLING_JOB_ENABLED`
- `BILLING_JOB_CRON`

Nao existem variaveis ativas de WhatsApp, Evolution API ou Meta Cloud API nesta versao.

## Database
Use a connection string PostgreSQL/Supabase em `DATABASE_URL`.

Observacoes:
- senhas com caracteres especiais, como `@`, `:`, `/` ou `#`, devem estar URL-encoded;
- use `?sslmode=require` em conexoes Supabase;
- o pooler do Supabase costuma ser a melhor opcao para aplicacao.

Exemplo:
`postgresql://postgres.project-ref:senha%40aqui@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require`

## Base URL
`http://localhost:3333`

## Rotas principais
- `POST /auth/login`
- `GET /products`
- `GET /promotions`
- `GET /leads`
- `GET /metrics`
- `GET /billing-rules`
- `GET /conversations`
- `GET /conversations/:atendimentoId/messages`
- `POST /conversations/:atendimentoId/messages`
- `POST /webhooks/telegram`
- `GET /docs`