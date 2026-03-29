[![Open in Codespaces](https://classroom.github.com/assets/launch-codespace-2972f46106e565e64193e422d61a12cf1da4916b45550586e14ef0a7c637dd04.svg)](https://classroom.github.com/open-in-codespaces?assignment_repo_id=20563286)

# TCC — Chatbot de Atendimento via WhatsApp para a Eletro Rádio Esperança

Este projeto tem como objetivo desenvolver um **chatbot de atendimento via WhatsApp**, integrado à **WhatsApp Cloud API** e a um **painel administrativo web**.

A solução automatiza o atendimento digital da loja *Eletro Rádio Esperança*, fornecendo respostas sobre produtos e promoções, reduzindo a sobrecarga da equipe de vendas e permitindo a **geração de leads e automação de processos comerciais**.

---

## 🚀 Tecnologias Utilizadas

- **Node.js** — runtime do backend  
- **TypeScript** — tipagem e organização do código  
- **Fastify** — framework HTTP  
- **PostgreSQL (Supabase)** — banco de dados relacional  
- **React + Vite** — painel administrativo  
- **WhatsApp Cloud API** — canal de comunicação  

---

## 🧩 Arquitetura da Solução

O sistema é dividido em quatro principais módulos:

### 1. Chatbot Core + Integração WhatsApp
- Recebe mensagens via webhook  
- Processa intenções (produtos, promoções, atendimento humano)  
- Mantém estado da conversa  
- Encaminha para vendedor quando necessário  

### 2. Backend (API + Chatbot Core)
- Gerencia produtos, leads e regras de negócio  
- Expõe endpoints REST  
- Controla o fluxo conversacional  
- Integra com o banco de dados  

### 3. Banco de Dados (Supabase/Postgres)
- Armazena produtos, clientes, leads e mensagens  
- Garante consistência dos dados  
- Base relacional do sistema  

### 4. Painel Administrativo
- Gestão de produtos (CRUD)  
- Visualização de leads  
- Controle operacional do sistema  
