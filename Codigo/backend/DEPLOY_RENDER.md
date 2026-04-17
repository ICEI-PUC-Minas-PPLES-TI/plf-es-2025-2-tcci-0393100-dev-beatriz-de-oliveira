# Deploy no Render

Backend preparado para deploy com:

- Build: `npm run build`
- Start: `npm start`
- Porta dinamica via `PORT`
- Bind em `0.0.0.0`
- Health check em `/health`
- Webhook Meta em `/webhooks/whatsapp`
- Inbound normalizado em `/webhooks/whatsapp/normalized`

## Configuracao recomendada no Render

- Root Directory: `backend`
- Build Command: `npm install && npm run build`
- Start Command: `npm start`

## Webhook

- Meta: `https://SEU-SERVICO.onrender.com/webhooks/whatsapp`
- Bridge web.js: `https://SEU-SERVICO.onrender.com/webhooks/whatsapp/normalized`
