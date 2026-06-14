alter table public.atendimentos
  drop constraint if exists atendimentos_status_check;

alter table public.atendimentos
  add constraint atendimentos_status_check
  check (status in ('ATIVO','ENCERRADO','PENDENTE'));

alter table public.mensagens
  drop constraint if exists mensagens_remetente_check;

alter table public.mensagens
  add constraint mensagens_remetente_check
  check (remetente in ('CLIENTE','CHATBOT','ATENDENTE'));

alter table public.mensagens
  drop constraint if exists mensagens_direcao_check;

alter table public.mensagens
  add constraint mensagens_direcao_check
  check (direcao in ('ENTRADA','SAIDA'));

alter table public.pedidos
  drop constraint if exists pedidos_status_check;

alter table public.pedidos
  add constraint pedidos_status_check
  check (status in ('PENDENTE','CONCLUIDO','CANCELADO'));

alter table public.produtos
  drop constraint if exists produtos_preco_check;

alter table public.produtos
  add constraint produtos_preco_check
  check (preco >= 0);

alter table public.produtos
  drop constraint if exists produtos_quantidade_check;

alter table public.produtos
  add constraint produtos_quantidade_check
  check (quantidade >= 0);

alter table public.itens_pedido
  drop constraint if exists itens_pedido_quantidade_check;

alter table public.itens_pedido
  add constraint itens_pedido_quantidade_check
  check (quantidade > 0);

alter table public.itens_pedido
  drop constraint if exists itens_pedido_preco_unitario_check;

alter table public.itens_pedido
  add constraint itens_pedido_preco_unitario_check
  check (preco_unitario >= 0);
