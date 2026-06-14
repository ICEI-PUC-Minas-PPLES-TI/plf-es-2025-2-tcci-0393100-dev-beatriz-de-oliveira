alter table public.leads
  alter column origem set default 'TELEGRAM';

alter table public.atendimentos
  add column if not exists telegram_chat_id varchar(100);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'atendimentos'
      and column_name = 'whatsapp_chat_id'
  ) then
    update public.atendimentos
    set telegram_chat_id = whatsapp_chat_id
    where telegram_chat_id is null
      and whatsapp_chat_id is not null;
  end if;
end $$;

alter table public.mensagens
  add column if not exists telegram_message_id varchar(100);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mensagens'
      and column_name = 'whatsapp_message_id'
  ) then
    update public.mensagens
    set telegram_message_id = whatsapp_message_id
    where telegram_message_id is null
      and whatsapp_message_id is not null;
  end if;
end $$;

drop index if exists public.idx_mensagens_whatsapp_message_id;

create unique index if not exists idx_mensagens_telegram_message_id
  on public.mensagens(telegram_message_id);

alter table public.atendimentos
  drop column if exists whatsapp_chat_id;

alter table public.mensagens
  drop column if exists whatsapp_message_id;
