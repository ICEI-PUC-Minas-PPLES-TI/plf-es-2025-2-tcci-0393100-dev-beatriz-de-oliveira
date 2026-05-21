alter table public.leads drop constraint if exists leads_status_check;

update public.leads
set status = case
  when status = 'INTERESSADO' then 'EM_CONTATO'
  when status = 'ENCAMINHADO_HUMANO' then 'ENCAMINHADO'
  when status = 'ENCERRADO' then 'PERDIDO'
  else status
end;

alter table public.leads
  add constraint leads_status_check
  check (status in ('NOVO','EM_CONTATO','ENCAMINHADO','CONVERTIDO','PERDIDO'));

create table if not exists public.lead_status_history (
  id serial primary key,
  lead_id uuid not null references public.leads(lead_id) on delete cascade,
  old_status varchar(50),
  new_status varchar(50) not null,
  reason varchar(80) not null,
  created_at timestamp not null default now()
);

create index if not exists idx_lead_status_history_lead_id
  on public.lead_status_history(lead_id, created_at desc);
