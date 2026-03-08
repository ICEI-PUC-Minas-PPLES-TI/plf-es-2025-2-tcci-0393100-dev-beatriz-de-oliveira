insert into public.administrators (nome, login, senha, permissao)
values ('Administrador Principal','admin','admin123','SUPER_ADMIN')
on conflict (login) do nothing;

insert into public.produtos (nome, descricao, preco, disponibilidade, categoria)
values
('Ventilador Mondial 40cm','Ventilador de coluna 40cm',189.90,true,'Ventiladores'),
('Liquidificador Arno 800W','Liquidificador doméstico 800W',249.90,true,'Liquidificadores'),
('Ferro de Passar Philips','Ferro a vapor',139.90,true,'Eletroportáteis')
on conflict do nothing;

insert into public.regras_cobranca (nome, tipo, valor, ativo)
values
('Lembrete 3 dias','REMINDER_DAYS','3',true),
('Mensagem amigável','MESSAGE_TEMPLATE','Olá, identificamos uma pendência em seu pagamento.',true)
on conflict do nothing;