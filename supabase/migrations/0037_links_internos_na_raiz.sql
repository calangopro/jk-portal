-- Post saiu de /guia/<slug> para /<slug>, e o índice de /guia para /dicas.
--
-- O corpo do texto guarda link interno como caminho do App Router, gravado pelo
-- seletor de links do editor. Trinta rascunhos tinham `href="/guia/algo"`, que
-- depois da mudança de rota deixaria de existir: em produção esse endereço nem
-- é do portal, é da loja na Tray, então o link viraria 404 dentro do artigo.
--
-- A troca é literal e fechada em `href="`, então não encosta em link externo
-- (`href="https://...`), em âncora (`href="#...`) nem em texto que por acaso
-- contenha a palavra guia. `href="/guias/` também não casa, porque o padrão
-- exige a barra logo depois de `guia`.
--
-- Conferido antes de escrever: só `contents.body_html` tinha ocorrência.
-- `body_md`, `answer`, `excerpt` e os retratos em `revisions` estavam limpos.

update public.contents
set body_html = replace(body_html, 'href="/guia/', 'href="/')
where body_html like '%href="/guia/%';

-- O índice mudou de endereço junto. Hoje nenhum rascunho aponta para ele, mas a
-- linha fica porque o custo é zero e o estrago de esquecer seria silencioso.
update public.contents
set body_html = replace(body_html, 'href="/guia"', 'href="/dicas"')
where body_html like '%href="/guia"%';
