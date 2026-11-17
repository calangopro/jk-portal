-- Detalhes dos produtos lidos pela API da Tray, para o arquivo de catálogo do
-- Meta e do Google (rotas /api/catalogo/meta.xml e /api/catalogo/google.xml).
--
-- POR QUE
--
-- Em 17/11/2026 o Filipe decidiu tirar da Tray o arquivo que alimenta o
-- catálogo do Meta (a integração "Facebook e Instagram" da Tray caiu em 15/11
-- para todas as lojas). O espelho do catálogo (`products`) vem da busca
-- pública da loja, que entrega preço, disponibilidade e UMA foto, mas não traz
-- o que o arquivo da Tray tem: as outras fotos, a descrição completa, a
-- referência, o GTIN, o peso e as medidas. Tudo isso vem de
-- `GET /products/{id}`, rota da API já homologada (docs/tray-api-de-pedidos.md).
--
-- A API não lista produtos por rota homologada, então a leitura é um produto
-- por chamada. A rotina lê aos poucos (no máximo 40 por rodada) e só relê o
-- que pode ter mudado: produto novo, foto principal diferente da que o
-- espelho tem, ou leitura com mais de três dias. Preço e disponibilidade NÃO
-- moram aqui: continuam vindo de `products`, que a sincronização refaz de
-- quinze em quinze minutos.
--
-- A árvore de categorias da loja também é guardada, porque o tipo do produto
-- no arquivo é o caminho da categoria ("Anéis > Anéis de Formatura > ...") e
-- é a árvore que diz quais produtos entram (docs/catalogo-pelo-painel.md).
--
-- QUEM LÊ
--
-- Ninguém pela chave anônima nem pela sessão: RLS ligada e nenhuma policy. A
-- rota do arquivo e a rotina usam a service_role. O conteúdo é o mesmo que a
-- loja já mostra em público, mas não há motivo para abrir.

create table if not exists public.catalogo_detalhes (
  tray_id text primary key,
  -- false quando a API respondeu que o produto não existe (404).
  encontrado boolean not null default true,
  descricao_html text,
  -- Todas as fotos, na ordem da loja. A primeira é a principal.
  imagens text[] not null default '{}',
  referencia text,
  modelo text,
  ean text,
  -- Gramas e centímetros, como a Tray guarda.
  peso numeric(12, 3),
  comprimento numeric(12, 3),
  largura numeric(12, 3),
  altura numeric(12, 3),
  -- Estoque informado pela API. Não entra no arquivo; fica para quem precisar.
  estoque integer,
  -- `modified` da Tray, como veio.
  modificado_na_loja text,
  lido_em timestamptz not null default now(),
  constraint catalogo_detalhes_tray_id_check check (tray_id ~ '^[0-9]+$')
);

comment on table public.catalogo_detalhes is
  'Detalhes dos produtos lidos por GET /products/{id} da Tray, para o arquivo de catálogo do Meta e do Google. Só a service_role lê e grava.';

create index if not exists catalogo_detalhes_lido_em_idx on public.catalogo_detalhes (lido_em);

alter table public.catalogo_detalhes enable row level security;

create table if not exists public.catalogo_categorias (
  tray_id text primary key,
  nome text not null,
  -- Categoria de cima. Nulo na raiz.
  pai text,
  ativa boolean not null default true,
  lida_em timestamptz not null default now(),
  constraint catalogo_categorias_tray_id_check check (tray_id ~ '^[0-9]+$')
);

comment on table public.catalogo_categorias is
  'Árvore de categorias da loja (web_api/categories/tree), refeita a cada rodada da leitura dos detalhes. Só a service_role lê e grava.';

alter table public.catalogo_categorias enable row level security;
