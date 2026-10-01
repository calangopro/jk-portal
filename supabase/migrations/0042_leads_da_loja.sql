-- O pop-up do grupo na loja (tema Esquenta da Tray) passa a gravar aqui.
--
-- Até 01/10 o pop-up mandava o contato do navegador direto para o RD, e o
-- webhook do painel da Tray estava vazio: quem se cadastrava na loja não
-- chegava à Kommo nem à lista do painel. Agora ele chama `/guias/api/leads`
-- (mesmo domínio, sem CORS) com `origem = 'loja'`, e o portal repassa como faz
-- com a bio e com /grupo. Se o portal não responder, o pop-up volta ao envio
-- antigo, direto para o RD.
--
-- `posicao` é de onde, DENTRO da porta, a pessoa abriu o formulário. Na loja:
-- `popup-tempo`, `popup-saida`, `palco-grupo`, `botao` e afins, os mesmos
-- valores que o tema já manda ao dataLayer em `jk_origem`.

alter table public.leads drop constraint leads_origem_check;
alter table public.leads
  add constraint leads_origem_check check (origem in ('bio', 'grupo', 'loja'));

alter table public.leads add column posicao text check (posicao is null or char_length(posicao) <= 40);
