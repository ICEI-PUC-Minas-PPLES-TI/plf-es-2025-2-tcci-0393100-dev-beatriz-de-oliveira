create table if not exists public.product_images (
  image_id bigint generated always as identity primary key,
  product_id integer not null references public.produtos(produto_id) on delete cascade,
  image_url text not null,
  ordem integer not null default 0,
  principal boolean not null default false,
  criado_em timestamp without time zone not null default now()
);

create index if not exists idx_product_images_product_id_ordem
  on public.product_images(product_id, ordem, image_id);

create unique index if not exists idx_product_images_one_primary
  on public.product_images(product_id)
  where principal;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'produtos'
      and column_name = 'imagem'
  ) then
    execute $migration$
      insert into public.product_images (product_id, image_url, ordem, principal)
      select p.produto_id, p.imagem, 0, true
      from public.produtos p
      where nullif(trim(coalesce(p.imagem, '')), '') is not null
        and not exists (
          select 1
          from public.product_images pi
          where pi.product_id = p.produto_id
        )
    $migration$;
  end if;
end $$;
