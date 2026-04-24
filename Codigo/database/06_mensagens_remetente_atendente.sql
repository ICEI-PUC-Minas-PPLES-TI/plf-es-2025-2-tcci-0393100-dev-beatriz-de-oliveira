do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'mensagens_remetente_check'
      and conrelid = 'public.mensagens'::regclass
  ) then
    alter table public.mensagens
      drop constraint mensagens_remetente_check;
  end if;
end
$$;

alter table public.mensagens
  add constraint mensagens_remetente_check
  check (remetente in ('CLIENTE','CHATBOT','ATENDENTE'));
