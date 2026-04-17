import { randomUUID } from "node:crypto";
import { pool } from "../config/database.js";
import { container } from "../modules/container.js";

async function cleanupByChatId(chatId: string) {
  const atendimentoIds = await pool.query<{ atendimento_id: string }>(
    `
      SELECT a.atendimento_id::text
      FROM atendimentos a
      LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
      WHERE a.canal = 'TELEGRAM'
        AND (a.whatsapp_chat_id = $1 OR c.telefone = $1)
    `,
    [chatId],
  );

  for (const row of atendimentoIds.rows) {
    await pool.query(`DELETE FROM mensagens WHERE atendimento_id = $1::uuid`, [row.atendimento_id]);
    await pool.query(`DELETE FROM atendimentos WHERE atendimento_id = $1::uuid`, [row.atendimento_id]);
  }

  await pool.query(`DELETE FROM clientes WHERE telefone = $1`, [chatId]);
}

async function run() {
  const chatId = `tg-${Date.now()}`;
  const payload = {
    update_id: Math.floor(Date.now() / 1000),
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      text: `teste telegram persist ${randomUUID().slice(0, 8)}`,
      chat: {
        id: chatId,
        type: "private",
      },
      from: {
        first_name: "Teste",
        last_name: "Telegram",
        username: "teste_telegram",
      },
    },
  };

  await cleanupByChatId(chatId);

  try {
    const result = await container.telegramService.processWebhookEvent(payload);

    const atendimento = await pool.query(
      `
        SELECT
          a.atendimento_id::text,
          a.canal,
          a.status,
          a.ultima_interacao_em,
          a.whatsapp_chat_id,
          c.nome,
          c.telefone
        FROM atendimentos a
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        WHERE a.canal = 'TELEGRAM'
          AND (a.whatsapp_chat_id = $1 OR c.telefone = $1)
        ORDER BY a.ultima_interacao_em DESC NULLS LAST
        LIMIT 1
      `,
      [chatId],
    );

    const mensagens = await pool.query(
      `
        SELECT
          m.mensagem_id::text,
          m.remetente,
          m.direcao,
          m.conteudo,
          m.data_envio
        FROM mensagens m
        INNER JOIN atendimentos a ON a.atendimento_id = m.atendimento_id
        LEFT JOIN clientes c ON c.cliente_id = a.cliente_id
        WHERE a.canal = 'TELEGRAM'
          AND (a.whatsapp_chat_id = $1 OR c.telefone = $1)
        ORDER BY m.data_envio ASC NULLS LAST, m.mensagem_id ASC
      `,
      [chatId],
    );

    console.log(
      JSON.stringify(
        {
          payload,
          result,
          atendimento: atendimento.rows[0] ?? null,
          mensagens: mensagens.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanupByChatId(chatId);
    await pool.end().catch(() => undefined);
  }
}

void run();
