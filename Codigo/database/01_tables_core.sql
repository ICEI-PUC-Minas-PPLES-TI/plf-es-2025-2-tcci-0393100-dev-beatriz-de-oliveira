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
  interesse_produto varchar(150),
  status varchar(50) not null default 'NOVO',
  origem varchar(50) not null default 'WHATSAPP',
  criado_em timestamp not null default now(),
  atualizado_em timestamp not null default now(),
  constraint leads_status_check check (
    status in ('NOVO','INTERESSADO','ENCAMINHADO_HUMANO','CONVERTIDO','ENCERRADO')
  )
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
  whatsapp_chat_id varchar(100)
);

create table if not exists public.mensagens (
  mensagem_id uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos(atendimento_id) on delete cascade,
  conteudo text,
  data_envio timestamp not null default now(),
  remetente varchar(20) not null,
  whatsapp_message_id varchar(100),
  tipo_mensagem varchar(50) not null default 'text',
  status_entrega varchar(50),
  direcao varchar(20)
);