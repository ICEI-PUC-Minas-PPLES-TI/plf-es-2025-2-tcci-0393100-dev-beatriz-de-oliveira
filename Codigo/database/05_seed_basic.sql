insert into public.administrators (nome, login, senha, permissao)
values ('Administrador Principal','admin','admin123','SUPER_ADMIN')
on conflict (login) do nothing;

insert into public.produtos (nome, descricao, preco, disponibilidade, categoria)
select seed.nome, seed.descricao, seed.preco, seed.disponibilidade, seed.categoria
from (
  values
    ('Ventilador Mondial 40cm','Ventilador de coluna 40cm',189.90::decimal(10,2),true,'Ventiladores'),
    ('Liquidificador Arno 800W','Liquidificador domestico 800W',249.90::decimal(10,2),true,'Liquidificadores'),
    ('Ferro de Passar Philips','Ferro a vapor',139.90::decimal(10,2),true,'Eletroportateis')
) as seed(nome, descricao, preco, disponibilidade, categoria)
where not exists (
  select 1
  from public.produtos p
  where lower(p.nome) = lower(seed.nome)
);

insert into public.regras_cobranca (nome, tipo, valor, ativo)
select seed.nome, seed.tipo, seed.valor, seed.ativo
from (
  values
    ('Lembrete 3 dias','REMINDER_DAYS','3',true),
    ('Mensagem amigavel','MESSAGE_TEMPLATE','Ola, identificamos uma pendencia em seu pagamento.',true)
) as seed(nome, tipo, valor, ativo)
where not exists (
  select 1
  from public.regras_cobranca r
  where r.tipo = seed.tipo
);
