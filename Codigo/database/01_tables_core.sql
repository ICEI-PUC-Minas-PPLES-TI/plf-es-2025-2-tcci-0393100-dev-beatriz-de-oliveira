create table if not exists public.administrators (
  admin_id serial primary key,
  nome varchar(100) not null,
  login varchar(100) not null unique,
  senha varchar(255) not null,
  permissao varchar(50) not null,
  criado_em timestamp not null default now()
);

create table if not exists public.clientes (
  cliente_id uuid primary key default gen_random_uuid(),
  nome varchar(100),
  telefone varchar(20) not null,
  endereco varchar(255),
  criado_em timestamp not null default now(),
  atualizado_em timestamp not null default now()
);

create table if not exists public.leads (
  lead_id uuid primary key default gen_random_uuid(),
  nome varchar(100),
  telefone varchar(20) not null unique,
  interesse_produto text,
  status varchar(50) not null default 'NOVO',
  origem varchar(50) not null default 'TELEGRAM',
  criado_em timestamp not null default now(),
  atualizado_em timestamp not null default now(),
  constraint leads_status_check check (
    status in ('NOVO','EM_CONTATO','ENCAMINHADO','CONVERTIDO','PERDIDO')
  )
);

create table if not exists public.lead_status_history (
  id serial primary key,
  lead_id uuid not null references public.leads(lead_id) on delete cascade,
  old_status varchar(50),
  new_status varchar(50) not null,
  reason varchar(80) not null,
  created_at timestamp not null default now()
);

create table if not exists public.atendimentos (
  atendimento_id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(cliente_id) on delete set null,
  lead_id uuid references public.leads(lead_id) on delete set null,
  canal varchar(50) not null,
  status varchar(50) not null,
  iniciado_em timestamp,
  encerrado_em timestamp,
  encaminhado_humano boolean not null default false,
  ultima_intencao varchar(50),
  estado_conversa varchar(50),
  ultima_interacao_em timestamp,
  telegram_chat_id varchar(100)
);

create table if not exists public.mensagens (
  mensagem_id uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos(atendimento_id) on delete cascade,
  conteudo text,
  data_envio timestamp not null default now(),
  remetente varchar(20) not null,
  telegram_message_id varchar(100),
  tipo_mensagem varchar(50) not null default 'text',
  status_entrega varchar(50),
  direcao varchar(20)
);
