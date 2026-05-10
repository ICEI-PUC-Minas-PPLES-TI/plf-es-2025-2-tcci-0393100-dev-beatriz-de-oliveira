create table if not exists public.produtos (
  produto_id serial primary key,
  nome varchar(150) not null,
  descricao text,
  preco decimal(10,2) not null,
  disponibilidade boolean not null default true,
  categoria varchar(100),
  criado_em timestamp not null default now(),
  atualizado_em timestamp not null default now()
);

create table if not exists public.pedidos (
  pedido_id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(cliente_id) on delete set null,
  data_criacao timestamp not null default now(),
  valor_total decimal(10,2) not null default 0,
  forma_pagamento varchar(50),
  status varchar(50) not null,
  pago_em timestamp,
  criado_em timestamp not null default now(),
  atualizado_em timestamp not null default now()
);

create table if not exists public.itens_pedido (
  item_id serial primary key,
  pedido_id uuid not null references public.pedidos(pedido_id) on delete cascade,
  produto_id int not null references public.produtos(produto_id) on delete restrict,
  quantidade int not null,
  preco_unitario decimal(10,2) not null,
  criado_em timestamp not null default now()
);

create table if not exists public.regras_cobranca (
  regra_id uuid primary key default gen_random_uuid(),
  nome varchar(100) not null,
  tipo varchar(50) not null,
  valor varchar(100) not null,
  ativo boolean not null default true,
  criado_em timestamp not null default now(),
  atualizado_em timestamp not null default now()
);
