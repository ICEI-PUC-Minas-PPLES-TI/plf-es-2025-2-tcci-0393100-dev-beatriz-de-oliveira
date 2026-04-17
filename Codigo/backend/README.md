# Backend API (TCC)

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run type-check`
- `npm run test:db`
- `npm run smoke:chatbot`
- `npm run smoke:chatbot-concurrency`
- `npm run smoke:billing`

## Env
Use `.env` based on `.env.example`.

### Auth e perfis
- `AUTH_ADMIN_EMAIL` / `AUTH_ADMIN_PASSWORD`: bootstrap do proprietário
- `AUTH_SELLER_EMAIL` / `AUTH_SELLER_PASSWORD`: bootstrap do vendedor
- `AUTH_TOKEN_SECRET`: assinatura dos tokens do painel

### DATABASE_URL
Use the connection string copied directly from Supabase.

Important notes:
- passwords with special characters such as `@`, `:`, `/` or `#` must be URL-encoded
- for Supabase direct connection, prefer `?sslmode=require`
- if Supabase provides a pooler host, it is usually the best option for app connections

Examples:

Direct connection:
`postgresql://postgres:your_password%40here@db.your-project-ref.supabase.co:5432/postgres?sslmode=require`

Pooler connection:
`postgresql://postgres.your-project-ref:your_password%40here@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require`

### WhatsApp Cloud API
To enable real outbound sending, configure:
- `WHATSAPP_META_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_API_VERSION`
- `WHATSAPP_GRAPH_BASE_URL`

Without `WHATSAPP_META_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`, the webhook and inbox still persist incoming and outgoing messages, but manual outbound requests return `WHATSAPP_OUTBOUND_NOT_CONFIGURED`.

## Base URL
`http://localhost:3333`

## Main routes
- `POST /auth/login`
- `GET /products`
- `GET /promotions`
- `GET /leads`
- `GET /metrics` (proprietário)
- `GET /billing-rules`
- `GET /whatsapp/conversations`
- `GET /whatsapp/messages/:atendimentoId`
- `POST /whatsapp/send`
- `GET /webhooks/whatsapp`
- `POST /webhooks/whatsapp`
- `GET /docs`
