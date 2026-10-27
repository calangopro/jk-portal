-- A contagem por dia da 0043 não sabia de qual QR veio a leitura, e o painel
-- passou a ler `qrcode_resumo` e `qrcode_leituras_diarias` (0044). Esta view
-- ficou de pé até o deploy do painel novo, para a tela antiga não quebrar no
-- meio da troca, e agora sai.
drop view if exists public.qrcode_leituras_por_dia;
