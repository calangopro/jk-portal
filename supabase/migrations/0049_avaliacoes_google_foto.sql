-- Foto de quem avaliou, para a vitrine da loja parecer a avaliação do Google.
--
-- É o `reviewer.profilePhotoUrl` que a API devolve, um endereço do próprio
-- Google (googleusercontent). Mesmas regras da 0048: cache de no máximo 25
-- dias, regravado a cada leitura. Avaliação anônima fica sem foto.
--
-- `if not exists` de propósito: roda igual antes ou depois da 0048 ter ido
-- para o banco pelo SQL Editor.

alter table public.google_avaliacoes add column if not exists autor_foto text;
