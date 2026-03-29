[![Open in Codespaces](https://classroom.github.com/assets/launch-codespace-2972f46106e565e64193e422d61a12cf1da4916b45550586e14ef0a7c637dd04.svg)](https://classroom.github.com/open-in-codespaces?assignment_repo_id=20563286)

# TCC — Chatbot de Atendimento via WhatsApp para a Eletro Rádio Esperança

Este projeto tem como objetivo desenvolver um **chatbot de atendimento via WhatsApp**, totalmente integrado à **WhatsApp Cloud API** e conectado a um **painel administrativo web**.  
A solução busca **automatizar o atendimento digital** da loja *Eletro Rádio Esperança*, oferecendo respostas consistentes sobre produtos e promoções, reduzindo a sobrecarga da equipe de vendas e possibilitando o **envio automático de lembretes de cobrança**.

O chatbot será implementado diretamente no **backend próprio**, que recebe mensagens por webhooks enviados pela **WhatsApp Cloud API** e envia respostas utilizando os endpoints oficiais da WhatsApp Cloud API 
O sistema utilizará **Supabase/Postgres** como banco de dados relacional para armazenar catálogo, leads, métricas e configurações de cobrança.

O painel administrativo permitirá que gestores e vendedores visualizem métricas, atualizem produtos, gerenciem leads e configurem mensagens de cobrança.

---

## 👤 Integrante da Equipe

- **Beatriz de Oliveira Silveira**

---

## 👨‍🏫 Professores Responsáveis

- **Cleiton Silva Tavares**  
- **Danilo de Quadros Maia Filho**  
- **Leonardo Vilela Cardoso**  
- **Raphael Ramos Dias Costa**

---

# 🧩 Arquitetura da Solução

A arquitetura prevista é composta pelos seguintes módulos:


## 1. Chatbot Core + Integração WhatsApp Cloud API

- Recebe mensagens por meio de webhooks enviados pela Meta  
- Processa regras de atendimento no **Chatbot Core**  
- Consulta o catálogo e gera respostas automáticas  
- Encaminha para atendimento humano quando necessário  
- Envia mensagens de volta ao cliente via **Graph API**  


## 2. Backend da Aplicação (API Backend + Chatbot Core)

- Desenvolvido especificamente para o projeto  
- Gerencia catálogo, leads, métricas, cobranças e interações  
- Expõe endpoints REST consumidos pelo painel administrativo  
- Integração oficial com a **WhatsApp Cloud API**  
- Aplica regras de negócio e controla o fluxo conversacional  


## 3. Banco de Dados — Supabase/Postgres

- Armazena catálogo de produtos  
- Mantém registro de leads, histórico de interações e métricas  
- Guarda configurações e regras de cobrança  
- Acesso exclusivo via camada de persistência do backend  


## 4. Painel Administrativo Web

- Interface para gestão de catálogo e promoções  
- Visualização de métricas básicas  
- Administração de leads  
- Exportação de dados em CSV  
- Configuração e disparo de lembretes de cobrança  
- **Não acessa o banco diretamente**: utiliza somente a API Backend  

---

> Instruções completas de configuração de ambiente, variáveis, endpoints e execução serão adicionadas nas próximas etapas do projeto.




