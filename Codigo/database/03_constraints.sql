alter table public.atendimentos
  add constraint atendimentos_status_check
  check (status in ('ATIVO','ENCERRADO','PENDENTE'));

alter table public.mensagens
  add constraint mensagens_remetente_check
  check (remetente in ('CLIENTE','CHATBOT','ATENDENTE'));

alter table public.mensagens
  add constraint mensagens_direcao_check
  check (direcao in ('ENTRADA','SAIDA'));

alter table public.pedidos
  add constraint pedidos_status_check
  check (status in ('PENDENTE','CONCLUIDO','CANCELADO'));

alter table public.produtos
  add constraint produtos_preco_check
  check (preco >= 0);

alter table public.itens_pedido
  add constraint itens_pedido_quantidade_check
  check (quantidade > 0);

alter table public.itens_pedido
  add constraint itens_pedido_preco_unitario_check
  check (preco_unitario >= 0);
